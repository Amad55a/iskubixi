# Biometric authentication adapters

IskuBixi does not include biometric sensors, vendor SDKs, or biometric
verification endpoints. Its modality methods are available only when the
application configures a trusted adapter that declares support for that method.
The adapter is a security boundary: the SDK cannot independently inspect a
sensor or establish that a provider's statement is true.

## What the method names mean

| Method | Intended modality | Required evidence |
| --- | --- | --- |
| `waji()` | Face | A trusted, documented authenticator or provider verifies face use for this ceremony. |
| `faraha()` | Fingerprint or thumb | A trusted, documented authenticator or provider verifies fingerprint use for this ceremony. |
| `isha()` | Eye or iris | A compatible authenticator/provider explicitly documents and verifies this modality. |
| `calaacal()` | Palm | A compatible authenticator/provider explicitly documents and verifies this modality. |

These are requests, not claims about device support. Unsupported methods must
fail clearly. A phone camera is not an iris or palm authenticator.

WebAuthn can require user verification, which may involve a device PIN,
fingerprint, face recognition, or another authenticator mechanism. Standard
WebAuthn does not tell the relying party which method the user selected.
Therefore, a generic WebAuthn user-verification result is not proof of face,
fingerprint, iris, or palm use. In particular, ordinary WebAuthn alone cannot
confirm one of these modality-specific payment authorization requests.

## Adapter contract

The package exports `AmaanoodLaqabsade`, `AmaanoodHab`,
`AmaanoodBilowLaqabsade`, and `AmaanoodXaqiijinLaqabsade`. A configured adapter
declares support by listing actual methods in `supportedMethods` and implements
`start()` and `verify()`. For payment authorization it must also set
`supportsPaymentAuthorization: true`; this is an explicit trust declaration,
not proof that the integration is correct.

```ts
import type { AmaanoodLaqabsade } from "iskubixi";

declare const trustedVendorAdapter: AmaanoodLaqabsade;

const configuration = {
  bixiyeyaasha: { edahab: { apiKey: process.env.EDAHAB_API_KEY! } },
  amaanood: { laqabsadayaal: [trustedVendorAdapter] }
};
```

Do not copy the placeholder into a running application. Implement this interface
using the chosen vendor's current official documentation and security guidance:

1. In `start()`, bind the authenticated application `userId`, requested method,
   short expiry, and (for payments) `paymentBinding` into the vendor/WebAuthn
   challenge. Generate fresh unpredictable challenge material.
2. Return only client-safe ceremony options, an opaque server-side adapter
   session reference, and its expiry. Keep credentials and provider secrets on
   the backend.
3. In `verify()`, retrieve the original server-side session and verify its
   challenge, user, method, expiry, response signature, and user-verification
   result. For payment authorization, verify the exact original
   `paymentBinding`.
4. Return `authenticated: true` and `userVerified: true` only after successful
   verification. Set `verifiedMethod` to a biometric method only if the
   trusted integration proves that exact method was used. Otherwise return
   `"user-verification"` or omit it; the IskuBixi modality API will not set
   `methodConfirmed` based on generic user verification.
5. Persist sessions in an application-owned store with atomic consume semantics
   across application instances. Derive `userId` from the backend's
   authenticated session, not a browser-supplied identity.

The `start()` options must never contain a private key, secret, biometric
image, template, or measurement. Do not collect, transmit, log, or store raw
biometric data in IskuBixi. Follow the vendor's privacy and retention rules for
any data handled outside the SDK.

## Modality-specific expectations

### Face

Use only a compatible, documented authenticator/provider that can verify face
authentication for the current ceremony. A generic WebAuthn assertion can
establish user verification but cannot establish that face, rather than a PIN
or another method, was used. Do not infer face support from a camera or
`userVerification: "required"`.

### Fingerprint or thumb

Use only an authenticator/provider that documents fingerprint use and can
associate it with this verified ceremony. WebAuthn does not disclose whether
the user used a fingerprint or another local verification method. Do not claim
thumb-specific confirmation unless the trusted integration explicitly proves
it.

### Eye or iris

Require a compatible authenticator and documented platform/vendor API that
explicitly establishes eye/iris verification. WebAuthn does not universally
support or identify iris recognition. Do not infer it from a camera, face
verification, or generic user verification. If the capability is absent, do
not advertise or configure `isha`.

### Palm

Require a compatible trusted device/provider with a documented palm
authentication interface and verifiable result. Ordinary phone cameras and
generic WebAuthn do not establish palm recognition. If the integration cannot
prove it, do not advertise or configure `calaacal`.

## Testing and operations

Use mocks only in isolated tests and label them as mocks. A mock proves that
application code handles the adapter contract; it does not test hardware,
provider claims, or real-device behavior. Test unsupported methods, failed and
expired sessions, replay, wrong-user attempts, concurrent verification,
storage failures, and privacy of returned data. Conduct a vendor and
real-device security review before enabling an adapter in production.

For payment-specific requirements and recovery behavior, see
[Payment authorization](./payment-authorization.md).
