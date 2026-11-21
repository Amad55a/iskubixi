import type { Bixiye } from "../types/configuration";
import type { NatiijoCelin, XaaladdaLacagta } from "../types/payment";
import type { ProviderPayment } from "./payment-provider";
import { PaymentError } from "../errors";

export interface PaymentTransaction extends ProviderPayment {
  bixiye: Bixiye;
  laAbuuray: string;
  dhacayaa?: string;
  furahaIdempotencyHash?: string;
  codsiIdempotencyFingerprint?: string;
  celin?: NatiijoCelin;
}

export interface PaymentTransactionQuery {
  bixiye?: Bixiye;
  xaalad?: XaaladdaLacagta;
  lacagta?: string;
  lagaBilaabo?: string;
  ilaa?: string;
  bogga: number;
  xadka: number;
}

export interface PaymentTransactionPage {
  lacagaha: readonly PaymentTransaction[];
  wadarta: number;
}

export interface PaymentTransactionStore {
  /**
   * Atomically upsert by globally unique payment ID. Preserve the original
   * provider, reference, creation timestamp, and expiry; enforce valid status
   * transitions and retain existing refund metadata when it is omitted.
   */
  save(transaction: PaymentTransaction): Promise<void>;

  /**
   * Apply filters, order newest first, and return a page with the full filtered count.
   */
  list(query: PaymentTransactionQuery): Promise<PaymentTransactionPage>;
}

/**
 * Optional extension that lets a new SDK instance route a payment ID to its
 * provider using the persisted transaction record.
 */
export interface PaymentRoutingTransactionStore extends PaymentTransactionStore {
  findPaymentById(lacagId: string): Promise<PaymentTransaction | undefined>;
}

/** Store contract required to read and persist refund transaction results. */
export interface RefundPaymentTransactionStore extends PaymentTransactionStore {
  findById(bixiye: Bixiye, lacagId: string): Promise<PaymentTransaction | undefined>;
}

export interface PaymentExpirationTransactionStore extends RefundPaymentTransactionStore {
  expireDue(asOf: string): Promise<void>;
}

export type WebhookStatusUpdate =
  | "updated"
  | "unchanged"
  | "expired"
  | "invalid-transition"
  | "not-found";

export interface WebhookPaymentTransactionStore extends PaymentExpirationTransactionStore {
  findByReference(bixiye: Bixiye, tixraac: string): Promise<PaymentTransaction | undefined>;
  applyWebhookStatus(
    bixiye: Bixiye,
    lacagId: string,
    xaalad: XaaladdaLacagta
  ): Promise<WebhookStatusUpdate>;
}

export function waaXaaladBixinLaOggolYahay(
  hore: XaaladdaLacagta,
  cusub: XaaladdaLacagta
): boolean {
  if (hore === cusub || hore === "sugaya") {
    return true;
  }

  return hore === "guuleystay" &&
    (cusub === "joojiyay" || cusub === "laCeliyay");
}

