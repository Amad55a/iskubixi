import type { Bixiye } from "./configuration";

export interface ProviderCapabilities {
  paymentCreation: boolean;
  paymentLookup: boolean;
  paymentVerification: boolean;
  paymentCancellation: boolean;
  refundCreation: boolean;
  refundStatusLookup: boolean;
  qrPayment: boolean;
  webhookSignatureVerification: boolean;
}

export type ProviderCapabilityOverrides = Partial<
  Pick<
    ProviderCapabilities,
    | "paymentCreation"
    | "paymentLookup"
    | "paymentVerification"
    | "paymentCancellation"
    | "refundCreation"
    | "refundStatusLookup"
  >
> & {
  /** True only when the remote provider documents idempotency-key semantics. */
  paymentIdempotency?: boolean;
};

export interface CodsiBixiyeAwood {
  bixiye: Bixiye;
}

export interface NatiijoBixiyeAwood {
  bixiye: Bixiye;
  awoodaha: ProviderCapabilities;
}
