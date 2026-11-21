# Webhook security

Provider adapters must authenticate raw bytes before parsing provider JSON.
Never verify a re-serialized or reformatted request body.

## Required controls

- exact provider signature validation;
- timestamp/replay tolerance where the provider format supports it;
- event ID deduplication;
- exact payment ID, amount, currency, and reference matching;
- terminal status transition validation;
- refund event normalization;
- retry only from the original signed request;
- secret-safe error handling.

Webhook success is not sufficient by itself if the event details do not match
the locally stored payment.

Stripe uses its official Node SDK signature constructor. PayPal verifies
signatures through PayPal's verification API. WaafiPay uses its separate
timestamp and HMAC adapter.
