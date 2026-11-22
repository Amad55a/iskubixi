# Biometric adapters

IskuBixi provides adapter interfaces for:

- `waji`: face
- `faraha`: fingerprint/thumb
- `isha`: eye/iris
- `calaacal`: palm

The package does not perform hardware capture or universal biometric matching.
It does not store raw biometric templates or samples.

## Register an adapter

```ts
const adapter: AmaanoodLaqabsade = {
  id: "trusted-face-provider",
  supportedMethods: ["waji"],
  supportsPaymentAuthorization: true,
  async start({ userId, method, paymentBinding }) {
    return {
      options: { ceremony: "face-verification" },
      adapterSessionId: "opaque-adapter-session",
      expiresAt: Date.now() + 60_000
    };
  },
  async verify({ userId, method, adapterSessionId, response, paymentBinding }) {
    return {
      authenticated: true,
      userVerified: true,
      verifiedMethod: "waji"
    };
  }
};

const sdk = new IskuBixi({
  bixiyeyaasha: { edahab: { apiKey: "local-demo-only" } },
  allowSimulation: true,
  amaanood: {
    laqabsadayaal: [adapter]
  }
});
```

Use a trusted adapter that:

- creates an unpredictable user-bound challenge;
- verifies the exact response and session;
- verifies user presence/user verification;
- checks `paymentBinding` when present;
- never exposes raw biometric data to IskuBixi.

Ordinary WebAuthn user verification may be `"user-verification"` but does not
prove a named face, fingerprint, eye, or palm modality. Authentication approval
also does not make a payment successful.
