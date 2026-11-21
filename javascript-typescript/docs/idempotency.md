# Idempotency

Payment creation and confirmation accept idempotency values:

```ts
const payment = await sdk.lacag.samee({
  qadarka: 25,
  lacagta: "USD",
  bixiye: "stripe",
  tixraac: "ORDER-1001",
  furahaIdempotency: "order-1001-create"
});
```

The SDK:

- stores an SDK fingerprint for duplicate detection;
- rejects reuse with changed amount, currency, provider, reference, or expiry;
- coalesces concurrent identical requests;
- hashes provider-facing keys and forwards them only when the adapter declares
  provider-side idempotency support.

Refund idempotency keys are separate from payment idempotency keys. Confirmation
keys are also separated.

Use a replaceable persistent idempotency store in production.
