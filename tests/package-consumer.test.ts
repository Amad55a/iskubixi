import {
  Amaanood,
  IskuBixi,
  type AuthenticationResponseJSON,
  type AmaanoodQaabeyn,
  type IskuBixiQaabeyn,
  type RegistrationResponseJSON
} from "..";

const configuration: IskuBixiQaabeyn = {
  bixiyeyaasha: {
    edahab: {
      apiKey: "consumer-type-check-key",
      merchantId: "consumer-type-check-merchant"
    }
  }
};

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
  const authenticated = await amaanood.saxiixXaqiiji({
    userId: "account-1",
    response: authenticationResponse
  });
  const passkeys = await amaanood.furahaLiiska({ userId: "account-1" });
  const revoked = await amaanood.furahaJooji({
    userId: "account-1",
    credentialId: registration.credentialId
  });
  void paymentStatus;
  void verificationSource;
  void options;
  void registration.credentialId;
  void loginOptions;
  void authenticated.authenticated;
  void passkeys;
  void revoked;
}

void quickStartConsumerExample;
