# Examples

## Server initialization

See [Getting started](./getting-started.md) and
[Configuration](./configuration.md).

## Payment

```ts
const created = await sdk.lacag.samee({
  qadarka: 25,
  lacagta: "USD",
  bixiye: "stripe",
  tixraac: "ORDER-1001",
  furahaIdempotency: "order-1001-create"
});

const status = await sdk.lacag.xaalad({ lacagId: created.id });
```

## QR

```ts
const qr = await sdk.qr.samee({
  qadarka: 20,
  lacagta: "USD",
  bixiye: "edahab",
  lambarka: "252611111111",
  dhacayaa: new Date(Date.now() + 900000).toISOString()
});
```

## Webhook

```ts
await sdk.webhook.kaShaqee({
  bixiye: "stripe",
  rawBody,
  headers
});
```

## Passkey

See [Passkeys](./passkeys.md).
