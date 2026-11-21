# Errors

All SDK errors extend `IskuBixiError` and expose stable `code` values.

| Class | Typical use |
|---|---|
| `ConfigurationError` | invalid SDK/provider configuration |
| `ValidationError` | invalid public input |
| `PaymentError` | payment operation failure |
| `ProviderError` | provider response or transport failure |
| `RefundError` | refund failure |
| `IdempotencyError` | conflicting duplicate request |
| `StorageError` | custom storage failure |
| `WebhookVerificationError` | invalid or untrusted webhook |
| `UnsupportedOperationError` | provider capability unavailable |
| `WebAuthnError` | passkey or authentication failure |

```ts
try {
  await sdk.lacag.samee(request);
} catch (error) {
  if (error instanceof ValidationError) {
    // Correct application input.
  } else if (error instanceof UnsupportedOperationError) {
    // Select a provider with the required capability.
  } else if (error instanceof ProviderError) {
    // Reconcile provider state; do not assume failure or success.
  } else {
    throw error;
  }
}
```

After uncertain network/provider failures, reconcile by payment ID before
creating a new write.
