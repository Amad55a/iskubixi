# IskuBixi

### One SDK. Many Payments. Smarter Authentication.

**Payments · QR Codes · Face · Fingerprint · Eye · Palm · Passkeys**

[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178C6)](https://www.typescriptlang.org/)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

IskuBixi is an open-source JavaScript and TypeScript SDK for applications that
need payment-provider routing, QR workflows, passkey authentication, and
adapter-based biometric authorization.

You install the SDK in your backend or application server. You configure your
own provider accounts and credentials, own your application users and database,
and control all business decisions. IskuBixi does not require a central API key,
a hosted IskuBixi payment backend, or an IskuBixi database.

## Problems it addresses

- A consistent payment API across multiple provider adapters.
- Explicit provider selection for each payment.
- Idempotency and duplicate-payment protection.
- Verified provider and webhook status before marking a payment successful.
- QR creation, reading, expiry, status, and cancellation.
- WebAuthn/passkey registration and authentication.
- External, modality-specific biometric adapters.
- Payment authorization bound to user, amount, currency, provider, and reference.

## Major features

| Area | Implemented capability |
|---|---|
| Payments | Create, lookup, verify, confirm, list, expire, and refund through the payment API |
| Providers | Stripe, PayPal, and WaafiPay adapters; custom `PaymentProvider` registration |
| QR | Create, encode/read, verify, inspect status, and cancel where supported |
| Passkeys | Server-side WebAuthn registration, authentication, credential listing, and revocation |
| Biometrics | Adapter interfaces for face, fingerprint, eye, and palm verification |
| Authorization | Short-lived, exact-payment authorization bound to a verified authentication result |
| Webhooks | Raw-body signature verification, normalized events, deduplication, retry, and replay protection |
| Storage | Replaceable in-memory or application-owned stores |

## Installation

Requires Node.js 20 or later.

```sh
npm install iskubixi
```

## Quick example

The simulator is for local development only. For real providers, register an
explicit provider factory and keep credentials on the server.

### JavaScript

```js
const { IskuBixi } = require("iskubixi");

const sdk = new IskuBixi({
  allowSimulation: true,
  bixiyeyaasha: {
    edahab: {
      apiKey: "local-demo-only"
    }
  }
});

async function main() {
  const payment = await sdk.lacag.samee({
    qadarka: 20,
    lacagta: "USD",
    bixiye: "edahab",
    tixraac: "LOCAL-ORDER-1",
    furahaIdempotency: "LOCAL-ORDER-1-ATTEMPT-1"
  });

  console.log(payment.xaalad); // "sugaya"
}

main().catch(console.error);
```

### TypeScript

```ts
import { IskuBixi } from "iskubixi";

const sdk = new IskuBixi({
  allowSimulation: true,
  bixiyeyaasha: {
    edahab: { apiKey: "local-demo-only" }
  }
});

const payment = await sdk.lacag.samee({
  qadarka: 20,
  lacagta: "USD",
  bixiye: "edahab",
  tixraac: "LOCAL-ORDER-1"
});
```

The published package is CommonJS with TypeScript declarations.

## Providers

| Provider | Actual status |
|---|---|
| Stripe | PaymentIntents, lookup, verification, confirmation, cancellation, refunds, and raw-body webhooks |
| PayPal | Orders, OAuth, capture, lookup, refunds, and remote webhook verification |
| WaafiPay | Sandbox purchase creation and webhook verification; lookup and refunds are not implemented |
| EVC | No direct API adapter |
| eDahab | No direct API adapter |
| Zaad | No direct API adapter |
| Banks | No direct API adapters |
| Google Pay | Processor-dependent architecture only |
| Simulator | Local development/testing only |

No official sandbox or live transaction test is claimed without credentials and
actual evidence. Legacy provider identifiers never silently replace live-mode
requests with a successful local payment.

For real Stripe configuration:

```ts
import { IskuBixi, StripePaymentProviderFactory } from "iskubixi";

const sdk = new IskuBixi({
  bixiyeyaasha: {
    stripe: { apiKey: process.env.STRIPE_SECRET_KEY! }
  },
  laqabsadayaasha: {
    stripe: new StripePaymentProviderFactory({
      environment: "test"
    })
  }
});
```

Use `environment: "live"` only with a live key and a production checkout
verified through provider APIs and webhooks.

## QR payments

```ts
const qr = await sdk.qr.samee({
  qadarka: 20,
  lacagta: "USD",
  bixiye: "edahab",
  lambarka: "252611111111",
  dhacayaa: new Date(Date.now() + 15 * 60 * 1000).toISOString()
});

const scanned = await sdk.qr.akhriso({ nuxur: qr.nuxur });
```

QR scanning does not create or fulfill another payment.

## Authentication and biometrics

`IskuBixi.amaanood.waji`, `faraha`, `isha`, and `calaacal` are adapter-backed
entry points. The SDK does not include universal face, fingerprint, iris, or
palm hardware. It does not store raw biometric data.

WebAuthn/passkey operations are available through `Amaanood` and through
`IskuBixi.amaanood` when external adapters are configured. An authentication
challenge can authorize a payment only after the exact user, amount, currency,
provider, and reference are bound and verified.

Authentication approval is not payment success; the provider or verified
webhook must confirm the payment.

## Security

- Keep provider secrets and webhook secrets in server-side secret management.
- Never send credentials to browser code.
- Never log credentials or full provider responses containing secrets.
- Use HTTPS in deployed WebAuthn origins.
- Use `lacag.cadee()` or provider/webhook confirmation rather than client success messages.
- Store idempotency and payment state in durable application-owned storage for production.
- Use explicit live configuration; `.env` is not encryption at rest.

## Documentation

- [Documentation index](./docs/index.md)
- [Getting started](./docs/getting-started.md)
- [Payments](./docs/payments.md)
- [Provider integrations](./docs/providers.md)
- [QR payments](./docs/qr-payments.md)
- [Webhooks](./docs/webhooks.md)
- [Authentication](./docs/authentication.md)
- [Biometric adapters](./docs/biometric-adapters.md)
- [Payment authorization](./docs/payment-authorization.md)
- [Storage](./docs/storage.md)
- [API reference](./docs/api-reference.md)
- [Testing](./docs/testing.md)
- [Limitations](./docs/limitations.md)

## Contributing

See [Contributing](./docs/contributing.md). No real credentials or live money
transactions are needed for normal development; use unit and mock HTTP tests.

## License

MIT. See [LICENSE](./LICENSE).
