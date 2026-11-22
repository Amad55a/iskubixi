# Security

## Credentials

- Keep provider secrets in environment variables or secret management.
- Never place secrets in browser bundles or source-controlled examples.
- Never return credential objects from application endpoints.
- Never print credentials in application or SDK logs.
- Rotate credentials and signing secrets when compromised.

## Payment truth

Never mark success solely because:

- payment creation returned successfully;
- a redirect or approval screen was shown;
- a biometric challenge was authenticated;
- a frontend reported success.

Use a provider lookup, verification, confirmation/capture, or verified webhook
that exactly matches the stored payment.

## Webhooks

Verify raw bytes with the provider-specific adapter before parsing or applying
events. Use deduplication and exact payment-detail matching.

## Biometrics

Do not store raw biometric samples. Use a trusted modality adapter and never
infer face, fingerprint, iris, or palm use from ordinary WebAuthn user
verification alone.

## Authorization

Payment authorization is short-lived and bound to user, amount, currency,
provider, and reference. Authorization replay and request changes are rejected.
