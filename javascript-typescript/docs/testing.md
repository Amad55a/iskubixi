# Testing

Run:

```sh
npm ci
npm test
npm audit
npm pack --dry-run
```

## Test levels

- **Unit tests:** SDK logic and validation.
- **Mock HTTP tests:** provider request/response behavior.
- **Contract tests:** expected provider payload and response shapes.
- **Official sandbox tests:** require authorized provider credentials.
- **Live transactions:** require explicit approval and never run by default.

Mock and unit tests establish SDK behavior, not real merchant settlement.
Do not claim official provider access without evidence.

The current suite includes security, idempotency, payment lifecycle,
verification, QR, webhook, passkey, and provider-adapter regression tests.