export class InMemoryPaymentTransactionStore implements
  WebhookPaymentTransactionStore,
  PaymentRoutingTransactionStore {
  private readonly transactions = new Map<string, PaymentTransaction>();

  async save(transaction: PaymentTransaction): Promise<void> {
    const existing = this.transactions.get(transaction.id);
    if (existing && (
      existing.bixiye !== transaction.bixiye ||
      existing.amount !== transaction.amount ||
      existing.currency !== transaction.currency ||
      existing.reference !== transaction.reference ||
      (existing.furahaIdempotencyHash !== undefined &&
        transaction.furahaIdempotencyHash !== undefined &&
        existing.furahaIdempotencyHash !== transaction.furahaIdempotencyHash) ||
      (existing.codsiIdempotencyFingerprint !== undefined &&
        transaction.codsiIdempotencyFingerprint !== undefined &&
        existing.codsiIdempotencyFingerprint !== transaction.codsiIdempotencyFingerprint)
    )) {
      throw new PaymentError("Transaction ID is already recorded for different payment details.");
    }
    const dhacayaa = existing?.dhacayaa ?? transaction.dhacayaa;
    const waqtiguWuuDhacay = dhacayaa !== undefined &&
      Date.parse(dhacayaa) <= Date.now();
    const xaalad = existing?.status === "dhacay"
      ? "dhacay"
      : existing?.status === "laCeliyay"
        ? "laCeliyay"
        : waqtiguWuuDhacay && (existing?.status ?? transaction.status) === "sugaya"
          ? "dhacay"
          : transaction.status;

    if (existing && !waaXaaladBixinLaOggolYahay(existing.status, xaalad)) {
      throw new PaymentError("Payment status cannot transition from its current terminal status.");
    }

    this.transactions.set(transaction.id, {
      ...transaction,
      status: xaalad,
      bixiye: existing?.bixiye ?? transaction.bixiye,
      laAbuuray: existing?.laAbuuray ?? transaction.laAbuuray,
      dhacayaa,
      furahaIdempotencyHash:
        transaction.furahaIdempotencyHash ?? existing?.furahaIdempotencyHash,
      codsiIdempotencyFingerprint:
        transaction.codsiIdempotencyFingerprint ?? existing?.codsiIdempotencyFingerprint,
      celin: transaction.celin ?? existing?.celin
    });
  }

  async expireDue(asOf: string): Promise<void> {
    const waqti = Date.parse(asOf);
    if (!Number.isFinite(waqti)) {
      throw new PaymentError("Expiration check time must be a valid ISO date-time.");
    }

    for (const [lacagId, transaction] of this.transactions) {
      if (
        transaction.status === "sugaya" &&
        transaction.dhacayaa !== undefined &&
        Date.parse(transaction.dhacayaa) <= waqti
      ) {
        this.transactions.set(lacagId, { ...transaction, status: "dhacay" });
      }
    }
  }

  async list(query: PaymentTransactionQuery): Promise<PaymentTransactionPage> {
    await this.expireDue(new Date(Date.now()).toISOString());
    const filtered = Array.from(this.transactions.values())
      .filter((transaction) =>
        query.bixiye === undefined || transaction.bixiye === query.bixiye
      )
      .filter((transaction) =>
        query.xaalad === undefined || transaction.status === query.xaalad
      )
      .filter((transaction) =>
        query.lacagta === undefined || transaction.currency === query.lacagta
      )
      .filter((transaction) =>
        query.lagaBilaabo === undefined ||
        Date.parse(transaction.laAbuuray) >= Date.parse(query.lagaBilaabo)
      )
      .filter((transaction) =>
        query.ilaa === undefined ||
        Date.parse(transaction.laAbuuray) <= Date.parse(query.ilaa)
      )
      .sort((left, right) =>
        Date.parse(right.laAbuuray) - Date.parse(left.laAbuuray) ||
        left.id.localeCompare(right.id)
      );

    const offset = (query.bogga - 1) * query.xadka;
    return {
      lacagaha: filtered.slice(offset, offset + query.xadka),
      wadarta: filtered.length
    };
  }

  async findById(
    bixiye: Bixiye,
    lacagId: string
  ): Promise<PaymentTransaction | undefined> {
    const transaction = this.transactions.get(lacagId);
    return transaction?.bixiye === bixiye ? { ...transaction } : undefined;
  }

  async findPaymentById(lacagId: string): Promise<PaymentTransaction | undefined> {
    const transaction = this.transactions.get(lacagId);
    return transaction ? { ...transaction } : undefined;
  }

  async findByReference(
    bixiye: Bixiye,
    tixraac: string
  ): Promise<PaymentTransaction | undefined> {
    const matches = Array.from(this.transactions.values())
      .filter((transaction) =>
        transaction.bixiye === bixiye && transaction.reference === tixraac
      );
    return matches.length === 1 ? { ...matches[0] } : undefined;
  }

  async applyWebhookStatus(
    bixiye: Bixiye,
    lacagId: string,
    xaalad: XaaladdaLacagta
  ): Promise<WebhookStatusUpdate> {
    const existing = this.transactions.get(lacagId);
    if (!existing || existing.bixiye !== bixiye) {
      return "not-found";
    }
    if (existing.status === "dhacay") {
      return "expired";
    }
    if (
      existing.status === "sugaya" &&
      existing.dhacayaa !== undefined &&
      Date.parse(existing.dhacayaa) <= Date.now()
    ) {
      this.transactions.set(lacagId, { ...existing, status: "dhacay" });
      return "expired";
    }
    if (existing.status === xaalad) {
      return "unchanged";
    }
    if (!waaXaaladBixinLaOggolYahay(existing.status, xaalad)) {
      return "invalid-transition";
    }

    this.transactions.set(lacagId, { ...existing, status: xaalad });
    return "updated";
  }
}
