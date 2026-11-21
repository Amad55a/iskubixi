# Changelog

## 1.2.0 - Unreleased

### Added

- Add explicit local-simulation opt-in and live-mode provider safeguards.
- Add explicit Stripe and PayPal payment provider adapters, factories,
  webhook adapters, and capability reporting.
- Add provider selection, confirmation handoffs, and provider operation tests.
- Add provider integration guidance and a type-checked multi-provider example.

### Security and compatibility

- Validate provider payment identities and redirect actions before accepting
  lookup and verification responses.
- Reject HTTP redirects in provider transports to avoid forwarding credentials
  to another location.
- Preserve existing APIs and keep unsupported provider operations explicit.

### Validation status

- Locally mock-tested; no official provider sandbox or live transactions were
  performed for this release.
- Stripe and PayPal account eligibility depends on the provider. No direct
  Salam/Salaam Bank, Amal Bank, or Premier Bank adapter is claimed.
