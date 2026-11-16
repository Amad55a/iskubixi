import { randomUUID } from "node:crypto";
import type {
  PaymentIdRequest,
  PaymentProvider,
  PaymentRequest,
  PaymentRefundRequest,
  PaymentRefundStatusRequest,
  PaymentVerification,
  ProviderPayment,
  ProviderRefund,
  ProviderRefundStatus
} from "./payment-provider";
import { InMemoryPaymentStore } from "./in-memory-payment-store";
import type { PaymentStateStore } from "./payment-store";
import type { XaaladLacagDhamaad } from "../types/payment";

export class SimulatedPaymentProvider implements PaymentProvider {
  readonly capabilities = Object.freeze({
    paymentCreation: true,
    paymentLookup: true,
    paymentVerification: true,
    paymentCancellation: false,
    refundCreation: true,
    refundStatusLookup: true
  });
  private readonly refunds = new Map<string, {
    paymentId: string;
    status: ProviderRefundStatus;
  }>();

  constructor(
    private readonly paymentStore: PaymentStateStore,
    private readonly initialRefundStatus: ProviderRefundStatus = "guuleystay"
  ) {}

  async createPayment(request: PaymentRequest): Promise<ProviderPayment> {
    const payment: ProviderPayment = {
      id: `sim-${randomUUID()}`,
      amount: request.amount,
      currency: request.currency,
      reference: request.reference,
      status: "sugaya"
    };

    await this.paymentStore.save(payment);
    return payment;
  }

  async findPayment(request: PaymentIdRequest): Promise<ProviderPayment | undefined> {
    return await this.paymentStore.findById(request.paymentId);
  }

  async verifyPayment(request: PaymentIdRequest): Promise<PaymentVerification> {
    const payment = await this.paymentStore.findById(request.paymentId);

    return {
      exists: payment !== undefined,
      payment,
      source: "simulated"
    };
  }

  async simulateStatus(
    paymentId: string,
    xaalad: XaaladLacagDhamaad
  ): Promise<ProviderPayment | undefined> {
    return await this.paymentStore.updateStatus(paymentId, xaalad);
  }

  async refundPayment({ paymentId }: PaymentRefundRequest): Promise<ProviderRefund> {
    const payment = await this.paymentStore.findById(paymentId);
    if (!payment) {
      throw new Error(`Payment "${paymentId}" was not found.`);
    }
    if (payment.status !== "guuleystay") {
      throw new Error("Only successful payments can be refunded.");
    }

    const refund: ProviderRefund = {
      id: `sim-refund-${randomUUID()}`,
      status: this.initialRefundStatus
    };
    if (refund.status === "guuleystay") {
      await this.paymentStore.refund(paymentId);
    }
    this.refunds.set(refund.id, { paymentId, status: refund.status });
    return refund;
  }

  async findRefundStatus(
    request: PaymentRefundStatusRequest
  ): Promise<ProviderRefund | undefined> {
    const refund = this.refunds.get(request.refundId);
    if (!refund || refund.paymentId !== request.paymentId) {
      return undefined;
    }
    return { id: request.refundId, status: refund.status };
  }

  async simulateRefundStatus(
    refundId: string,
    xaalad: ProviderRefundStatus
  ): Promise<ProviderRefund | undefined> {
    const refund = this.refunds.get(refundId);
    if (!refund) {
      return undefined;
    }
    if (refund.status !== "sugaya") {
      throw new Error("Refund has already reached a terminal status.");
    }
    if (xaalad === "sugaya") {
      return { id: refundId, status: refund.status };
    }
    if (xaalad === "guuleystay") {
      await this.paymentStore.refund(refund.paymentId);
    }
    const updated = { ...refund, status: xaalad };
    this.refunds.set(refundId, updated);
    return { id: refundId, status: xaalad };
  }
}
