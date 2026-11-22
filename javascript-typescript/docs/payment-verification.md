# Payment verification and status

Use provider lookup or verification for server-side truth.

```ts
const status = await sdk.lacag.xaalad({ lacagId: paymentId });
const verification = await sdk.lacag.cadee({ lacagId: paymentId });
```

`lacag.cadee()` returns provider verification metadata with `waaJiraa: true`
and requires an adapter with payment-verification support.

The SDK validates the provider response against the originally stored amount,
currency, reference, and payment ID. A changed or malformed response is rejected.

For Stripe, verify a PaymentIntent after checkout. For PayPal, verify that the
order capture is completed. Never mark an order successful because a redirect,
approval page, or authentication ceremony was reached.
