# IskuBixi

![IskuBixi logo](./assets/iskubixi-logo.svg)

IskuBixi is a Somali-first JavaScript and TypeScript SDK for payments and WebAuthn/passkey authentication. It is built for backend/server use, not browser-only device access. The package keeps payment flows, QR payments, webhook verification, and passkey verification as separate concerns, with application-owned storage and business logic left to the developer.

The public API is intentionally small and consistent:

- `new IskuBixi(configuration)` for payment and webhook operations
- `iskubixi.lacag.*` for payment creation, lookup, verification, refunds, listing, and testing
- `iskubixi.qr.*` for QR payment references
- `iskubixi.webhook.*` for webhook verification and recovery
- `iskubixi.bixiye.awood()` to inspect provider capabilities
- `new Amaanood(configuration)` for passkey registration and sign-in

This package is a pure npm SDK. It does not host a database, an auth service, or a payment gateway. It helps verify provider responses and apply application-side rules around payment, refunds, QR references, and WebAuthn verification.

## Requirements

- Node.js 20 or later
- npm 10+ recommended

## Installation

```sh
npm install iskubixi
```

For local development in this repository:

```sh
npm install
```

## Package metadata and release notes

The current package metadata in this repository is:

- package name: `iskubixi`
- version: `0.1.0`
- license: MIT
- Node engine requirement: `>=20`
- main entry: `dist/index.js`
- type declarations: `dist/index.d.ts`

This repository keeps the package name and version unchanged unless you explicitly ask to change them.

## Quick start

### JavaScript example

```js
const { IskuBixi } = require("iskubixi");

const iskubixi = new IskuBixi({
  bixiyeyaasha: {
    edahab: { apiKey: "local-demo-only" }
  }
});

async function main() {
  const lacag = await iskubixi.lacag.samee({
    qadarka: 20,
    lacagta: "USD",
    bixiye: "edahab",
    tixraac: "LOCAL-DEMO-1"
  });

  const xaqiijin = await iskubixi.lacag.cadee({
    lacagId: lacag.id
  });

  console.log(lacag.xaalad); // "sugaya"
  console.log(xaqiijin.xaqiijin); // "simulated"
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### TypeScript example

```ts
import { IskuBixi, type IskuBixiQaabeyn } from "iskubixi";

const qaabeyn: IskuBixiQaabeyn = {
  bixiyeyaasha: {
    edahab: { apiKey: "local-demo-only" }
  }
};

const iskubixi = new IskuBixi(qaabeyn);

const lacag = await iskubixi.lacag.samee({
  qadarka: 20,
  lacagta: "USD",
  bixiye: "edahab",
  tixraac: "LOCAL-DEMO-1"
});

const xaqiijin = await iskubixi.lacag.cadee({
  lacagId: lacag.id
});

console.log(lacag.xaalad, xaqiijin.xaqiijin);
```

Important: a configured provider without a real adapter still routes through the built-in simulator. The simulator is for local testing and compatibility only; it does not represent a real payment provider integration.

## Configuration

`IskuBixi` accepts a single configuration object:

```ts
import { IskuBixi, type IskuBixiQaabeyn } from "iskubixi";

const qaabeyn: IskuBixiQaabeyn = {
  bixiyeyaasha: {
    edahab: {
      apiKey: process.env.EDAHAB_API_KEY!,
      merchantId: process.env.EDAHAB_MERCHANT_ID!
    },
    waafipay: {
      merchantId: process.env.WAAFI_MERCHANT_ID!,
      apiKey: process.env.WAAFI_API_KEY!
    }
  },
  laqabsadayaasha: {
    waafipay: waafipayFactory
  }
};

