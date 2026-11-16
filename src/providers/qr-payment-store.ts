import type { Bixiye } from "../types/configuration";

export type XaaladdaQr = "furan" | "joojiyay" | "dhacay" | "laIsticmaalay";
export type XaaladdaQrRecord = Extract<XaaladdaQr, "furan" | "joojiyay">;

export interface QrPaymentRecord {
  tixraac: string;
  lacagId: string;
  bixiye: Bixiye;
  laAbuuray: string;
  dhacayaa: string;
  xaalad: XaaladdaQrRecord;
}

export interface QrPaymentStore {
  /**
   * Atomically create a record without reusing an existing reference or payment ID.
   */
  create(record: QrPaymentRecord): Promise<void>;
  find(tixraac: string): Promise<QrPaymentRecord | undefined>;
  findByPaymentId(lacagId: string): Promise<QrPaymentRecord | undefined>;
  /** Change only an open QR reference to the cancelled state. */
  cancel(tixraac: string): Promise<QrPaymentRecord | undefined>;
}

export class InMemoryQrPaymentStore implements QrPaymentStore {
  private readonly records = new Map<string, QrPaymentRecord>();

  async create(record: QrPaymentRecord): Promise<void> {
    if (
      this.records.has(record.tixraac) ||
      Array.from(this.records.values()).some((existing) => existing.lacagId === record.lacagId)
    ) {
      throw new Error("QR payment reference or payment ID already exists.");
    }

    this.records.set(record.tixraac, { ...record });
  }

  async find(tixraac: string): Promise<QrPaymentRecord | undefined> {
    const record = this.records.get(tixraac);
    return record ? { ...record } : undefined;
  }

  async findByPaymentId(lacagId: string): Promise<QrPaymentRecord | undefined> {
    const record = Array.from(this.records.values())
      .find((transaction) => transaction.lacagId === lacagId);
    return record ? { ...record } : undefined;
  }

  async cancel(tixraac: string): Promise<QrPaymentRecord | undefined> {
    const record = this.records.get(tixraac);
    if (!record || record.xaalad !== "furan") {
      return undefined;
    }

    const cancelled = { ...record, xaalad: "joojiyay" as const };
    this.records.set(tixraac, cancelled);
    return { ...cancelled };
  }
}
