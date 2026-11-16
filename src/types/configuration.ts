import type {
  PaymentProviderFactory,
  ProviderCredentials
} from "../providers/payment-provider";
import type {
  PaymentIdempotencyStore,
  RefundIdempotencyStore
} from "../providers/idempotency-store";
import type { PaymentTransactionStore } from "../providers/payment-transaction-store";
import type { QrPaymentStore } from "../providers/qr-payment-store";
import type { PaymentWebhookAdapter } from "../providers/payment-webhook-adapter";
import type { WebhookEventStore } from "../providers/webhook-event-store";
import type { RefundStore } from "../providers/refund-store";
import type { PaymentStateStore } from "../providers/payment-store";
import type { AmaanoodLaqabsade } from "../providers/amaanood-auth-adapter";
import type { AmaanoodAuthenticationSessionStore } from "../providers/webauthn-store";
import type { PaymentAuthorizationStore } from "../providers/payment-authorization-store";

export type Bixiye = "edahab" | "evc" | "zaad" | "bank" | "waafipay";

export type AqoonsigaBixiyaha = ProviderCredentials;

export interface AmaanoodIskuXir {
  laqabsadayaal: readonly AmaanoodLaqabsade[];
  keydkaKulamada?: AmaanoodAuthenticationSessionStore;
}

export interface IskuBixiQaabeyn {
  bixiyeyaasha: Partial<Record<Bixiye, AqoonsigaBixiyaha>>;
  laqabsadayaasha?: Partial<Record<Bixiye, PaymentProviderFactory>>;
  amaanood?: AmaanoodIskuXir;
  keydkaIdempotency?: PaymentIdempotencyStore;
  keydkaOgolaanshaha?: PaymentAuthorizationStore;
  keydkaCelin?: RefundIdempotencyStore;
  keydkaCelinDiiwaanka?: RefundStore;
  keydkaLacagaha?: PaymentTransactionStore;
  keydkaLacagahaBixiyaha?: PaymentStateStore;
  keydkaQr?: QrPaymentStore;
  laqabsadayaashaWebhook?: Partial<Record<Bixiye, PaymentWebhookAdapter>>;
  keydkaWebhook?: WebhookEventStore;
}
