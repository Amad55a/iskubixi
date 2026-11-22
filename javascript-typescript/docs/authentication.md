# Authentication

IskuBixi separates passkeys/WebAuthn from external modality adapters.

## Passkeys

Create an `Amaanood` instance with relying-party configuration:

```ts
import { Amaanood } from "iskubixi";

const passkeys = new Amaanood({
  rpId: "example.com",
  rpName: "Example",
  origins: ["https://example.com"],
  requireUserVerification: true
});
```

Public methods:

- `furahaAbuur()` generates registration options.
- `furahaDiiwaangeli()` verifies registration.
- `saxiix()` generates authentication options.
- `saxiixXaqiiji()` verifies authentication.
- `furahaLiiska()` lists public credential metadata.
- `furahaJooji()` revokes a credential.

## External modality adapters

`IskuBixi.amaanood.waji`, `faraha`, `isha`, and `calaacal` require a matching
`AmaanoodLaqabsade` in configuration. Adapter support does not mean the SDK
contains hardware or biometric templates.

The SDK stores opaque session identifiers and challenge state, not raw biometric
information.
