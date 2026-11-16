import { createHash, randomBytes } from "node:crypto";
import {
  ConfigurationError,
  IdempotencyError,
  IskuBixiError,
  PaymentError,
  ProviderError,
  RefundError,
  StorageError,
  UnsupportedOperationError,
  ValidationError,
  WebAuthnError,
  WebhookVerificationError
} from "./errors";
import type { Bixiye, IskuBixiQaabeyn } from "./types/configuration";
import type {
  AmaanoodHab,
  AmaanoodHabLaXaqiijiyay,
  AmaanoodLaqabsade,
  CodsiAmaanoodBilow,
  CodsiAmaanoodXaqiiji,
  NatiijoAmaanoodBilow,
  NatiijoAmaanoodXaqiiji
} from "./providers/amaanood-auth-adapter";
import type {
  CodsiBixiyeAwood,
  NatiijoBixiyeAwood,
  ProviderCapabilities
} from "./types/provider-capabilities";
import { SimulatedPaymentProvider } from "./providers/simulated-payment-provider";
import { InMemoryPaymentStore } from "./providers/in-memory-payment-store";
import type { PaymentStateStore } from "./providers/payment-store";
import {
  InMemoryPaymentIdempotencyStore,
  InMemoryRefundIdempotencyStore,
  type RefundIdempotencyStore,
  type PaymentIdempotencyStore
} from "./providers/idempotency-store";
import {
  InMemoryPaymentTransactionStore,
  type PaymentTransaction,
  type PaymentRoutingTransactionStore,
  type PaymentExpirationTransactionStore,
  type RefundPaymentTransactionStore,
  type PaymentTransactionStore,
  type WebhookPaymentTransactionStore,
  type WebhookStatusUpdate
} from "./providers/payment-transaction-store";
import {
  InMemoryRefundStore,
  type RefundRecord,
  type RefundStatusUpdate,
  type RefundStore
} from "./providers/refund-store";
import {
  InMemoryQrPaymentStore,
  type QrPaymentRecord,
  type QrPaymentStore,
  type XaaladdaQr
} from "./providers/qr-payment-store";
import type {
  PaymentProvider,
  PaymentProviderFactory,
  ProviderCredentials,
  ProviderPayment,
  ProviderRefund,
  ProviderRefundStatus
} from "./providers/payment-provider";
import {
  InMemoryPaymentAuthorizationStore,
  type PaymentAuthorizationPaymentRequest,
  type PaymentAuthorizationRecord,
  type PaymentAuthorizationStore
} from "./providers/payment-authorization-store";
import {
  InMemoryWebhookEventStore,
  type RecoverableWebhookEventStore,
  type WebhookEventProcessingResult,
  type WebhookEventStore
} from "./providers/webhook-event-store";
import {
  InMemoryAmaanoodAuthenticationSessionStore,
  type AmaanoodAuthenticationSessionStore
} from "./providers/webauthn-store";
import type {
  CodsiWebhook,
  PaymentWebhookAdapter,
  PaymentWebhookEvent,
  VerifiedPaymentWebhookEvent
} from "./providers/payment-webhook-adapter";
import type {
  CodsiLacag,
  CodsiLacagId,
  CodsiCelin,
  CodsiCelinXaalad,
  CodsiLiiskaLacag,
  CodsiQrLacag,
  CodsiQrNuxur,
  CodsiQrTixraac,
  CodsiTijaabiXaalad,
  NatiijoCelin,
  NatiijoLiiskaLacag,
  NatiijoLacag,
  NatiijoLacagLiiska,
  NatiijoQr,
  NatiijoQrXaalad,
  NatiijoQrXaqiijin,
  NatiijoXaqiijin,
  XaaladdaCelin,
  CodsiOgolaanshoAbuur,
  CodsiOgolaanshoXaqiiji,
  CodsiOgolaanshoXaalad,
  NatiijoOgolaanshoAbuur,
  NatiijoOgolaanshoXaqiiji,
  NatiijoOgolaanshoXaalad
} from "./types/payment";
import type {
  CodsiWebhookDibUshaqee,
  CodsiWebhookFashilmay,
  NatiijoWebhookCadee,
  NatiijoWebhookDhacdoFashilmay,
  NatiijoWebhookShaqeeyay
} from "./types/webhook";

const qrPayloadBilow = "iskubixi:qr:v1:";
const qrTixraacHab = /^[A-Za-z0-9_-]{43}$/;

const bixiyeyaashaLaTaageero: ReadonlySet<string> = new Set([
  "edahab",
  "evc",
  "zaad",
  "bank",
  "waafipay"
]);

const hababkaAqoonsiga: ReadonlySet<string> = new Set([
  "waji",
  "faraha",
  "isha",
  "calaacal"
]);
const aqoonsiSessionLifetimeMs = 5 * 60 * 1000;
const paymentAuthorizationLifetimeMs = 5 * 60 * 1000;

function waaHabAqoonsi(value: unknown): value is AmaanoodHab {
  return typeof value === "string" && hababkaAqoonsiga.has(value);
}

function waaHabLaXaqiijiyay(value: unknown): value is AmaanoodHabLaXaqiijiyay {
  return value === "user-verification" || waaHabAqoonsi(value);
}

function waaDiiwaan(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const methodToCapability = {
  createPayment: "paymentCreation",
  findPayment: "paymentLookup",
  verifyPayment: "paymentVerification",
  cancelPayment: "paymentCancellation",
  refundPayment: "refundCreation",
  findRefundStatus: "refundStatusLookup"
} as const;

function waaBixiye(value: unknown): value is Bixiye {
  return typeof value === "string" && bixiyeyaashaLaTaageero.has(value);
}

function waaPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}

function storageFailure(
  storage: string,
  operation: string
): StorageError {
  return new StorageError(`${storage} storage operation "${operation}" failed.`, {
    context: { storage, operation }
  });
}

function ilaaliKeydka<T extends object>(
  storage: T,
  storageName: string,
  preserveSdkErrors: boolean
): T {
  return new Proxy(storage, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property, target);
      if (typeof value !== "function") {
        return value;
      }

      const operation = typeof property === "string" ? property : "unknown";
      return (...args: unknown[]) => {
        let result: unknown;
        try {
          result = Reflect.apply(value, target, args);
        } catch (error) {
          if (preserveSdkErrors && error instanceof IskuBixiError) {
            throw error;
          }
          throw storageFailure(storageName, operation);
        }

        if (!waaPromiseLike(result)) {
          return result;
        }
        return Promise.resolve(result).catch((error: unknown) => {
          if (preserveSdkErrors && error instanceof IskuBixiError) {
            throw error;
          }
          throw storageFailure(storageName, operation);
        });
      };
    }
  });
}

function waaXaaladLacagDhamaad(value: unknown): value is "guuleystay" | "fashilmay" {
  return value === "guuleystay" || value === "fashilmay";
}

function waaXaaladdaLacagta(
  value: unknown
): value is "sugaya" | "guuleystay" | "fashilmay" | "joojiyay" | "dhacay" | "laCeliyay" {
  return (
    value === "sugaya" ||
    value === "guuleystay" ||
    value === "fashilmay" ||
    value === "joojiyay" ||
    value === "dhacay" ||
    value === "laCeliyay"
  );
}

function waaXaaladdaWebhook(
  value: unknown
): value is Exclude<NatiijoLacag["xaalad"], "dhacay" | "laCeliyay"> {
  return (
    value === "sugaya" ||
    value === "guuleystay" ||
    value === "fashilmay" ||
    value === "joojiyay"
  );
}

function waaNatiijadaCelin(value: unknown): value is ProviderRefund {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return (
    "id" in value &&
    typeof value.id === "string" &&
    value.id.trim() !== "" &&
    "status" in value &&
    waaXaaladdaProviderCelin(value.status)
  );
}

function waaNatiijadaLacag(value: unknown): value is ProviderPayment {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return (
    "id" in value &&
    typeof value.id === "string" &&
    value.id.trim() !== "" &&
    "amount" in value &&
    typeof value.amount === "number" &&
    Number.isFinite(value.amount) &&
    value.amount > 0 &&
    "currency" in value &&
    typeof value.currency === "string" &&
    /^[A-Z]{3}$/.test(value.currency) &&
    "reference" in value &&
    typeof value.reference === "string" &&
    value.reference.trim() !== "" &&
    "status" in value &&
    waaXaaladdaLacagta(value.status)
  );
}

function waaXaaladdaProviderCelin(value: unknown): value is ProviderRefundStatus {
  return value === "sugaya" || value === "guuleystay" || value === "fashilmay";
}

function waaTaariikhISO(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    return false;
  }

  const taariikh = value.slice(0, 10);
  return new Date(`${taariikh}T00:00:00.000Z`).toISOString().slice(0, 10) === taariikh;
}

function waaAqoonsiBixiye(value: unknown): value is ProviderCredentials {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const credentials = Object.entries(value);
  return credentials.length > 0 && credentials.every(
    ([magac, qiime]) =>
      magac.trim() !== "" &&
      typeof qiime === "string" &&
      qiime.trim() !== ""
  );
}

function waaWarshadLaqabsade(value: unknown): value is PaymentProviderFactory {
  return (
    typeof value === "object" &&
    value !== null &&
    "create" in value &&
    typeof value.create === "function"
  );
}

function waaAwoodahaLaqabsade(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const allowed = new Set([
    "paymentCreation",
    "paymentLookup",
    "paymentVerification",
    "paymentCancellation",
    "refundCreation",
    "refundStatusLookup",
    "paymentIdempotency",
    "paymentIdempotency"
  ]);
  return Object.entries(value).every(
    ([name, enabled]) => allowed.has(name) && typeof enabled === "boolean"
  );
}

function waaLaqabsadeBixiye(value: unknown): value is PaymentProvider {
  return (
    typeof value === "object" &&
    value !== null &&
    "createPayment" in value &&
    typeof value.createPayment === "function" &&
    "findPayment" in value &&
    typeof value.findPayment === "function" &&
    "verifyPayment" in value &&
    typeof value.verifyPayment === "function" &&
    (!("capabilities" in value) || waaAwoodahaLaqabsade(value.capabilities)) &&
    (
      !("refundPayment" in value) ||
      value.refundPayment === undefined ||
      typeof value.refundPayment === "function"
    ) &&
    (
      !("findRefundStatus" in value) ||
      value.findRefundStatus === undefined ||
      typeof value.findRefundStatus === "function"
    )
  );
}

function waaKeydkaCelin(value: unknown): value is RefundStore {
  return (
    typeof value === "object" &&
    value !== null &&
    "save" in value &&
    typeof value.save === "function" &&
    "findById" in value &&
    typeof value.findById === "function" &&
    "findByProviderRefundId" in value &&
    typeof value.findByProviderRefundId === "function" &&
    "findByPaymentId" in value &&
    typeof value.findByPaymentId === "function" &&
    "applyWebhookStatus" in value &&
    typeof value.applyWebhookStatus === "function"
  );
}

function waaLaqabsadeWebhook(value: unknown): value is PaymentWebhookAdapter {
  return (
    typeof value === "object" &&
    value !== null &&
    "verifyAndParse" in value &&
    typeof value.verifyAndParse === "function"
  );
}

function waaKeydkaWebhookLacagaha(
  value: PaymentTransactionStore
): value is WebhookPaymentTransactionStore {
  return (
    waaKeydkaDhacaya(value) &&
    "findByReference" in value &&
    typeof value.findByReference === "function" &&
    "applyWebhookStatus" in value &&
    typeof value.applyWebhookStatus === "function"
  );
}

function waaKeydkaWebhookSooKabasho(
  value: WebhookEventStore
): value is RecoverableWebhookEventStore {
  return (
    "get" in value &&
    typeof value.get === "function" &&
    "listFailed" in value &&
    typeof value.listFailed === "function"
  );
}

function waaKeydkaDhacaya(
  value: PaymentTransactionStore
): value is PaymentExpirationTransactionStore {
  return (
    "findById" in value &&
    typeof value.findById === "function" &&
    "expireDue" in value &&
    typeof value.expireDue === "function"
  );
}

function waaKeydkaCelinLacagaha(
  value: PaymentTransactionStore
): value is RefundPaymentTransactionStore {
  return "findById" in value && typeof value.findById === "function";
}

function waaKeydkaRoutingLacagaha(
  value: PaymentTransactionStore
): value is PaymentRoutingTransactionStore {
  return "findPaymentById" in value && typeof value.findPaymentById === "function";
}

function waaKeydkaXaaladdaBixiyaha(value: unknown): value is PaymentStateStore {
  return (
    typeof value === "object" &&
    value !== null &&
    "save" in value &&
    typeof value.save === "function" &&
    "findById" in value &&
    typeof value.findById === "function" &&
    "updateStatus" in value &&
    typeof value.updateStatus === "function" &&
    "refund" in value &&
    typeof value.refund === "function"
  );
}

export class IskuBixi {
  #paymentProviders: ReadonlyMap<Bixiye, PaymentProvider>;
  #idempotencyStore: PaymentIdempotencyStore;
  #refundIdempotencyStore: RefundIdempotencyStore;
  #refundStore: RefundStore;
  #transactionStore: PaymentTransactionStore;
  #qrStore: QrPaymentStore;
  #webhookAdapters: ReadonlyMap<Bixiye, PaymentWebhookAdapter>;
  #providerCapabilities: ReadonlyMap<Bixiye, ProviderCapabilities>;
  #providersWithIdempotency: ReadonlySet<Bixiye>;
  #webhookEventStore: WebhookEventStore;
  #authenticationAdapters: ReadonlyMap<string, AmaanoodLaqabsade>;
  #authenticationAdaptersByMethod: ReadonlyMap<AmaanoodHab, AmaanoodLaqabsade>;
  #authenticationSessionStore: AmaanoodAuthenticationSessionStore;
  #paymentAuthorizationStore: PaymentAuthorizationStore;
  #qrCancellationOperations = new Map<string, Promise<NatiijoQr>>();
  #paymentProvidersByPaymentId = new Map<
    string,
    {
      bixiye: Bixiye;
      laqabsade: PaymentProvider;
      furahaIdempotencyHash?: string;
      codsiIdempotencyFingerprint?: string;
      laAbuuray: string;
      dhacayaa?: string;
    }
  >();

