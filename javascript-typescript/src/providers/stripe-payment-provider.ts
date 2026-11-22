import Stripe from "stripe";
import { createHash } from "node:crypto";
import {
  ConfigurationError,
  PaymentError,
  ProviderError
} from "../errors";
import type {
  PaymentIdRequest,
  PaymentConfirmationRequest,
  PaymentProvider,
  PaymentProviderFactory,
  PaymentRefundRequest,
  PaymentRefundStatusRequest,
  PaymentRequest,
  PaymentVerification,
  ProviderCredentials,
  ProviderPayment,
  ProviderRefund
} from "./payment-provider";
import {
  fromMinorUnits,
  record,
  toMinorUnits
} from "./provider-http";
import type {
  CodsiWebhook,
  PaymentWebhookAdapter,
  PaymentWebhookEvent
} from "./payment-webhook-adapter";
import { WebhookVerificationError } from "../errors";

const defaultTimeoutMs = 15_000;

export interface StripePaymentProviderOptions {
  environment?: "test" | "live";
  timeoutMs?: number;
  apiBaseUrl?: string;
}

export interface StripeWebhookAdapterOptions {
  secret: string;
  toleranceSeconds?: number;
}

function readApiKey(credentials: ProviderCredentials): string {
  const apiKey = credentials.apiKey;
  if (
    typeof apiKey !== "string" ||
    !/^sk_(?:test|live)_[A-Za-z0-9_]+$/.test(apiKey)
  ) {
    throw new ConfigurationError("Stripe secret API key is missing or invalid.");
  }
  return apiKey;
}

function stripeMinorUnits(amount: number, currency: string): number {
  const minorUnits = toMinorUnits(amount, currency);
  if (currency === "ISK" || currency === "UGX") {
    const compatibleAmount = minorUnits * 100;
    if (!Number.isSafeInteger(compatibleAmount)) {
      throw new ProviderError("Stripe payment amount exceeds its supported range.");
    }
    return compatibleAmount;
  }
  return minorUnits;
}

function stripeAmountFromMinorUnits(amount: number, currency: string): number {
  if (currency === "ISK" || currency === "UGX") {
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount % 100 !== 0) {
      throw new ProviderError("Stripe returned an invalid whole-unit currency amount.");
    }
    return amount / 100;
  }
  return fromMinorUnits(amount, currency);
}

