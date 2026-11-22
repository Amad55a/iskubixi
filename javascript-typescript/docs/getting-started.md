# Getting started

IskuBixi runs inside your application backend. It does not host payments or
replace your provider merchant account.

## Requirements

- Node.js 20 or later
- HTTPS for deployed WebAuthn origins
- A real provider account and credentials, or local simulation

## Install

```sh
npm install iskubixi
```

## Local simulation

```js
const { IskuBixi } = require("iskubixi");

const sdk = new IskuBixi({
  allowSimulation: true,
  bixiyeyaasha: {
    edahab: { apiKey: "local-demo-only" }
  }
});
```

Simulation IDs and statuses are not real payment confirmations.

## Real Stripe provider

```ts
import { IskuBixi, StripePaymentProviderFactory } from "iskubixi";

const sdk = new IskuBixi({
  bixiyeyaasha: {
    stripe: { apiKey: process.env.STRIPE_SECRET_KEY! }
  },
  laqabsadayaasha: {
    stripe: new StripePaymentProviderFactory({ environment: "test" })
  }
});
```

## Create a payment

```ts
const payment = await sdk.lacag.samee({
  qadarka: 25,
  lacagta: "USD",
  bixiye: "stripe",
  tixraac: "ORDER-1001",
  furahaIdempotency: "order-1001-create"
});

console.log(payment.xaalad);
```

A result can remain pending or contain a provider handoff. Confirm success only
through provider lookup, verification, capture/confirmation, or a verified
webhook.
