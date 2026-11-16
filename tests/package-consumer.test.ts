import {
  Amaanood,
  InMemoryPaymentAuthorizationStore,
  IskuBixi,
  type AuthenticationResponseJSON,
  type AmaanoodLaqabsade,
  type AmaanoodQaabeyn,
  type IskuBixiQaabeyn,
  type PaymentAuthorizationStore,
  type RegistrationResponseJSON
} from "..";

// Type-only mock adapter for the package-consumer API check; not hardware support.
const authenticationAdapter: AmaanoodLaqabsade = {
  id: "consumer-auth-adapter",
  supportedMethods: ["waji", "faraha", "isha", "calaacal"],
  async start({ method }) {
    return {
      options: { requestedMethod: method },
      adapterSessionId: `adapter-${method}`,
      expiresAt: Date.now() + 60_000
    };
  },
  async verify() {
    return {
      authenticated: true,
      userVerified: true,
      verifiedMethod: "user-verification"
    };
  }
};

const configuration: IskuBixiQaabeyn = {
  bixiyeyaasha: {
    edahab: {
      apiKey: "consumer-type-check-key",
      merchantId: "consumer-type-check-merchant"
    }
  },
  amaanood: { laqabsadayaal: [authenticationAdapter] },
  keydkaOgolaanshaha: new InMemoryPaymentAuthorizationStore()
};
const paymentAuthorizationStore: PaymentAuthorizationStore =
  new InMemoryPaymentAuthorizationStore();

const sdk: IskuBixi = new IskuBixi(configuration);
const passkeyConfiguration: AmaanoodQaabeyn = {
  rpId: "example.com",
  rpName: "Example App",
  origins: ["https://example.com"]
};
const amaanood = new Amaanood(passkeyConfiguration);
declare const registrationResponse: RegistrationResponseJSON;
declare const authenticationResponse: AuthenticationResponseJSON;

async function quickStartConsumerExample(): Promise<void> {
  const lacag = await sdk.lacag.samee({
    qadarka: 20,
    lacagta: "USD",
    bixiye: "edahab",
    tixraac: "LOCAL-DEMO-1"
  });
  const xaqiijin = await sdk.lacag.cadee({ lacagId: lacag.id });

  const paymentStatus: string = lacag.xaalad;
  const verificationSource: string = xaqiijin.xaqiijin;
  const options = await amaanood.furahaAbuur({
    userId: "account-1",
    userName: "user@example.com"
  });
  const registration = await amaanood.furahaDiiwaangeli({
    userId: "account-1",
    response: registrationResponse
  });
  const loginOptions = await amaanood.saxiix({ userId: "account-1" });
  const paymentBoundOptions = await amaanood.saxiix({
    userId: "account-1",
    paymentBinding: "a".repeat(64)
  });
  const authenticated = await amaanood.saxiixXaqiiji({
    userId: "account-1",
    response: authenticationResponse
  });
  const passkeys = await amaanood.furahaLiiska({ userId: "account-1" });
  const revoked = await amaanood.furahaJooji({
    userId: "account-1",
    credentialId: registration.credentialId
  });
  const biometricOptions = await sdk.amaanood.waji({ userId: "account-1" });
  const fingerprintOptions = await sdk.amaanood.faraha({ userId: "account-1" });
  const eyeOptions = await sdk.amaanood.isha({ userId: "account-1" });
  const palmOptions = await sdk.amaanood.calaacal({ userId: "account-1" });
  const paymentAuthorization = await sdk.lacag.ogolaanshoAbuur({
    userId: "account-1",
    lacag: {
      qadarka: 25,
      lacagta: "USD",
      bixiye: "edahab",
      tixraac: "ORDER-1001"
    },
    hab: "waji"
  });
  const authorizedPayment = await sdk.lacag.ogolaanshoXaqiiji({
    userId: "account-1",
    authorizationId: paymentAuthorization.authorizationId,
    response: authenticationResponse
  });
  const authorizationStatus = await sdk.lacag.ogolaanshoXaalad({
    userId: "account-1",
    authorizationId: paymentAuthorization.authorizationId
  });
  const biometricLogin = await sdk.amaanood.xaqiiji({
    userId: "account-1",
    sessionId: biometricOptions.sessionId,
    response: authenticationResponse
  });
  void paymentStatus;
  void verificationSource;
  void options;
  void registration.credentialId;
  void loginOptions;
  void paymentBoundOptions;
  void authenticated.authenticated;
  void passkeys;
  void revoked;
  void biometricOptions.options;
  void fingerprintOptions.options;
  void eyeOptions.options;
  void palmOptions.options;
  void biometricLogin.methodConfirmed;
  void paymentAuthorization.authenticationOptions;
  void authorizedPayment.xaalad;
  void authorizationStatus.xaalad;
  void paymentAuthorizationStore;
}

void quickStartConsumerExample;
