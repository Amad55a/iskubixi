import type { ProviderPayment } from "./payment-provider";
import type { XaaladLacagDhamaad } from "../types/payment";
import type { PaymentStateStore } from "./payment-store";
import { PaymentError } from "../errors";

export class InMemoryPaymentStore implements PaymentStateStore {
  private readonly payments = new Map<string, ProviderPayment>();

  save(payment: ProviderPayment): void {
    const existing = this.payments.get(payment.id);
    if (existing) {
      if (
        existing.amount !== payment.amount ||
        existing.currency !== payment.currency ||
        existing.reference !== payment.reference
      ) {
        throw new PaymentError("Payment ID is already recorded for different payment details.");
      }
      return;
    }
    this.payments.set(payment.id, payment);
  }

  findById(paymentId: string): ProviderPayment | undefined {
    return this.payments.get(paymentId);
  }

  updateStatus(
    paymentId: string,
    xaalad: XaaladLacagDhamaad
  ): ProviderPayment | undefined {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      return undefined;
    }

    if (payment.status !== "sugaya") {
      throw new PaymentError("Payment has already reached a terminal status.");
    }

    const updatedPayment: ProviderPayment = { ...payment, status: xaalad };
    this.payments.set(paymentId, updatedPayment);
    return updatedPayment;
  }

  refund(paymentId: string): ProviderPayment | undefined {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      return undefined;
    }
    if (payment.status !== "guuleystay") {
      throw new PaymentError("Only successful payments can be refunded.");
    }

    const refundedPayment: ProviderPayment = {
      ...payment,
      status: "laCeliyay"
    };
    this.payments.set(paymentId, refundedPayment);
    return refundedPayment;
  }
}