const iskubixi = new IskuBixi(qaabeyn);
```

The supported provider names are:

- `edahab`
- `evc`
- `zaad`
- `bank`
- `waafipay`

The SDK validates that:

- the top-level config is an object
- at least one provider is configured
- no provider entry is explicitly `null`
- provider adapters implement the required contracts
- custom storage adapters implement the required operations
- empty or malformed credential values are rejected

Use only the providers your application actually needs. Do not pass secrets around in application code or log credential objects.

## Errors

The package exports stable error classes from `src/errors.ts` and re-exports them from the top-level package:

```ts
import {
  IskuBixiError,
  ConfigurationError,
  ValidationError,
  PaymentError,
  RefundError,
  StorageError,
  WebhookVerificationError,
  WebAuthnError
} from "iskubixi";
```

The error codes are:

- `ISKUBIXI_ERROR`
- `ISKUBIXI_CONFIGURATION_ERROR`
- `ISKUBIXI_VALIDATION_ERROR`
- `ISKUBIXI_PROVIDER_ERROR`
- `ISKUBIXI_UNSUPPORTED_OPERATION`
- `ISKUBIXI_PAYMENT_ERROR`
- `ISKUBIXI_REFUND_ERROR`
- `ISKUBIXI_WEBHOOK_VERIFICATION_ERROR`
- `ISKUBIXI_WEBAUTHN_ERROR`
- `ISKUBIXI_STORAGE_ERROR`
- `ISKUBIXI_IDEMPOTENCY_ERROR`

Example:

```ts
import { IskuBixiError } from "iskubixi";

try {
  const result = await iskubixi.lacag.samee({
    qadarka: 200,
    lacagta: "USD",
    bixiye: "edahab",
    tixraac: "ORDER-1"
  });
  console.log(result.id);
} catch (error) {
  if (error instanceof IskuBixiError) {
    console.error(error.code, error.message);
  } else {
    throw error;
  }
}
```

The SDK intentionally sanitizes error details and avoids leaking raw provider credential data, signed payload bodies, private secrets, or stack traces in JSON output.

## Public API reference

### `new IskuBixi(configuration)`

Create an SDK instance with payment providers and optional custom adapters or storage implementations.

```ts
import { IskuBixi } from "iskubixi";

