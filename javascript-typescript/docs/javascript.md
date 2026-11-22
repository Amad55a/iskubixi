# JavaScript

The package uses CommonJS:

```js
const {
  IskuBixi,
  StripePaymentProviderFactory
} = require("iskubixi");

const sdk = new IskuBixi({
  bixiyeyaasha: {
    stripe: { apiKey: process.env.STRIPE_SECRET_KEY }
  },
  laqabsadayaasha: {
    stripe: new StripePaymentProviderFactory({ environment: "test" })
  }
});
```

There is no separate native ESM build. JavaScript users can also consume the
package through tools that support require-compatible CommonJS interop.
