# API reference

Names below are the public SDK entry points implemented in `src/index.ts`.

## SDK

### `new IskuBixi(configuration)`

Creates SDK instances and initializes provider, storage, webhook, and
authentication adapters.

### `sdk.lacag.samee(request)`

Creates a payment. Fields: `qadarka`, `lacagta`, `bixiye`, `tixraac`,
optional `lambarka`, `furahaIdempotency`, and `dhacayaa`.

### `sdk.lacag.qabso(request)`

Confirms or captures a provider payment. Fields: `lacagId`,
`furahaIdempotency`. Requires provider confirmation support.

### `sdk.lacag.xaalad(request)`

Retrieves provider status. Input: `lacagId`.

### `sdk.lacag.cadee(request)`

Verifies provider existence and exact stored payment identity. Input:
`lacagId`.

### `sdk.lacag.celi(request)`

Creates a full refund. Fields: `lacagId`, `furahaIdempotency`.

### `sdk.lacag.celintaXaalad(request)`

Retrieves refund status. Field: `celinId`.

### `sdk.lacag.liiska(request?)`

Lists stored transactions. Optional filters: `bixiye`, `xaalad`, `lacagta`,
`lagaBilaabo`, `ilaa`, `bogga`, `xadka`.

### `sdk.bixiye.awood(request)`

Reports provider capabilities. Input: `bixiye`.

## QR

- `sdk.qr.samee(request)`
- `sdk.qr.cadee({ tixraac })`
- `sdk.qr.akhriso({ nuxur })`
- `sdk.qr.xaalad({ tixraac })`
- `sdk.qr.jooji({ tixraac })`
- `sdk.qr.xog({ tixraac })`

QR creation requires `dhacayaa`.

## Webhooks

- `sdk.webhook.cadee(request)`
- `sdk.webhook.kaShaqee(request)`
- `sdk.webhook.fashilmay({ bixiye? })`
- `sdk.webhook.dibUshaqee({ bixiye, dhacdoId, codsi? })`

Webhook requests contain `bixiye`, unchanged `rawBody`, and `headers`.

## Payment authorization

- `sdk.lacag.ogolaanshoAbuur(request)`
- `sdk.lacag.ogolaanshoXaqiiji(request)`
- `sdk.lacag.ogolaanshoXaalad(request)`

## Biometric/adapters

- `sdk.amaanood.waji(request)`
- `sdk.amaanood.faraha(request)`
- `sdk.amaanood.isha(request)`
- `sdk.amaanood.calaacal(request)`
- `sdk.amaanood.xaqiiji(request)`

These require matching configured external adapters.

## Passkeys

`Amaanood` public methods:

- `furahaAbuur()`
- `furahaDiiwaangeli()`
- `saxiix()`
- `saxiixXaqiiji()`
- `furahaLiiska()`
- `furahaJooji()`
