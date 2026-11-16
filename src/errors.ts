export const IskuBixiErrorCode = {
  GENERAL: "ISKUBIXI_ERROR",
  CONFIGURATION: "ISKUBIXI_CONFIGURATION_ERROR",
  VALIDATION: "ISKUBIXI_VALIDATION_ERROR",
  PROVIDER: "ISKUBIXI_PROVIDER_ERROR",
  UNSUPPORTED_OPERATION: "ISKUBIXI_UNSUPPORTED_OPERATION",
  PAYMENT: "ISKUBIXI_PAYMENT_ERROR",
  REFUND: "ISKUBIXI_REFUND_ERROR",
  WEBHOOK_VERIFICATION: "ISKUBIXI_WEBHOOK_VERIFICATION_ERROR",
  WEBAUTHN: "ISKUBIXI_WEBAUTHN_ERROR",
  STORAGE: "ISKUBIXI_STORAGE_ERROR",
  IDEMPOTENCY: "ISKUBIXI_IDEMPOTENCY_ERROR"
} as const;

export type IskuBixiErrorCode =
  (typeof IskuBixiErrorCode)[keyof typeof IskuBixiErrorCode];

export type IskuBixiErrorContext = Readonly<
  Record<string, string | number | boolean>
>;

export interface IskuBixiErrorOptions {
  cause?: unknown;
  context?: IskuBixiErrorContext;
}

const sensitiveContextKey =
  /secret|api.?key|token|credential|authorization|signature|password|body|payload|header/i;

function safeContext(
  context: IskuBixiErrorContext | undefined
): IskuBixiErrorContext | undefined {
  if (!context) {
    return undefined;
  }

  const entries = Object.entries(context).filter(
    ([key, value]) =>
      !sensitiveContextKey.test(key) &&
      (typeof value === "boolean" || typeof value === "number" ||
        (typeof value === "string" && value.length <= 256))
  );
  return entries.length > 0 ? Object.freeze(Object.fromEntries(entries)) : undefined;
}

export class IskuBixiError extends Error {
  readonly code: IskuBixiErrorCode;
  readonly context?: IskuBixiErrorContext;
  readonly cause?: unknown;

  constructor(
    code: IskuBixiErrorCode,
    message: string,
    options: IskuBixiErrorOptions = {}
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.context = safeContext(options.context);
    if (options.cause !== undefined) {
      Object.defineProperty(this, "cause", {
        configurable: false,
        enumerable: false,
        value: options.cause,
        writable: false
      });
    }
  }

  toJSON(): {
    name: string;
    code: IskuBixiErrorCode;
    message: string;
    context?: IskuBixiErrorContext;
  } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.context === undefined ? {} : { context: this.context })
    };
  }
}

export class ConfigurationError extends IskuBixiError {
  constructor(message: string, options?: IskuBixiErrorOptions) {
    super(IskuBixiErrorCode.CONFIGURATION, message, options);
  }
}

export class ValidationError extends IskuBixiError {
  constructor(message: string, options?: IskuBixiErrorOptions) {
    super(IskuBixiErrorCode.VALIDATION, message, options);
  }
}

export class ProviderError extends IskuBixiError {
  constructor(message: string, options?: IskuBixiErrorOptions) {
    super(IskuBixiErrorCode.PROVIDER, message, options);
  }
}

export class UnsupportedOperationError extends IskuBixiError {
  constructor(
    provider: string,
    operation: string,
    message = `Payment provider "${provider}" does not support ${operation}; select another provider or register an adapter that implements it.`
  ) {
    super(IskuBixiErrorCode.UNSUPPORTED_OPERATION, message, {
      context: { provider, operation }
    });
  }
}

export class PaymentError extends IskuBixiError {
  constructor(message: string, options?: IskuBixiErrorOptions) {
    super(IskuBixiErrorCode.PAYMENT, message, options);
  }
}

export class RefundError extends IskuBixiError {
  constructor(message: string, options?: IskuBixiErrorOptions) {
    super(IskuBixiErrorCode.REFUND, message, options);
  }
}

export class WebhookVerificationError extends IskuBixiError {
  constructor(message: string, options?: IskuBixiErrorOptions) {
    super(IskuBixiErrorCode.WEBHOOK_VERIFICATION, message, options);
  }
}

export class WebAuthnError extends IskuBixiError {
  constructor(message: string, options?: IskuBixiErrorOptions) {
    super(IskuBixiErrorCode.WEBAUTHN, message, options);
  }
}

export class StorageError extends IskuBixiError {
  constructor(message: string, options?: IskuBixiErrorOptions) {
    super(IskuBixiErrorCode.STORAGE, message, options);
  }
}

export class IdempotencyError extends IskuBixiError {
  constructor(message: string, options?: IskuBixiErrorOptions) {
    super(IskuBixiErrorCode.IDEMPOTENCY, message, options);
  }
}