function apiOrigin(apiBaseUrl: string | undefined): {
  host?: string;
  port?: string;
  protocol?: "http" | "https";
} {
  if (apiBaseUrl === undefined) {
    return {};
  }
  let url: URL;
  try {
    url = new URL(apiBaseUrl);
  } catch {
    throw new ConfigurationError("Stripe API base URL is invalid.");
  }
  const loopback = url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1";
  if (
    (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new ConfigurationError("Stripe API base URL must be HTTPS, or HTTP on loopback for tests.");
  }
  return {
    host: url.hostname,
    port: url.port || undefined,
    protocol: url.protocol.slice(0, -1) as "http" | "https"
  };
}

function paymentIntentStatus(intent: Stripe.PaymentIntent): ProviderPayment["status"] {
  if (intent.status === "succeeded") {
    return "guuleystay";
  }
  if (intent.status === "canceled") {
    return "joojiyay";
  }
  if (
    intent.status === "requires_payment_method" &&
    intent.last_payment_error !== null &&
    intent.last_payment_error !== undefined
  ) {
    return "fashilmay";
  }
  if (
    intent.status !== "requires_payment_method" &&
    intent.status !== "requires_confirmation" &&
    intent.status !== "requires_action" &&
    intent.status !== "processing" &&
    intent.status !== "requires_capture"
  ) {
    throw new ProviderError("Stripe returned an unsupported PaymentIntent status.");
  }
  return "sugaya";
}

function paymentFromIntent(intent: Stripe.PaymentIntent): ProviderPayment {
  const metadata = record(intent?.metadata) ? intent.metadata : undefined;
  const reference = metadata?.iskubixi_reference;
  if (
    !record(intent) ||
    typeof intent.id !== "string" ||
    intent.id.trim() === "" ||
    !Number.isSafeInteger(intent.amount) ||
    intent.amount <= 0 ||
    typeof intent.currency !== "string" ||
    !/^[a-z]{3}$/.test(intent.currency) ||
    typeof reference !== "string" ||
    reference.trim() === "" ||
    (intent.client_secret !== null &&
      (typeof intent.client_secret !== "string" || intent.client_secret.trim() === ""))
  ) {
    throw new ProviderError("Stripe returned invalid PaymentIntent details.");
  }
  const payment: ProviderPayment = {
    id: intent.id,
    amount: stripeAmountFromMinorUnits(intent.amount, intent.currency.toUpperCase()),
    currency: intent.currency.toUpperCase(),
    reference,
    status: paymentIntentStatus(intent),
    providerStatus: intent.status
  };
  return intent.client_secret !== null &&
    intent.client_secret.trim() !== "" &&
    payment.status === "sugaya"
    ? {
      ...payment,
      nextAction: {
        type: "client_secret",
        clientSecret: intent.client_secret
      }
    }
    : payment;
}

function paymentIntentMissing(error: unknown): boolean {
  return record(error) &&
    error.statusCode === 404 &&
    error.code === "resource_missing";
}

function refundStatus(status: unknown): ProviderRefund["status"] {
  if (status === "succeeded") {
    return "guuleystay";
  }
  if (status === "pending" || status === "requires_action") {
    return "sugaya";
  }
  if (status === "failed" || status === "canceled") {
    return "fashilmay";
  }
  throw new ProviderError("Stripe returned an unsupported refund status.");
}

export class StripePaymentProvider implements PaymentProvider {
  readonly capabilities = Object.freeze({
    paymentCreation: true,
    paymentLookup: true,
    paymentVerification: true,
    paymentConfirmation: true,
    paymentCancellation: true,
    refundCreation: true,
    refundStatusLookup: true,
    paymentIdempotency: true
  });
  readonly #stripe: Stripe;

  constructor(credentials: ProviderCredentials, options: StripePaymentProviderOptions = {}) {
    const apiKey = readApiKey(credentials);
    const environment = options.environment ?? "test";
    if (environment !== "test" && environment !== "live") {
      throw new ConfigurationError("Stripe environment must be test or live.");
    }
    if (environment === "test" && !apiKey.startsWith("sk_test_")) {
      throw new ConfigurationError("Stripe test mode requires a test secret key.");
    }
    if (environment === "live" && !apiKey.startsWith("sk_live_")) {
      throw new ConfigurationError("Stripe live mode requires an explicitly configured live secret key.");
    }
    const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new ConfigurationError("Stripe request timeout must be a positive integer.");
    }
    this.#stripe = new Stripe(apiKey, {
      timeout: timeoutMs,
      maxNetworkRetries: 0,
      telemetry: false,
      ...apiOrigin(options.apiBaseUrl)
    });
  }

  async createPayment(request: PaymentRequest): Promise<ProviderPayment> {
    const amount = stripeMinorUnits(request.amount, request.currency);
    const intent = await this.call("create payment", () =>
      this.#stripe.paymentIntents.create(
        {
          amount,
          currency: request.currency.toLowerCase(),
          automatic_payment_methods: { enabled: true },
          metadata: { iskubixi_reference: request.reference }
        },
        request.idempotencyKey === undefined
          ? undefined
          : { idempotencyKey: request.idempotencyKey }
      )
    );
    if (
      typeof intent.client_secret !== "string" ||
      intent.client_secret.trim() === ""
    ) {
      throw new ProviderError("Stripe PaymentIntent response omitted the client confirmation secret.");
    }
    const payment = paymentFromIntent(intent);
    if (
      payment.amount !== request.amount ||
      payment.currency !== request.currency ||
      payment.reference !== request.reference
    ) {
      throw new ProviderError("Stripe PaymentIntent did not match the payment request.");
    }
    return payment;
  }

  async findPayment(request: PaymentIdRequest): Promise<ProviderPayment | undefined> {
    const intent = await this.call("retrieve payment", () =>
      this.#stripe.paymentIntents.retrieve(request.paymentId)
    , true);
    return intent ? paymentFromIntent(intent) : undefined;
  }

  async confirmPayment(
    request: PaymentConfirmationRequest
  ): Promise<ProviderPayment> {
    const intent = await this.call("confirm payment", () =>
      this.#stripe.paymentIntents.confirm(
        request.paymentId,
        {},
        { idempotencyKey: request.idempotencyKey }
      )
    );
    return paymentFromIntent(intent);
  }

  async cancelPayment(request: PaymentIdRequest): Promise<void> {
    await this.call("cancel payment", () =>
      this.#stripe.paymentIntents.cancel(
        request.paymentId,
        {},
        {
          idempotencyKey: createHash("sha256")
            .update(`iskubixi:stripe:cancel:${request.paymentId}`)
            .digest("hex")
        }
      )
    );
  }

  async verifyPayment(request: PaymentIdRequest): Promise<PaymentVerification> {
    const payment = await this.findPayment(request);
    return payment
      ? { exists: true, payment, source: "adapter" }
      : { exists: false, source: "adapter" };
  }

  async refundPayment(request: PaymentRefundRequest): Promise<ProviderRefund> {
    const refund = await this.call("refund payment", () =>
      this.#stripe.refunds.create(
        { payment_intent: request.paymentId },
        { idempotencyKey: request.idempotencyKey }
      )
    );
    if (typeof refund.id !== "string" || refund.id.trim() === "") {
      throw new ProviderError("Stripe returned an invalid refund ID.");
    }
    return { id: refund.id, status: refundStatus(refund.status) };
  }

  async findRefundStatus(
    request: PaymentRefundStatusRequest
  ): Promise<ProviderRefund | undefined> {
    const refund = await this.call("retrieve refund", () =>
      this.#stripe.refunds.retrieve(request.refundId)
    , true);
    return refund
      ? { id: refund.id, status: refundStatus(refund.status) }
      : undefined;
  }

  private async call<T>(
    operation: string,
    request: () => Promise<T>
  ): Promise<T>;
  private async call<T>(
    operation: string,
    request: () => Promise<T>,
    allowNotFound: true
  ): Promise<T | undefined>;
  private async call<T>(
    operation: string,
    request: () => Promise<T>,
    allowNotFound = false
  ): Promise<T | undefined> {
    try {
      return await request();
    } catch (error) {
      if (allowNotFound && paymentIntentMissing(error)) {
        return undefined;
      }
      throw new ProviderError(`Stripe ${operation} failed.`, {
        context: { provider: "stripe", operation }
      });
    }
  }
}

