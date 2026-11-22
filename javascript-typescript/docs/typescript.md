# TypeScript

Import runtime classes normally and use `import type` for declarations:

```ts
import {
  IskuBixi,
  StripePaymentProviderFactory,
  type IskuBixiQaabeyn
} from "iskubixi";

const config: IskuBixiQaabeyn = {
  bixiyeyaasha: {
    stripe: { apiKey: process.env.STRIPE_SECRET_KEY! }
  },
  laqabsadayaasha: {
    stripe: new StripePaymentProviderFactory({ environment: "test" })
  }
};

const sdk = new IskuBixi(config);
```

The package publishes declarations under `dist/index.d.ts` and its package
entry points resolve to `dist/index.js` and `dist/index.d.ts`.
