# Custom providers

Implement `PaymentProviderFactory` and `PaymentProvider` for an officially
documented provider.

```ts
import type {
  PaymentProvider,
  PaymentProviderFactory,
  ProviderCredentials
} from "iskubixi";

class ApplicationProvider implements PaymentProvider {
  readonly capabilities = {
    paymentCreation: true,
    paymentLookup: true,
    paymentVerification: true,
    paymentCancellation: false,
    refundCreation: false,
    refundStatusLookup: false
  };

  constructor(private readonly credentials: ProviderCredentials) {}

  async createPayment(request) {
    // Call the official provider API with server-side credentials.
    throw new Error("Implement against your provider's official API");
  }

  async findPayment({ paymentId }) {
    // Retrieve and normalize provider state.
    throw new Error(`Implement lookup for ${paymentId}`);
  }

  async verifyPayment({ paymentId }) {
    // Return exists, payment, and source: "adapter".
    throw new Error(`Implement verification for ${paymentId}`);
  }
}

export const applicationProviderFactory: PaymentProviderFactory = {
  create(credentials) {
    return new ApplicationProvider(credentials);
  }
};
```

The custom provider must validate responses, exact payment IDs, amounts,
currencies, references, terminal states, timeout behavior, idempotency, and
credential redaction. Do not add an unofficial endpoint or response mapping.
