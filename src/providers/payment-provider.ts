import type { XaaladdaLacagta } from "../types/payment";
import type { ProviderCapabilityOverrides } from "../types/provider-capabilities";

export type ProviderCredentials = Readonly<Record<string, string>>;

export interface PaymentRequest {
  amount: number;
  currency: string;
  reference: string;
  accountNumber?: string;
}

export interface PaymentIdRequest {
  paymentId: string;
}

export interface PaymentRefundRequest extends PaymentIdRequest {
  idempotencyKey: string;
}

export interface PaymentRefundStatusRequest extends PaymentIdRequest {
  refundId: string;
}

export type ProviderRefundStatus = "sugaya" | "guuleystay" | "fashilmay";

export interface ProviderRefund {
  id: string;
  status: ProviderRefundStatus;
}

export interface ProviderPayment {
  id: string;
  amount: number;
  currency: string;
  reference: string;
  status: XaaladdaLacagta;
}

export type PaymentVerificationSource = "simulated" | "adapter";

export interface PaymentVerification {
  exists: boolean;
  payment?: ProviderPayment;
  source: PaymentVerificationSource;
}

export interface PaymentProvider {
  /**
   * Optional declarations for operations unavailable despite a compatible
   * method being present (for example, an adapter with documented limits).
   */
  readonly capabilities?: ProviderCapabilityOverrides;
  createPayment(request: PaymentRequest): Promise<ProviderPayment>;
  findPayment(request: PaymentIdRequest): Promise<ProviderPayment | undefined>;
  verifyPayment(request: PaymentIdRequest): Promise<PaymentVerification>;
  cancelPayment?(request: PaymentIdRequest): Promise<void>;
  refundPayment?(request: PaymentRefundRequest): Promise<ProviderRefund>;
  findRefundStatus?(
    request: PaymentRefundStatusRequest
  ): Promise<ProviderRefund | undefined>;
}

export interface PaymentProviderFactory {
  create(credentials: ProviderCredentials): PaymentProvider;
}
