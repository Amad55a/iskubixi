import type { Bixiye } from "../types/configuration";
import type { XaaladdaCelin } from "../types/payment";
import { RefundError } from "../errors";

export interface RefundRecord {
  id: string;
  providerRefundId: string;
  lacagId: string;
  bixiye: Bixiye;
  xaalad: XaaladdaCelin;
  laAbuuray: string;
  laCusboonaysiiyay: string;
}

export type RefundStatusUpdate =
  | "updated"
  | "unchanged"
  | "invalid-transition"
  | "not-found";

export interface RefundStore {
  /**
   * Atomically create/update a refund while preserving identity, provider,
   * payment association, and valid pending-to-terminal status transitions.
   */
  save(refund: RefundRecord): Promise<RefundStatusUpdate>;
  findById(celinId: string): Promise<RefundRecord | undefined>;
  findByProviderRefundId(
    bixiye: Bixiye,
    providerRefundId: string
  ): Promise<RefundRecord | undefined>;
  /** Return the most recently created refund attempt for this payment. */
  findByPaymentId(
    bixiye: Bixiye,
    lacagId: string
  ): Promise<RefundRecord | undefined>;
  applyWebhookStatus(
    bixiye: Bixiye,
    providerRefundId: string,
    xaalad: XaaladdaCelin
  ): Promise<RefundStatusUpdate>;
}

function waaKalaGuurCelinLaOggolYahay(
  hore: XaaladdaCelin,
  cusub: XaaladdaCelin
): boolean {
  return hore === cusub || hore === "sugaya";
}

export class InMemoryRefundStore implements RefundStore {
  private readonly refunds = new Map<string, RefundRecord>();

  async save(refund: RefundRecord): Promise<RefundStatusUpdate> {
    const existing = this.refunds.get(refund.id);
    const conflictingRefund = Array.from(this.refunds.values()).find(
      (record) =>
        record.id !== refund.id &&
        record.bixiye === refund.bixiye &&
        record.providerRefundId === refund.providerRefundId
    );
    if (conflictingRefund) {
      if (conflictingRefund.lacagId === refund.lacagId) {
        return "unchanged";
      }
      throw new RefundError("Provider refund ID is already recorded for another payment.");
    }
    if (existing) {
      if (
        existing.bixiye !== refund.bixiye ||
        existing.providerRefundId !== refund.providerRefundId ||
        existing.lacagId !== refund.lacagId
      ) {
        throw new RefundError("Refund ID is already recorded for a different refund.");
      }
      if (!waaKalaGuurCelinLaOggolYahay(existing.xaalad, refund.xaalad)) {
        return "invalid-transition";
      }
      if (existing.xaalad === refund.xaalad) {
        return "unchanged";
      }
    }

    this.refunds.set(refund.id, {
      ...refund,
      laAbuuray: existing?.laAbuuray ?? refund.laAbuuray
    });
    return "updated";
  }

  async findById(celinId: string): Promise<RefundRecord | undefined> {
    const refund = this.refunds.get(celinId);
    return refund ? { ...refund } : undefined;
  }

  async findByProviderRefundId(
    bixiye: Bixiye,
    providerRefundId: string
  ): Promise<RefundRecord | undefined> {
    const matches = Array.from(this.refunds.values()).filter(
      (refund) =>
        refund.bixiye === bixiye &&
        refund.providerRefundId === providerRefundId
    );
    return matches.length === 1 ? { ...matches[0] } : undefined;
  }

  async findByPaymentId(
    bixiye: Bixiye,
    lacagId: string
  ): Promise<RefundRecord | undefined> {
    const matches = Array.from(this.refunds.values()).filter(
      (refund) => refund.bixiye === bixiye && refund.lacagId === lacagId
    );
    const latest = matches[matches.length - 1];
    return latest ? { ...latest } : undefined;
  }

  async applyWebhookStatus(
    bixiye: Bixiye,
    providerRefundId: string,
    xaalad: XaaladdaCelin
  ): Promise<RefundStatusUpdate> {
    const matches = Array.from(this.refunds.values()).filter(
      (record) =>
        record.bixiye === bixiye &&
        record.providerRefundId === providerRefundId
    );
    if (matches.length !== 1) {
      return "not-found";
    }
    const refund = matches[0];
    if (refund.xaalad === xaalad) {
      return "unchanged";
    }
    if (!waaKalaGuurCelinLaOggolYahay(refund.xaalad, xaalad)) {
      return "invalid-transition";
    }

    this.refunds.set(refund.id, {
      ...refund,
      xaalad,
      laCusboonaysiiyay: new Date().toISOString()
    });
    return "updated";
  }
}
