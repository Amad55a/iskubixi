# Payment lifecycle

```text
Application
  -> IskuBixi.lacag.samee
  -> selected provider adapter
  -> provider transaction ID
  -> local transaction record

Provider response / webhook
  -> status validation
  -> exact amount/currency/reference match
  -> trusted success/pending/failure state
```

Creation may produce pending, failed, or provider-handoff state. It is never
unconditional success.

The SDK supports:

- provider-side idempotency keys when advertised;
- SDK idempotency fingerprints;
- concurrency coalescing;
- expiry;
- status lookup;
- verification;
- confirmation/capture;
- cancellation where supported;
- refunds;
- refund status lookup;
- verified webhooks.

After a network timeout, reconcile with the provider rather than blindly
retrying a write.
