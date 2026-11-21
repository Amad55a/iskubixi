# Payment authorization

Payment authorization binds a short-lived authentication event to an exact
payment request.

## Create authorization

```ts
const authorization = await sdk.lacag.ogolaanshoAbuur({
  userId: "user-123",
  hab: "waji",
  lacag: {
    qadarka: 25,
    lacagta: "USD",
    bixiye: "stripe",
    tixraac: "ORDER-1001"
  }
});
```

The result contains `authorizationId`, expiry, client-safe authentication
options, and a payment summary. The payment is not created until verification
succeeds.

## Verify authorization

```ts
const result = await sdk.lacag.ogolaanshoXaqiiji({
  userId: "user-123",
  authorizationId: authorization.authorizationId,
  response: adapterResponse
});
```

The SDK atomically rejects replay, wrong user, changed request data, expiry,
and provider uncertainty. It creates the provider payment once on success.

## Check authorization

```ts
const status = await sdk.lacag.ogolaanshoXaalad({
  userId: "user-123",
  authorizationId: authorization.authorizationId
});
```

The authorization binds the user, amount, currency, provider, and reference.
Authentication or customer approval is not itself proof of payment; provider
confirmation or a verified webhook establishes success.
