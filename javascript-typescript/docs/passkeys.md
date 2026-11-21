# Passkeys and WebAuthn

## Registration

```ts
const options = await passkeys.furahaAbuur({
  userId: "user-123",
  userName: "alice",
  displayName: "Alice"
});
```

Send `options` to the browser WebAuthn API. Verify the response:

```ts
const registered = await passkeys.furahaDiiwaangeli({
  userId: "user-123",
  response: browserRegistrationResponse
});
```

## Authentication

```ts
const options = await passkeys.saxiix({ userId: "user-123" });
const result = await passkeys.saxiixXaqiiji({
  userId: "user-123",
  response: browserAuthenticationResponse
});
```

For HTTPS deployments, `rpId` must match the relying-party hostname and every
origin must be HTTPS or localhost HTTP. Challenges expire and can be consumed
only once.

Ordinary WebAuthn user verification does not prove that a particular face,
fingerprint, iris, or palm modality was used. Use a trusted external adapter
and modality-specific support for that claim.
