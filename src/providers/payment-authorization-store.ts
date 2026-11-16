import type { AmaanoodHab } from "./amaanood-auth-adapter";
import type { Bixiye } from "../types/configuration";

export type PaymentAuthorizationStatus =
  | "pending"
  | "verifying"
  | "authorized"
  | "failed"
  | "expired"
  | "processing"
  | "reconciliation_required";

export type PaymentAuthorizationFailure =
  | "authentication_failed"
  | "provider_outcome_uncertain";

export interface PaymentAuthorizationPaymentRequest {
  qadarka: number;
  lacagta: string;
  bixiye: Bixiye;
  tixraac: string;
  lambarka?: string;
  dhacayaa?: string;
}

export interface PaymentAuthorizationRecord {
  authorizationId: string;
  userId: string;
  method: AmaanoodHab;
  payment: PaymentAuthorizationPaymentRequest;
  paymentBinding: string;
  paymentExpiresAt?: string;
  expiresAt: number;
  createdAt: string;
  authenticationSessionId: string;
  status: PaymentAuthorizationStatus;
  paymentId?: string;
  failure?: PaymentAuthorizationFailure;
}

export interface PaymentAuthorizationStore {
  /** Atomically create a unique authorization record without replacing an existing one. */
  create(record: PaymentAuthorizationRecord): Promise<boolean>;
  /** Atomically move a matching, unexpired pending record to verifying. */
  claimForVerification(
    authorizationId: string,
    userId: string,
    now: number
  ): Promise<PaymentAuthorizationRecord | undefined>;
  /** Atomically fail only an authorization currently being verified. */
  markVerificationFailure(
    authorizationId: string,
    userId: string
  ): Promise<boolean>;
  /** Atomically authorize only a verifying, unexpired record. */
  markAuthorized(
    authorizationId: string,
    userId: string,
    now: number
  ): Promise<boolean>;
  /** Atomically claim the one allowed provider payment attempt. */
  claimForProcessing(
    authorizationId: string,
    userId: string,
    now: number
  ): Promise<PaymentAuthorizationRecord | undefined>;
  /** Record a returned payment ID without changing the authorization lifecycle state. */
  recordPaymentCreation(
    authorizationId: string,
    userId: string,
    paymentId: string
  ): Promise<boolean>;
  /** Prevent further attempts when the provider outcome cannot be established safely. */
  markReconciliationRequired(
    authorizationId: string,
    userId: string,
    paymentId?: string
  ): Promise<boolean>;
  /** Return a record only to its owning application user. */
  findById(
    authorizationId: string,
    userId: string,
    now: number
  ): Promise<PaymentAuthorizationRecord | undefined>;
}

function copyRecord(
  record: PaymentAuthorizationRecord
): PaymentAuthorizationRecord {
  return {
    ...record,
    payment: { ...record.payment }
  };
}

export class InMemoryPaymentAuthorizationStore
implements PaymentAuthorizationStore {
  private readonly records = new Map<string, PaymentAuthorizationRecord>();

  async create(record: PaymentAuthorizationRecord): Promise<boolean> {
    if (this.records.has(record.authorizationId)) {
      return false;
    }
    this.records.set(record.authorizationId, copyRecord(record));
    return true;
  }

  async claimForVerification(
    authorizationId: string,
    userId: string,
    now: number
  ): Promise<PaymentAuthorizationRecord | undefined> {
    const record = this.records.get(authorizationId);
    if (!record || record.userId !== userId || record.status !== "pending") {
      return undefined;
    }
    if (record.expiresAt <= now) {
      this.records.set(authorizationId, { ...record, status: "expired" });
      return undefined;
    }
    const claimed = { ...record, status: "verifying" as const };
    this.records.set(authorizationId, claimed);
    return copyRecord(claimed);
  }

  async markVerificationFailure(
    authorizationId: string,
    userId: string
  ): Promise<boolean> {
    const record = this.ownedRecord(authorizationId, userId);
    if (!record || record.status !== "verifying") {
      return false;
    }
    this.records.set(authorizationId, {
      ...record,
      status: "failed",
      failure: "authentication_failed"
    });
    return true;
  }

  async markAuthorized(
    authorizationId: string,
    userId: string,
    now: number
  ): Promise<boolean> {
    const record = this.ownedRecord(authorizationId, userId);
    if (!record || record.status !== "verifying") {
      return false;
    }
    if (record.expiresAt <= now) {
      this.records.set(authorizationId, { ...record, status: "expired" });
      return false;
    }
    this.records.set(authorizationId, { ...record, status: "authorized" });
    return true;
  }

  async claimForProcessing(
    authorizationId: string,
    userId: string,
    now: number
  ): Promise<PaymentAuthorizationRecord | undefined> {
    const record = this.ownedRecord(authorizationId, userId);
    if (!record || record.status !== "authorized") {
      return undefined;
    }
    if (record.expiresAt <= now) {
      this.records.set(authorizationId, { ...record, status: "expired" });
      return undefined;
    }
    const claimed = { ...record, status: "processing" as const };
    this.records.set(authorizationId, claimed);
    return copyRecord(claimed);
  }

  async recordPaymentCreation(
    authorizationId: string,
    userId: string,
    paymentId: string
  ): Promise<boolean> {
    const record = this.ownedRecord(authorizationId, userId);
    if (
      !record ||
      record.status !== "processing" ||
      record.paymentId !== undefined ||
      typeof paymentId !== "string" ||
      paymentId.trim() === ""
    ) {
      return false;
    }
    this.records.set(authorizationId, { ...record, paymentId });
    return true;
  }

  async markReconciliationRequired(
    authorizationId: string,
    userId: string,
    paymentId?: string
  ): Promise<boolean> {
    const record = this.ownedRecord(authorizationId, userId);
    if (!record || record.status !== "processing") {
      return false;
    }
    this.records.set(authorizationId, {
      ...record,
      status: "reconciliation_required",
      failure: "provider_outcome_uncertain",
      ...(paymentId === undefined ? {} : { paymentId })
    });
    return true;
  }

  async findById(
    authorizationId: string,
    userId: string,
    now: number
  ): Promise<PaymentAuthorizationRecord | undefined> {
    const record = this.ownedRecord(authorizationId, userId);
    if (!record) {
      return undefined;
    }
    if (
      (record.status === "pending" || record.status === "authorized") &&
      record.expiresAt <= now
    ) {
      const expired = { ...record, status: "expired" as const };
      this.records.set(authorizationId, expired);
      return copyRecord(expired);
    }
    return copyRecord(record);
  }

  private ownedRecord(
    authorizationId: string,
    userId: string
  ): PaymentAuthorizationRecord | undefined {
    const record = this.records.get(authorizationId);
    return record?.userId === userId ? record : undefined;
  }
}
