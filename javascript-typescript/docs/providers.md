# Payment providers

The source of truth for provider status is the implementation and its
capability report. No integration is considered verified against an official
sandbox or live environment unless it was actually tested with credentials.

## Status matrix

| Provider | Create | Lookup | Verify | Confirm/capture | Cancel | Refund/status | Webhooks |
|---|---|---|---|---|---|---|---|
| Stripe | Yes | Yes | Yes | Confirm/cancel | Yes | Full refund/status | Stripe raw-body signatures |
| PayPal | Order | Yes | Yes | Capture | No | Full capture refund/status | PayPal remote verification |
| WaafiPay | Sandbox purchase | No | No | No | No | No | Separate signature adapter |
| EVC | No | No | No | No | No | No | No |
| eDahab | No | No | No | No | No | No | No |
| Zaad | No | No | No | No | No | No | No |
| Banks | No | No | No | No | No | No | No |
| Simulator | Local only | Local only | Local only | Local status control | No | Local refund | No real provider webhook |

## Stripe

The package exports `StripePaymentProviderFactory`,
`StripePaymentProvider`, and `StripeWebhookAdapter`.

```ts
import {
  IskuBixi,
  StripePaymentProviderFactory,
  StripeWebhookAdapter
} from "iskubixi";

const sdk = new IskuBixi({
  bixiyeyaasha: {
    stripe: { apiKey: process.env.STRIPE_SECRET_KEY! }
  },
  laqabsadayaasha: {
    stripe: new StripePaymentProviderFactory({ environment: "test" })
  },
  laqabsadayaashaWebhook: {
    stripe: new StripeWebhookAdapter({
      secret: process.env.STRIPE_WEBHOOK_SECRET!
    })
  }
});
```

For live use, set `environment: "live"` and use an `sk_live_` key. Test mode
requires `sk_test_`. The adapter cannot enable Stripe for an account where
Stripe does not support the merchant or business country.

## PayPal

The package exports `PayPalPaymentProviderFactory`,
`PayPalPaymentProvider`, and `PayPalWebhookAdapter`.

```ts
import {
  IskuBixi,
  PayPalPaymentProviderFactory,
  PayPalWebhookAdapter
} from "iskubixi";

const credentials = {
  clientId: process.env.PAYPAL_CLIENT_ID!,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET!
};

const sdk = new IskuBixi({
  bixiyeyaasha: { paypal: credentials },
  laqabsadayaasha: {
    paypal: new PayPalPaymentProviderFactory({ environment: "sandbox" })
  },
  laqabsadayaashaWebhook: {
    paypal: new PayPalWebhookAdapter(credentials, {
      environment: "sandbox",
      webhookId: process.env.PAYPAL_WEBHOOK_ID!
    })
  }
});
```

Creating an order is not capture. The SDK returns an approval redirect when
PayPal provides one. The application must capture and verify the order through
the provider API or webhook.

## WaafiPay

`WaafiPayPaymentProviderFactory` implements only sandbox purchase creation.
It is explicitly limited to sandbox mode. Lookup, verification, confirmation,
cancellation, refunds, and refund lookup are unsupported in the SDK.

```ts
import {
  IskuBixi,
  WaafiPayPaymentProviderFactory
} from "iskubixi";

const waafi = new WaafiPayPaymentProviderFactory({
  environment: "sandbox",
  formatTimestamp: () => "20261122T000000Z   " // Replace with provider format.
});
```

Obtain the merchant UID, API user ID, API key, and exact timestamp format from
WaafiPay merchant documentation. The adapter validates credentials but does not
prove that a merchant account is enabled or that live charging is allowed.

## Providers without direct adapters

The identifiers `edahab`, `evc`, `zaad`, and `bank` do not have invented API
implementations. Local simulation is available for `edahab`, `evc`, `zaad`,
and `bank` only with `allowSimulation: true`. Live-mode credentials never fall
back to simulation.

Applications can implement the public `PaymentProvider` and
`PaymentProviderFactory` contracts after they receive official API
documentation and authorized credentials.

## Google Pay

Google Pay is a wallet/checkout technology, not a standalone provider adapter.
A processor that the SDK supports or a custom provider must implement the real
payment, merchant eligibility, capture, verification, refund, and webhook flow.
