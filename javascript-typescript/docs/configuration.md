# Configuration

`IskuBixiQaabeyn` defines provider credentials, adapters, storage, and optional
authentication adapters.

```ts
import { IskuBixi, StripePaymentProviderFactory } from "iskubixi";

const sdk = new IskuBixi({
  bixiyeyaasha: {
    stripe: { apiKey: process.env.STRIPE_SECRET_KEY! }
  },
  laqabsadayaasha: {
    stripe: new StripePaymentProviderFactory({ environment: "test" })
  }
});
```

## Configuration fields

| Field | Purpose |
|---|---|
| `bixiyeyaasha` | Provider credentials |
| `allowSimulation` | Explicit opt-in for local development |
| `laqabsadayaasha` | Payment provider factories |
| `laqabsadayaashaWebhook` | Provider webhook adapters |
| `keydkaIdempotency` | Payment idempotency store |
| `keydkaCelin` | Refund idempotency store |
| `keydkaCelinDiiwaanka` | Refund records |
| `keydkaLacagaha` | Transaction history |
| `keydkaLacagahaBixiyaha` | Provider payment state used by the simulator |
| `keydkaQr` | QR records |
| `keydkaWebhook` | Webhook event and retry state |
| `keydkaOgolaanshaha` | Payment authorization records |
| `amaanood` | Passkey and external authentication configuration |

## Environment variables

IskuBixi does not load `.env` files automatically. Read variables in the
application process and pass them to the SDK.

```ts
const apiKey = process.env.STRIPE_SECRET_KEY;
if (!apiKey) throw new Error("STRIPE_SECRET_KEY is required");
```

`.env` is configuration storage, not encryption at rest. Use a deployment
secret manager and rotate credentials according to provider guidance.

## Environment modes

- Stripe test mode requires `sk_test_` and `environment: "test"`.
- Stripe live mode requires `sk_live_` and `environment: "live"`.
- PayPal has `sandbox` and `live` factory environments.
- WaafiPay currently has only `sandbox`.
- Live legacy provider identifiers require a real adapter and never silently
  fall back to simulation.
