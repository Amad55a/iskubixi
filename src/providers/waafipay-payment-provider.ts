import { randomUUID } from "node:crypto";
import {
  ConfigurationError,
  ProviderError,
  UnsupportedOperationError,
  ValidationError
} from "../errors";
import type {
  PaymentIdRequest,
  PaymentProvider,
  PaymentProviderFactory,
  PaymentRequest,
  PaymentVerification,
  ProviderCredentials,
  ProviderPayment
} from "./payment-provider";

const SANDBOX_URL = "https://sandbox.waafipay.com/asm";
const REQUEST_TIMEOUT_MS = 15_000;

export interface WaafiPayPaymentProviderOptions {
  formatTimestamp: () => string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

interface WaafiPayPurchaseRequest {
  schemaVersion: "1.0";
  requestId: string;
  timestamp: string;
  channelName: "WEB";
  serviceName: "API_PURCHASE";
  serviceParams: {
    merchantUid: string;
    apiUserId: string;
    apiKey: string;
    paymentMethod: "MWALLET_ACCOUNT";
    payerInfo: {
      accountNo: string;
    };
    transactionInfo: {
      referenceId: string;
      invoiceId: string;
      amount: string;
      currency: string;
    };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCredentials(credentials: ProviderCredentials): {
  merchantUid: string;
  apiUserId: string;
  apiKey: string;
} {
  const merchantUid = credentials.merchantUid;
  const apiUserId = credentials.apiUserId;
  const apiKey = credentials.apiKey;

  if (
    typeof merchantUid !== "string" ||
    !/^[\s\S]{7,15}$/.test(merchantUid) ||
    merchantUid.trim() === "" ||
    typeof apiUserId !== "string" ||
    !/^[\s\S]{7,15}$/.test(apiUserId) ||
    apiUserId.trim() === "" ||
    typeof apiKey !== "string" ||
    !/^[\s\S]{20,40}$/.test(apiKey) ||
    apiKey.trim() === ""
  ) {
    throw new ConfigurationError("WaafiPay credentials are missing or invalid.");
  }

  return { merchantUid, apiUserId, apiKey };
}

function formatRequestTimestamp(formatTimestamp: () => string): string {
  let timestamp: string;
  try {
    timestamp = formatTimestamp();
  } catch {
    throw new ConfigurationError("WaafiPay request timestamp format is not configured.");
  }

  if (typeof timestamp !== "string" || timestamp.length !== 20) {
    throw new ConfigurationError("WaafiPay request timestamp must be configured as a 20-character value.");
  }

  return timestamp;
}

function createPurchaseRequest(
  credentials: ReturnType<typeof readCredentials>,
  request: PaymentRequest,
  timestamp: string
): WaafiPayPurchaseRequest {
  if (
    !request ||
    typeof request !== "object" ||
    typeof request.amount !== "number" ||
    !Number.isFinite(request.amount) ||
    request.amount <= 0 ||
    typeof request.currency !== "string" ||
    !/^[A-Z]{3}$/.test(request.currency)
  ) {
    throw new ValidationError("WaafiPay payment amount or currency is invalid.");
  }

  if (
    typeof request.accountNumber !== "string" ||
    !/^[1-9]\d{9,19}$/.test(request.accountNumber)
  ) {
    throw new ValidationError("WaafiPay wallet number is invalid.");
  }

  if (!/^[A-Za-z0-9._-]{1,50}$/.test(request.reference)) {
    throw new ValidationError("WaafiPay payment reference is invalid.");
  }

  if (Math.round(request.amount * 100) / 100 !== request.amount) {
    throw new ValidationError("WaafiPay payment amount cannot have more than two decimal places.");
  }

  return {
    schemaVersion: "1.0",
    requestId: randomUUID(),
    timestamp,
    channelName: "WEB",
    serviceName: "API_PURCHASE",
    serviceParams: {
      merchantUid: credentials.merchantUid,
      apiUserId: credentials.apiUserId,
      apiKey: credentials.apiKey,
      paymentMethod: "MWALLET_ACCOUNT",
      payerInfo: {
        accountNo: request.accountNumber
      },
      transactionInfo: {
        referenceId: request.reference,
        invoiceId: request.reference,
        amount: String(request.amount),
        currency: request.currency
      }
    }
  };
}

function mapStatus(state: unknown): ProviderPayment["status"] {
  if (state === "APPROVED") {
    return "guuleystay";
  }
  if (state === "CANCELLED") {
    return "joojiyay";
  }
  if (state === "DECLINED" || state === "FAILED") {
    return "fashilmay";
  }
  return "sugaya";
}

export class WaafiPayPaymentProvider implements PaymentProvider {
  readonly capabilities = Object.freeze({
    paymentCreation: true,
    paymentLookup: false,
    paymentVerification: false,
    paymentCancellation: false,
    refundCreation: false,
    refundStatusLookup: false
  });
  readonly #credentials: ReturnType<typeof readCredentials>;
  readonly #formatTimestamp: () => string;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;

  constructor(credentials: ProviderCredentials, options: WaafiPayPaymentProviderOptions) {
    if (!options || typeof options !== "object") {
      throw new ConfigurationError("WaafiPay provider options are required.");
    }
    this.#credentials = Object.freeze(readCredentials(credentials));
    this.#formatTimestamp = options.formatTimestamp;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;

    if (typeof this.#formatTimestamp !== "function") {
      throw new ConfigurationError("WaafiPay request timestamp format must be configured.");
    }
    if (typeof this.#fetch !== "function") {
      throw new ConfigurationError("Fetch is required to use the WaafiPay sandbox adapter.");
    }
    if (!Number.isInteger(this.#timeoutMs) || this.#timeoutMs <= 0) {
      throw new ConfigurationError("WaafiPay request timeout must be a positive integer.");
    }
  }

  async createPayment(request: PaymentRequest): Promise<ProviderPayment> {
    const timestamp = formatRequestTimestamp(this.#formatTimestamp);
    const payload = createPurchaseRequest(this.#credentials, request, timestamp);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);

    try {
      const response = await this.#fetch(SANDBOX_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new ProviderError("WaafiPay sandbox returned an HTTP error.");
      }

      const body: unknown = await response.json();
      if (!isRecord(body) || !isRecord(body.params)) {
        throw new ProviderError("WaafiPay sandbox returned an invalid response.");
      }

      const transactionId = body.params.transactionId;
      if (typeof transactionId !== "string" || transactionId.trim() === "") {
        throw new ProviderError("WaafiPay sandbox response did not contain a transaction ID.");
      }

      return {
        id: transactionId,
        amount: request.amount,
        currency: request.currency,
        reference: request.reference,
        status: mapStatus(body.params.state)
      };
    } catch {
      throw new ProviderError("WaafiPay sandbox payment request failed.", {
        context: { provider: "waafipay", operation: "create payment" }
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async findPayment(_request: PaymentIdRequest): Promise<ProviderPayment | undefined> {
    throw new UnsupportedOperationError(
      "waafipay",
      "transaction lookup",
      "WaafiPay transaction lookup is unavailable in the supplied official documentation."
    );
  }

  async verifyPayment(_request: PaymentIdRequest): Promise<PaymentVerification> {
    throw new UnsupportedOperationError(
      "waafipay",
      "transaction verification",
      "WaafiPay transaction verification is unavailable in the supplied official documentation."
    );
  }
}

export class WaafiPayPaymentProviderFactory implements PaymentProviderFactory {
  constructor(private readonly options: WaafiPayPaymentProviderOptions) {}

  create(credentials: ProviderCredentials): PaymentProvider {
    return new WaafiPayPaymentProvider(credentials, this.options);
  }
}
