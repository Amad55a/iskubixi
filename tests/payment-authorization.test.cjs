const test = require("node:test");
const assert = require("node:assert/strict");
const {
  IskuBixi,
  InMemoryAmaanoodAuthenticationSessionStore,
  InMemoryPaymentAuthorizationStore,
  PaymentError,
  UnsupportedOperationError,
  WebAuthnError
} = require("..");

const userId = "customer-028";
const paymentRequest = {
  qadarka: 25,
  lacagta: "USD",
  bixiye: "edahab",
  tixraac: "ORDER-1001",
  lambarka: "account-private"
};

function makeAuthAdapter(overrides = {}) {
  const calls = { starts: [], verifications: [] };
  const adapter = {
    id: "mock-payment-authenticator",
    supportedMethods: ["waji"],
    supportsPaymentAuthorization: true,
    async start(request) {
      calls.starts.push(request);
      return {
        options: { challenge: request.paymentBinding },
        adapterSessionId: `mock-session-${calls.starts.length}`,
        expiresAt: Date.now() + 60_000
      };
    },
    async verify(request) {
      calls.verifications.push(request);
      return {
        authenticated: request.response.challenge === request.paymentBinding,
        userVerified: true,
        verifiedMethod: "waji"
      };
    },
    ...overrides
  };
  return { adapter, calls };
}

function makePaymentProvider(overrides = {}) {
  const calls = [];
  const provider = {
    capabilities: {},
    async createPayment(request) {
      calls.push(request);
      if (overrides.createPayment) {
        return overrides.createPayment(request);
      }
      return {
        id: `provider-payment-${calls.length}`,
        amount: request.amount,
        currency: request.currency,
        reference: request.reference,
        status: "sugaya"
      };
    },
    async findPayment() {
      return undefined;
    },
    async verifyPayment() {
      return { exists: false, source: "adapter" };
    }
  };
  if (overrides.capabilities) {
    provider.capabilities = overrides.capabilities;
  }
  return { provider, calls };
}

function makeSdk({
  adapter = makeAuthAdapter().adapter,
  provider = makePaymentProvider().provider,
  authorizationStore = new InMemoryPaymentAuthorizationStore(),
  authenticationSessionStore = new InMemoryAmaanoodAuthenticationSessionStore()
} = {}) {
  return new IskuBixi({
    bixiyeyaasha: { edahab: { apiKey: "test-key" } },
    laqabsadayaasha: {
      edahab: { create: () => provider }
    },
    amaanood: {
      laqabsadayaal: [adapter],
      keydkaKulamada: authenticationSessionStore
    },
    keydkaOgolaanshaha: authorizationStore
  });
}

async function createAuthorization(sdk, payment = paymentRequest) {
  const authorization = await sdk.lacag.ogolaanshoAbuur({
    userId,
    lacag: payment,
    hab: "waji"
  });
  return {
    authorization,
    response: { challenge: authorization.authenticationOptions.challenge }
  };
}

test("[mock-adapter/mock-provider] binds the stored payment and returns only a safe summary", async () => {
  const { adapter, calls: authCalls } = makeAuthAdapter();
  const { provider, calls: providerCalls } = makePaymentProvider();
  const sdk = makeSdk({ adapter, provider });
  const { authorization, response } = await createAuthorization(sdk);

  assert.deepEqual(authorization.lacag, {
    qadarka: 25,
    lacagta: "USD",
    bixiye: "edahab",
    tixraac: "ORDER-1001"
  });
  assert.equal(JSON.stringify(authorization).includes("account-private"), false);
  assert.equal(authCalls.starts[0].paymentBinding, authorization.authenticationOptions.challenge);

  const result = await sdk.lacag.ogolaanshoXaqiiji({
    userId,
    authorizationId: authorization.authorizationId,
    response
  });
  assert.equal(result.xaalad, "processing");
  assert.equal(result.payment.xaalad, "sugaya");
  assert.deepEqual(providerCalls[0], {
    amount: 25,
    currency: "USD",
    reference: "ORDER-1001",
    accountNumber: "account-private"
  });
  assert.equal(authCalls.verifications[0].paymentBinding, authCalls.starts[0].paymentBinding);
  assert.equal(providerCalls.length, 1);
});

