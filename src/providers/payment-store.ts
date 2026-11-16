import type { XaaladLacagDhamaad } from "../types/payment";
import type { ProviderPayment } from "./payment-provider";

export type StorageResult<T> = T | Promise<T>;

/** Storage contract for simulated/provider payment state. */
export interface PaymentStateStore {
  /** Create by unique payment ID without overwriting existing payment details. */
  save(payment: ProviderPayment): StorageResult<void>;
  findById(paymentId: string): StorageResult<ProviderPayment | undefined>;
  /** Atomically change only an eligible pending payment to a final status. */
  updateStatus(
    paymentId: string,
    xaalad: XaaladLacagDhamaad
  ): StorageResult<ProviderPayment | undefined>;
  /** Atomically mark only a confirmed successful payment as refunded. */
  refund(paymentId: string): StorageResult<ProviderPayment | undefined>;
}