  readonly lacag = {
    samee: (codsi: CodsiLacag): Promise<NatiijoLacag> =>
      this.apiCall(() => this.lacagSamee(codsi), (message) => new PaymentError(message)),
    xaalad: (codsi: CodsiLacagId): Promise<NatiijoLacag> =>
      this.apiCall(() => this.lacagXaalad(codsi), (message) => new PaymentError(message)),
    cadee: (codsi: CodsiLacagId): Promise<NatiijoXaqiijin> =>
      this.apiCall(() => this.lacagCadee(codsi), (message) => new PaymentError(message)),
    celi: (codsi: CodsiCelin): Promise<NatiijoCelin> =>
      this.apiCall(() => this.lacagCeli(codsi), (message) => new RefundError(message)),
    celintaXaalad: (codsi: CodsiCelinXaalad): Promise<NatiijoCelin> =>
      this.apiCall(() => this.lacagCelinXaalad(codsi), (message) => new RefundError(message)),
    liiska: (codsi?: CodsiLiiskaLacag): Promise<NatiijoLiiskaLacag> =>
      this.apiCall(() => this.lacagLiiska(codsi), (message) => new PaymentError(message)),
    tijaabiXaalad: (codsi: CodsiTijaabiXaalad): Promise<NatiijoLacag> =>
      this.apiCall(() => this.lacagTijaabiXaalad(codsi), (message) => new PaymentError(message)),
    ogolaanshoAbuur: (codsi: CodsiOgolaanshoAbuur): Promise<NatiijoOgolaanshoAbuur> =>
      this.apiCall(
        () => this.ogolaanshoAbuur(codsi),
        (message) => new PaymentError(message)
      ),
    ogolaanshoXaqiiji: (
      codsi: CodsiOgolaanshoXaqiiji
    ): Promise<NatiijoOgolaanshoXaqiiji> =>
      this.apiCall(
        () => this.ogolaanshoXaqiiji(codsi),
        (message) => new PaymentError(message)
      ),
    ogolaanshoXaalad: (
      codsi: CodsiOgolaanshoXaalad
    ): Promise<NatiijoOgolaanshoXaalad> =>
      this.apiCall(
        () => this.ogolaanshoXaalad(codsi),
        (message) => new PaymentError(message)
      )
  };

  readonly qr = {
    samee: (codsi: CodsiQrLacag): Promise<NatiijoQr> =>
      this.apiCall(() => this.qrSamee(codsi), (message) => new PaymentError(message)),
    cadee: (codsi: CodsiQrTixraac): Promise<NatiijoQrXaqiijin> =>
      this.apiCall(() => this.qrCadee(codsi), (message) => new PaymentError(message)),
    akhriso: (codsi: CodsiQrNuxur): Promise<NatiijoQrXaqiijin> =>
      this.apiCall(() => this.qrAkhriso(codsi), (message) => new PaymentError(message)),
    xaalad: (codsi: CodsiQrTixraac): Promise<NatiijoQrXaalad> =>
      this.apiCall(() => this.qrXaalad(codsi), (message) => new PaymentError(message)),
    jooji: (codsi: CodsiQrTixraac): Promise<NatiijoQr> =>
      this.apiCall(() => this.qrJooji(codsi), (message) => new PaymentError(message)),
    xog: (codsi: CodsiQrTixraac): Promise<NatiijoQr> =>
      this.apiCall(() => this.qrXog(codsi), (message) => new PaymentError(message))
  };

  readonly webhook = {
    cadee: (codsi: CodsiWebhook): Promise<NatiijoWebhookCadee> =>
      this.apiCall(() => this.webhookCadee(codsi), (message) => new WebhookVerificationError(message)),
    kaShaqee: (codsi: CodsiWebhook): Promise<NatiijoWebhookShaqeeyay> =>
      this.apiCall(() => this.webhookKaShaqee(codsi), (message) => new WebhookVerificationError(message)),
    fashilmay: (
      codsi?: CodsiWebhookFashilmay
    ): Promise<readonly NatiijoWebhookDhacdoFashilmay[]> =>
      this.apiCall(() => this.webhookFashilmay(codsi), (message) => new StorageError(message)),
    dibUshaqee: (
      codsi: CodsiWebhookDibUshaqee
    ): Promise<NatiijoWebhookShaqeeyay> =>
      this.apiCall(() => this.webhookDibUshaqee(codsi), (message) => new WebhookVerificationError(message))
  };

  readonly bixiye = {
    awood: (codsi: CodsiBixiyeAwood): Promise<NatiijoBixiyeAwood> =>
      this.apiCall(() => this.bixiyeAwood(codsi), (message) => new ValidationError(message))
  };

  readonly amaanood = {
    waji: (request: CodsiAmaanoodBilow): Promise<NatiijoAmaanoodBilow> =>
      this.apiCall(
        () => this.bilowAqoonsi("waji", request),
        (message) => new WebAuthnError(message)
      ),
    faraha: (request: CodsiAmaanoodBilow): Promise<NatiijoAmaanoodBilow> =>
      this.apiCall(
        () => this.bilowAqoonsi("faraha", request),
        (message) => new WebAuthnError(message)
      ),
    isha: (request: CodsiAmaanoodBilow): Promise<NatiijoAmaanoodBilow> =>
      this.apiCall(
        () => this.bilowAqoonsi("isha", request),
        (message) => new WebAuthnError(message)
      ),
    calaacal: (request: CodsiAmaanoodBilow): Promise<NatiijoAmaanoodBilow> =>
      this.apiCall(
        () => this.bilowAqoonsi("calaacal", request),
        (message) => new WebAuthnError(message)
      ),
    xaqiiji: (request: CodsiAmaanoodXaqiiji): Promise<NatiijoAmaanoodXaqiiji> =>
      this.apiCall(
        () => this.xaqiijiAqoonsi(request),
        (message) => new WebAuthnError(message)
      )
  };

