# Payments

## Create

```ts
const payment = await sdk.lacag.samee({
  qadarka: 25,
  lacagta: "USD",
  bixiye: "stripe",
  tixraac: "ORDER-1001",
  lambarka: "252611111111",
  furahaIdempotency: "order-1001-create",
  dhacayaa: "2026-12-01T12:00:00Z"
});
```

Fields:

- `qadarka`: positive, finite number.
- `lacagta`: provider/currency validation; pass an uppercase three-letter code.
- `bixiye`: provider identifier.
- `tixraac`: application reference.
- `lambarka`: optional account/wallet number for providers that support it.
- `furahaIdempotency`: optional SDK/provider idempotency key.
- `dhacayaa`: optional ISO 8601 payment expiry.

## Confirm/capture

```ts
const confirmed = await sdk.lacag.qabso({
  lacagId: payment.id,
  furahaIdempotency: "order-1001-confirm"
});
```

Only providers declaring `paymentConfirmation` support this operation. Stripe
supports server-side confirmation; PayPal supports capture.

## Status

```ts
const status = await sdk.lacag.xaalad({ lacagId: payment.id });
```

Statuses: `sugaya` pending, `guuleystay` successful, `fashilmay` failed,
`joojiyay` cancelled, `dhacay` expired, `laCeliyay` refunded.

Provider details can include `providerStatus` and `nextAction`.

## Verification

```ts
const result = await sdk.lacag.cadee({ lacagId: payment.id });
```

Verification is only trusted when the provider adapter reports an exact stored
payment match. It does not accept arbitrary frontend-reported success.

## List

```ts
const page = await sdk.lacag.liiska({
  bixiye: "stripe",
  xaalad: "guuleystay",
  bogga: 1,
  xadka: 50
});
```