export class StripePaymentProviderFactory implements PaymentProviderFactory {
  constructor(private readonly options: StripePaymentProviderOptions = {}) {}

  create(credentials: ProviderCredentials): PaymentProvider {
    return new StripePaymentProvider(credentials, this.options);
  }
}

export class StripeWebhookAdapter implements PaymentWebhookAdapter {
  readonly #secret: string;
  readonly #toleranceSeconds: number;

  constructor(options: StripeWebhookAdapterOptions) {
    if (!options || typeof options.secret !== "string" || options.secret.trim() === "") {
      throw new ConfigurationError("Stripe webhook signing secret is required.");
    }
    this.#secret = options.secret;
    this.#toleranceSeconds = options.toleranceSeconds ?? 300;
    if (!Number.isInteger(this.#toleranceSeconds) || this.#toleranceSeconds <= 0) {
      throw new ConfigurationError("Stripe webhook tolerance must be a positive integer.");
    }
  }

  async verifyAndParse(request: CodsiWebhook): Promise<PaymentWebhookEvent> {
    if (
      !request ||
      request.bixiye !== "stripe" ||
      !(request.rawBody instanceof Uint8Array) ||
      request.rawBody.byteLength === 0 ||
      !request.headers ||
      typeof request.headers !== "object" ||
      Array.isArray(request.headers)
    ) {
      throw new WebhookVerificationError("Stripe webhook request is invalid.");
    }
    const signatures = Object.entries(request.headers)
      .filter(([name]) => name.toLowerCase() === "stripe-signature")
      .map(([, value]) => value);
    if (signatures.length !== 1 || typeof signatures[0] !== "string") {
      throw new WebhookVerificationError("Stripe webhook signature header is missing or ambiguous.");
    }

    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(
        Buffer.from(request.rawBody),
        signatures[0],
        this.#secret,
        this.#toleranceSeconds
      );
    } catch {
      throw new WebhookVerificationError("Stripe webhook signature or body is invalid.");
    }
    if (event.type === "payment_intent.succeeded" ||
      event.type === "payment_intent.payment_failed" ||
      event.type === "payment_intent.processing" ||
      event.type === "payment_intent.canceled") {
      const intent = event.data.object;
      let payment: ProviderPayment;
      try {
        payment = paymentFromIntent(intent as Stripe.PaymentIntent);
      } catch {
        throw new WebhookVerificationError("Stripe payment event details are invalid.");
      }
      if (event.type === "payment_intent.payment_failed") {
        payment.status = "fashilmay";
      } else if (event.type === "payment_intent.processing") {
        payment.status = "sugaya";
      }
      return {
        bixiye: "stripe",
        dhacdoId: event.id,
        xaalad: payment.status,
        lacagId: payment.id,
        tixraac: payment.reference,
        qadarka: payment.amount,
        lacagta: payment.currency
      };
    }
    return { bixiye: "stripe", dhacdoId: event.id, laIskaIndhoTiray: true };
  }
}
