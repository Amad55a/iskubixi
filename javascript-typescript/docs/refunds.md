# Refunds

Refund requests require a payment ID and idempotency key.

```ts
const refund = await sdk.lacag.celi({
  lacagId: payment.id,
  furahaIdempotency: "order-1001-refund"
});

const refundStatus = await sdk.lacag.celintaXaalad({
  celinId: refund.id
});
```

The public refund request has no amount field. Refunds are full refunds.
Supported adapters must provide the refund and refund-status operations.

Stripe and PayPal implement full refund flows. WaafiPay does not implement
refund creation or status lookup.
