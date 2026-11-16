# Payment authorization integration

Payment authorization asks a customer to approve one immutable payment request
with a supported, trusted authentication adapter. It does not confirm that a
provider has transferred money.

IskuBixi is a server-side npm SDK, not a hosted payment service. Your
application owns its users, sessions, database, provider credentials, browser
application, recovery process, and deployment.

## Lifecycle

1. The application backend authenticates the customer and loads the intended
   order from trusted application data.
2. The backend calls `iskubixi.lacag.ogolaanshoAbuur()` with the authenticated
   user ID, exact payment details, and requested authentication method.
3. IskuBixi saves the payment details, computes a binding digest, creates an
   authentication session, and returns an authorization ID, expiry,
   client-safe authentication options, and safe payment summary.
4. The frontend shows the returned summary and performs the ceremony supported
   by the configured adapter.
5. The frontend sends the authorization ID and response to the application
   backend. It does not supply replacement payment details.
6. The backend obtains the user ID from its authenticated session and calls
   `iskubixi.lacag.ogolaanshoXaqiiji()`.
7. IskuBixi verifies the bound challenge and consumes the authorization once,
   then starts the stored payment request. An uncertain provider result moves
   to `reconciliation_required`; it is not retried automatically.
8. The application checks provider verification or processes a verified
   provider webhook before marking an order paid or fulfilling it.

```ts
const authorization = await iskubixi.lacag.ogolaanshoAbuur({
  userId: authenticatedSession.user.id,
  lacag: {
    qadarka: order.total,
    lacagta: order.currency,
    bixiye: "edahab",
    tixraac: order.reference
  },
  hab: "waji"
});

// Send authorization to your own frontend. Never accept userId or payment
// details from the browser as the trusted source.
return authorization;
```

After the frontend returns its authentication response:

```ts
const result = await iskubixi.lacag.ogolaanshoXaqiiji({
  userId: authenticatedSession.user.id,
  authorizationId: request.body.authorizationId,
  response: request.body.response
});

if (result.xaalad === "processing") {
  // Authentication passed and the saved request was submitted.
  // result.payment.xaalad is a separate payment status, often "sugaya".
}
```

These public methods are `ogolaanshoAbuur`,
`ogolaanshoXaqiiji`, and `ogolaanshoXaalad`. The final verification request
accepts no amount, currency, provider, or merchant reference. The SDK retrieves
all payment details from the authorization record.

## Authentication requirements

Configure an application-owned `AmaanoodLaqabsade` that supports the requested
method and declares `supportsPaymentAuthorization: true`. It must bind the
payment digest into its challenge and verify the same digest, user, method,
expiry, and user-verification response. The adapter must prove the requested
modality; generic WebAuthn user verification does not identify face,
fingerprint, iris, palm, or PIN use. An ordinary passkey adapter that cannot
prove the requested method will be rejected for payment authorization.

The frontend runs the adapter's ceremony. It must not be trusted to assert which
modality succeeded. Use HTTPS for WebAuthn, configure the exact RP ID and
allowed origins in a WebAuthn adapter, and provide a non-biometric recovery
process for unsupported devices or cancelled prompts.

## State and durability

Authorization states (`pending`, `verifying`, `authorized`, `failed`,
`expired`, `processing`, `reconciliation_required`) are separate from payment
states (`sugaya`, `guuleystay`, `fashilmay`, and others). Authentication
success is never payment success.

The built-in in-memory authorization and authentication-session stores are for
tests and local development only. They are lost on restart and do not provide
atomic coordination across instances. Production deployments must supply
application-owned durable stores implementing `PaymentAuthorizationStore` and
`AmaanoodAuthenticationSessionStore`, with atomic unique creation, claim,
transition, and consume operations shared by all workers. Use appropriate
durable stores for payment transactions and idempotency as well.

Keep authorization IDs, stored payment details, and session references
protected. Do not store or transmit raw biometric images, templates, or
measurements.

## Provider idempotency and uncertain outcomes

The SDK's local idempotency record does not make a remote provider call
idempotent. A provider adapter may declare `capabilities.paymentIdempotency`
only when the provider documents the semantics. IskuBixi then forwards a stable
key derived from the authorization ID.

If a provider call times out, fails ambiguously, or the SDK cannot save the
returned payment ID, the authorization is marked
`reconciliation_required`. The SDK does not retry and does not allow another
payment attempt from that authorization. An interrupted worker can leave a
record in `processing`; treat it as uncertain. Reconcile through documented
provider tools, provider lookup, or authenticated webhook evidence before
deciding what to do. Database transitions and external provider calls cannot be
one atomic transaction.

The bundled WaafiPay provider adapter is sandbox-focused and does not claim
documented provider-side idempotency, lookup, or transaction verification.
Do not infer those capabilities. Use only provider operations established by
the provider's current documentation.

## Webhook and payment confirmation

Use an authenticated webhook adapter for the provider's signed callbacks.
Validate the raw request body and provider signature, apply verified events
through the SDK webhook API, and maintain your own order/payment state.
Alternatively, use provider lookup/verification only if your adapter
implements and documents it. Do not fulfill an order merely because the
authorization result is `processing` or because passkey verification
succeeded.

## Errors and fallback

Handle unsupported authentication methods, invalid/expired/replayed responses,
wrong-user requests, storage errors, provider failures, and
`reconciliation_required` explicitly. A cancelled browser ceremony should not
be treated as success. Do not retry an uncertain payment by creating a new
authorization until the previous outcome has been reconciled.

## Production checklist

- [ ] Derive `userId` from the server's authenticated session.
- [ ] Load payment amount, currency, provider, and reference from trusted
      application data.
- [ ] Use durable stores with atomic operations across all workers.
- [ ] Use a trusted adapter that verifies the exact requested method and
      user-verification result.
- [ ] For WebAuthn, validate origin/RP ID and require UV; do not claim a
      specific modality without documented evidence.
- [ ] Keep provider secrets on the backend, protected by a secret manager.
- [ ] Process only authenticated provider lookup results or signed webhooks as
      payment confirmation.
- [ ] Reconcile uncertain outcomes before any further payment attempt.
- [ ] Offer recovery for unsupported authenticators and account/device loss.
- [ ] Never collect, log, or store raw biometric data.
