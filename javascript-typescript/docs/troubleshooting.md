# Troubleshooting

## Provider requires an adapter

Stripe and PayPal require explicit factories. EVC, eDahab, Zaad, and bank
providers require custom real adapters outside the built-in simulator.

## Live credentials rejected

Check that Stripe test/live key prefixes match `environment`.
Check that PayPal environment is `sandbox` or `live`.
Check that WaafiPay is not configured outside sandbox support.

## Payment remains pending

Retrieve status or verification through the provider. For PayPal, confirm that
the order was captured. For Stripe, complete the required PaymentIntent client
handoff and retrieve server-side state.

## Webhook rejected

Use unchanged raw bytes, provider signing secrets, exact headers, and the
configured provider adapter.

## Secrets appear in errors

This should not occur. Report the error and verify that provider/custom storage
implementations do not place credentials in thrown messages or error causes.
