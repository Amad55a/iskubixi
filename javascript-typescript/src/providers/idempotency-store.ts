import type { ProviderPayment, ProviderRefund } from "./payment-provider";
import { IdempotencyError } from "../errors";

export interface PaymentIdempotencyStore {
  /**
   * Must atomically return one result per key and reject a key reused with a
   * different fingerprint, including across concurrent callers.
   */
  getOrCreate(
    key: string,
    fingerprint: string,
    createPayment: () => Promise<ProviderPayment>
  ): Promise<ProviderPayment>;
}

interface IdempotentOperation {
  fingerprint: string;
  result: Promise<ProviderPayment>;
}

export class InMemoryPaymentIdempotencyStore implements PaymentIdempotencyStore {
  private readonly operations = new Map<string, IdempotentOperation>();

  async getOrCreate(
    key: string,
    fingerprint: string,
    createPayment: () => Promise<ProviderPayment>
  ): Promise<ProviderPayment> {
    const existing = this.operations.get(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new IdempotencyError("Idempotency key was already used with different payment details.");
      }
      return existing.result;
    }

    const operation: IdempotentOperation = {
      fingerprint,
      result: Promise.resolve().then(createPayment)
    };
    this.operations.set(key, operation);

    try {
      return await operation.result;
    } catch (error) {
      if (this.operations.get(key) === operation) {
        this.operations.delete(key);
      }
      throw error;
    }
  }
}

export interface RefundIdempotencyStore {
  /**
   * Must atomically deduplicate keys and prevent concurrent refunds for one payment.
   */
  get(key: string, fingerprint: string): Promise<ProviderRefund | undefined>;
  getOrCreate(
    key: string,
    fingerprint: string,
    paymentIdentity: string,
    createRefund: () => Promise<ProviderRefund>
  ): Promise<ProviderRefund>;
}

interface IdempotentRefundOperation {
  fingerprint: string;
  paymentIdentity: string;
  result: Promise<ProviderRefund>;
}

export class InMemoryRefundIdempotencyStore implements RefundIdempotencyStore {
  private readonly operations = new Map<string, IdempotentRefundOperation>();
  private readonly paymentOperations = new Map<string, IdempotentRefundOperation>();

  async get(key: string, fingerprint: string): Promise<ProviderRefund | undefined> {
    const existing = this.operations.get(key);
    if (!existing) {
      return undefined;
    }
    if (existing.fingerprint !== fingerprint) {
      throw new IdempotencyError("Refund idempotency key was already used with different details.");
    }
    return existing.result;
  }

  async getOrCreate(
    key: string,
    fingerprint: string,
    paymentIdentity: string,
    createRefund: () => Promise<ProviderRefund>
  ): Promise<ProviderRefund> {
    const existing = this.operations.get(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new IdempotencyError("Refund idempotency key was already used with different details.");
      }
      return existing.result;
    }
    if (this.paymentOperations.has(paymentIdentity)) {
      throw new IdempotencyError("A refund is already pending or completed for this payment.");
    }

    const operation: IdempotentRefundOperation = {
      fingerprint,
      paymentIdentity,
      result: Promise.resolve().then(createRefund)
    };
    this.operations.set(key, operation);
    this.paymentOperations.set(paymentIdentity, operation);

    const result = await operation.result;
    if (
      result.status === "fashilmay" &&
      this.paymentOperations.get(paymentIdentity) === operation
    ) {
      this.paymentOperations.delete(paymentIdentity);
    }
    return result;
  }
}