test("[mock-adapter/mock-provider] rejects stored payment or user changes before authenticating", async () => {
  const mutations = [
    { target: "payment", field: "qadarka", value: 250 },
    { target: "payment", field: "lacagta", value: "EUR" },
    { target: "payment", field: "bixiye", value: "evc" },
    { target: "payment", field: "tixraac", value: "OTHER-ORDER" },
    { target: "user", field: "userId", value: "different-customer" }
  ];

  for (const mutation of mutations) {
    const store = new InMemoryPaymentAuthorizationStore();
    const claim = store.claimForVerification.bind(store);
    store.claimForVerification = async (...args) => {
      const record = await claim(...args);
      if (!record) {
        return undefined;
      }
      if (mutation.target === "user") {
        return { ...record, userId: mutation.value };
      }
      return {
        ...record,
        payment: {
          ...record.payment,
          [mutation.field]: mutation.value
        }
      };
    };
    const { adapter, calls: authCalls } = makeAuthAdapter();
    const { provider, calls: providerCalls } = makePaymentProvider();
    const sdk = makeSdk({ adapter, provider, authorizationStore: store });
    const { authorization, response } = await createAuthorization(sdk);

    await assert.rejects(
      sdk.lacag.ogolaanshoXaqiiji({
        userId,
        authorizationId: authorization.authorizationId,
        response
      }),
      PaymentError
    );
    assert.equal(authCalls.verifications.length, 0);
    assert.equal(providerCalls.length, 0);
  }
});

test("[mock-adapter/mock-provider] rejects wrong users, changed details, and unknown authorizations", async () => {
  const { adapter, calls: authCalls } = makeAuthAdapter();
  const { provider, calls: providerCalls } = makePaymentProvider();
  const sdk = makeSdk({ adapter, provider });
  const { authorization, response } = await createAuthorization(sdk);

  await assert.rejects(
    sdk.lacag.ogolaanshoXaqiiji({
      userId: "another-customer",
      authorizationId: authorization.authorizationId,
      response
    }),
    PaymentError
  );
  await assert.rejects(
    sdk.lacag.ogolaanshoXaqiiji({
      userId,
      authorizationId: authorization.authorizationId,
      response,
      lacag: { ...paymentRequest, qadarka: 250 }
    }),
    /valid payment authorization/
  );
  await assert.rejects(
    sdk.lacag.ogolaanshoXaqiiji({
      userId,
      authorizationId: "A".repeat(43),
      response
    }),
    PaymentError
  );
  assert.equal(authCalls.verifications.length, 0);
  assert.equal(providerCalls.length, 0);
});

test("[mock-adapter/mock-provider] expires authorizations without invoking the provider", async () => {
  const store = new InMemoryPaymentAuthorizationStore();
  const create = store.create.bind(store);
  store.create = async (record) =>
    create({ ...record, expiresAt: Date.now() - 1 });
  const { adapter } = makeAuthAdapter();
  const { provider, calls } = makePaymentProvider();
  const sdk = makeSdk({ adapter, provider, authorizationStore: store });
  const { authorization, response } = await createAuthorization(sdk);

  const result = await sdk.lacag.ogolaanshoXaqiiji({
    userId,
    authorizationId: authorization.authorizationId,
    response
  });
  assert.equal(result.xaalad, "expired");
  assert.equal(calls.length, 0);
});

test("[mock-adapter/mock-provider] failed user verification never starts payment", async () => {
  const { adapter } = makeAuthAdapter({
    async verify() {
      return { authenticated: true, userVerified: false };
    }
  });
  const { provider, calls } = makePaymentProvider();
  const sdk = makeSdk({ adapter, provider });
  const { authorization, response } = await createAuthorization(sdk);

  await assert.rejects(
    sdk.lacag.ogolaanshoXaqiiji({
      userId,
      authorizationId: authorization.authorizationId,
      response
    }),
    WebAuthnError
  );
  assert.equal((await sdk.lacag.ogolaanshoXaalad({
    userId,
    authorizationId: authorization.authorizationId
  })).xaalad, "failed");
  assert.equal(calls.length, 0);
});