const iskubixi = new IskuBixi({
  bixiyeyaasha: {
    edahab: { apiKey: process.env.EDAHAB_API_KEY! }
  }
});
```

### `iskubixi.lacag.samee()`

Create a payment request.

```ts
const result = await iskubixi.lacag.samee({
  qadarka: 49.99,
  lacagta: "USD",
  bixiye: "edahab",
  tixraac: "PAYMENT-001",
  furahaIdempotency: "pay-001",
  dhacayaa: "2026-12-31T23:59:59Z"
});
```

Returns a payment object with an `id`, `qadarka`, `lacagta`, `xaalad`, `tixraac`, and optional `dhacayaa` and `celin` fields.

### `iskubixi.lacag.xaalad()`

Check the current payment state for a payment ID.

```ts
const status = await iskubixi.lacag.xaalad({
  lacagId: "pay_123"
});
```

### `iskubixi.lacag.cadee()`

Verify a previously created payment by its ID and return the provider verification result.

```ts
const verification = await iskubixi.lacag.cadee({
  lacagId: "pay_123"
});
```

The result includes `waaJiraa`, `xaqiijin`, and the same payment fields as the original payment if the provider supplies them.

### `iskubixi.lacag.celi()`

Create a refund for a confirmed payment.

```ts
const refund = await iskubixi.lacag.celi({
  lacagId: "pay_123",
  furahaIdempotency: "refund-001"
});
```

### `iskubixi.lacag.celintaXaalad()`

Check the state of a refund by refund ID.

```ts
const refundStatus = await iskubixi.lacag.celintaXaalad({
  celinId: "refund_123"
});
```

### `iskubixi.lacag.liiska()`

List payments with optional filters.

```ts
const page = await iskubixi.lacag.liiska({
  bixiye: "edahab",
  xaalad: "sugaya",
  lacagta: "USD",
  bogga: 1,
  xadka: 20
});
```

This returns `lacagaha`, `wadarta`, `bogga`, `xadka`, and `wadartaBogagga`.

### `iskubixi.lacag.tijaabiXaalad()`

Only for simulated payments, move a simulated payment to a final state for test purposes.

```ts
const updated = await iskubixi.lacag.tijaabiXaalad({
  lacagId: "pay_123",
  xaalad: "guuleystay"
});
```

This is not a real provider operation.

### `iskubixi.qr.samee()`

Create a QR payment reference.

```ts
const qr = await iskubixi.qr.samee({
  qadarka: 75,
  lacagta: "USD",
  bixiye: "edahab",
  dhacayaa: "2026-12-31T23:59:59Z"
});
```

### `iskubixi.qr.cadee()`

Validate a QR reference or payload and resolve the linked payment.

```ts
const result = await iskubixi.qr.cadee({
  tixraac: "QR-REF-123"
});
```

### `iskubixi.qr.akhriso()`

Read and validate the QR payload embedded in a QR string.

```ts
const payload = await iskubixi.qr.akhriso({
  nuxur: "base64-or-string-qr-content"
});
```

### `iskubixi.qr.xaalad()`

Get the current status of a QR reference.

```ts
const qrStatus = await iskubixi.qr.xaalad({
  tixraac: "QR-REF-123"
});
```

### `iskubixi.qr.jooji()`

Cancel a pending QR payment if the provider supports cancellation.

```ts
const cancelled = await iskubixi.qr.jooji({
  tixraac: "QR-REF-123"
});
```

### `iskubixi.qr.xog()`

Fetch the stored QR record metadata.

```ts
const record = await iskubixi.qr.xog({
  tixraac: "QR-REF-123"
});
```

### `iskubixi.webhook.cadee()`

Verify a webhook request by provider-specific signature validation and normalize it into an SDK event.

```ts
const event = await iskubixi.webhook.cadee({
  bixiye: "waafipay",
  rawBody: Buffer.from("{" + "\"test\": true" + "}"),
  headers: {
    "x-signature": "abc123"
  }
});
```

This returns either a verified payment event, a verified refund event, or an ignored event.

### `iskubixi.webhook.kaShaqee()`

Apply a verified webhook event to the transaction and payment store.

```ts
const result = await iskubixi.webhook.kaShaqee({
  bixiye: "waafipay",
  rawBody: Buffer.from("payload"),
  headers: {
    "x-signature": "abc123"
  }
});
```

### `iskubixi.webhook.fashilmay()`

List webhook processing failures that were recorded for later inspection or replay.

```ts
const failed = await iskubixi.webhook.fashilmay({
  bixiye: "waafipay"
});
```

### `iskubixi.webhook.dibUshaqee()`

Retry a previously failed webhook event.

```ts
const retried = await iskubixi.webhook.dibUshaqee({
  bixiye: "waafipay",
  dhacdoId: "evt_123",
  codsi: {
    bixiye: "waafipay",
    rawBody: Buffer.from("payload"),
    headers: {
      "x-signature": "abc123"
    }
  }
});
```

### `iskubixi.bixiye.awood()`

Inspect the capabilities of a provider adapter.

```ts
const capabilities = await iskubixi.bixiye.awood({
  bixiye: "waafipay"
});

console.log(capabilities.awoodaha);
```

The capability object includes:

- `paymentCreation`
- `paymentLookup`
- `paymentVerification`
- `paymentCancellation`
- `refundCreation`
- `refundStatusLookup`
- `qrPayment`
- `webhookSignatureVerification`

## Passkeys and biometric user verification

`Amaanood` is the passkey/WebAuthn helper. It provides server-side options, response verification, credential listing, and revocation. It does not access device sensors and it does not perform a fake or simulated biometric check.

The browser or mobile app is responsible for running the WebAuthn ceremony. The SDK only verifies the returned credential response against the configured relying-party (RP) ID and origin.

WebAuthn authenticators can use a device PIN, fingerprint, face recognition, or another supported user-verification method. The SDK does not know which biometric modality was used, and it cannot claim universal iris recognition support. Iris recognition is not a guaranteed feature of WebAuthn and should not be advertised as such.

The SDK never collects or stores raw biometric data. It stores only credential IDs, public keys, counters, and limited metadata needed for verification. Challenge and credential stores are development-only in-memory stores by default and should be replaced with application-owned durable storage in production.

### Configure `Amaanood`

```ts
import { Amaanood } from "iskubixi";

