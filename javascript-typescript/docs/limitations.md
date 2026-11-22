# Limitations

## Provider coverage

- Stripe and PayPal have implemented adapters.
- WaafiPay supports sandbox purchase creation and webhook verification only.
- EVC, eDahab, Zaad, and banks are not direct public provider adapters.
- Google Pay is not a processor adapter.
- Local legacy providers use only explicit simulator behavior or custom adapters.

No official sandbox or live provider test is claimed in this repository.

## Credentials

The SDK cannot provide merchant accounts or official API credentials. Obtain
provider documentation and approval for real integration.

## Biometrics

The SDK does not perform modality-specific capture or matching. It requires a
trusted external adapter.

## Storage

Default stores are in-memory. Production applications must provide durable,
atomic application-owned storage.

## Authentication

WebAuthn and authentication approval do not establish payment success. Provider
confirmation remains required.
