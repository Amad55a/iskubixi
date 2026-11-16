import { createHmac, timingSafeEqual } from "node:crypto";
import { ConfigurationError, WebhookVerificationError } from "../errors";
import type {
  CodsiWebhook,
  PaymentWebhookAdapter,
  PaymentWebhookEvent,
  VerifiedPaymentWebhookEvent
} from "./payment-webhook-adapter";

const waafiWebhookFreshnessSeconds = 300;

export interface WaafiPayWebhookAdapterOptions {
  secret: string;
  merchantUid: string;
}

function waaWalax(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function madaxKaHel(
  headers: CodsiWebhook["headers"],
  magaca: string
): string | undefined {
  const laHelay: string[] = [];
  for (const [furaha, qiime] of Object.entries(headers)) {
    if (furaha.toLowerCase() !== magaca) {
      continue;
    }
    if (typeof qiime !== "string") {
      return undefined;
    }
    laHelay.push(qiime);
  }

  return laHelay.length === 1 ? laHelay[0] : undefined;
}

export class WaafiPayWebhookAdapter implements PaymentWebhookAdapter {
  readonly #secret: string;
  readonly #merchantUid: string;

  constructor(options: WaafiPayWebhookAdapterOptions) {
    if (
      !options ||
      typeof options.secret !== "string" ||
      options.secret.trim() === "" ||
      typeof options.merchantUid !== "string" ||
      options.merchantUid.trim() === ""
    ) {
      throw new ConfigurationError("WaafiPay webhook secret and merchant UID are required.");
    }

    this.#secret = options.secret;
    this.#merchantUid = options.merchantUid;
  }

  async verifyAndParse(codsi: CodsiWebhook): Promise<PaymentWebhookEvent> {
    if (
      !codsi ||
      codsi.bixiye !== "waafipay" ||
      !(codsi.rawBody instanceof Uint8Array) ||
      codsi.rawBody.byteLength === 0 ||
      !codsi.headers ||
      typeof codsi.headers !== "object" ||
      Array.isArray(codsi.headers)
    ) {
      throw new WebhookVerificationError("WaafiPay webhook request is invalid.");
    }

    const rawBody = Buffer.from(codsi.rawBody);
    const timestamp = madaxKaHel(codsi.headers, "x-webhook-timestamp");
    const eventId = madaxKaHel(codsi.headers, "x-webhook-event-id");
    const signatureAlg = madaxKaHel(codsi.headers, "x-webhook-signature-alg");
    const signature = madaxKaHel(codsi.headers, "x-webhook-signature");

    if (
      !timestamp ||
      !/^\d+$/.test(timestamp) ||
      !Number.isSafeInteger(Number(timestamp)) ||
      !eventId ||
      eventId.trim() === "" ||
      eventId.length > 256 ||
      /[\u0000-\u001f\u007f]/.test(eventId) ||
      signatureAlg !== "HMAC-SHA256" ||
      !signature ||
      !/^[a-f0-9]{64}$/.test(signature)
    ) {
      throw new WebhookVerificationError("WaafiPay webhook signature headers are invalid.");
    }

    const timestampSeconds = Number(timestamp);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestampSeconds) > waafiWebhookFreshnessSeconds) {
      throw new WebhookVerificationError("WaafiPay webhook timestamp is outside the allowed window.");
    }

    const signingPrefix = Buffer.from(`${timestamp}.${eventId}.`, "utf8");
    const expectedSignature = createHmac("sha256", this.#secret)
      .update(Buffer.concat([signingPrefix, rawBody]))
      .digest();
    const receivedSignature = Buffer.from(signature, "hex");
    if (!timingSafeEqual(expectedSignature, receivedSignature)) {
      throw new WebhookVerificationError("WaafiPay webhook signature is invalid.");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody));
    } catch {
      throw new WebhookVerificationError("WaafiPay webhook body is invalid.");
    }

    if (!waaWalax(payload) || payload.merchant_uid !== this.#merchantUid) {
      throw new WebhookVerificationError("WaafiPay webhook merchant is invalid.");
    }
    if (payload.event === "webhook.test") {
      throw new WebhookVerificationError("Unsigned WaafiPay test pings cannot be processed as payment events.");
    }
    if (typeof payload.event !== "string") {
      throw new WebhookVerificationError("WaafiPay webhook event type is invalid.");
    }
    if (
      payload.event !== "authorization" &&
      payload.event !== "declined" &&
      payload.event !== "void"
    ) {
      return {
        bixiye: "waafipay",
        dhacdoId: eventId,
        laIskaIndhoTiray: true
      };
    }
    if (!waaWalax(payload.payment)) {
      throw new WebhookVerificationError("WaafiPay payment webhook data is invalid.");
    }

    const payment = payload.payment;
    if (
      typeof payment.amount !== "number" ||
      !Number.isFinite(payment.amount) ||
      payment.amount <= 0 ||
      typeof payment.currency !== "string" ||
      !/^[A-Z]{3}$/.test(payment.currency)
    ) {
      throw new WebhookVerificationError("WaafiPay payment webhook details are invalid.");
    }

    const paymentId = payload.event === "void"
      ? payment.original_transaction_id
      : payment.transaction_id;
    if (typeof paymentId !== "string" || paymentId.trim() === "") {
      throw new WebhookVerificationError("WaafiPay webhook payment ID is invalid.");
    }
    const lacagId = typeof paymentId === "string" && paymentId !== "0"
      ? paymentId
      : undefined;
    const tixraac = payment.reference_id;
    if (
      (tixraac !== undefined &&
        (typeof tixraac !== "string" || tixraac.trim() === "")) ||
      (lacagId === undefined && tixraac === undefined)
    ) {
      throw new WebhookVerificationError("WaafiPay webhook does not identify a payment.");
    }

    const xaalad = this.statusKaHel(payload.event, payment.status);
    return {
      bixiye: "waafipay",
      dhacdoId: eventId,
      xaalad,
      lacagId,
      tixraac: typeof tixraac === "string" ? tixraac : undefined,
      qadarka: payment.amount,
      lacagta: payment.currency
    };
  }

  private statusKaHel(
    event: unknown,
    status: unknown
  ): VerifiedPaymentWebhookEvent["xaalad"] {
    if (typeof status !== "string") {
      throw new WebhookVerificationError("WaafiPay payment webhook status is invalid.");
    }

    const normalizedStatus = status.toUpperCase();
    if (event === "authorization") {
      if (normalizedStatus === "APPROVED") {
        return "guuleystay";
      }
      if (normalizedStatus === "DECLINED" || normalizedStatus === "FAILED") {
        return "fashilmay";
      }
    } else if (event === "declined") {
      if (normalizedStatus === "DECLINED") {
        return "fashilmay";
      }
      if (normalizedStatus === "CANCELLED") {
        return "joojiyay";
      }
    } else if (event === "void" && normalizedStatus === "CANCELLED") {
      return "joojiyay";
    }

    throw new WebhookVerificationError("WaafiPay webhook event and payment status are unsupported.");
  }
}
