# Provider development

Implement only operations with official API support.

## Contracts

`PaymentProviderFactory.create(credentials)` creates a `PaymentProvider`.

The provider contract includes:

- `createPayment`
- `findPayment`
- `verifyPayment`
- optional `confirmPayment`
- optional `cancelPayment`
- optional `refundPayment`
- optional `findRefundStatus`
- optional capabilities

Declare capabilities accurately. The SDK also infers backward-compatible
capabilities from implemented methods.

## Required implementation behavior

- use only official endpoints and authentication;
- validate malformed/unexpected responses;
- validate amount, currency, reference, and status;
- configure timeout and abort behavior;
- handle network errors safely;
- forward idempotency only if the provider contract supports it;
- redact credentials from all errors and logs;
- verify webhook signatures with raw bytes;
- never claim success from request submission alone.
