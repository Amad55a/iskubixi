# IskuBixi

### One SDK. Many Payments. Smarter Authentication.

IskuBixi is an open-source SDK for integrating payments and authentication
into applications. Developers use their own provider accounts, credentials,
application users, databases, and backend infrastructure.

## JavaScript and TypeScript SDK

The SDK currently included in this repository is the JavaScript and TypeScript
implementation. It is published as the `iskubixi` npm package.

- [SDK README](./javascript-typescript/README.md)
- [SDK source](./javascript-typescript/src/)
- [SDK documentation](./javascript-typescript/docs/index.md)
- [TypeScript examples](./javascript-typescript/examples/typescript/)
- [JavaScript examples](./javascript-typescript/examples/javascript/)

The SDK provides payment-provider routing, idempotency, QR workflows,
WebAuthn/passkeys, adapter-based biometric authorization, and webhook
verification. Provider integration status is documented rather than assumed:

- Stripe and PayPal have implemented adapters.
- WaafiPay supports sandbox purchase creation and webhook verification.
- EVC, eDahab, Zaad, direct bank integrations, and Google Pay do not have
  direct provider adapters in this repository.

No official sandbox or live transaction test is claimed without actual
provider credentials and evidence.

## Repository layout

```text
IskuBixi/
├── README.md
├── LICENSE
├── .gitignore
└── javascript-typescript/
```

IskuBixi does not operate a hosted payment backend or require an IskuBixi
database or central API key. Provider credentials belong on the application
backend and must not be placed in browser code or source-controlled examples.

## License

IskuBixi is licensed under the [MIT License](./LICENSE).
