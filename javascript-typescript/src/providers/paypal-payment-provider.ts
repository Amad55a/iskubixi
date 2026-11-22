import { createHash } from "node:crypto";
import {
  ConfigurationError,
  PaymentError,
  ProviderError,
  ValidationError
} from "../errors";
import type {
  PaymentConfirmationRequest,
  PaymentIdRequest,
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
  currencyExponent,
  httpsRedirect,
  ProviderHttpClient,
  record,
  toMinorUnits
} from "./provider-http";
import type {
  CodsiWebhook,
  PaymentWebhookAdapter,
  PaymentWebhookEvent
} from "./payment-webhook-adapter";
import { WebhookVerificationError } from "../errors";

export type PayPalEnvironment = "sandbox" | "live";

export interface PayPalPaymentProviderOptions {
  environment: PayPalEnvironment;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface PayPalWebhookAdapterOptions extends PayPalPaymentProviderOptions {
  webhookId: string;
}

interface PayPalRestClientOptions extends PayPalPaymentProviderOptions {
  clientId: string;
  clientSecret: string;
}

interface PayPalOrderDetails {
  payment: ProviderPayment;
  captureId?: string;
}

function readCredentials(credentials: ProviderCredentials): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = credentials.clientId;
  const clientSecret = credentials.clientSecret;
  if (
    typeof clientId !== "string" ||
    clientId.trim() === "" ||
    typeof clientSecret !== "string" ||
    clientSecret.trim() === ""
  ) {
    throw new ConfigurationError("PayPal client ID and client secret are required.");
  }
  return { clientId, clientSecret };
}

function moneyToString(amount: number, currency: string): string {
  const minorUnits = toMinorUnits(amount, currency);
  const exponent = currencyExponent(currency);
  if (exponent === 0) {
    return String(minorUnits);
  }
  const factor = 10 ** exponent;
  const whole = Math.floor(minorUnits / factor);
  const fraction = String(minorUnits % factor).padStart(exponent, "0");
  return `${whole}.${fraction}`;
}

function moneyFromString(value: unknown, currency: string): number {
  if (
    typeof value !== "string" ||
    !/^\d+(?:\.\d+)?$/.test(value)
  ) {
    throw new ProviderError("PayPal returned an invalid order amount.");
  }
  const exponent = currencyExponent(currency);
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > exponent) {
    throw new ProviderError("PayPal returned an amount with unsupported currency precision.");
  }
  const minorUnits = Number(whole) * (10 ** exponent) +
    Number(fraction.padEnd(exponent, "0") || "0");
  if (!Number.isSafeInteger(minorUnits) || minorUnits <= 0) {
    throw new ProviderError("PayPal returned an invalid order amount.");
  }
  return minorUnits / (10 ** exponent);
}

function paymentStatus(
  orderStatus: unknown,
  captureStatus: unknown
): ProviderPayment["status"] {
  if (orderStatus === "VOIDED") {
    return "joojiyay";
  }
  if (orderStatus !== "COMPLETED") {
    if (
      orderStatus === "CREATED" ||
      orderStatus === "SAVED" ||
      orderStatus === "APPROVED" ||
      orderStatus === "PAYER_ACTION_REQUIRED"
    ) {
      return "sugaya";
    }
    throw new ProviderError("PayPal returned an unsupported order status.");
  }
  if (captureStatus === "COMPLETED") {
    return "guuleystay";
  }
  if (captureStatus === "PENDING") {
    return "sugaya";
  }
  if (captureStatus === "DECLINED" || captureStatus === "FAILED") {
    return "fashilmay";
  }
  throw new ProviderError("PayPal completed order response omitted a valid capture status.");
}

function orderDetails(value: unknown): PayPalOrderDetails {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    value.id.trim() === "" ||
    typeof value.status !== "string" ||
    !Array.isArray(value.purchase_units) ||
    !record(value.purchase_units[0])
  ) {
    throw new ProviderError("PayPal returned an invalid order response.");
  }
  const purchaseUnit = value.purchase_units[0];
  const amount = record(purchaseUnit.amount) ? purchaseUnit.amount : undefined;
  const currencyCode = amount?.currency_code;
  if (typeof currencyCode !== "string" || !/^[A-Za-z]{3}$/.test(currencyCode)) {
    throw new ProviderError("PayPal returned invalid order currency details.");
  }
  const currency = currencyCode.toUpperCase();
  const payments = record(purchaseUnit.payments) ? purchaseUnit.payments : undefined;
  const captures = Array.isArray(payments?.captures) ? payments.captures : [];
  const capture = record(captures[0]) ? captures[0] : undefined;
  const captureId = capture?.id;
  const captureStatus = capture?.status;
  const reference = purchaseUnit.reference_id;
  if (typeof reference !== "string" || reference.trim() === "") {
    throw new ProviderError("PayPal order response omitted the payment reference.");
  }
  const payment: ProviderPayment = {
    id: value.id,
    amount: moneyFromString(amount?.value, currency),
    currency,
    reference,
    status: paymentStatus(value.status, captureStatus),
    providerStatus: typeof captureStatus === "string" ? captureStatus : value.status
  };
  const links = Array.isArray(value.links) ? value.links : [];
  const approvalUrl = links
    .filter(record)
    .find((link) => link.rel === "approve" || link.rel === "payer-action");
  const redirectUrl = httpsRedirect(approvalUrl?.href);
  return {
    payment: redirectUrl
      ? { ...payment, nextAction: { type: "redirect", url: redirectUrl } }
      : payment,
    ...(typeof captureId === "string" && captureId.trim() !== ""
      ? { captureId }
      : {})
  };
}

