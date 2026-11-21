# Webhooks

Configure one signature-verifying adapter per provider.

```ts
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
  },
  keydkaWebhook: new InMemoryWebhookEventStore()
});
```

## Verify only

```ts
const verification = await sdk.webhook.cadee({
  bixiye: "stripe",
  rawBody: requestBody,
  headers: requestHeaders
});
```

## Verify and apply

```ts
const result = await sdk.webhook.kaShaqee({
  bixiye: "stripe",
  rawBody: requestBody,
  headers: requestHeaders
});
```

The implementation verifies the provider signature before parsing or applying
events. Stripe and other adapters require the unchanged raw request bytes.
Events are deduplicated and conflicting terminal transitions are rejected.

## Retry failures

```ts
const failed = await sdk.webhook.fashilmay({ bixiye: "stripe" });

const retried = await sdk.webhook.dibUshaqee({
  bixiye: "stripe",
  dhacdoId: "evt_123",
  codsi: originalWebhookRequest
});
```

A retry requires an recoverable webhook store and re-verifies the original
signed request.
