# Architecture

```text
Developer application
  ├─ users and business rules
  ├─ application database and storage
  ├─ server-side provider credentials
  └─ IskuBixi SDK
       ├─ payment routing
       ├─ idempotency
       ├─ QR state
       ├─ webhook normalization
       └─ passkey/adapter authorization
             |
             v
Provider or custom PaymentProvider
```

IskuBixi is not a hosted backend. It does not own credentials, users, or a
database. Developers choose providers for each payment and deploy their own
backend.

The SDK is suitable for server-side use in CommonJS Node.js applications.
Browser code should only receive provider/client handoff values intentionally
returned by the server, never API secrets or webhook signing secrets.
