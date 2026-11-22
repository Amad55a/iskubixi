# Storage

All built-in stores are in-memory and therefore process-local. Use replaceable
application-owned stores for durable or horizontally scaled deployments.

## Relevant contracts

- `PaymentIdempotencyStore`
- `RefundIdempotencyStore`
- `PaymentStateStore`
- `PaymentTransactionStore`
- `RefundStore`
- `QrPaymentStore`
- `WebhookEventStore`
- `PaymentAuthorizationStore`
- `AmaanoodChallengeStore`
- `AmaanoodCredentialStore`

Implement the corresponding exported interface, then pass it through
`IskuBixiQaabeyn`.

```ts
const sdk = new IskuBixi({
  bixiyeyaasha: { stripe: { apiKey: process.env.STRIPE_SECRET_KEY! } },
  laqabsadayaasha: {
    stripe: new StripePaymentProviderFactory({ environment: "test" })
  },
  keydkaIdempotency: applicationPaymentIdempotencyStore,
  keydkaLacagaha: applicationTransactionStore,
  keydkaWebhook: applicationWebhookStore
});
```

Production storage should provide atomic operations, consistent reads, event
deduplication, and appropriate TTL/cleanup. Custom store failures are returned
through SDK storage errors without exposing store implementation details.