  constructor(qaabeyn: IskuBixiQaabeyn) {
    if (
      !qaabeyn ||
      typeof qaabeyn !== "object" ||
      Array.isArray(qaabeyn)
    ) {
      throw new ConfigurationError("SDK configuration must be an object.");
    }

    const bixiyeyaasha = qaabeyn.bixiyeyaasha;

    if (!bixiyeyaasha || typeof bixiyeyaasha !== "object" || Array.isArray(bixiyeyaasha)) {
      throw new ConfigurationError("Ugu yaraan hal bixiye waa in la qaabeeyaa.");
    }

    const bixiyeyaashaLaQaabeeyay: Bixiye[] = [];
    const aqoonsiyadaBixiyeyaasha = new Map<Bixiye, ProviderCredentials>();
    const entries = Object.entries(bixiyeyaasha);
    if (entries.length === 0) {
      throw new ConfigurationError("Ugu yaraan hal bixiye waa in la qaabeeyaa.");
    }

    const keydkaIdempotency =
      qaabeyn.keydkaIdempotency ?? new InMemoryPaymentIdempotencyStore();
    if (
      typeof keydkaIdempotency !== "object" ||
      keydkaIdempotency === null ||
      typeof keydkaIdempotency.getOrCreate !== "function"
    ) {
      throw new ConfigurationError("Idempotency storage must implement getOrCreate.");
    }

    const keydkaCelin =
      qaabeyn.keydkaCelin ?? new InMemoryRefundIdempotencyStore();
    if (
      typeof keydkaCelin !== "object" ||
      keydkaCelin === null ||
      typeof keydkaCelin.get !== "function" ||
      typeof keydkaCelin.getOrCreate !== "function"
    ) {
      throw new ConfigurationError("Refund idempotency storage must implement getOrCreate.");
    }

    const keydkaCelinDiiwaanka =
      qaabeyn.keydkaCelinDiiwaanka ?? new InMemoryRefundStore();
    if (!waaKeydkaCelin(keydkaCelinDiiwaanka)) {
      throw new ConfigurationError("Refund storage must implement the RefundStore contract.");
    }

    const keydkaLacagaha =
      qaabeyn.keydkaLacagaha ?? new InMemoryPaymentTransactionStore();
    if (
      typeof keydkaLacagaha !== "object" ||
      keydkaLacagaha === null ||
      typeof keydkaLacagaha.save !== "function" ||
      typeof keydkaLacagaha.list !== "function"
    ) {
      throw new ConfigurationError("Transaction storage must implement save and list.");
    }

    const keydkaQr = qaabeyn.keydkaQr ?? new InMemoryQrPaymentStore();
    if (
      typeof keydkaQr !== "object" ||
      keydkaQr === null ||
      typeof keydkaQr.create !== "function" ||
      typeof keydkaQr.find !== "function" ||
      typeof keydkaQr.findByPaymentId !== "function" ||
      typeof keydkaQr.cancel !== "function"
    ) {
      throw new ConfigurationError("QR storage must implement create, find, findByPaymentId, and cancel.");
    }

    const keydkaWebhook = qaabeyn.keydkaWebhook ?? new InMemoryWebhookEventStore();
    if (
      typeof keydkaWebhook !== "object" ||
      keydkaWebhook === null ||
      typeof keydkaWebhook.processOnce !== "function"
    ) {
      throw new ConfigurationError("Webhook storage must implement processOnce.");
    }

    const keydkaLacagahaBixiyaha =
      qaabeyn.keydkaLacagahaBixiyaha ?? new InMemoryPaymentStore();
    if (!waaKeydkaXaaladdaBixiyaha(keydkaLacagahaBixiyaha)) {
      throw new ConfigurationError(
        "Provider payment storage must implement save, findById, updateStatus, and refund."
      );
    }

    const adapters = qaabeyn.amaanood?.laqabsadayaal ?? [];
    if (
      qaabeyn.amaanood !== undefined &&
      (
        typeof qaabeyn.amaanood !== "object" ||
        qaabeyn.amaanood === null ||
        Array.isArray(qaabeyn.amaanood) ||
        !Array.isArray(qaabeyn.amaanood.laqabsadayaal)
      )
    ) {
      throw new ConfigurationError("Authentication adapters must be configured as a list.");
    }

    const authenticationAdapters = new Map<string, AmaanoodLaqabsade>();
    const authenticationAdaptersByMethod = new Map<AmaanoodHab, AmaanoodLaqabsade>();
    for (const adapter of adapters) {
      if (
        !waaDiiwaan(adapter) ||
        typeof adapter.id !== "string" ||
        adapter.id.trim() === "" ||
        adapter.id.length > 128 ||
        !Array.isArray(adapter.supportedMethods) ||
        adapter.supportedMethods.length === 0 ||
        typeof adapter.start !== "function" ||
        typeof adapter.verify !== "function" ||
        (
          adapter.supportsPaymentAuthorization !== undefined &&
          typeof adapter.supportsPaymentAuthorization !== "boolean"
        ) ||
        authenticationAdapters.has(adapter.id)
      ) {
        throw new ConfigurationError("An authentication adapter does not implement its contract.");
      }

      for (const method of adapter.supportedMethods) {
        if (
          !waaHabAqoonsi(method) ||
          authenticationAdaptersByMethod.has(method)
        ) {
          throw new ConfigurationError(
            "Authentication methods must be valid and may be assigned to only one adapter."
          );
        }
        authenticationAdaptersByMethod.set(method, adapter);
      }
      authenticationAdapters.set(adapter.id, adapter);
    }

    const keydkaAqoonsiga =
      qaabeyn.amaanood?.keydkaKulamada ??
      new InMemoryAmaanoodAuthenticationSessionStore();
    if (
      typeof keydkaAqoonsiga !== "object" ||
      keydkaAqoonsiga === null ||
      typeof keydkaAqoonsiga.create !== "function" ||
      typeof keydkaAqoonsiga.consume !== "function"
    ) {
      throw new ConfigurationError(
        "Authentication session storage must implement create and consume."
      );
    }

    const keydkaOgolaanshaha =
      qaabeyn.keydkaOgolaanshaha ??
      new InMemoryPaymentAuthorizationStore();
    if (
      typeof keydkaOgolaanshaha !== "object" ||
      keydkaOgolaanshaha === null ||
      typeof keydkaOgolaanshaha.create !== "function" ||
      typeof keydkaOgolaanshaha.claimForVerification !== "function" ||
      typeof keydkaOgolaanshaha.markVerificationFailure !== "function" ||
      typeof keydkaOgolaanshaha.markAuthorized !== "function" ||
      typeof keydkaOgolaanshaha.claimForProcessing !== "function" ||
      typeof keydkaOgolaanshaha.recordPaymentCreation !== "function" ||
      typeof keydkaOgolaanshaha.markReconciliationRequired !== "function" ||
      typeof keydkaOgolaanshaha.findById !== "function"
    ) {
      throw new ConfigurationError(
        "Payment authorization storage does not implement its atomic store contract."
      );
    }

    for (const [bixiye, aqoonsi] of entries) {
      if (!waaBixiye(bixiye)) {
        throw new ConfigurationError(`Bixiyaha "${bixiye}" lama taageero.`);
      }

      if (aqoonsi === undefined) {
        continue;
      }

      if (!waaAqoonsiBixiye(aqoonsi)) {
        throw new ConfigurationError(`Qaabeynta bixiyaha "${bixiye}" waa khalad.`);
      }

      bixiyeyaashaLaQaabeeyay.push(bixiye);
      aqoonsiyadaBixiyeyaasha.set(bixiye, Object.freeze({ ...aqoonsi }));
    }

    if (bixiyeyaashaLaQaabeeyay.length === 0) {
      throw new ConfigurationError("Ugu yaraan hal bixiye waa in la qaabeeyaa.");
    }

    const laqabsadayaasha = qaabeyn.laqabsadayaasha;
    if (
      laqabsadayaasha !== undefined &&
      (typeof laqabsadayaasha !== "object" || laqabsadayaasha === null || Array.isArray(laqabsadayaasha))
    ) {
      throw new ConfigurationError("Provider adapters must be configured as a provider map.");
    }

    for (const [bixiye, laqabsade] of Object.entries(laqabsadayaasha ?? {})) {
      if (!waaBixiye(bixiye)) {
        throw new ConfigurationError(`Provider adapter "${bixiye}" is unsupported.`);
      }

      if (!bixiyeyaashaLaQaabeeyay.includes(bixiye)) {
        throw new ConfigurationError(`Provider adapter "${bixiye}" has no matching provider configuration.`);
      }

      if (!waaWarshadLaqabsade(laqabsade)) {
        throw new ConfigurationError(`Provider adapter "${bixiye}" does not implement the required contract.`);
      }
    }

    const laqabsadayaashaWebhook = qaabeyn.laqabsadayaashaWebhook;
    if (
      laqabsadayaashaWebhook !== undefined &&
      (
        typeof laqabsadayaashaWebhook !== "object" ||
        laqabsadayaashaWebhook === null ||
        Array.isArray(laqabsadayaashaWebhook)
      )
    ) {
      throw new ConfigurationError("Webhook adapters must be configured as a provider map.");
    }

    const webhookAdapters = new Map<Bixiye, PaymentWebhookAdapter>();
    for (const [bixiye, laqabsade] of Object.entries(laqabsadayaashaWebhook ?? {})) {
      if (!waaBixiye(bixiye)) {
        throw new ConfigurationError(`Webhook adapter "${bixiye}" is unsupported.`);
      }
      if (!bixiyeyaashaLaQaabeeyay.includes(bixiye)) {
        throw new ConfigurationError(`Webhook adapter "${bixiye}" has no matching provider configuration.`);
      }
      if (!waaLaqabsadeWebhook(laqabsade)) {
        throw new ConfigurationError(`Webhook adapter "${bixiye}" does not implement verifyAndParse.`);
      }
      webhookAdapters.set(bixiye, laqabsade);
    }

    const simulatedPaymentProvider = new SimulatedPaymentProvider(
      ilaaliKeydka(
        keydkaLacagahaBixiyaha,
        "provider payment",
        qaabeyn.keydkaLacagahaBixiyaha === undefined
      )
    );
    const paymentProviders = new Map<Bixiye, PaymentProvider>();
    for (const bixiye of bixiyeyaashaLaQaabeeyay) {
      const warshad = laqabsadayaasha?.[bixiye];
      if (!warshad) {
        paymentProviders.set(bixiye, simulatedPaymentProvider);
        continue;
      }

      const aqoonsi = aqoonsiyadaBixiyeyaasha.get(bixiye);
      if (!aqoonsi) {
        throw new ConfigurationError(`Credentials for provider "${bixiye}" are not configured.`);
      }

      let laqabsade: PaymentProvider;
      try {
        laqabsade = warshad.create(aqoonsi);
      } catch {
        throw new ConfigurationError(`Provider adapter "${bixiye}" could not be initialized.`);
      }

      if (!waaLaqabsadeBixiye(laqabsade)) {
        throw new ConfigurationError(`Provider adapter "${bixiye}" does not implement the required contract.`);
      }

      paymentProviders.set(bixiye, laqabsade);
    }

    this.#paymentProviders = paymentProviders;
    this.#idempotencyStore = ilaaliKeydka(
      keydkaIdempotency,
      "payment idempotency",
      qaabeyn.keydkaIdempotency === undefined
    );
    this.#refundIdempotencyStore = ilaaliKeydka(
      keydkaCelin,
      "refund idempotency",
      qaabeyn.keydkaCelin === undefined
    );
    this.#refundStore = ilaaliKeydka(
      keydkaCelinDiiwaanka,
      "refund",
      qaabeyn.keydkaCelinDiiwaanka === undefined
    );
    this.#transactionStore = ilaaliKeydka(
      keydkaLacagaha,
      "transaction",
      qaabeyn.keydkaLacagaha === undefined
    );
    this.#qrStore = ilaaliKeydka(
      keydkaQr,
      "QR",
      qaabeyn.keydkaQr === undefined
    );
    this.#webhookAdapters = webhookAdapters;
    this.#webhookEventStore = keydkaWebhook;
    this.#authenticationAdapters = authenticationAdapters;
    this.#authenticationAdaptersByMethod = authenticationAdaptersByMethod;
    this.#authenticationSessionStore = ilaaliKeydka(
      keydkaAqoonsiga,
      "authentication session",
      qaabeyn.amaanood?.keydkaKulamada === undefined
    );
    this.#paymentAuthorizationStore = ilaaliKeydka(
      keydkaOgolaanshaha,
      "payment authorization",
      qaabeyn.keydkaOgolaanshaha === undefined
    );
    this.#providerCapabilities = new Map(
      Array.from(paymentProviders.entries()).map(([bixiye, provider]) => [
        bixiye,
        this.awoodahaBixiyahaKaHel(provider, webhookAdapters.has(bixiye))
      ])
    );
    this.#providersWithIdempotency = new Set(
      Array.from(paymentProviders.entries())
        .filter(([, provider]) =>
          provider.capabilities?.paymentIdempotency === true
        )
        .map(([bixiye]) => bixiye)
    );
  }

  private async apiCall<T>(
    operation: () => Promise<T>,
    wrap: (message: string) => IskuBixiError
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof IskuBixiError) {
        throw error;
      }
      throw wrap(error instanceof Error ? error.message : "SDK operation failed.");
    }
  }

  private async ogolaanshoAbuur(
    request: CodsiOgolaanshoAbuur
  ): Promise<NatiijoOgolaanshoAbuur> {
    if (
      !waaDiiwaan(request) ||
      typeof request.userId !== "string" ||
      request.userId.length === 0 ||
      request.userId.length > 256 ||
      Object.keys(request).some((key) =>
        !["userId", "lacag", "hab"].includes(key)
      )
    ) {
      throw new ValidationError("A valid user and payment authorization request are required.");
    }
    if (!waaHabAqoonsi(request.hab)) {
      throw new ValidationError("A supported authentication method is required.");
    }
    const adapter = this.#authenticationAdaptersByMethod.get(request.hab);
    if (
      !adapter ||
      adapter.supportsPaymentAuthorization !== true
    ) {
      throw new UnsupportedOperationError(
        "authentication",
        "payment authorization with the requested method"
      );
    }
    const payment = this.paymentAuthorizationPayment(request.lacag);
    const now = Date.now();
    const paymentExpiry = payment.dhacayaa === undefined
      ? Number.POSITIVE_INFINITY
      : Date.parse(payment.dhacayaa);
    const expiresAt = Math.min(now + paymentAuthorizationLifetimeMs, paymentExpiry);
    if (expiresAt <= now) {
      throw new ValidationError("The payment or authorization has already expired.");
    }

    const authorizationId = randomBytes(32).toString("base64url");
    const paymentBinding = this.paymentAuthorizationBinding(
      authorizationId,
      request.userId,
      request.hab,
      payment,
      expiresAt
    );
    const authentication = await this.bilowAqoonsi(
      request.hab,
      { userId: request.userId },
      "payment-authorization",
      paymentBinding,
      expiresAt
    );
    const record: PaymentAuthorizationRecord = {
      authorizationId,
      userId: request.userId,
      method: request.hab,
      payment,
      paymentBinding,
      ...(payment.dhacayaa === undefined
        ? {}
        : { paymentExpiresAt: payment.dhacayaa }),
      expiresAt,
      createdAt: new Date(now).toISOString(),
      authenticationSessionId: authentication.sessionId,
      status: "pending"
    };
    const created = await this.paymentAuthorizationStoreCall(
      "create authorization",
      () => this.#paymentAuthorizationStore.create(record)
    );
    if (!created) {
      throw new PaymentError("Could not create a unique payment authorization.");
    }

    return {
      authorizationId,
      expiresAt: new Date(expiresAt).toISOString(),
      authenticationOptions: authentication.options,
      lacag: {
        qadarka: payment.qadarka,
        lacagta: payment.lacagta,
        bixiye: payment.bixiye,
        tixraac: payment.tixraac,
        ...(payment.dhacayaa === undefined
          ? {}
          : { dhacayaa: payment.dhacayaa })
      }
    };
  }

  private async ogolaanshoXaqiiji(
    request: CodsiOgolaanshoXaqiiji
  ): Promise<NatiijoOgolaanshoXaqiiji> {
    if (
      !waaDiiwaan(request) ||
      typeof request.userId !== "string" ||
      request.userId.length === 0 ||
      request.userId.length > 256 ||
      typeof request.authorizationId !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(request.authorizationId) ||
      Object.keys(request).some((key) =>
        !["userId", "authorizationId", "response"].includes(key)
      )
    ) {
      throw new ValidationError("A valid payment authorization and response are required.");
    }

    const record = await this.paymentAuthorizationStoreCall(
      "claim authorization",
      () => this.#paymentAuthorizationStore.claimForVerification(
        request.authorizationId,
        request.userId,
        Date.now()
      )
    );
    if (!record) {
      const current = await this.paymentAuthorizationStoreCall(
        "read authorization",
        () => this.#paymentAuthorizationStore.findById(
          request.authorizationId,
          request.userId,
          Date.now()
        )
      );
      if (!current) {
        throw new PaymentError("Payment authorization is unavailable, expired, or already used.");
      }
      return this.paymentAuthorizationResult(current);
    }

    const expectedBinding = this.paymentAuthorizationBinding(
      record.authorizationId,
      record.userId,
      record.method,
      record.payment,
      record.expiresAt
    );
    if (
      record.authorizationId !== request.authorizationId ||
      record.userId !== request.userId ||
      record.status !== "verifying" ||
      record.paymentBinding !== expectedBinding ||
      !/^[A-Za-z0-9_-]{43}$/.test(record.authenticationSessionId)
    ) {
      await this.requirePaymentAuthorizationStoreChange(
        "fail invalid authorization",
        () => this.#paymentAuthorizationStore.markVerificationFailure(
          request.authorizationId,
          request.userId
        )
      );
      throw new PaymentError("Stored payment authorization data is invalid.");
    }

    try {
      const verified = await this.xaqiijiAqoonsi({
        userId: request.userId,
        sessionId: record.authenticationSessionId,
        response: request.response
      }, "payment-authorization", expectedBinding);
      if (!verified.methodConfirmed) {
        throw new WebAuthnError(
          "The authentication adapter did not verify the requested payment authorization method."
        );
      }
    } catch (error) {
      await this.requirePaymentAuthorizationStoreChange(
        "record verification failure",
        () => this.#paymentAuthorizationStore.markVerificationFailure(
          request.authorizationId,
          request.userId
        )
      );
      throw error;
    }

    const authorized = await this.paymentAuthorizationStoreCall(
      "authorize payment",
      () => this.#paymentAuthorizationStore.markAuthorized(
        request.authorizationId,
        request.userId,
        Date.now()
      )
    );
    if (!authorized) {
      const current = await this.paymentAuthorizationStoreCall(
        "read authorization",
        () => this.#paymentAuthorizationStore.findById(
          request.authorizationId,
          request.userId,
          Date.now()
        )
      );
      if (current) {
        return this.paymentAuthorizationResult(current);
      }
      throw new PaymentError("Payment authorization expired before it could be processed.");
    }

    const processingRecord = await this.paymentAuthorizationStoreCall(
      "claim payment processing",
      () => this.#paymentAuthorizationStore.claimForProcessing(
        request.authorizationId,
        request.userId,
        Date.now()
      )
    );
    if (!processingRecord) {
      throw new PaymentError("Payment authorization could not be claimed for processing.");
    }

    const localIdempotencyKey = `iskubixi-auth-${record.authorizationId}`;
    const providerIdempotencyKey = this.hashValue(
      `iskubixi:payment-authorization:${record.authorizationId}`
    );
    let payment: NatiijoLacag;
    try {
      payment = await this.lacagSamee({
        ...processingRecord.payment,
        furahaIdempotency: localIdempotencyKey
      }, providerIdempotencyKey);
    } catch {
      await this.requirePaymentAuthorizationStoreChange(
        "mark uncertain payment outcome",
        () => this.#paymentAuthorizationStore.markReconciliationRequired(
          request.authorizationId,
          request.userId
        )
      );
      return {
        authorizationId: request.authorizationId,
        xaalad: "reconciliation_required",
        failure: "provider_outcome_uncertain"
      };
    }

    let recorded = false;
    try {
      recorded = await this.paymentAuthorizationStoreCall(
        "record created payment",
        () => this.#paymentAuthorizationStore.recordPaymentCreation(
          request.authorizationId,
          request.userId,
          payment.id
        )
      );
    } catch {
      await this.requirePaymentAuthorizationStoreChange(
        "mark unrecorded payment for reconciliation",
        () => this.#paymentAuthorizationStore.markReconciliationRequired(
          request.authorizationId,
          request.userId,
          payment.id
        )
      );
      return {
        authorizationId: request.authorizationId,
        xaalad: "reconciliation_required",
        payment,
        failure: "provider_outcome_uncertain"
      };
    }
    if (!recorded) {
      await this.requirePaymentAuthorizationStoreChange(
        "mark unrecorded payment for reconciliation",
        () => this.#paymentAuthorizationStore.markReconciliationRequired(
          request.authorizationId,
          request.userId,
          payment.id
        )
      );
      return {
        authorizationId: request.authorizationId,
        xaalad: "reconciliation_required",
        payment,
        failure: "provider_outcome_uncertain"
      };
    }
    return {
      authorizationId: request.authorizationId,
      xaalad: "processing",
      payment
    };
  }

  private async ogolaanshoXaalad(
    request: CodsiOgolaanshoXaalad
  ): Promise<NatiijoOgolaanshoXaalad> {
    if (
      !waaDiiwaan(request) ||
      typeof request.userId !== "string" ||
      request.userId.length === 0 ||
      request.userId.length > 256 ||
      typeof request.authorizationId !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(request.authorizationId) ||
      Object.keys(request).some((key) =>
        !["userId", "authorizationId"].includes(key)
      )
    ) {
      throw new ValidationError("A valid payment authorization ID and user are required.");
    }
    const record = await this.paymentAuthorizationStoreCall(
      "read authorization status",
      () => this.#paymentAuthorizationStore.findById(
        request.authorizationId,
        request.userId,
        Date.now()
      )
    );
    if (!record) {
      throw new PaymentError("Payment authorization was not found.");
    }
    return {
      authorizationId: record.authorizationId,
      xaalad: record.status,
      ...(record.paymentId === undefined ? {} : { paymentId: record.paymentId }),
      ...(record.failure === undefined ? {} : { failure: record.failure }),
      expiresAt: new Date(record.expiresAt).toISOString()
    };
  }

  private paymentAuthorizationResult(
    record: PaymentAuthorizationRecord
  ): NatiijoOgolaanshoXaqiiji {
    return {
      authorizationId: record.authorizationId,
      xaalad: record.status,
      ...(record.failure === undefined ? {} : { failure: record.failure })
    };
  }

  private paymentAuthorizationPayment(
    value: unknown
  ): PaymentAuthorizationPaymentRequest {
    if (
      !waaDiiwaan(value) ||
      Object.keys(value).some((key) =>
        !["qadarka", "lacagta", "bixiye", "tixraac", "lambarka", "dhacayaa"].includes(key)
      ) ||
      typeof value.qadarka !== "number" ||
      !Number.isFinite(value.qadarka) ||
      value.qadarka <= 0 ||
      typeof value.lacagta !== "string" ||
      !/^[A-Z]{3}$/.test(value.lacagta) ||
      !waaBixiye(value.bixiye) ||
      typeof value.tixraac !== "string" ||
      value.tixraac.trim() === ""
    ) {
      throw new ValidationError("A valid payment amount, currency, provider, and reference are required.");
    }
    const provider = this.#paymentProviders.get(value.bixiye);
    if (!provider) {
      throw new ConfigurationError(`Payment provider "${value.bixiye}" is not configured or registered.`);
    }
    this.awoodHubi(value.bixiye, "payment creation", "paymentCreation");

    if (
      value.bixiye === "waafipay" &&
      (typeof value.lambarka !== "string" || !/^[1-9]\d{9,19}$/.test(value.lambarka))
    ) {
      throw new ValidationError("WaafiPay wallet number (lambarka) must be 10 to 20 digits without a leading zero.");
    }
    if (value.lambarka !== undefined && typeof value.lambarka !== "string") {
      throw new ValidationError("Payment account number (lambarka) must be a string.");
    }
    if (
      value.bixiye === "waafipay" &&
      (
        !/^[A-Za-z0-9._-]{1,50}$/.test(value.tixraac) ||
        Math.round(value.qadarka * 100) / 100 !== value.qadarka
      )
    ) {
      throw new ValidationError("WaafiPay requires a 1 to 50 character reference and an amount with at most two decimal places.");
    }
    let dhacayaa: string | undefined;
    if (value.dhacayaa !== undefined) {
      if (!waaTaariikhISO(value.dhacayaa) || Date.parse(value.dhacayaa) <= Date.now()) {
        throw new ValidationError("Payment expiry (dhacayaa) must be a future ISO 8601 date-time with a timezone.");
      }
      if (!waaKeydkaDhacaya(this.#transactionStore)) {
        throw new StorageError(
          "Transaction storage must implement PaymentExpirationTransactionStore to create expiring payments."
        );
      }
      dhacayaa = new Date(Date.parse(value.dhacayaa)).toISOString();
    }
    return {
      qadarka: value.qadarka,
      lacagta: value.lacagta,
      bixiye: value.bixiye,
      tixraac: value.tixraac,
      ...(value.lambarka === undefined ? {} : { lambarka: value.lambarka }),
      ...(dhacayaa === undefined ? {} : { dhacayaa })
    };
  }

  private paymentAuthorizationBinding(
    authorizationId: string,
    userId: string,
    method: AmaanoodHab,
    payment: PaymentAuthorizationPaymentRequest,
    expiresAt: number
  ): string {
    return this.hashValue(JSON.stringify([
      "iskubixi-payment-authorization-v1",
      authorizationId,
      userId,
      method,
      payment.qadarka,
      payment.lacagta,
      payment.bixiye,
      payment.tixraac,
      payment.lambarka ?? null,
      payment.dhacayaa ?? null,
      expiresAt
    ]));
  }

  private async paymentAuthorizationStoreCall<T>(
    operation: string,
    action: () => Promise<T>
  ): Promise<T> {
    try {
      return await action();
    } catch {
      throw new StorageError(
        `Payment authorization storage operation "${operation}" failed.`,
        { context: { storage: "payment-authorization", operation } }
      );
    }
  }

  private async requirePaymentAuthorizationStoreChange(
    operation: string,
    action: () => Promise<boolean>
  ): Promise<void> {
    const changed = await this.paymentAuthorizationStoreCall(operation, action);
    if (!changed) {
      throw new StorageError(
        `Payment authorization storage operation "${operation}" could not apply the state transition.`,
        { context: { storage: "payment-authorization", operation } }
      );
    }
  }

  private async bilowAqoonsi(
    method: AmaanoodHab,
    request: CodsiAmaanoodBilow,
    purpose: "authentication" | "payment-authorization" = "authentication",
    paymentBinding?: string,
    expiresAtLimit?: number
  ): Promise<NatiijoAmaanoodBilow> {
    if (
      !waaDiiwaan(request) ||
      typeof request.userId !== "string" ||
      request.userId.length === 0 ||
      request.userId.length > 256
    ) {
      throw new ValidationError("A valid application user ID is required.");
    }

    const adapter = this.#authenticationAdaptersByMethod.get(method);
    if (!adapter || !adapter.supportedMethods.includes(method)) {
      throw new UnsupportedOperationError("authentication", `${method} authentication`);
    }

    let response: Awaited<ReturnType<AmaanoodLaqabsade["start"]>>;
    try {
      response = await adapter.start({
        userId: request.userId,
        method,
        ...(paymentBinding === undefined ? {} : { paymentBinding })
      });
    } catch {
      throw new WebAuthnError("The configured authentication adapter could not start the request.");
    }

    const now = Date.now();
    if (
      !waaDiiwaan(response) ||
      !waaDiiwaan(response.options) ||
      typeof response.adapterSessionId !== "string" ||
      response.adapterSessionId.length === 0 ||
      response.adapterSessionId.length > 2048 ||
      typeof response.expiresAt !== "number" ||
      !Number.isFinite(response.expiresAt) ||
      response.expiresAt <= now
    ) {
      throw new WebAuthnError("The authentication adapter returned an invalid session.");
    }

    const expiresAt = Math.min(
      response.expiresAt,
      now + aqoonsiSessionLifetimeMs,
      expiresAtLimit ?? Number.POSITIVE_INFINITY
    );
    if (expiresAt <= now) {
      throw new WebAuthnError("The authentication session expired before it could be stored.");
    }
    const sessionId = randomBytes(32).toString("base64url");
    const created = await this.#authenticationSessionStore.create({
      sessionId,
      userId: request.userId,
      method,
      adapterId: adapter.id,
      adapterSessionId: response.adapterSessionId,
      expiresAt,
      purpose,
      ...(paymentBinding === undefined ? {} : { paymentBinding })
    });
    if (!created) {
      throw new WebAuthnError("Could not create a unique authentication session.");
    }

    return {
      sessionId,
      method,
      expiresAt: new Date(expiresAt).toISOString(),
      options: response.options
    };
  }

  private async xaqiijiAqoonsi(
    request: CodsiAmaanoodXaqiiji,
    purpose: "authentication" | "payment-authorization" = "authentication",
    paymentBinding?: string
  ): Promise<NatiijoAmaanoodXaqiiji> {
    if (
      !waaDiiwaan(request) ||
      typeof request.userId !== "string" ||
      request.userId.length === 0 ||
      request.userId.length > 256 ||
      typeof request.sessionId !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(request.sessionId)
    ) {
      throw new ValidationError("A valid authentication session and response are required.");
    }
    if (!waaDiiwaan(request.response)) {
      throw new WebAuthnError("The authentication response is incomplete or invalid.");
    }

    const session = await this.#authenticationSessionStore.consume(
      request.sessionId,
      request.userId,
      Date.now()
    );
    if (!session) {
      throw new WebAuthnError("The authentication session is invalid, expired, or already used.");
    }
    if (
      session.sessionId !== request.sessionId ||
      session.userId !== request.userId ||
      !waaHabAqoonsi(session.method) ||
      (session.purpose ?? "authentication") !== purpose ||
      session.paymentBinding !== paymentBinding
    ) {
      throw new WebAuthnError("The authentication session is invalid.");
    }

    const adapter = this.#authenticationAdapters.get(session.adapterId);
    if (!adapter || !adapter.supportedMethods.includes(session.method)) {
      throw new ConfigurationError("The authentication session adapter is not configured.");
    }

    let verification: Awaited<ReturnType<AmaanoodLaqabsade["verify"]>>;
    try {
      verification = await adapter.verify({
        userId: session.userId,
        method: session.method,
        adapterSessionId: session.adapterSessionId,
        response: request.response,
        ...(paymentBinding === undefined ? {} : { paymentBinding })
      });
    } catch {
      throw new WebAuthnError("The authentication response could not be verified.");
    }
    if (
      !waaDiiwaan(verification) ||
      verification.authenticated !== true ||
      verification.userVerified !== true ||
      (
        verification.verifiedMethod !== undefined &&
        !waaHabLaXaqiijiyay(verification.verifiedMethod)
      )
    ) {
      throw new WebAuthnError("The authentication response could not be verified.");
    }

    return {
      authenticated: true,
      userId: session.userId,
      sessionId: session.sessionId,
      requestedMethod: session.method,
      ...(verification.verifiedMethod === undefined
        ? {}
        : { verifiedMethod: verification.verifiedMethod }),
      methodConfirmed: verification.verifiedMethod === session.method,
      userVerified: true
    };
  }

  private async bixiyeAwood(
    codsi: CodsiBixiyeAwood
  ): Promise<NatiijoBixiyeAwood> {
    if (!codsi || typeof codsi !== "object" || Array.isArray(codsi)) {
      throw new ValidationError("Provider capability request must include a configured provider.");
    }
    if (!waaBixiye(codsi.bixiye)) {
      throw new ValidationError("Provider capability request contains an unknown provider.");
    }
    const awoodaha = this.#providerCapabilities.get(codsi.bixiye);
    if (!awoodaha) {
      throw new ConfigurationError(`Payment provider "${codsi.bixiye}" is not configured.`);
    }
    return {
      bixiye: codsi.bixiye,
      awoodaha: { ...awoodaha }
    };
  }

  private awoodahaBixiyahaKaHel(
    provider: PaymentProvider,
    webhookSignatureVerification: boolean
  ): ProviderCapabilities {
    const overrides = provider.capabilities ?? {};
    const laFuliyo = (
      method: keyof Pick<
        PaymentProvider,
        | "createPayment"
        | "findPayment"
        | "verifyPayment"
        | "cancelPayment"
        | "refundPayment"
        | "findRefundStatus"
      >
    ): boolean => {
      const declared = overrides[methodToCapability[method]];
      return typeof provider[method] === "function" && declared !== false;
    };
    const paymentCreation = laFuliyo("createPayment");
    const paymentLookup = laFuliyo("findPayment");
    return {
      paymentCreation,
      paymentLookup,
      paymentVerification: laFuliyo("verifyPayment"),
      paymentCancellation: laFuliyo("cancelPayment"),
      refundCreation: laFuliyo("refundPayment"),
      refundStatusLookup: laFuliyo("findRefundStatus"),
      qrPayment: paymentCreation && paymentLookup,
      webhookSignatureVerification
    };
  }

  private awoodHubi(
    bixiye: Bixiye,
    operation: string,
    capability: keyof ProviderCapabilities
  ): void {
    if (!this.#providerCapabilities.get(bixiye)?.[capability]) {
      throw new UnsupportedOperationError(bixiye, operation);
    }
  }

  private async lacagSamee(
    codsi: CodsiLacag,
    providerIdempotencyKey?: string
  ): Promise<NatiijoLacag> {
    if (!codsi || typeof codsi !== "object" || Array.isArray(codsi)) {
      throw new ValidationError("Payment request is required.");
    }

    if (typeof codsi.qadarka !== "number" || !Number.isFinite(codsi.qadarka) || codsi.qadarka <= 0) {
      throw new ValidationError("Payment amount (qadarka) must be a finite number greater than zero.");
    }

    if (typeof codsi.lacagta !== "string" || !/^[A-Z]{3}$/.test(codsi.lacagta)) {
      throw new ValidationError("Currency (lacagta) must be a valid three-letter uppercase code, such as USD.");
    }

    if (!waaBixiye(codsi.bixiye)) {
      throw new ValidationError("Provider selection (bixiye) must be a supported provider.");
    }

    const paymentProvider = this.#paymentProviders.get(codsi.bixiye);
    if (!paymentProvider) {
      throw new ConfigurationError(`Payment provider "${codsi.bixiye}" is not configured or registered.`);
    }
    this.awoodHubi(codsi.bixiye, "payment creation", "paymentCreation");

    if (typeof codsi.tixraac !== "string" || codsi.tixraac.trim() === "") {
      throw new ValidationError("Payment reference (tixraac) is required.");
    }

    if (
      codsi.bixiye === "waafipay" &&
      (typeof codsi.lambarka !== "string" || !/^[1-9]\d{9,19}$/.test(codsi.lambarka))
    ) {
      throw new ValidationError("WaafiPay wallet number (lambarka) must be 10 to 20 digits without a leading zero.");
    }

    if (codsi.furahaIdempotency !== undefined &&
      (typeof codsi.furahaIdempotency !== "string" || codsi.furahaIdempotency.trim() === "")) {
      throw new ValidationError("Idempotency key (furahaIdempotency) must be a non-empty string.");
    }

    let dhacayaa: string | undefined;
    if (codsi.dhacayaa !== undefined) {
      if (!waaTaariikhISO(codsi.dhacayaa)) {
        throw new ValidationError("Payment expiry (dhacayaa) must be an ISO 8601 date-time with a timezone.");
      }
      if (!waaKeydkaDhacaya(this.#transactionStore)) {
        throw new StorageError(
          "Transaction storage must implement PaymentExpirationTransactionStore to create expiring payments."
        );
      }
      dhacayaa = new Date(Date.parse(codsi.dhacayaa)).toISOString();
    }

    const createProviderPayment = () => {
      if (dhacayaa !== undefined && Date.parse(dhacayaa) <= Date.now()) {
        throw new ValidationError("Payment expiry (dhacayaa) must be in the future.");
      }
      return this.adapterCall(
        codsi.bixiye,
        "create payment",
        () => paymentProvider.createPayment({
          amount: codsi.qadarka,
          currency: codsi.lacagta,
          reference: codsi.tixraac,
          accountNumber: codsi.lambarka,
          ...(providerIdempotencyKey !== undefined &&
            this.#providersWithIdempotency.has(codsi.bixiye)
            ? { idempotencyKey: providerIdempotencyKey }
            : {})
        })
      );
    };
    const idempotencyKey = codsi.furahaIdempotency;
    const codsiIdempotencyFingerprint =
      this.paymentRequestFingerprint(codsi, dhacayaa);
    const providerPayment = idempotencyKey === undefined
      ? await createProviderPayment()
      : await this.#idempotencyStore.getOrCreate(
        idempotencyKey,
        codsiIdempotencyFingerprint,
        createProviderPayment
      );

    if (!providerPayment || typeof providerPayment.id !== "string" || providerPayment.id.trim() === "") {
      throw new ProviderError(`Payment provider "${codsi.bixiye}" returned an invalid payment ID.`);
    }
    if (!waaNatiijadaLacag(providerPayment)) {
      throw new ProviderError(`Payment provider "${codsi.bixiye}" returned invalid payment details.`);
    }
    if (
      providerPayment.amount !== codsi.qadarka ||
      providerPayment.currency !== codsi.lacagta ||
      providerPayment.reference !== codsi.tixraac
    ) {
      throw new ProviderError(`Payment provider "${codsi.bixiye}" returned payment details that do not match the request.`);
    }

    const idempotencyKeyHash = idempotencyKey === undefined
      ? undefined
      : this.hashValue(idempotencyKey);
    const existingPayment = this.#paymentProvidersByPaymentId.get(providerPayment.id);
    const storedPayment = existingPayment || !waaKeydkaRoutingLacagaha(this.#transactionStore)
      ? undefined
      : await this.#transactionStore.findPaymentById(providerPayment.id);
    const existingBixiye = existingPayment?.bixiye ?? storedPayment?.bixiye;
    const existingIdempotencyKeyHash =
      existingPayment?.furahaIdempotencyHash ?? storedPayment?.furahaIdempotencyHash;
    const existingFingerprint =
      existingPayment?.codsiIdempotencyFingerprint ??
      storedPayment?.codsiIdempotencyFingerprint;
    const isIdempotentReplay = existingPayment !== undefined || storedPayment !== undefined
      ? idempotencyKeyHash !== undefined &&
        existingBixiye === codsi.bixiye &&
        existingIdempotencyKeyHash === idempotencyKeyHash &&
        existingFingerprint === codsiIdempotencyFingerprint
      : false;

    if ((existingPayment || storedPayment) && !isIdempotentReplay) {
      throw new PaymentError(`Payment provider returned a duplicate payment ID "${providerPayment.id}".`);
    }

    if (!existingPayment && !storedPayment) {
      const laAbuuray = new Date().toISOString();
      await this.#transactionStore.save({
        ...this.paymentToTransaction(providerPayment, codsi.bixiye, laAbuuray, dhacayaa),
        furahaIdempotencyHash: idempotencyKeyHash,
        codsiIdempotencyFingerprint
      });
      this.#paymentProvidersByPaymentId.set(providerPayment.id, {
        bixiye: codsi.bixiye,
        laqabsade: paymentProvider,
        furahaIdempotencyHash: idempotencyKeyHash,
        codsiIdempotencyFingerprint,
        laAbuuray,
        dhacayaa
      });
    } else if (!existingPayment && storedPayment) {
      this.#paymentProvidersByPaymentId.set(providerPayment.id, {
        bixiye: storedPayment.bixiye,
        laqabsade: paymentProvider,
        furahaIdempotencyHash: storedPayment.furahaIdempotencyHash,
        codsiIdempotencyFingerprint: storedPayment.codsiIdempotencyFingerprint,
        laAbuuray: storedPayment.laAbuuray,
        dhacayaa: storedPayment.dhacayaa
      });
    }
    const expiredPayment = dhacayaa === undefined
      ? undefined
      : await this.lacagDhacayKaHel(codsi.bixiye, providerPayment.id, dhacayaa);
    return this.paymentToResult(expiredPayment ?? providerPayment, dhacayaa);
  }

  private async lacagCeli(codsi: CodsiCelin): Promise<NatiijoCelin> {
    if (!codsi || typeof codsi !== "object" || Array.isArray(codsi)) {
      throw new ValidationError("Refund request is required.");
    }
    if (typeof codsi.lacagId !== "string" || codsi.lacagId.trim() === "") {
      throw new ValidationError("Payment ID (lacagId) is required for a refund.");
    }
    if (
      typeof codsi.furahaIdempotency !== "string" ||
      codsi.furahaIdempotency.trim() === ""
    ) {
      throw new ValidationError("Refund idempotency key (furahaIdempotency) must be a non-empty string.");
    }
    if (Object.keys(codsi).some((furaha) =>
      furaha !== "lacagId" && furaha !== "furahaIdempotency"
    )) {
      throw new ValidationError("Only full refunds are supported; partial refund details are not accepted.");
    }

    const { bixiye, laqabsade } = await this.bixiyeLacagKaHel(codsi.lacagId);
    this.awoodHubi(bixiye, "refunds (refund creation)", "refundCreation");
    if (typeof laqabsade.refundPayment !== "function") {
      throw new UnsupportedOperationError(bixiye, "refunds (refund creation)");
    }
    const refundPayment = laqabsade.refundPayment.bind(laqabsade);
    if (!waaKeydkaCelinLacagaha(this.#transactionStore)) {
      throw new StorageError(
        "Transaction storage must implement RefundPaymentTransactionStore to record refunds."
      );
    }

    const paymentIdentity = `${bixiye}:${codsi.lacagId}`;
    const fingerprint = this.hashValue(JSON.stringify([bixiye, codsi.lacagId, "full"]));
    const storedRefund = await this.#refundIdempotencyStore.get(
      codsi.furahaIdempotency,
      fingerprint
    );
    if (!storedRefund) {
      const currentTransaction = await this.#transactionStore.findById(
        bixiye,
        codsi.lacagId
      );
      if (!currentTransaction) {
        throw new Error(`Payment "${codsi.lacagId}" was not found in transaction storage.`);
      }
      if (currentTransaction.status === "laCeliyay") {
        throw new RefundError("Payment has already been refunded.");
      }
      const previousRefund = await this.#refundStore.findByPaymentId(
        bixiye,
        codsi.lacagId
      );
      if (previousRefund?.xaalad === "guuleystay") {
        throw new RefundError("Payment has already been refunded.");
      }
      if (previousRefund?.xaalad === "sugaya") {
        throw new RefundError("A refund is already pending for this payment.");
      }

      const verification = await this.lacagCadee({ lacagId: codsi.lacagId });
      if (verification.xaalad !== "guuleystay") {
        throw new RefundError("Only verified successful payments can be refunded.");
      }
    }

    const refund = await this.#refundIdempotencyStore.getOrCreate(
      codsi.furahaIdempotency,
      fingerprint,
      paymentIdentity,
      async () => {
        const result = await this.adapterCall(
          bixiye,
          "refund payment",
          () => refundPayment({
            paymentId: codsi.lacagId,
            idempotencyKey: codsi.furahaIdempotency
          })
        );
        if (!waaNatiijadaCelin(result)) {
          throw new ProviderError(`Payment provider "${bixiye}" returned an invalid refund result.`);
        }
        return result;
      }
    );

    let record = await this.#refundStore.findByProviderRefundId(bixiye, refund.id);
    if (record && record.lacagId !== codsi.lacagId) {
      throw new Error("Provider refund ID is already recorded for another payment.");
    }
    if (!record) {
      const hadda = new Date().toISOString();
      record = {
        id: `celin-${randomBytes(16).toString("hex")}`,
        providerRefundId: refund.id,
        lacagId: codsi.lacagId,
        bixiye,
        xaalad: refund.status,
        laAbuuray: hadda,
        laCusboonaysiiyay: hadda
      };
      const saveResult = await this.#refundStore.save(record);
      if (saveResult === "invalid-transition") {
        throw new Error("Refund status transition is invalid.");
      }
      record = await this.#refundStore.findByProviderRefundId(bixiye, refund.id);
      if (!record) {
        throw new Error("Refund could not be recorded.");
      }
    }

    await this.paymentCelinDiiwaangeli(record);
    return this.refundToResult(record);
  }

  private async lacagCelinXaalad(
    codsi: CodsiCelinXaalad
  ): Promise<NatiijoCelin> {
    if (
      !codsi ||
      typeof codsi !== "object" ||
      Array.isArray(codsi) ||
      typeof codsi.celinId !== "string" ||
      codsi.celinId.trim() === ""
    ) {
      throw new ValidationError("Refund ID (celinId) is required.");
    }

    const record = await this.#refundStore.findById(codsi.celinId);
    if (!record) {
      throw new Error(`Refund "${codsi.celinId}" was not found.`);
    }
    const bixiye = record.bixiye;
    const laqabsade = this.#paymentProviders.get(bixiye);
    if (!laqabsade) {
      throw new Error(`Payment provider "${bixiye}" is not configured for this refund.`);
    }
    this.awoodHubi(bixiye, "refund status lookup", "refundStatusLookup");
    if (typeof laqabsade.findRefundStatus !== "function") {
      throw new Error(`Payment provider "${bixiye}" does not support refund status lookup; select another provider or register an adapter that implements it.`);
    }

    const providerRefund = await this.adapterCall(
      bixiye,
      "retrieve refund status",
      () => laqabsade.findRefundStatus!({
        refundId: record.providerRefundId,
        paymentId: record.lacagId
      })
    );
    if (!providerRefund || !waaNatiijadaCelin(providerRefund) ||
        providerRefund.id !== record.providerRefundId) {
      throw new Error(`Payment provider "${bixiye}" returned an invalid refund status result.`);
    }

    const saveResult = await this.#refundStore.save({
      ...record,
      xaalad: providerRefund.status,
      laCusboonaysiiyay: new Date().toISOString()
    });
    if (saveResult === "invalid-transition") {
      throw new Error("Refund status transition is invalid.");
    }
    const latest = await this.#refundStore.findById(record.id);
    if (!latest) {
      throw new Error("Refund was not found after its status was updated.");
    }
    await this.paymentCelinDiiwaangeli(latest);
    return this.refundToResult(latest);
  }

  private async paymentCelinDiiwaangeli(record: RefundRecord): Promise<void> {
    if (!waaKeydkaCelinLacagaha(this.#transactionStore)) {
      throw new StorageError(
        "Transaction storage must implement RefundPaymentTransactionStore to record refunds."
      );
    }
    const transaction = await this.#transactionStore.findById(
      record.bixiye,
      record.lacagId
    );
    if (!transaction) {
      throw new Error(`Payment "${record.lacagId}" was not found in transaction storage.`);
    }
    if (transaction.status !== "guuleystay" && transaction.status !== "laCeliyay") {
      throw new Error("Payment status changed before the refund result could be recorded.");
    }

    const latestRefund = await this.#refundStore.findByPaymentId(
      record.bixiye,
      record.lacagId
    ) ?? record;
    const natiijo = this.refundToResult(latestRefund);
    await this.#transactionStore.save({
      ...transaction,
      status: latestRefund.xaalad === "guuleystay" ? "laCeliyay" : transaction.status,
      celin: natiijo
    });
  }

  private refundToResult(record: RefundRecord): NatiijoCelin {
    return {
      id: record.id,
      lacagId: record.lacagId,
      xaalad: record.xaalad
    };
  }

  private async qrSamee(codsi: CodsiQrLacag): Promise<NatiijoQr> {
    if (!codsi || typeof codsi !== "object" || Array.isArray(codsi)) {
      throw new ValidationError("QR payment request is required.");
    }
    if (!waaTaariikhISO(codsi.dhacayaa)) {
      throw new ValidationError("QR expiry (dhacayaa) must be an ISO 8601 date-time with a timezone.");
    }
    if (
      codsi.furahaIdempotency !== undefined &&
      (typeof codsi.furahaIdempotency !== "string" || codsi.furahaIdempotency.trim() === "")
    ) {
      throw new ValidationError("Idempotency key (furahaIdempotency) must be a non-empty string.");
    }

    const tixraac = randomBytes(32).toString("base64url");
    const dhacayaa = new Date(Date.parse(codsi.dhacayaa)).toISOString();
    const codsiHash = this.hashValue(JSON.stringify([
      codsi.qadarka,
      codsi.lacagta,
      codsi.bixiye,
      codsi.lambarka ?? null,
      dhacayaa
    ]));
    const paymentReference = codsi.furahaIdempotency === undefined
      ? `QR-${tixraac}`
      : `QR-${this.hashValue(`${codsi.furahaIdempotency}:${codsiHash}`).slice(0, 40)}`;
    const paymentIdempotencyKey = codsi.furahaIdempotency === undefined
      ? `qr-${tixraac}`
      : `qr-${codsi.furahaIdempotency}`;
    const payment = await this.lacagSamee({
      qadarka: codsi.qadarka,
      lacagta: codsi.lacagta,
      bixiye: codsi.bixiye,
      tixraac: paymentReference,
      lambarka: codsi.lambarka,
      furahaIdempotency: paymentIdempotencyKey,
      dhacayaa
    });
    const previousQr = await this.#qrStore.findByPaymentId(payment.id);
    if (previousQr) {
      const verified = await this.qrRecordKaHel(previousQr.tixraac);
      if (verified.bixiye !== codsi.bixiye || verified.dhacayaa !== dhacayaa) {
        throw new IdempotencyError("QR idempotency key was reused with different payment details.");
      }
      return this.qrToResult(verified, payment);
    }

    const record: QrPaymentRecord = {
      tixraac,
      lacagId: payment.id,
      bixiye: codsi.bixiye,
      laAbuuray: new Date().toISOString(),
      dhacayaa,
      xaalad: "furan"
    };

    try {
      await this.#qrStore.create(record);
    } catch (error) {
      const concurrentQr = await this.#qrStore.findByPaymentId(payment.id);
      if (concurrentQr) {
        const verified = await this.qrRecordKaHel(concurrentQr.tixraac);
        return this.qrToResult(verified, payment);
      }
      throw error;
    }
    return this.qrToResult(record, payment);
  }

  private async qrCadee(codsi: CodsiQrTixraac): Promise<NatiijoQrXaqiijin> {
    if (!codsi || typeof codsi !== "object" || Array.isArray(codsi)) {
      throw new ValidationError("QR reference validation request is required.");
    }

    const record = await this.qrRecordKaHel(codsi.tixraac);
    const xaaladQr = this.qrXaaladKaHel(record);
    if (xaaladQr === "dhacay") {
      await this.lacagDhacayKaHel(record.bixiye, record.lacagId, record.dhacayaa);
      throw new Error("QR payment reference has expired.");
    }
    if (xaaladQr === "joojiyay") {
      throw new Error("QR payment reference has been cancelled.");
    }

    const payment = await this.qrLacagKaHel(record);
    if (payment.xaalad !== "sugaya") {
      throw new Error("QR payment reference has already been used.");
    }

    return this.qrToValidation(record, xaaladQr);
  }

  private async qrAkhriso(codsi: CodsiQrNuxur): Promise<NatiijoQrXaqiijin> {
    if (!codsi || typeof codsi !== "object" || Array.isArray(codsi)) {
      throw new ValidationError("QR payload is required.");
    }
    if (typeof codsi.nuxur !== "string") {
      throw new ValidationError("QR payload (nuxur) must be a string.");
    }

    const match = /^iskubixi:qr:v1:([A-Za-z0-9_-]{43})$/.exec(codsi.nuxur);
    if (!match) {
      throw new ValidationError("QR payload is malformed or has been tampered with.");
    }

    const validation = await this.qrCadee({ tixraac: match[1] });
    return { ...validation, nuxur: codsi.nuxur };
  }

  private async qrXaalad(codsi: CodsiQrTixraac): Promise<NatiijoQrXaalad> {
    const record = await this.qrTixraacKaHel(codsi);
    const payment = await this.qrLacagKaHel(record);
    return {
      tixraac: record.tixraac,
      lacagId: record.lacagId,
      bixiye: record.bixiye,
      xaalad: payment.xaalad,
      xaaladQr: this.qrXaaladKaHel(record, payment.xaalad),
      dhacayaa: record.dhacayaa
    };
  }

  private async qrXog(codsi: CodsiQrTixraac): Promise<NatiijoQr> {
    const record = await this.qrTixraacKaHel(codsi);
    const payment = await this.qrLacagKaHel(record);
    return this.qrToResult(record, payment);
  }

  private async qrJooji(codsi: CodsiQrTixraac): Promise<NatiijoQr> {
    const record = await this.qrTixraacKaHel(codsi);
    const pending = this.#qrCancellationOperations.get(record.tixraac);
    if (pending) {
      return pending;
    }

    const operation = this.qrJoojiFulin(record);
    this.#qrCancellationOperations.set(record.tixraac, operation);
    try {
      return await operation;
    } finally {
      if (this.#qrCancellationOperations.get(record.tixraac) === operation) {
        this.#qrCancellationOperations.delete(record.tixraac);
      }
    }
  }

  private async qrJoojiFulin(record: QrPaymentRecord): Promise<NatiijoQr> {
    const xaaladQr = this.qrXaaladKaHel(record);
    if (xaaladQr === "dhacay") {
      await this.lacagDhacayKaHel(record.bixiye, record.lacagId, record.dhacayaa);
      throw new Error("Expired QR payment references cannot be cancelled.");
    }
    if (xaaladQr === "joojiyay") {
      throw new Error("QR payment reference has already been cancelled.");
    }

    const laqabsade = this.#paymentProviders.get(record.bixiye);
    if (!laqabsade) {
      throw new Error(`Payment provider "${record.bixiye}" is not configured for this QR reference.`);
    }
    this.awoodHubi(
      record.bixiye,
      "cancellation (payment cancellation)",
      "paymentCancellation"
    );
    const cancelPayment = laqabsade.cancelPayment?.bind(laqabsade);
    if (!cancelPayment) {
      throw new Error(`Payment provider "${record.bixiye}" does not support cancellation (payment cancellation); select another provider or register an adapter that implements it.`);
    }

    const payment = await this.qrLacagKaHel(record);
    if (payment.xaalad !== "sugaya") {
      throw new Error("Only pending QR payments can be cancelled.");
    }

    await this.adapterCall(
      record.bixiye,
      "cancel payment",
      () => cancelPayment({ paymentId: record.lacagId })
    );

    const lacagLaJoojiyay: NatiijoLacag = {
      ...payment,
      xaalad: "joojiyay"
    };
    await this.#transactionStore.save(
      this.paymentToTransaction(
        {
          id: lacagLaJoojiyay.id,
          amount: lacagLaJoojiyay.qadarka,
          currency: lacagLaJoojiyay.lacagta,
          reference: lacagLaJoojiyay.tixraac,
          status: lacagLaJoojiyay.xaalad
        },
        record.bixiye,
        record.laAbuuray,
        record.dhacayaa
      )
    );

    const cancelled = await this.#qrStore.cancel(record.tixraac);
    if (!cancelled) {
      throw new Error("QR payment reference could not be cancelled.");
    }

    return this.qrToResult(cancelled, lacagLaJoojiyay);
  }

  private async qrTixraacKaHel(codsi: CodsiQrTixraac): Promise<QrPaymentRecord> {
    if (!codsi || typeof codsi !== "object" || Array.isArray(codsi)) {
      throw new ValidationError("QR reference is required.");
    }
    return this.qrRecordKaHel(codsi.tixraac);
  }

  private async qrRecordKaHel(tixraac: unknown): Promise<QrPaymentRecord> {
    if (typeof tixraac !== "string" || !qrTixraacHab.test(tixraac)) {
      throw new ValidationError("QR payment reference is malformed.");
    }

    const record = await this.#qrStore.find(tixraac);
    if (!record) {
      throw new Error("QR payment reference was not found or is invalid.");
    }
    if (
      record.tixraac !== tixraac ||
      typeof record.lacagId !== "string" ||
      record.lacagId.trim() === "" ||
      !waaBixiye(record.bixiye) ||
      !waaTaariikhISO(record.laAbuuray) ||
      !waaTaariikhISO(record.dhacayaa) ||
      (record.xaalad !== "furan" && record.xaalad !== "joojiyay")
    ) {
      throw new Error("QR payment record is invalid.");
    }

    return record;
  }

  private async qrLacagKaHel(record: QrPaymentRecord): Promise<NatiijoLacag> {
    if (!waaKeydkaDhacaya(this.#transactionStore)) {
      throw new Error("Transaction storage cannot retrieve QR payment expiration data.");
    }
    const storedPayment = await this.#transactionStore.findById(
      record.bixiye,
      record.lacagId
    );
    if (!storedPayment || storedPayment.dhacayaa !== record.dhacayaa) {
      throw new Error("QR expiry does not match the underlying payment expiry.");
    }
    const expiredPayment = await this.lacagDhacayKaHel(
      record.bixiye,
      record.lacagId,
      record.dhacayaa
    );
    if (expiredPayment) {
      return this.paymentToResult(expiredPayment, record.dhacayaa);
    }

    const provider = this.#paymentProviders.get(record.bixiye);
    if (!provider) {
      throw new Error(`Payment provider "${record.bixiye}" is not configured for this QR reference.`);
    }
    this.awoodHubi(record.bixiye, "payment lookup for QR payment", "paymentLookup");

    const payment = await this.adapterCall(
      record.bixiye,
      "retrieve QR payment status",
      () => provider.findPayment({ paymentId: record.lacagId })
    );
    if (!payment || payment.id !== record.lacagId) {
      throw new Error("Payment provider could not find the QR payment.");
    }

    await this.#transactionStore.save(
      this.paymentToTransaction(
        payment,
        record.bixiye,
        record.laAbuuray,
        record.dhacayaa
      )
    );
    const expiredAfterLookup = await this.lacagDhacayKaHel(
      record.bixiye,
      record.lacagId,
      record.dhacayaa
    );
    const savedPayment = await this.#transactionStore.findById(
      record.bixiye,
      record.lacagId
    );
    const effectivePayment = expiredAfterLookup ??
      (savedPayment?.status === "laCeliyay" ? savedPayment : payment);
    return this.paymentToResult(
      effectivePayment,
      record.dhacayaa,
      savedPayment?.celin
    );
  }

  private qrXaaladKaHel(
    record: QrPaymentRecord,
    xaaladLacag?: NatiijoLacag["xaalad"]
  ): XaaladdaQr {
    if (record.xaalad === "joojiyay") {
      return "joojiyay";
    }
    if (Date.parse(record.dhacayaa) <= Date.now()) {
      return "dhacay";
    }
    return xaaladLacag !== undefined && xaaladLacag !== "sugaya"
      ? "laIsticmaalay"
      : "furan";
  }

  private qrToValidation(
    record: QrPaymentRecord,
    xaaladQr: XaaladdaQr
  ): NatiijoQrXaqiijin {
    return {
      waaSax: true,
      tixraac: record.tixraac,
      nuxur: `${qrPayloadBilow}${record.tixraac}`,
      lacagId: record.lacagId,
      bixiye: record.bixiye,
      xaaladQr,
      laAbuuray: record.laAbuuray,
      dhacayaa: record.dhacayaa
    };
  }

  private qrToResult(record: QrPaymentRecord, payment: NatiijoLacag): NatiijoQr {
    return {
      ...this.qrToValidation(record, this.qrXaaladKaHel(record, payment.xaalad)),
      lacagTixraac: payment.tixraac,
      qadarka: payment.qadarka,
      lacagta: payment.lacagta,
      xaalad: payment.xaalad
    };
  }

  private async lacagLiiska(codsi?: CodsiLiiskaLacag): Promise<NatiijoLiiskaLacag> {
    if (
      codsi !== undefined &&
      (typeof codsi !== "object" || codsi === null || Array.isArray(codsi))
    ) {
      throw new ValidationError("Transaction listing filters must be an object.");
    }

    const filters = codsi ?? {};
    if (filters.bixiye !== undefined && !waaBixiye(filters.bixiye)) {
      throw new ValidationError("Provider filter (bixiye) must be a supported provider.");
    }
    if (filters.xaalad !== undefined && !waaXaaladdaLacagta(filters.xaalad)) {
      throw new ValidationError("Payment status filter (xaalad) is invalid.");
    }
    if (filters.lacagta !== undefined && (
      typeof filters.lacagta !== "string" ||
      !/^[A-Z]{3}$/.test(filters.lacagta)
    )) {
      throw new ValidationError("Currency filter (lacagta) must be a three-letter uppercase code.");
    }
    if (filters.lagaBilaabo !== undefined && !waaTaariikhISO(filters.lagaBilaabo)) {
      throw new ValidationError("Start date (lagaBilaabo) must be an ISO 8601 date-time with a timezone.");
    }
    if (filters.ilaa !== undefined && !waaTaariikhISO(filters.ilaa)) {
      throw new ValidationError("End date (ilaa) must be an ISO 8601 date-time with a timezone.");
    }

    const lagaBilaabo = filters.lagaBilaabo === undefined
      ? undefined
      : Date.parse(filters.lagaBilaabo);
    const ilaa = filters.ilaa === undefined
      ? undefined
      : Date.parse(filters.ilaa);
    if (lagaBilaabo !== undefined && ilaa !== undefined && lagaBilaabo > ilaa) {
      throw new ValidationError("Start date (lagaBilaabo) cannot be later than end date (ilaa).");
    }

    const bogga = filters.bogga ?? 1;
    const xadka = filters.xadka ?? 20;
    if (!Number.isSafeInteger(bogga) || bogga < 1) {
      throw new ValidationError("Page (bogga) must be a positive safe integer.");
    }
    if (!Number.isSafeInteger(xadka) || xadka < 1) {
      throw new ValidationError("Page size (xadka) must be a positive safe integer.");
    }

    if (waaKeydkaDhacaya(this.#transactionStore)) {
      await this.#transactionStore.expireDue(new Date(Date.now()).toISOString());
    }

    const page = await this.#transactionStore.list({
      bixiye: filters.bixiye,
      xaalad: filters.xaalad,
      lacagta: filters.lacagta,
      lagaBilaabo: filters.lagaBilaabo,
      ilaa: filters.ilaa,
      bogga,
      xadka
    });

    return {
      lacagaha: await Promise.all(page.lacagaha.map(async (payment) => {
        const refund = await this.#refundStore.findByPaymentId(
          payment.bixiye,
          payment.id
        );
        return this.transactionToResult(
          payment,
          refund ? this.refundToResult(refund) : payment.celin
        );
      })),
      wadarta: page.wadarta,
      bogga,
      xadka,
      wadartaBogagga: Math.ceil(page.wadarta / xadka)
    };
  }

  private async webhookCadee(
    codsi: CodsiWebhook
  ): Promise<NatiijoWebhookCadee> {
    const event = await this.webhookDhacdoKaHel(codsi);
    return this.webhookNatiijoKaHel(event);
  }

  private async webhookFashilmay(
    codsi?: CodsiWebhookFashilmay
  ): Promise<readonly NatiijoWebhookDhacdoFashilmay[]> {
    if (
      codsi !== undefined &&
      (
        typeof codsi !== "object" ||
        codsi === null ||
        (codsi.bixiye !== undefined && !waaBixiye(codsi.bixiye))
      )
    ) {
      throw new ValidationError("Webhook failed-event filter is invalid.");
    }

    const store = this.#webhookEventStore;
    if (!waaKeydkaWebhookSooKabasho(store)) {
      throw new Error("Configured webhook storage does not support failed-event inspection or retry.");
    }

    let records;
    try {
      records = await store.listFailed(codsi?.bixiye);
    } catch {
      throw new StorageError("Webhook event storage failed while listing failed events.", {
        context: { storage: "webhook", operation: "listFailed" }
      });
    }
    return records.map((record) => ({
      bixiye: record.bixiye,
      dhacdoId: record.dhacdoId,
      xaalad: "fashilmay",
      iskuDayo: record.iskuDayo,
      iskuDaygiiUguDanbeeyay: record.iskuDaygiiUguDanbeeyay,
      fashil: "Webhook event processing failed."
    }));
  }

  private async webhookDibUshaqee(
    codsi: CodsiWebhookDibUshaqee
  ): Promise<NatiijoWebhookShaqeeyay> {
    if (
      !codsi ||
      typeof codsi !== "object" ||
      !waaBixiye(codsi.bixiye) ||
      typeof codsi.dhacdoId !== "string" ||
      codsi.dhacdoId.length === 0
    ) {
      throw new ValidationError("Webhook retry request is invalid.");
    }

    const store = this.#webhookEventStore;
    if (!waaKeydkaWebhookSooKabasho(store)) {
      throw new Error("Configured webhook storage does not support failed-event inspection or retry.");
    }

    let record;
    try {
      record = await store.get(codsi.bixiye, codsi.dhacdoId);
    } catch {
      throw new StorageError("Webhook event storage failed while loading a failed event.", {
        context: { storage: "webhook", operation: "get" }
      });
    }
    if (!record) {
      throw new Error("Webhook event was not found.");
    }
    if (record.xaalad !== "fashilmay") {
      throw new Error("Only failed webhook events can be retried.");
    }

    const request = codsi.codsi ?? record.codsi;
    if (!request) {
      throw new Error("The original signed webhook request is unavailable for retry.");
    }
    if (request.bixiye !== codsi.bixiye) {
      throw new Error("Webhook retry provider does not match the stored event.");
    }

    const event = await this.webhookDhacdoKaHel(request);
    if (event.bixiye !== codsi.bixiye || event.dhacdoId !== codsi.dhacdoId) {
      throw new Error("Verified webhook does not match the failed event.");
    }
    return this.webhookDhacdoShaqee(request, event);
  }

  private async webhookKaShaqee(
    codsi: CodsiWebhook
  ): Promise<NatiijoWebhookShaqeeyay> {
    const event = await this.webhookDhacdoKaHel(codsi);
    return this.webhookDhacdoShaqee(codsi, event);
  }

  private async webhookDhacdoShaqee(
    codsi: CodsiWebhook,
    event: PaymentWebhookEvent
  ): Promise<NatiijoWebhookShaqeeyay> {
    const provider = this.#paymentProviders.get(event.bixiye);
    if (provider instanceof SimulatedPaymentProvider) {
      throw new Error("Webhook events cannot update simulated payments or refunds.");
    }

    const transactionStore = this.#transactionStore;
    const ignored = "laIskaIndhoTiray" in event;
    const refundEvent = "nooca" in event && event.nooca === "celin"
      ? event
      : undefined;
    let transaction: PaymentTransaction | undefined;
    if (!ignored && !refundEvent) {
      if (!waaKeydkaWebhookLacagaha(transactionStore)) {
        throw new Error("Configured transaction storage does not support webhook processing.");
      }
    }

    const fingerprint = this.hashValue(JSON.stringify(ignored
      ? [event.bixiye, true]
      : refundEvent
        ? [event.bixiye, "refund", refundEvent.providerRefundId, refundEvent.xaalad]
        : [
            event.bixiye,
            "payment",
            (event as VerifiedPaymentWebhookEvent).lacagId ?? null,
            (event as VerifiedPaymentWebhookEvent).tixraac ?? null,
            (event as VerifiedPaymentWebhookEvent).xaalad,
            (event as VerifiedPaymentWebhookEvent).qadarka ?? null,
            (event as VerifiedPaymentWebhookEvent).lacagta ?? null
          ]));
    let result: WebhookEventProcessingResult;
    try {
      result = await this.#webhookEventStore.processOnce(
        event.bixiye,
        event.dhacdoId,
        fingerprint,
        async () => {
          if (ignored) {
            return;
          }
          if (refundEvent) {
            let refundRecord: RefundRecord | undefined;
            try {
              refundRecord = await this.#refundStore.findByProviderRefundId(
                event.bixiye,
                refundEvent.providerRefundId
              );
            } catch {
              throw new StorageError("Webhook refund storage failed while looking up the event.", {
                context: { storage: "refund", operation: "findByProviderRefundId" }
              });
            }
            if (!refundRecord) {
              throw new Error("Webhook refund was not found.");
            }
            let update: RefundStatusUpdate;
            try {
              update = await this.#refundStore.applyWebhookStatus(
                event.bixiye,
                refundEvent.providerRefundId,
                refundEvent.xaalad
              );
            } catch {
              throw new StorageError("Webhook refund storage failed while applying the event.", {
                context: { storage: "refund", operation: "applyWebhookStatus" }
              });
            }
            if (update === "invalid-transition") {
              throw new Error("Webhook refund status transition is invalid.");
            }
            if (update === "not-found") {
              throw new Error("Webhook refund was not found.");
            }
            const latestRefund = await this.#refundStore.findByProviderRefundId(
              event.bixiye,
              refundEvent.providerRefundId
            );
            if (!latestRefund) {
              throw new Error("Webhook refund was not found after processing.");
            }
            await this.paymentCelinDiiwaangeli(latestRefund);
            return;
          }
          if (!waaKeydkaWebhookLacagaha(transactionStore)) {
            throw new Error("Configured transaction storage does not support webhook processing.");
          }
          transaction = await this.webhookPaymentKaHel(event, transactionStore);

          let statusUpdate: WebhookStatusUpdate;
          try {
            statusUpdate = await transactionStore.applyWebhookStatus(
              event.bixiye,
              transaction.id,
              (event as VerifiedPaymentWebhookEvent).xaalad
            );
          } catch {
            throw new StorageError("Webhook transaction storage failed while applying the event.", {
              context: { storage: "transaction", operation: "applyWebhookStatus" }
            });
          }
          if (statusUpdate === "invalid-transition") {
            throw new Error("Webhook payment status transition is invalid.");
          }
          if (statusUpdate === "not-found") {
            throw new Error("Webhook payment was not found.");
          }
        },
        codsi
      );
    } catch (error) {
      if (error instanceof StorageError || error instanceof IdempotencyError) {
        throw error;
      }
      if (
        error instanceof Error &&
        (
          error.message === "Webhook event ID was reused with different event data." ||
          error.message === "Webhook event is already being processed." ||
          error.message === "Webhook refund status transition is invalid." ||
          error.message === "Webhook refund was not found." ||
          error.message === "Webhook payment status transition is invalid." ||
          error.message === "Webhook payment was not found." ||
          error.message === "Webhook payment was not found or its identifiers do not match." ||
          error.message === "Webhook payment details do not match the stored transaction." ||
          error.message === "Configured transaction storage does not support webhook processing."
        )
      ) {
        throw error;
      }
      throw new StorageError("Webhook event storage or processing failed.", {
        context: { storage: "webhook", operation: "processOnce" }
      });
    }

    if (ignored) {
      return {
        waaSax: true,
        bixiye: event.bixiye,
        dhacdoId: event.dhacdoId,
        laIskaIndhoTiray: true,
        horeLooShaqeeyay: result.horeLooShaqeeyay
      };
    }
    if (refundEvent) {
      let latestRefund: RefundRecord | undefined;
      try {
        latestRefund = await this.#refundStore.findByProviderRefundId(
          event.bixiye,
          refundEvent.providerRefundId
        );
      } catch {
        throw new StorageError("Webhook refund storage failed while loading the processed event.", {
          context: { storage: "refund", operation: "findByProviderRefundId" }
        });
      }
      if (!latestRefund) {
        throw new Error("Webhook refund was not found after processing.");
      }
      return {
        waaSax: true,
        bixiye: event.bixiye,
        dhacdoId: event.dhacdoId,
        celinId: latestRefund.id,
        providerRefundId: latestRefund.providerRefundId,
        xaaladCelin: latestRefund.xaalad,
        horeLooShaqeeyay: result.horeLooShaqeeyay
      };
    }
    if (!waaKeydkaWebhookLacagaha(transactionStore)) {
      throw new Error("Configured transaction storage does not support webhook processing.");
    }
    transaction = transaction ?? await this.webhookPaymentKaHel(
      event as VerifiedPaymentWebhookEvent,
      transactionStore
    );
    let latestTransaction: PaymentTransaction | undefined;
    try {
      latestTransaction = await transactionStore.findById(event.bixiye, transaction.id);
    } catch {
      throw new StorageError("Webhook transaction storage failed while loading the processed event.", {
        context: { storage: "transaction", operation: "findById" }
      });
    }
    if (!latestTransaction) {
      throw new Error("Webhook payment was not found after processing.");
    }

    return {
      waaSax: true,
      bixiye: event.bixiye,
      dhacdoId: event.dhacdoId,
      xaalad: latestTransaction.status,
      lacagId: latestTransaction.id,
      tixraac: latestTransaction.reference,
      horeLooShaqeeyay: result.horeLooShaqeeyay
    };
  }

  private async webhookPaymentKaHel(
    event: VerifiedPaymentWebhookEvent,
    transactionStore: WebhookPaymentTransactionStore
  ): Promise<PaymentTransaction> {
    let byId: PaymentTransaction | undefined;
    let byReference: PaymentTransaction | undefined;
    try {
      [byId, byReference] = await Promise.all([
        event.lacagId === undefined
          ? Promise.resolve(undefined)
          : transactionStore.findById(event.bixiye, event.lacagId),
        event.tixraac === undefined
          ? Promise.resolve(undefined)
          : transactionStore.findByReference(event.bixiye, event.tixraac)
      ]);
    } catch {
      throw new StorageError("Webhook transaction storage failed while looking up the payment.", {
        context: { storage: "transaction", operation: "findById" }
      });
    }

    if (
      (event.lacagId !== undefined && !byId) ||
      (event.tixraac !== undefined && !byReference) ||
      (byId && byReference && byId.id !== byReference.id)
    ) {
      throw new Error("Webhook payment was not found or its identifiers do not match.");
    }

    const transaction = byId ?? byReference;
    if (!transaction) {
      throw new Error("Webhook payment was not found.");
    }
    if (
      (event.qadarka !== undefined && event.qadarka !== transaction.amount) ||
      (event.lacagta !== undefined && event.lacagta !== transaction.currency)
    ) {
      throw new Error("Webhook payment details do not match the stored transaction.");
    }
    return transaction;
  }

  private async webhookDhacdoKaHel(
    codsi: CodsiWebhook
  ): Promise<PaymentWebhookEvent> {
    if (
      !codsi ||
      typeof codsi !== "object" ||
      Array.isArray(codsi) ||
      !waaBixiye(codsi.bixiye) ||
      !(codsi.rawBody instanceof Uint8Array) ||
      !codsi.headers ||
      typeof codsi.headers !== "object" ||
      Array.isArray(codsi.headers)
    ) {
      throw new WebhookVerificationError(
        "Webhook request must include a provider, raw body bytes, and headers."
      );
    }

    const adapter = this.#webhookAdapters.get(codsi.bixiye);
    if (!adapter) {
      throw new UnsupportedOperationError(
        codsi.bixiye,
        "webhook signature verification"
      );
    }

    let event: PaymentWebhookEvent;
    const rawBody = Buffer.from(codsi.rawBody);
    try {
      event = await adapter.verifyAndParse({
        bixiye: codsi.bixiye,
        rawBody,
        headers: codsi.headers
      });
    } catch {
      throw new WebhookVerificationError(
        `Webhook adapter "${codsi.bixiye}" rejected or could not verify the event.`,
        { context: { provider: codsi.bixiye, operation: "verify" } }
      );
    }

    if (
      !event ||
      typeof event !== "object" ||
      Array.isArray(event) ||
      event.bixiye !== codsi.bixiye ||
      typeof event.dhacdoId !== "string" ||
      event.dhacdoId.trim() === "" ||
      event.dhacdoId.length > 256
    ) {
      throw new WebhookVerificationError(
        `Webhook adapter "${codsi.bixiye}" returned an invalid event.`,
        { context: { provider: codsi.bixiye, operation: "normalize" } }
      );
    }

    if ("laIskaIndhoTiray" in event) {
      if (event.laIskaIndhoTiray !== true) {
        throw new WebhookVerificationError(
          `Webhook adapter "${codsi.bixiye}" returned an invalid event.`,
          { context: { provider: codsi.bixiye, operation: "normalize" } }
        );
      }
      return event;
    }

    if ("nooca" in event) {
      if (
        event.nooca !== "celin" ||
        typeof event.providerRefundId !== "string" ||
        event.providerRefundId.trim() === "" ||
        !waaXaaladdaProviderCelin(event.xaalad)
      ) {
        throw new WebhookVerificationError(
          `Webhook adapter "${codsi.bixiye}" returned an invalid event.`,
          { context: { provider: codsi.bixiye, operation: "normalize" } }
        );
      }
      return event;
    }

    if (
      !waaXaaladdaWebhook(event.xaalad) ||
      (event.lacagId !== undefined &&
        (typeof event.lacagId !== "string" || event.lacagId.trim() === "")) ||
      (event.tixraac !== undefined &&
        (typeof event.tixraac !== "string" || event.tixraac.trim() === "")) ||
      (event.lacagId === undefined && event.tixraac === undefined) ||
      (event.qadarka !== undefined &&
        (typeof event.qadarka !== "number" ||
          !Number.isFinite(event.qadarka) ||
          event.qadarka <= 0)) ||
      (event.lacagta !== undefined &&
        (typeof event.lacagta !== "string" || !/^[A-Z]{3}$/.test(event.lacagta)))
    ) {
      throw new WebhookVerificationError(
        `Webhook adapter "${codsi.bixiye}" returned an invalid event.`,
        { context: { provider: codsi.bixiye, operation: "normalize" } }
      );
    }

    return event;
  }

  private webhookNatiijoKaHel(
    event: PaymentWebhookEvent
  ): NatiijoWebhookCadee {
    if ("laIskaIndhoTiray" in event) {
      return {
        waaSax: true,
        bixiye: event.bixiye,
        dhacdoId: event.dhacdoId,
        laIskaIndhoTiray: true
      };
    }
    if ("nooca" in event && event.nooca === "celin") {
      return {
        waaSax: true,
        bixiye: event.bixiye,
        dhacdoId: event.dhacdoId,
        providerRefundId: event.providerRefundId,
        xaaladCelin: event.xaalad
      };
    }
    return {
      waaSax: true,
      bixiye: event.bixiye,
      dhacdoId: event.dhacdoId,
      xaalad: event.xaalad
    };
  }

  private paymentRequestFingerprint(
    codsi: CodsiLacag,
    dhacayaa?: string
  ): string {
    return this.hashValue(JSON.stringify([
      codsi.qadarka,
      codsi.lacagta,
      codsi.bixiye,
      codsi.tixraac,
      codsi.lambarka ?? null,
      dhacayaa ?? null
    ]));
  }

  private hashValue(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private async lacagXaalad(codsi: CodsiLacagId): Promise<NatiijoLacag> {
    const providerPayment = await this.raadiLacag(codsi);
    const route = await this.bixiyeLacagKaHel(codsi.lacagId);
    const celin = await this.celinDiiwaangashanKaHel(route.bixiye, codsi.lacagId);
    return this.paymentToResult(providerPayment, route.dhacayaa, celin);
  }

  private async celinDiiwaangashanKaHel(
    bixiye: Bixiye,
    lacagId: string
  ): Promise<NatiijoCelin | undefined> {
    const refund = await this.#refundStore.findByPaymentId(bixiye, lacagId);
    return refund ? this.refundToResult(refund) : undefined;
  }

  private async lacagCadee(codsi: CodsiLacagId): Promise<NatiijoXaqiijin> {
    if (!codsi || typeof codsi !== "object") {
      throw new ValidationError("Payment verification request is required.");
    }

    const paymentId = this.lacagIdXaqiiji(codsi);
    const { bixiye, laqabsade, laAbuuray, dhacayaa } =
      await this.bixiyeLacagKaHel(paymentId);
    this.awoodHubi(bixiye, "payment verification", "paymentVerification");
    const expiredPayment = dhacayaa === undefined
      ? undefined
      : await this.lacagDhacayKaHel(bixiye, paymentId, dhacayaa);
    const verification = await this.adapterCall(
      bixiye,
      "verify payment",
      () => laqabsade.verifyPayment({ paymentId })
    );

    if (!verification.exists) {
      throw new Error(`Payment "${paymentId}" was not found.`);
    }

    if (!verification.payment || verification.payment.id !== paymentId) {
      throw new Error(`Payment provider returned an invalid verification result for "${paymentId}".`);
    }

    if (!expiredPayment) {
      await this.#transactionStore.save(
        this.paymentToTransaction(
          verification.payment,
          bixiye,
          laAbuuray,
          dhacayaa
        )
      );
    }
    const savedTransaction = waaKeydkaCelinLacagaha(this.#transactionStore)
      ? await this.#transactionStore.findById(bixiye, paymentId)
      : undefined;
    const expiredAfterVerification = expiredPayment ?? (
      dhacayaa === undefined
        ? undefined
        : await this.lacagDhacayKaHel(bixiye, paymentId, dhacayaa)
    );
    const payment = expiredAfterVerification ??
      (savedTransaction?.status === "laCeliyay" ? savedTransaction : verification.payment);

    return {
      ...this.paymentToResult(
        payment,
        dhacayaa,
        await this.celinDiiwaangashanKaHel(bixiye, paymentId)
      ),
      waaJiraa: true,
      xaqiijin: verification.source
    };
  }

  private async lacagTijaabiXaalad(codsi: CodsiTijaabiXaalad): Promise<NatiijoLacag> {
    if (!codsi || typeof codsi !== "object") {
      throw new ValidationError("Status simulation request is required.");
    }

    const lacagId = this.lacagIdXaqiiji(codsi);
    if (!waaXaaladLacagDhamaad(codsi.xaalad)) {
      throw new ValidationError('Target status (xaalad) must be "guuleystay" or "fashilmay".');
    }

    const route = await this.bixiyeLacagKaHel(lacagId);
    const expiredPayment = route.dhacayaa === undefined
      ? undefined
      : await this.lacagDhacayKaHel(route.bixiye, lacagId, route.dhacayaa);
    if (expiredPayment) {
      throw new Error("Expired payments cannot be changed through simulated status updates.");
    }
    const { laqabsade } = route;
    if (!(laqabsade instanceof SimulatedPaymentProvider)) {
      throw new Error("Status simulation is only available for simulated payments.");
    }

    const payment = await laqabsade.simulateStatus(lacagId, codsi.xaalad);
    if (!payment) {
      throw new Error(`Payment "${lacagId}" was not found.`);
    }

    const paymentRoute = this.#paymentProvidersByPaymentId.get(lacagId);
    if (paymentRoute) {
      await this.#transactionStore.save(
        this.paymentToTransaction(
          payment,
          paymentRoute.bixiye,
          paymentRoute.laAbuuray,
          paymentRoute.dhacayaa
        )
      );
    }

    const expiredAfterSimulation = paymentRoute?.dhacayaa === undefined
      ? undefined
      : await this.lacagDhacayKaHel(
        paymentRoute.bixiye,
        lacagId,
        paymentRoute.dhacayaa
      );
    return this.paymentToResult(expiredAfterSimulation ?? payment, paymentRoute?.dhacayaa);
  }

  private async raadiLacag(codsi: CodsiLacagId): Promise<ProviderPayment> {
    if (!codsi || typeof codsi !== "object") {
      throw new ValidationError("Payment lookup request is required.");
    }

    const lacagId = this.lacagIdXaqiiji(codsi);
    const { bixiye, laqabsade, laAbuuray, dhacayaa } =
      await this.bixiyeLacagKaHel(lacagId);
    this.awoodHubi(bixiye, "payment lookup", "paymentLookup");
    const expiredPayment = dhacayaa === undefined
      ? undefined
      : await this.lacagDhacayKaHel(bixiye, lacagId, dhacayaa);
    if (expiredPayment) {
      return expiredPayment;
    }
    const payment = await this.adapterCall(
      bixiye,
      "retrieve payment status",
      () => laqabsade.findPayment({ paymentId: lacagId })
    );
    if (!payment) {
      throw new Error(`Payment "${lacagId}" was not found.`);
    }

    await this.#transactionStore.save(
      this.paymentToTransaction(payment, bixiye, laAbuuray, dhacayaa)
    );

    const savedTransaction = waaKeydkaCelinLacagaha(this.#transactionStore)
      ? await this.#transactionStore.findById(bixiye, lacagId)
      : undefined;
    if (savedTransaction?.status === "laCeliyay") {
      return savedTransaction;
    }

    if (dhacayaa !== undefined) {
      return (await this.lacagDhacayKaHel(bixiye, lacagId, dhacayaa)) ?? payment;
    }
    return payment;
  }

  private async lacagDhacayKaHel(
    bixiye: Bixiye,
    lacagId: string,
    dhacayaa: string
  ): Promise<PaymentTransaction | undefined> {
    if (Date.parse(dhacayaa) > Date.now()) {
      return undefined;
    }
    if (!waaKeydkaDhacaya(this.#transactionStore)) {
      throw new Error(
        "Transaction storage must implement PaymentExpirationTransactionStore to check payment expiration."
      );
    }

    await this.#transactionStore.expireDue(new Date(Date.now()).toISOString());
    const transaction = await this.#transactionStore.findById(bixiye, lacagId);
    return transaction?.status === "dhacay" ? transaction : undefined;
  }

  private lacagIdXaqiiji(codsi: CodsiLacagId): string {
    if (typeof codsi.lacagId !== "string" || codsi.lacagId.trim() === "") {
      throw new ValidationError("Payment ID (lacagId) is required and cannot be empty.");
    }

    return codsi.lacagId;
  }

  private async bixiyeLacagKaHel(
    lacagId: string
  ): Promise<{
    bixiye: Bixiye;
    laqabsade: PaymentProvider;
    furahaIdempotencyHash?: string;
    laAbuuray: string;
    dhacayaa?: string;
  }> {
    const cachedRoute = this.#paymentProvidersByPaymentId.get(lacagId);
    if (cachedRoute) {
      return cachedRoute;
    }

    if (!waaKeydkaRoutingLacagaha(this.#transactionStore)) {
      throw new Error(
        `Payment "${lacagId}" is not available in this SDK instance; transaction storage must implement PaymentRoutingTransactionStore for cross-instance lookup.`
      );
    }

    const transaction = await this.#transactionStore.findPaymentById(lacagId);
    if (!transaction || transaction.id !== lacagId || !waaBixiye(transaction.bixiye)) {
      throw new Error(`Payment "${lacagId}" was not found.`);
    }

    const provider = this.#paymentProviders.get(transaction.bixiye);
    if (!provider) {
      throw new Error(
        `Payment provider "${transaction.bixiye}" recorded for payment "${lacagId}" is not configured in this SDK instance.`
      );
    }
    if (!waaTaariikhISO(transaction.laAbuuray) ||
        (transaction.dhacayaa !== undefined && !waaTaariikhISO(transaction.dhacayaa))) {
      throw new Error(`Stored payment "${lacagId}" contains invalid routing or expiration data.`);
    }

    const route = {
      bixiye: transaction.bixiye,
      laqabsade: provider,
      furahaIdempotencyHash: transaction.furahaIdempotencyHash,
      codsiIdempotencyFingerprint: transaction.codsiIdempotencyFingerprint,
      laAbuuray: transaction.laAbuuray,
      dhacayaa: transaction.dhacayaa
    };
    this.#paymentProvidersByPaymentId.set(lacagId, route);
    return route;
  }

  private async adapterCall<T>(
    bixiye: Bixiye,
    hawl: string,
    fulin: () => Promise<T>
  ): Promise<T> {
    try {
      return await fulin();
    } catch (error) {
      if (
        error instanceof StorageError ||
        (
          this.#paymentProviders.get(bixiye) instanceof SimulatedPaymentProvider &&
          (error instanceof PaymentError || error instanceof RefundError)
        )
      ) {
        throw error;
      }
      const source = this.#paymentProviders.get(bixiye) instanceof SimulatedPaymentProvider
        ? "simulated"
        : "provider";
      throw new ProviderError(`Provider adapter "${bixiye}" failed to ${hawl}.`, {
        context: { provider: bixiye, operation: hawl, source }
      });
    }
  }

  private paymentToResult(
    payment: ProviderPayment,
    dhacayaa?: string,
    celin?: NatiijoCelin
  ): NatiijoLacag {
    return {
      id: payment.id,
      qadarka: payment.amount,
      lacagta: payment.currency,
      xaalad: payment.status,
      tixraac: payment.reference,
      ...(dhacayaa === undefined ? {} : { dhacayaa }),
      ...(celin === undefined ? {} : { celin })
    };
  }

  private transactionToResult(
    payment: PaymentTransaction,
    celin: NatiijoCelin | undefined = payment.celin
  ): NatiijoLacagLiiska {
    return {
      ...this.paymentToResult(payment, payment.dhacayaa, celin),
      bixiye: payment.bixiye,
      laAbuuray: payment.laAbuuray
    };
  }

  private paymentToTransaction(
    payment: ProviderPayment,
    bixiye: Bixiye,
    laAbuuray: string,
    dhacayaa?: string
  ): PaymentTransaction {
    return {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      reference: payment.reference,
      status: payment.status,
      bixiye,
      laAbuuray,
      ...(dhacayaa === undefined ? {} : { dhacayaa })
    };
  }
}
