# QR payments

## Create

```ts
const qr = await sdk.qr.samee({
  qadarka: 20,
  lacagta: "USD",
  bixiye: "edahab",
  lambarka: "252611111111",
  furahaIdempotency: "qr-order-1001",
  dhacayaa: new Date(Date.now() + 15 * 60 * 1000).toISOString()
});
```

The result includes a QR payload in `nuxur`, the QR reference, payment ID,
amount, currency, and expiry.

## Read

```ts
const info = await sdk.qr.akhriso({ nuxur: qr.nuxur });
```

Reading validates the payload format, reference, expiry, and associated payment.
It does not create or fulfill another payment.

## Validate a reference

```ts
const valid = await sdk.qr.cadee({ tixraac: qr.tixraac });
```

## Status and cancellation

```ts
const status = await sdk.qr.xaalad({ tixraac: qr.tixraac });
const cancelled = await sdk.qr.jooji({ tixraac: qr.tixraac });
```

Cancellation requires provider cancellation support and a pending payment.
The simulator has no provider cancellation support.