function refundStatus(value: unknown): ProviderRefund["status"] {
  if (value === "COMPLETED") {
    return "guuleystay";
  }
  if (value === "PENDING") {
    return "sugaya";
  }
  if (value === "FAILED" || value === "CANCELLED") {
    return "fashilmay";
  }
  throw new ProviderError("PayPal returned an unsupported refund status.");
}

function requestIdempotencyKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

class PayPalRestClient {
  readonly #clientId: string;
  readonly #clientSecret: string;
  readonly #baseUrl: string;
  readonly #http: ProviderHttpClient;
  #accessToken?: string;
  #accessTokenExpiresAt = 0;
  #tokenRequest?: Promise<string>;

  constructor(options: PayPalRestClientOptions) {
    if (options.environment !== "sandbox" && options.environment !== "live") {
      throw new ConfigurationError("PayPal environment must be sandbox or live.");
    }
    if (!Number.isInteger(options.timeoutMs ?? 15_000) ||
      (options.timeoutMs ?? 15_000) <= 0) {
      throw new ConfigurationError("PayPal request timeout must be a positive integer.");
    }
    this.#clientId = options.clientId;
    this.#clientSecret = options.clientSecret;
    this.#baseUrl = options.environment === "sandbox"
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";
    this.#http = new ProviderHttpClient({
      provider: "paypal",
      fetch: options.fetch,
      timeoutMs: options.timeoutMs
    });
  }

  async requestJson(
    path: string,
    operation: string,
    method: "GET" | "POST",
    body?: Record<string, unknown>,
    idempotencyKey?: string,
    notFoundIsEmpty = false
  ): Promise<unknown | undefined> {
    const token = await this.accessToken();
    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    };
    if (idempotencyKey !== undefined) {
      headers["PayPal-Request-Id"] = requestIdempotencyKey(idempotencyKey);
    }
    return this.#http.requestJson(
      `${this.#baseUrl}${path}`,
      {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      },
      operation,
      notFoundIsEmpty
    );
  }

  private async accessToken(): Promise<string> {
    const now = Date.now();
    if (
      this.#accessToken !== undefined &&
      now < this.#accessTokenExpiresAt
    ) {
      return this.#accessToken;
    }
    if (this.#tokenRequest) {
      return this.#tokenRequest;
    }
    const tokenRequest = this.requestToken();
    this.#tokenRequest = tokenRequest;
    try {
      return await tokenRequest;
    } finally {
      if (this.#tokenRequest === tokenRequest) {
        this.#tokenRequest = undefined;
      }
    }
  }

  private async requestToken(): Promise<string> {
    const encodedCredentials = Buffer.from(
      `${this.#clientId}:${this.#clientSecret}`,
      "utf8"
    ).toString("base64");
    const body = await this.#http.requestJson(
      `${this.#baseUrl}/v1/oauth2/token`,
      {
        method: "POST",
        headers: {
          authorization: `Basic ${encodedCredentials}`,
          "content-type": "application/x-www-form-urlencoded"
        },
        body: "grant_type=client_credentials"
      },
      "obtain access token"
    );
    if (
      !record(body) ||
      typeof body.access_token !== "string" ||
      body.access_token.trim() === "" ||
      typeof body.expires_in !== "number" ||
      !Number.isFinite(body.expires_in) ||
      body.expires_in <= 0
    ) {
      throw new ProviderError("PayPal returned an invalid OAuth access token response.");
    }
    this.#accessToken = body.access_token;
    this.#accessTokenExpiresAt = Date.now() +
      Math.max(0, body.expires_in - 30) * 1000;
    return this.#accessToken;
  }
}