test("[mock-adapter/mock-provider] generic WebAuthn user verification does not satisfy a modality request", async () => {
  const { adapter } = makeAuthAdapter({
    async verify(request) {
      return {
        authenticated: request.response.challenge === request.paymentBinding,
        userVerified: true,
        verifiedMethod: "user-verification"
      };
    }
  });
  const { provider, calls } = makePaymentProvider();
  const sdk = makeSdk({ adapter, provider });
  const { authorization, response } = await createAuthorization(sdk);

  await assert.rejects(
    sdk.lacag.ogolaanshoXaqiiji({
      userId,
      authorizationId: authorization.authorizationId,
      response
    }),
    WebAuthnError
  );
  assert.equal((await sdk.lacag.ogolaanshoXaalad({
    userId,
    authorizationId: authorization.authorizationId
  })).xaalad, "failed");
  assert.equal(calls.length, 0);
});

test("[mock-adapter/mock-provider] requires explicit payment-authorization adapter support", async () => {
  const { adapter } = makeAuthAdapter({ supportsPaymentAuthorization: false });
  const { provider, calls } = makePaymentProvider();
  const sdk = makeSdk({ adapter, provider });

  await assert.rejects(
    sdk.lacag.ogolaanshoAbuur({
      userId,
      lacag: paymentRequest,
      hab: "waji"
    }),
    UnsupportedOperationError
  );
  assert.equal(calls.length, 0);
});

test("[mock-adapter/mock-provider] makes only one provider call under concurrent verification and replay", async () => {
  let releaseVerification;
  const { adapter } = makeAuthAdapter({
    async verify(request) {
      await new Promise((resolve) => {
        releaseVerification = resolve;
      });
      return {
        authenticated: request.response.challenge === request.paymentBinding,
        userVerified: true,
        verifiedMethod: "waji"
      };
    }
  });
  const { provider, calls } = makePaymentProvider();
  const sdk = makeSdk({ adapter, provider });
  const { authorization, response } = await createAuthorization(sdk);
  const first = sdk.lacag.ogolaanshoXaqiiji({
    userId,
    authorizationId: authorization.authorizationId,
    response
  });
  await new Promise((resolve) => setImmediate(resolve));
  const concurrent = await sdk.lacag.ogolaanshoXaqiiji({
    userId,
    authorizationId: authorization.authorizationId,
    response
  });
  assert.equal(concurrent.xaalad, "verifying");
  releaseVerification();
  const result = await first;
  assert.equal(result.xaalad, "processing");

  const replay = await sdk.lacag.ogolaanshoXaqiiji({
    userId,
    authorizationId: authorization.authorizationId,
    response
  });
  assert.equal(replay.xaalad, "processing");
  assert.equal(calls.length, 1);
});

test("[mock-adapter/mock-provider] atomically allows one attempt across SDK instances", async () => {
  const { adapter } = makeAuthAdapter();
  const { provider, calls } = makePaymentProvider();
  const authorizationStore = new InMemoryPaymentAuthorizationStore();
  const authenticationSessionStore = new InMemoryAmaanoodAuthenticationSessionStore();
  const options = { adapter, provider, authorizationStore, authenticationSessionStore };
  const firstSdk = makeSdk(options);
  const secondSdk = makeSdk(options);
  const { authorization, response } = await createAuthorization(firstSdk);

  const [first, second] = await Promise.all([
    firstSdk.lacag.ogolaanshoXaqiiji({
      userId,
      authorizationId: authorization.authorizationId,
      response
    }),
    secondSdk.lacag.ogolaanshoXaqiiji({
      userId,
      authorizationId: authorization.authorizationId,
      response
    })
  ]);
  assert.equal([first, second].filter((result) => result.xaalad === "processing").length, 1);
  assert.equal(calls.length, 1);
});