const amaanood = new Amaanood({
  rpId: "example.com",
  rpName: "Example App",
  origins: ["https://example.com", "https://app.example.com"],
  requireUserVerification: true
});
```

### `amaanood.furahaAbuur()`

Generate registration options for a new passkey.

```ts
const options = await amaanood.furahaAbuur({
  userId: "user-123",
  userName: "alice@example.com",
  displayName: "Alice Example"
});
```

### `amaanood.furahaDiiwaangeli()`

Verify a browser/mobile registration response and save the credential.

```ts
const registration = await amaanood.furahaDiiwaangeli({
  userId: "user-123",
  response: browserRegistrationResponse
});
```

### `amaanood.saxiix()`

Generate a sign-in challenge for an existing passkey.

```ts
const authOptions = await amaanood.saxiix({
  userId: "user-123"
});
```

### `amaanood.saxiixXaqiiji()`

Verify a browser/mobile authentication assertion.

```ts
const signIn = await amaanood.saxiixXaqiiji({
  userId: "user-123",
  response: browserAssertionResponse
});
```

### `amaanood.furahaLiiska()`

List the registered passkeys for a user.

```ts
const passkeys = await amaanood.furahaLiiska({
  userId: "user-123"
});
```

### `amaanood.furahaJooji()`

Remove a passkey from a user account.

```ts
const removed = await amaanood.furahaJooji({
  userId: "user-123",
  credentialId: "passkey_credential_id_here"
});
```

### End-to-end passkey flow

```ts
import { Amaanood } from "iskubixi";

const amaanood = new Amaanood({
  rpId: "example.com",
  rpName: "Example App",
  origins: ["https://example.com"]
});

// 1) Developer backend creates registration options
const registrationOptions = await amaanood.furahaAbuur({
  userId: "user-123",
  userName: "alice@example.com",
  displayName: "Alice"
});

// 2) Browser/mobile app runs WebAuthn ceremony and returns registration response
// const registrationResponse = await webAuthnClient.create(registrationOptions);

// 3) Backend verifies the response and stores the credential
// const registration = await amaanood.furahaDiiwaangeli({
//   userId: "user-123",
//   response: registrationResponse
// });

// 4) Later, sign-in options are created and verified
// const authOptions = await amaanood.saxiix({ userId: "user-123" });
// const assertion = await webAuthnClient.get(authOptions);
// const session = await amaanood.saxiixXaqiiji({
//   userId: "user-123",
//   response: assertion
// });
```

Passkey security requirements are enforced as part of the SDK: random single-use challenges, challenge expiry, replay protection, strict origin and RP ID validation, signature verification, user-verification checks, account binding, and safe credential revocation. User presence is not the same thing as user verification.

## Production responsibilities

The SDK is a server-side helper, not a complete identity platform.

You are responsible for:

- creating and managing user accounts
- selecting which user IDs may register or revoke a passkey
- storing credentials in your own database or key-value store
- handling recovery, replacement, and lost-device flows
- rotating or re-binding passkeys when needed
- verifying provider payments through the provider API or verified callback events
- validating request origins and RP IDs in your app configuration
- exposing webhook routes over HTTPS and preserving raw request bodies
- protecting secrets in environment variables or a secret manager

The SDK is responsible for:

- generating safe WebAuthn server options
- validating challenges, origins, RP IDs, and signatures
- checking user verification when configured
- maintaining the credential counters and revocation logic
- normalizing provider payment and webhook events into SDK objects

## Security notes

- Always use HTTPS for browser and webhook traffic.
- Do not advertise or imply iris recognition support unless it is explicitly supported by a specific authenticator and documented platform API.
- Do not treat a successful passkey verification as proof that a payment succeeded.
- Keep application-owned credential and challenge stores durable and atomic.
- Use the in-memory stores only for development or tests.
- Never store raw biometric data, face images, fingerprint templates, or private keys in IskuBixi.

## License

This project is licensed under the MIT License.

See [LICENSE](./LICENSE) for details.
