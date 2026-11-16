# IskuBixi

### One SDK. Many Payments. Smarter Authentication.

![IskuBixi logo](./assets/iskubixi-logo.svg)

**Payments · QR Codes · Face · Fingerprint · Eye · Palm · Passkeys**

[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

IskuBixi is a Somali-first JavaScript and TypeScript SDK that gives developers
a unified way to integrate payment providers, QR payment workflows, and secure
authentication into their applications.

**IskuBixi is a developer SDK, not a hosted payment platform.** You own your
application, user accounts, provider credentials, database, authentication
sessions, and deployment. The SDK does not host payments or collect raw
biometric data.

> **Biometric support is adapter-based.** IskuBixi includes no face,
> fingerprint, iris, or palm scanner. WebAuthn can request device user
> verification, but it does not tell the application whether the user chose
> face, fingerprint, PIN, or another method. Modality-specific claims require
> a trusted adapter that can prove that method.

## Features

| Area | What the SDK provides |
| --- | --- |
| Payments | A common API for creating, checking, verifying, listing, and refunding payments |
| Provider adapters | A `PaymentProvider` contract, capability inspection, and a sandbox-focused WaafiPay adapter |
| QR payments | Expiring QR references, payload reading, validation, status, and supported cancellation |
| Passkeys | WebAuthn registration, assertion verification, credential listing, and revocation |
| Biometric adapters | Modality-specific entry points for face, fingerprint/thumb, eye/iris, and palm when a trusted adapter supports them |
| Payment authorization | One-time authentication bound to the exact saved payment request |
| Webhooks | Provider signature verification, event processing, failure inspection, and retry |
| Reliability | Local idempotency, transaction listing, replaceable storage contracts, and separate payment/authentication states |

### Provider and modality reality check

The package accepts these provider identifiers: `edahab`, `evc`, `zaad`,
`bank`, and `waafipay`. An identifier is not a bundled live provider
integration. When no provider adapter is registered, the SDK uses its
**simulated provider**. The included WaafiPay adapter is sandbox-focused; it
does not claim transaction lookup, verification, refunds, cancellation, or
documented provider-side idempotency.

| Authentication request | Included capability |
| --- | --- |
| Passkey registration and sign-in | Server-side WebAuthn options and verification through `Amaanood` |
| Face (`waji`) | Public adapter-backed API; compatible trusted adapter required |
| Fingerprint/thumb (`faraha`) | Public adapter-backed API; compatible trusted adapter required |
| Eye/iris (`isha`) | Public adapter-backed API; documented compatible hardware/provider required |
| Palm (`calaacal`) | Public adapter-backed API; documented compatible hardware/provider required |

No biometric modality is enabled by default. Ordinary WebAuthn user
verification alone cannot satisfy a payment authorization for a named
modality. See [Biometric adapters](./docs/biometric-adapters.md).

## Requirements

- Node.js 20 or later
- npm (npm 10 or later recommended)
- HTTPS for deployed WebAuthn origins; localhost is suitable for local
  development

## Installation

```sh
npm install iskubixi
```

CommonJS:

```js
const { IskuBixi, Amaanood } = require("iskubixi");
```

TypeScript / ES modules:

```ts
import { IskuBixi, Amaanood } from "iskubixi";
```

## Quick start

This short example uses the built-in **simulated** provider. It creates a
local pending payment; it does not contact a payment provider or move money.

### JavaScript

```js
const { IskuBixi } = require("iskubixi");

const iskubixi = new IskuBixi({
  bixiyeyaasha: {
    // The local fallback value is not a credential and does not connect to eDahab.
    edahab: { apiKey: process.env.EDAHAB_API_KEY || "local-demo-only" }
  }
});

async function main() {
  const payment = await iskubixi.lacag.samee({
    qadarka: 20,
    lacagta: "USD",
    bixiye: "edahab",
    tixraac: "LOCAL-DEMO-1"
  });

  const verification = await iskubixi.lacag.cadee({ lacagId: payment.id });
  console.log(payment.xaalad); // "sugaya" (pending)
  console.log(verification.xaqiijin); // "simulated"
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### TypeScript

```ts
import { IskuBixi, type IskuBixiQaabeyn } from "iskubixi";

const configuration: IskuBixiQaabeyn = {
  bixiyeyaasha: {
    edahab: {
      apiKey: process.env.EDAHAB_API_KEY ?? "local-demo-only"
    }
  }
};

const iskubixi = new IskuBixi(configuration);
const payment = await iskubixi.lacag.samee({
  qadarka: 20,
  lacagta: "USD",
  bixiye: "edahab",
  tixraac: "LOCAL-DEMO-1"
});
const verification = await iskubixi.lacag.cadee({ lacagId: payment.id });

console.log(payment.xaalad, verification.xaqiijin);
```

The default provider is a simulator, even when a provider name and placeholder
credentials are configured. Do not interpret its results as real payments.
To process payments, register a provider adapter that calls the real provider
and verifies its responses.

## Payment providers

The public provider contract is `PaymentProvider`; provider factories implement
`PaymentProviderFactory`. Provider credentials remain server-side.

```ts
import {
  IskuBixi,
  type IskuBixiQaabeyn,
  type PaymentProviderFactory
} from "iskubixi";

// Implement this factory against the provider's current official API.
declare const applicationProviderFactory: PaymentProviderFactory;

const configuration: IskuBixiQaabeyn = {
  bixiyeyaasha: {
    edahab: { apiKey: process.env.EDAHAB_API_KEY! }
  },
  laqabsadayaasha: {
    edahab: applicationProviderFactory
  }
};

const iskubixi = new IskuBixi(configuration);
```

IskuBixi does not include live eDahab, EVC, ZAAD, or bank integrations. Do not
register a placeholder adapter as a real provider.

### WaafiPay sandbox adapter

The package exports `WaafiPayPaymentProviderFactory`. It sends purchase
requests to the adapter's configured WaafiPay sandbox endpoint. The adapter
requires valid sandbox credentials and a timestamp formatter matching the
provider's current documentation.

```ts
import {
  IskuBixi,
  WaafiPayPaymentProviderFactory
} from "iskubixi";

const waafipay = new WaafiPayPaymentProviderFactory({
  // Return the provider-documented 20-character timestamp format.
  formatTimestamp: providerDocumentedTimestamp
});

const iskubixi = new IskuBixi({
  bixiyeyaasha: {
    waafipay: {
      merchantUid: process.env.WAAFI_MERCHANT_UID!,
      apiUserId: process.env.WAAFI_API_USER_ID!,
      apiKey: process.env.WAAFI_API_KEY!
    }
  },
  laqabsadayaasha: { waafipay }
});

const payment = await iskubixi.lacag.samee({
  qadarka: 10,
  lacagta: "USD",
  bixiye: "waafipay",
  tixraac: "ORDER-1002",
  lambarka: process.env.CUSTOMER_WALLET_NUMBER!
});
```

`providerDocumentedTimestamp` above is supplied by your application; use the
format required by your provider account and current provider documentation.
Never put these credentials in frontend code or logs. WaafiPay's bundled
adapter currently supports payment creation only. It does not claim lookup,
payment verification, cancellation, refunds, or remote idempotency.

## Payments

### Create, check, and verify

```js
const payment = await iskubixi.lacag.samee({
  qadarka: 49.99,
  lacagta: "USD",
  bixiye: "edahab",
  tixraac: "ORDER-1001",
  furahaIdempotency: "order-1001-attempt-1",
  dhacayaa: "2026-12-31T23:59:59Z"
});

const current = await iskubixi.lacag.xaalad({ lacagId: payment.id });
const verification = await iskubixi.lacag.cadee({ lacagId: payment.id });

console.log(current.xaalad);
console.log(verification.xaqiijin); // "adapter" or "simulated"
```

Amounts must be positive finite numbers, currencies three-letter uppercase
codes, and references non-empty strings. `lambarka` is provider-specific;
WaafiPay requires a valid wallet number. Expiry is an ISO 8601 date-time with
timezone and must be supported by the configured transaction store.

### Refunds and listing

```ts
const page = await iskubixi.lacag.liiska({
  bixiye: "edahab",
  xaalad: "sugaya",
  lacagta: "USD",
  bogga: 1,
  xadka: 20
});

const refund = await iskubixi.lacag.celi({
  lacagId: "provider-payment-id",
  furahaIdempotency: "refund-order-1001"
});
const refundStatus = await iskubixi.lacag.celintaXaalad({
  celinId: refund.id
});
```

Only full refunds are accepted. Refund support and refund-status lookup depend
on the provider adapter. The returned payment state and refund state are
separate.

There is no general `lacag.jooji()` method. `qr.jooji()` can cancel a pending
QR-linked payment only when the configured provider supports cancellation.

### Simulated status controls

`lacag.tijaabiXaalad({ lacagId, xaalad })` is for simulated payments and tests
only. It cannot change a real provider payment and must not be used to confirm
production payments.

## QR payments

Create a QR payment with an explicit future expiry:

```ts
const qr = await iskubixi.qr.samee({
  qadarka: 75,
  lacagta: "USD",
  bixiye: "edahab",
  dhacayaa: new Date(Date.now() + 15 * 60 * 1000).toISOString()
});

// Render qr.nuxur with your application's QR library.
console.log(qr.nuxur, qr.tixraac, qr.xaaladQr);
```

The SDK creates the linked payment and a random QR reference. `nuxur` is the
SDK payload `iskubixi:qr:v1:<reference>`; your frontend may render that string
as a QR image using its own QR display library. The payload is a reference, not
a signed proof of payment.

JavaScript (inside an async route or function):

```js
const qr = await iskubixi.qr.samee({
  qadarka: 75,
  lacagta: "USD",
  bixiye: "edahab",
  dhacayaa: new Date(Date.now() + 15 * 60 * 1000).toISOString()
});
const activeReference = await iskubixi.qr.cadee({ tixraac: qr.tixraac });
const scannedPayload = await iskubixi.qr.akhriso({ nuxur: qr.nuxur });
const status = await iskubixi.qr.xaalad({ tixraac: qr.tixraac });
```

TypeScript validation:

```ts
const byReference = await iskubixi.qr.cadee({ tixraac: qr.tixraac });
const byPayload = await iskubixi.qr.akhriso({ nuxur: qr.nuxur });
const status = await iskubixi.qr.xaalad({ tixraac: qr.tixraac });
const details = await iskubixi.qr.xog({ tixraac: qr.tixraac });
```

Validation checks that the reference exists and is still open, not that money
has been received. `qr.xaalad()` reports both the payment state and QR state.
QR references can be `furan` (open), `joojiyay` (cancelled), `dhacay` (expired),
or `laIsticmaalay` (used). Expired, cancelled, and already-used references
cannot be validated as active.

```ts
const cancelled = await iskubixi.qr.jooji({ tixraac: qr.tixraac });
```

Cancellation works only while the linked payment is pending and only if the
provider supports payment cancellation. Scanning or validating a QR code does
not confirm a successful payment. Check the provider's verified payment status
or process its authenticated webhook before fulfilling an order.

## Passkeys and WebAuthn

`Amaanood` provides server-side WebAuthn/passkey registration options,
authentication options, response verification, credential listing, and
revocation. The browser or mobile application runs the user-facing ceremony.
The WebAuthn client must convert JSON-encoded binary fields to browser
`ArrayBuffer` values and serialize the credential response back to JSON. See
the [frontend example](./examples/frontend/passkey-authorization.ts) for an
assertion conversion using native browser APIs.

JavaScript (server-side; browser responses come from your WebAuthn client):

```js
const { Amaanood } = require("iskubixi");

const amaanood = new Amaanood({
  rpId: "example.com",
  rpName: "Example App",
  origins: ["https://example.com"],
  requireUserVerification: true
});

async function passkeySignIn(user) {
  const options = await amaanood.saxiix({ userId: user.id });
  const response = await sendOptionsToBrowserAndGetAssertion(options);
  return amaanood.saxiixXaqiiji({ userId: user.id, response });
}
```

TypeScript registration and sign-in:

```ts
import { Amaanood } from "iskubixi";

const amaanood = new Amaanood({
  rpId: "example.com",
  rpName: "Example App",
  origins: ["https://example.com"],
  requireUserVerification: true
});

const registrationOptions = await amaanood.furahaAbuur({
  userId: authenticatedUser.id,
  userName: authenticatedUser.email,
  displayName: authenticatedUser.name
});
// Send options to the application frontend and run navigator.credentials.create()
// through a WebAuthn client that handles JSON/ArrayBuffer conversion.

const registration = await amaanood.furahaDiiwaangeli({
  userId: authenticatedUser.id,
  response: registrationResponseFromFrontend
});

const signInOptions = await amaanood.saxiix({
  userId: authenticatedUser.id
});
// Send options to the frontend, run navigator.credentials.get(), and return
// the serialized authentication response to the backend.
const signedIn = await amaanood.saxiixXaqiiji({
  userId: authenticatedUser.id,
  response: authenticationResponseFromFrontend
});
```

Use the authenticated application's account ID, not an unauthenticated
browser-supplied identity. The SDK checks challenges, expiry, replay, origin,
RP ID, credential ownership, signatures, and user verification. It stores
credential IDs and public keys for verification—not biometric images or
templates. Challenges and credentials use in-memory stores by default; replace
them with durable application-owned stores in production.

## Biometric authentication API

The following methods are implemented on `iskubixi.amaanood`. Each start method
accepts `{ userId: string }` and returns
`Promise<NatiijoAmaanoodBilow>`: a short-lived `sessionId`, requested `method`,
`expiresAt`, and client-safe adapter `options`.

| Public method | Requested method | Available by default? |
| --- | --- | --- |
| `iskubixi.amaanood.waji({ userId })` | Face | No; trusted compatible adapter required |
| `iskubixi.amaanood.faraha({ userId })` | Fingerprint or thumb | No; trusted compatible adapter required |
| `iskubixi.amaanood.isha({ userId })` | Eye or iris | No; documented compatible hardware/provider required |
| `iskubixi.amaanood.calaacal({ userId })` | Palm | No; documented compatible hardware/provider required |
| `iskubixi.amaanood.xaqiiji({ userId, sessionId, response })` | Verify a started adapter session | Uses the adapter stored with that session |

The four modality methods and `xaqiiji()` are real exported and implemented
methods. They do not scan a face, finger, iris, or palm themselves.
`xaqiiji()` returns a successful authentication only after the configured
adapter verifies the response and user verification. Its result includes
`methodConfirmed`; this is true only when the trusted adapter confirms the
requested modality.

Configure an application-owned adapter implementing the exported
`AmaanoodLaqabsade` interface:

```ts
import {
  IskuBixi,
  type AmaanoodLaqabsade
} from "iskubixi";

declare const trustedAdapter: AmaanoodLaqabsade;

const iskubixi = new IskuBixi({
  bixiyeyaasha: { edahab: { apiKey: process.env.EDAHAB_API_KEY! } },
  amaanood: { laqabsadayaal: [trustedAdapter] }
});

const session = await iskubixi.amaanood.waji({
  userId: authenticatedUser.id
});
// Return session.options to the application frontend for the adapter ceremony.
const result = await iskubixi.amaanood.xaqiiji({
  userId: authenticatedUser.id,
  sessionId: session.sessionId,
  response: responseFromFrontend
});
if (!result.methodConfirmed) {
  throw new Error("The requested modality was not confirmed.");
}
```

JavaScript (the adapter must be supplied by your application):

```js
async function authenticateWithFace(userId) {
  const session = await iskubixi.amaanood.waji({ userId });
  const response = await trustedBiometricClient.complete(session.options);
  return iskubixi.amaanood.xaqiiji({
    userId,
    sessionId: session.sessionId,
    response
  });
}
```

The placeholder adapter above is application-supplied; this package includes no
vendor or biometric hardware adapter. A generic WebAuthn passkey adapter can
require user verification, but WebAuthn does not disclose whether the user
verified with face, fingerprint, PIN, or another authenticator method. Do not
claim a specific method unless a trusted adapter can establish it. Iris
recognition is not universally available through WebAuthn. Read the
[adapter guide](./docs/biometric-adapters.md) before integrating a modality.

## Payment authorization

Payment authorization binds a trusted, user-verified authentication ceremony to
one saved payment request. A successful authorization initiates the stored
payment request; it does **not** mean the provider completed or settled it.

```ts
const authorization = await iskubixi.lacag.ogolaanshoAbuur({
  userId: authenticatedUser.id, // derive on the backend
  lacag: {
    qadarka: order.total,
    lacagta: order.currency,
    bixiye: "edahab",
    tixraac: order.reference
  },
  hab: "waji"
});

// Send the safe summary and authenticationOptions to the frontend.
const result = await iskubixi.lacag.ogolaanshoXaqiiji({
  userId: authenticatedUser.id, // derive again from the backend session
  authorizationId: authorization.authorizationId,
  response: responseFromFrontend
});

const status = await iskubixi.lacag.ogolaanshoXaalad({
  userId: authenticatedUser.id,
  authorizationId: authorization.authorizationId
});
```

JavaScript (inside an authenticated backend route):

```js
const authorization = await iskubixi.lacag.ogolaanshoAbuur({
  userId: request.authenticatedUser.id,
  lacag: {
    qadarka: order.total,
    lacagta: order.currency,
    bixiye: "edahab",
    tixraac: order.reference
  },
  hab: "waji"
});
response.json(authorization);

// In the verification route, derive userId from the backend session again.
const result = await iskubixi.lacag.ogolaanshoXaqiiji({
  userId: request.authenticatedUser.id,
  authorizationId: request.body.authorizationId,
  response: request.body.authenticationResponse
});
```

Verification does not accept replacement amount, currency, provider, or
reference values. The configured adapter must explicitly support payment
authorization, require user verification, bind the original payment digest,
and verify the requested modality. Generic WebAuthn user verification alone
does not meet that modality requirement. Production authorization and
authentication-session stores must be durable and atomic across application
instances.

Authorization states (`pending`, `verifying`, `authorized`, `failed`,
`expired`, `processing`, `reconciliation_required`) are separate from payment
states. If a provider outcome is uncertain, the SDK does not automatically
retry that authorization; reconcile with provider evidence first. A local
idempotency key does not guarantee remote provider idempotency. See the full
[payment authorization guide](./docs/payment-authorization.md).

## Webhooks

Use a configured `PaymentWebhookAdapter` to authenticate provider signatures.
The SDK's WaafiPay webhook adapter verifies signatures against the original
raw request bytes. Preserve those bytes in your HTTP framework; do not parse
and reserialize the body before verification.

```ts
const event = await iskubixi.webhook.cadee({
  bixiye: "waafipay",
  rawBody: rawRequestBody,
  headers: requestHeaders
});

// For an adapter configured to apply verified events:
const processed = await iskubixi.webhook.kaShaqee({
  bixiye: "waafipay",
  rawBody: rawRequestBody,
  headers: requestHeaders
});
```

JavaScript (inside an HTTP handler; preserve the raw request bytes):

```js
const processed = await iskubixi.webhook.kaShaqee({
  bixiye: "waafipay",
  rawBody: rawRequestBytes,
  headers: requestHeaders
});
if (processed.horeLooShaqeeyay) {
  console.log("Duplicate delivery was already applied.");
}
```

`cadee()` verifies and normalizes an event; it does not apply the event.
`kaShaqee()` verifies and applies supported events with deduplication.
`fashilmay({ bixiye? })` inspects failed events when the configured webhook
store supports recovery. `dibUshaqee({ bixiye, dhacdoId, codsi? })` retries a
failed event only after re-verifying the signed request. Webhook verification
is not available unless an adapter for that provider is configured.

## Provider capabilities and public API reference

`await iskubixi.bixiye.awood({ bixiye })` returns
`Promise<NatiijoBixiyeAwood>` with the configured provider name and capability
flags: `paymentCreation`, `paymentLookup`, `paymentVerification`,
`paymentCancellation`, `refundCreation`, `refundStatusLookup`, `qrPayment`,
and `webhookSignatureVerification`. Inspect these flags; never assume a
provider supports an operation simply because the SDK method exists.

### Payment methods

All payment methods are available on `iskubixi.lacag`:

| Method | Request type | Return type |
| --- | --- | --- |
| `samee(request)` | `CodsiLacag` | `Promise<NatiijoLacag>` |
| `xaalad({ lacagId })` | `CodsiLacagId` | `Promise<NatiijoLacag>` |
| `cadee({ lacagId })` | `CodsiLacagId` | `Promise<NatiijoXaqiijin>` |
| `celi({ lacagId, furahaIdempotency })` | `CodsiCelin` | `Promise<NatiijoCelin>` |
| `celintaXaalad({ celinId })` | `CodsiCelinXaalad` | `Promise<NatiijoCelin>` |
| `liiska(filters?)` | `CodsiLiiskaLacag` (optional) | `Promise<NatiijoLiiskaLacag>` |
| `tijaabiXaalad({ lacagId, xaalad })` | `CodsiTijaabiXaalad` | `Promise<NatiijoLacag>`; simulated payments only |
| `ogolaanshoAbuur(request)` | `CodsiOgolaanshoAbuur` | `Promise<NatiijoOgolaanshoAbuur>` |
| `ogolaanshoXaqiiji(request)` | `CodsiOgolaanshoXaqiiji` | `Promise<NatiijoOgolaanshoXaqiiji>` |
| `ogolaanshoXaalad(request)` | `CodsiOgolaanshoXaalad` | `Promise<NatiijoOgolaanshoXaalad>` |

There is no public general payment-cancellation method. Cancellation is
available only through `qr.jooji()` for a supported pending QR payment.

### QR methods

All QR methods are available on `iskubixi.qr`:

| Method | Request type | Return type |
| --- | --- | --- |
| `samee(request)` | `CodsiQrLacag` | `Promise<NatiijoQr>` |
| `cadee({ tixraac })` | `CodsiQrTixraac` | `Promise<NatiijoQrXaqiijin>` |
| `akhriso({ nuxur })` | `CodsiQrNuxur` | `Promise<NatiijoQrXaqiijin>` |
| `xaalad({ tixraac })` | `CodsiQrTixraac` | `Promise<NatiijoQrXaalad>` |
| `jooji({ tixraac })` | `CodsiQrTixraac` | `Promise<NatiijoQr>` |
| `xog({ tixraac })` | `CodsiQrTixraac` | `Promise<NatiijoQr>` |

### Webhook methods

All webhook methods are available on `iskubixi.webhook`:

| Method | Request type | Return type |
| --- | --- | --- |
| `cadee(request)` | `CodsiWebhook` | `Promise<NatiijoWebhookCadee>` |
| `kaShaqee(request)` | `CodsiWebhook` | `Promise<NatiijoWebhookShaqeeyay>` |
| `fashilmay(request?)` | `CodsiWebhookFashilmay` (optional) | `Promise<readonly NatiijoWebhookDhacdoFashilmay[]>` |
| `dibUshaqee(request)` | `CodsiWebhookDibUshaqee` | `Promise<NatiijoWebhookShaqeeyay>` |

### Passkey methods

All passkey methods belong to an `Amaanood` instance:

| Method | Request type | Return type |
| --- | --- | --- |
| `furahaAbuur(request)` | `CodsiFurahaAbuur` | `Promise<PublicKeyCredentialCreationOptionsJSON>` |
| `furahaDiiwaangeli(request)` | `CodsiFurahaDiiwaangeli` | `Promise<NatiijoFurahaDiiwaangeli>` |
| `saxiix({ userId })` | `CodsiAmaanoodSaxiix` | `Promise<PublicKeyCredentialRequestOptionsJSON>` |
| `saxiixXaqiiji(request)` | `CodsiSaxiixXaqiiji` | `Promise<NatiijoSaxiix>` |
| `furahaLiiska({ userId })` | `CodsiAmaanood` | `Promise<readonly FurahaDiiwaangashan[]>` |
| `furahaJooji({ userId, credentialId })` | `CodsiAmaanood & { credentialId: string }` | `Promise<boolean>` |

The top-level package also exports provider, storage, request/result, webhook,
authentication-adapter, and error types.

## Configuration and storage

`IskuBixiQaabeyn` accepts provider credentials, provider factories, webhook
adapters, authentication adapters, and application-provided stores. The main
storage configuration fields are:

- `keydkaIdempotency`
- `keydkaOgolaanshaha`
- `keydkaCelin` and `keydkaCelinDiiwaanka`
- `keydkaLacagaha` and `keydkaLacagahaBixiyaha`
- `keydkaQr`
- `keydkaWebhook`
- `amaanood.keydkaKulamada`

```ts
import {
  IskuBixi,
  type AmaanoodAuthenticationSessionStore,
  type IskuBixiQaabeyn,
  type PaymentAuthorizationStore
} from "iskubixi";

declare const durableAuthorizationStore: PaymentAuthorizationStore;
declare const durableAuthenticationSessions: AmaanoodAuthenticationSessionStore;

const configuration: IskuBixiQaabeyn = {
  bixiyeyaasha: { edahab: { apiKey: process.env.EDAHAB_API_KEY! } },
  amaanood: {
    laqabsadayaal: [trustedAdapter],
    keydkaKulamada: durableAuthenticationSessions
  },
  keydkaOgolaanshaha: durableAuthorizationStore
};
const iskubixi = new IskuBixi(configuration);
```

The default in-memory stores are useful for development and tests only. They
are lost on restart and do not coordinate between server processes. In
production, implement the exported store interfaces using your own durable
database and provide atomic claim, consume, idempotency, and event-processing
operations as required by each contract.

The `Amaanood` constructor additionally accepts `keydkaLoolan` and
`keydkaFuraha` for WebAuthn challenges and credentials. Protect these records
and use atomic challenge consumption in production.

## Security and privacy

- Keep all payment and authentication secrets on the backend.
- Derive user IDs from your authenticated application session.
- Use HTTPS and configure exact WebAuthn origins and RP IDs.
- Require user verification where the operation requires it; user presence
  alone is not user verification.
- Never treat successful authentication as proof of payment.
- Verify payment through a capable provider adapter or authenticated webhook.
- Do not log credential responses, private keys, provider secrets, or signed
  webhook payloads.
- IskuBixi does not collect or store raw face images, fingerprints, iris scans,
  palm images, biometric templates, or measurements.
- A trusted external adapter is responsible for any modality-specific claim.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| `UnsupportedOperationError` for a provider operation | Inspect `bixiye.awood()` and configure an adapter that implements the operation |
| Biometric method is unsupported | Configure a trusted adapter whose `supportedMethods` includes the method |
| Payment authorization rejects a passkey response | The adapter must require user verification, bind the payment digest, and prove the requested modality |
| Passkey origin/RP ID validation fails | Match the configured RP ID to the browser domain and allow only the exact HTTPS origin |
| QR reference is invalid or inactive | Check its exact payload/reference, expiry, cancellation, and current payment status |
| Webhook verification fails | Preserve the exact raw body and check provider signature headers, secret, and timestamp |
| Payment becomes `reconciliation_required` | Do not retry; reconcile with provider evidence before taking another payment action |
| Payment remains pending | Check the provider's authenticated status lookup or webhook; authorization alone is not settlement |

Errors extend `IskuBixiError` and expose stable `code` values. Common exports
include `ConfigurationError`, `ValidationError`, `UnsupportedOperationError`,
`PaymentError`, `RefundError`, `StorageError`, `WebhookVerificationError`, and
`WebAuthnError`.

## Testing

```sh
npm install
npm run build
npm test
```

The tests include mocks for provider/authentication adapters and controlled
WebAuthn fixtures. They do not represent real payment processing or real
biometric-device testing. The TypeScript examples are compiled as part of the
test script.

## Production responsibilities and limitations

You are responsible for:

- user accounts, authorization policy, and recovery
- provider integrations, credentials, and provider-side payment confirmation
- durable storage and cross-instance atomicity
- HTTPS deployment, webhook routing, and raw-body preservation
- trusted authentication adapters and evidence for any modality-specific claim
- unsupported-device and lost-authenticator fallback paths

The SDK does not provide a hosted service, mandatory database, live integration
for every provider identifier, or biometric hardware. The bundled WaafiPay
adapter is sandbox-focused and has limited operations. No generic WebAuthn API
guarantees iris recognition or identifies which local user-verification method
was used. Confirm provider and device capabilities from their current official
documentation before enabling them.

## Examples and guides

- [JavaScript payment authorization example](./examples/javascript/payment-authorization.js) — explicitly mocked local demo
- [TypeScript payment authorization example](./examples/typescript/payment-authorization.ts) — strongly typed, explicitly mocked local demo
- [Frontend passkey authorization example](./examples/frontend/passkey-authorization.ts) — browser WebAuthn ceremony and modality limitations
- [Payment authorization guide](./docs/payment-authorization.md)
- [Biometric adapter guide](./docs/biometric-adapters.md)

## Contributing

Contributions are welcome. Before opening a change:

1. Read the existing implementation and public types.
2. Keep provider capabilities and authentication claims aligned with
   documented behavior.
3. Add focused tests and update the documentation for public API changes.
4. Run `npm run build` and `npm test`.

Do not include credentials, real customer information, or biometric data in
issues, tests, examples, or pull requests.

## License

IskuBixi is licensed under the [MIT License](./LICENSE).