test("[mock-adapter/mock-provider] marks an uncertain provider timeout and never retries", async () => {
  let providerCalls = 0;
  const { adapter } = makeAuthAdapter();
  const { provider, calls } = makePaymentProvider({
    async createPayment() {
      providerCalls += 1;
      throw new Error("ambiguous network timeout");
    }
  });
  const sdk = makeSdk({ adapter, provider });
  const { authorization, response } = await createAuthorization(sdk);
  const result = await sdk.lacag.ogolaanshoXaqiiji({
    userId,
    authorizationId: authorization.authorizationId,
    response
  });

  assert.equal(result.xaalad, "reconciliation_required");
  assert.equal(result.failure, "provider_outcome_uncertain");
  assert.equal((await sdk.lacag.ogolaanshoXaalad({
    userId,
    authorizationId: authorization.authorizationId
  })).xaalad, "reconciliation_required");
  assert.equal(providerCalls, 1);
  assert.equal(calls[0].idempotencyKey, undefined);
});

test("[mock-adapter/mock-provider] keeps a provider-declared payment failure separate from authorization", async () => {
  const { adapter } = makeAuthAdapter();
  const { provider, calls } = makePaymentProvider({
    async createPayment(request) {
      return {
        id: "provider-declined-payment",
        amount: request.amount,
        currency: request.currency,
        reference: request.reference,
        status: "fashilmay"
      };
    }
  });
  const sdk = makeSdk({ adapter, provider });
  const { authorization, response } = await createAuthorization(sdk);
  const result = await sdk.lacag.ogolaanshoXaqiiji({
    userId,
    authorizationId: authorization.authorizationId,
    response
  });

  assert.equal(result.xaalad, "processing");
  assert.equal(result.payment.xaalad, "fashilmay");
  assert.equal(calls.length, 1);
});

test("[mock-adapter/mock-provider] forwards a stable key only for declared provider-side idempotency", async () => {
  const { adapter } = makeAuthAdapter();
  const { provider, calls } = makePaymentProvider({
    capabilities: { paymentIdempotency: true }
  });
  const sdk = makeSdk({ adapter, provider });
  const { authorization, response } = await createAuthorization(sdk);

  await sdk.lacag.ogolaanshoXaqiiji({
    userId,
    authorizationId: authorization.authorizationId,
    response
  });
  assert.match(calls[0].idempotencyKey, /^[a-f0-9]{64}$/);
});

test("[mock-adapter/mock-provider] records a known payment ID for reconciliation after storage failure", async () => {
  const store = new InMemoryPaymentAuthorizationStore();
  store.recordPaymentCreation = async () => {
    throw new Error("temporary authorization database failure");
  };
  const { adapter } = makeAuthAdapter();
  const { provider, calls } = makePaymentProvider();
  const sdk = makeSdk({ adapter, provider, authorizationStore: store });
  const { authorization, response } = await createAuthorization(sdk);

  const result = await sdk.lacag.ogolaanshoXaqiiji({
    userId,
    authorizationId: authorization.authorizationId,
    response
  });
  assert.equal(result.xaalad, "reconciliation_required");
  assert.equal(result.payment.id, "provider-payment-1");
  const status = await sdk.lacag.ogolaanshoXaalad({
    userId,
    authorizationId: authorization.authorizationId
  });
  assert.equal(status.paymentId, "provider-payment-1");
  assert.equal(calls.length, 1);
});

test("[mock-adapter/mock-provider] reports storage failures without leaking store details", async () => {
  const store = new InMemoryPaymentAuthorizationStore();
  store.create = async () => {
    throw new Error("private database connection detail");
  };
  const { adapter } = makeAuthAdapter();
  const { provider, calls } = makePaymentProvider();
  const sdk = makeSdk({ adapter, provider, authorizationStore: store });

  await assert.rejects(
    sdk.lacag.ogolaanshoAbuur({
      userId,
      lacag: paymentRequest,
      hab: "waji"
    }),
    (error) =>
      error.code === "ISKUBIXI_STORAGE_ERROR" &&
      !error.message.includes("private database connection detail")
  );
  assert.equal(calls.length, 0);
});
