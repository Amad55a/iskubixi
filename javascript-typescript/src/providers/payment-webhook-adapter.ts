import type { Bixiye } from "../types/configuration";
import type { XaaladdaCelin, XaaladdaLacagta } from "../types/payment";

export type WebhookHeaders = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

export interface CodsiWebhook {
  bixiye: Bixiye;
  rawBody: Uint8Array;
  headers: WebhookHeaders;
}

export interface VerifiedPaymentWebhookEvent {
  bixiye: Bixiye;
  dhacdoId: string;
  xaalad: XaaladdaLacagta;
  lacagId?: string;
  tixraac?: string;
  qadarka?: number;
  lacagta?: string;
}

export interface VerifiedRefundWebhookEvent {
  nooca: "celin";
  bixiye: Bixiye;
  dhacdoId: string;
  providerRefundId: string;
  xaalad: XaaladdaCelin;
}

export interface IgnoredPaymentWebhookEvent {
  bixiye: Bixiye;
  dhacdoId: string;
  laIskaIndhoTiray: true;
}

export type PaymentWebhookEvent =
  | VerifiedPaymentWebhookEvent
  | VerifiedRefundWebhookEvent
  | IgnoredPaymentWebhookEvent;

export interface PaymentWebhookAdapter {
  /**
   * Verify the provider-specific signature and return a normalized event.
   * Implementations must authenticate raw bytes before parsing the body.
   */
  verifyAndParse(codsi: CodsiWebhook): Promise<PaymentWebhookEvent>;
}