function clientFromCredentials(
  credentials: ProviderCredentials,
  options: PayPalPaymentProviderOptions
): PayPalRestClient {
  return new PayPalRestClient({
    ...readCredentials(credentials),
    ...options
  });
}

export class PayPalPaymentProvider implements PaymentProvider {
  readonly capabilities = Object.freeze({
    paymentCreation: true,
    paymentLookup: true,
    paymentVerification: true,
    paymentConfirmation: true,
    paymentCancellation: false,
    refundCreation: true,
    refundStatusLookup: true,
    paymentIdempotency: true
  });
  readonly #client: PayPalRestClient;

  constructor(credentials: ProviderCredentials, options: PayPalPaymentProviderOptions) {
    if (!options || typeof options !== "object") {
      throw new ConfigurationError("PayPal provider options are required.");
    }
    this.#client = clientFromCredentials(credentials, options);
  }

  async createPayment(request: PaymentRequest): Promise<ProviderPayment> {
    if (request.reference.length > 256) {
      throw new ValidationError("PayPal payment reference cannot exceed 256 characters.");
    }
    const order = await this.#client.requestJson(
      "/v2/checkout/orders",
      "create payment",
      "POST",
      {
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: request.reference,
          amount: {
            currency_code: request.currency,
            value: moneyToString(request.amount, request.currency)
          }
        }]
      },
      request.idempotencyKey
    );
    const details = orderDetails(order);
    if (
      details.payment.amount !== request.amount ||
      details.payment.currency !== request.currency ||
      details.payment.reference !== request.reference
    ) {
      throw new ProviderError("PayPal order did not match the payment request.");
    }
    return details.payment;
  }

  async findPayment(request: PaymentIdRequest): Promise<ProviderPayment | undefined> {
    const order = await this.#client.requestJson(
      `/v2/checkout/orders/${encodeURIComponent(request.paymentId)}`,
      "retrieve payment",
      "GET",
      undefined,
      undefined,
      true
    );
    return order === undefined ? undefined : orderDetails(order).payment;
  }

  async verifyPayment(request: PaymentIdRequest): Promise<PaymentVerification> {
    const payment = await this.findPayment(request);
    return payment
      ? { exists: true, payment, source: "adapter" }
      : { exists: false, source: "adapter" };
  }

  async confirmPayment(request: PaymentConfirmationRequest): Promise<ProviderPayment> {
    const order = await this.#client.requestJson(
      `/v2/checkout/orders/${encodeURIComponent(request.paymentId)}/capture`,
      "capture payment",
      "POST",
      {},
      request.idempotencyKey
    );
    const details = orderDetails(order);
    if (details.payment.id !== request.paymentId) {
      throw new ProviderError("PayPal capture response returned a different order ID.");
    }
    return details.payment;
  }

  async refundPayment(request: PaymentRefundRequest): Promise<ProviderRefund> {
    const order = await this.#client.requestJson(
      `/v2/checkout/orders/${encodeURIComponent(request.paymentId)}`,
      "retrieve payment for refund",
      "GET"
    );
    const details = orderDetails(order);
    if (details.payment.status !== "guuleystay" || details.captureId === undefined) {
      throw new PaymentError("PayPal refunds require a completed capture.");
    }
    const refund = await this.#client.requestJson(
      `/v2/payments/captures/${encodeURIComponent(details.captureId)}/refund`,
      "refund payment",
      "POST",
      {},
      request.idempotencyKey
    );
    if (!record(refund) || typeof refund.id !== "string" || refund.id.trim() === "") {
      throw new ProviderError("PayPal returned an invalid refund response.");
    }
    return { id: refund.id, status: refundStatus(refund.status) };
  }

  async findRefundStatus(
    request: PaymentRefundStatusRequest
  ): Promise<ProviderRefund | undefined> {
    const refund = await this.#client.requestJson(
      `/v2/payments/refunds/${encodeURIComponent(request.refundId)}`,
      "retrieve refund",
      "GET",
      undefined,
      undefined,
      true
    );
    if (refund === undefined) {
      return undefined;
    }
    if (!record(refund) || typeof refund.id !== "string" || refund.id.trim() === "") {
      throw new ProviderError("PayPal returned an invalid refund status response.");
    }
    return { id: refund.id, status: refundStatus(refund.status) };
  }
}

export class PayPalPaymentProviderFactory implements PaymentProviderFactory {
  constructor(private readonly options: PayPalPaymentProviderOptions) {}

  create(credentials: ProviderCredentials): PaymentProvider {
    return new PayPalPaymentProvider(credentials, this.options);
  }
}

function headerValue(
  headers: CodsiWebhook["headers"],
  name: string
): string | undefined {
  const values = Object.entries(headers)
    .filter(([header]) => header.toLowerCase() === name.toLowerCase())
    .map(([, value]) => value);
  return values.length === 1 && typeof values[0] === "string"
    ? values[0]
    : undefined;
}

function safePayPalCertificateUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      [
        "api.paypal.com",
        "api-m.paypal.com",
        "api.sandbox.paypal.com",
        "api-m.sandbox.paypal.com"
      ]
        .includes(url.hostname) &&
      url.username === "" &&
      url.password === "";
  } catch {
    return false;
  }
}

export class PayPalWebhookAdapter implements PaymentWebhookAdapter {
  readonly #client: PayPalRestClient;
  readonly #webhookId: string;

  constructor(credentials: ProviderCredentials, options: PayPalWebhookAdapterOptions) {
    if (
      !options ||
      typeof options.webhookId !== "string" ||
      options.webhookId.trim() === ""
    ) {
      throw new ConfigurationError("PayPal webhook ID is required.");
    }
    this.#client = clientFromCredentials(credentials, options);
    this.#webhookId = options.webhookId;
  }

  async verifyAndParse(request: CodsiWebhook): Promise<PaymentWebhookEvent> {
    if (
      !request ||
      request.bixiye !== "paypal" ||
      !(request.rawBody instanceof Uint8Array) ||
      request.rawBody.byteLength === 0 ||
      !request.headers ||
      typeof request.headers !== "object" ||
      Array.isArray(request.headers)
    ) {
      throw new WebhookVerificationError("PayPal webhook request is invalid.");
    }

    const authAlgo = headerValue(request.headers, "paypal-auth-algo");
    const certUrl = headerValue(request.headers, "paypal-cert-url");
    const transmissionId = headerValue(request.headers, "paypal-transmission-id");
    const transmissionSignature = headerValue(request.headers, "paypal-transmission-sig");
    const transmissionTime = headerValue(request.headers, "paypal-transmission-time");
    if (
      !authAlgo ||
      !certUrl ||
      !safePayPalCertificateUrl(certUrl) ||
      !transmissionId ||
      !transmissionSignature ||
      !transmissionTime
    ) {
      throw new WebhookVerificationError("PayPal webhook signature headers are invalid.");
    }

    let event: unknown;
    try {
      event = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(request.rawBody));
    } catch {
      throw new WebhookVerificationError("PayPal webhook body is invalid.");
    }
    if (
      !record(event) ||
      typeof event.id !== "string" ||
      event.id.trim() === "" ||
      typeof event.event_type !== "string"
    ) {
      throw new WebhookVerificationError("PayPal webhook event envelope is invalid.");
    }

    const verification = await this.#client.requestJson(
      "/v1/notifications/verify-webhook-signature",
      "verify webhook signature",
      "POST",
      {
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSignature,
        transmission_time: transmissionTime,
        webhook_id: this.#webhookId,
        webhook_event: event
      }
    );
    if (!record(verification) || verification.verification_status !== "SUCCESS") {
      throw new WebhookVerificationError("PayPal webhook signature verification failed.");
    }

    if (
      event.event_type !== "PAYMENT.CAPTURE.COMPLETED" &&
      event.event_type !== "PAYMENT.CAPTURE.PENDING" &&
      event.event_type !== "PAYMENT.CAPTURE.DENIED"
    ) {
      return { bixiye: "paypal", dhacdoId: event.id, laIskaIndhoTiray: true };
    }
    if (!record(event.resource)) {
      throw new WebhookVerificationError("PayPal capture webhook resource is invalid.");
    }
    const related = record(event.resource.supplementary_data)
      ? event.resource.supplementary_data
      : undefined;
    const relatedIds = related && record(related.related_ids)
      ? related.related_ids
      : undefined;
    const orderId = relatedIds?.order_id;
    const amount = record(event.resource.amount) ? event.resource.amount : undefined;
    const currency = amount?.currency_code;
    if (
      typeof orderId !== "string" ||
      orderId.trim() === "" ||
      amount === undefined ||
      typeof amount.value !== "string" ||
      typeof currency !== "string" ||
      !/^[A-Za-z]{3}$/.test(currency)
    ) {
      throw new WebhookVerificationError("PayPal capture webhook details are invalid.");
    }
    const paymentStatus = event.event_type === "PAYMENT.CAPTURE.COMPLETED"
      ? "guuleystay"
      : event.event_type === "PAYMENT.CAPTURE.DENIED"
        ? "fashilmay"
        : "sugaya";
    return {
      bixiye: "paypal",
      dhacdoId: event.id,
      xaalad: paymentStatus,
      lacagId: orderId,
      qadarka: moneyFromString(amount.value, currency.toUpperCase()),
      lacagta: currency.toUpperCase()
    };
  }
}
