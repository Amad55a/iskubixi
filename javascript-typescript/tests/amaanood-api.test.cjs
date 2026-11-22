const test = require("node:test");
const assert = require("node:assert/strict");
const {
  IskuBixi,
  InMemoryAmaanoodAuthenticationSessionStore,
  UnsupportedOperationError,
  WebAuthnError
} = require("..");

const userId = "account-027";
const methods = ["waji", "faraha", "isha", "calaacal"];
const validResponse = { assertion: "mock-adapter-response" };

function makeAdapter(overrides = {}) {
  const calls = { starts: [], verifications: [] };
  const adapter = {
    id: "mock-trusted-adapter",
    supportedMethods: methods,
    async start(request) {
      calls.starts.push(request);
      return {
        options: { challenge: `mock-${request.method}`, rpId: "example.com" },
        adapterSessionId: `adapter-${calls.starts.length}`,
        expiresAt: Date.now() + 60_000
      };
    },
    async verify(request) {
      calls.verifications.push(request);
      return {
        authenticated: true,
        userVerified: true,
        verifiedMethod: "user-verification"
      };
    },
    ...overrides
  };
  return { adapter, calls };
}

function makeSdk(adapter, sessionStore) {
  return new IskuBixi({
    bixiyeyaasha: { edahab: { apiKey: "test-key" } },
    amaanood: {
      laqabsadayaal: adapter ? [adapter] : [],
      ...(sessionStore ? { keydkaKulamada: sessionStore } : {})
    }
  });
}

test("[mock-adapter] exposes the four modality starters and verifier on IskuBixi.amaanood", () => {
  const sdk = makeSdk();
  for (const method of [...methods, "xaqiiji"]) {
    assert.equal(typeof sdk.amaanood[method], "function");
  }
});

test("[mock-adapter] starts each requested method only through an adapter that declares support", async () => {
  const { adapter, calls } = makeAdapter();
  const sdk = makeSdk(adapter);

  for (const method of methods) {
    const started = await sdk.amaanood[method]({ userId });
    assert.equal(started.method, method);
    assert.equal(started.options.challenge, `mock-${method}`);
    assert.match(started.sessionId, /^[A-Za-z0-9_-]{43}$/);
    assert.ok(Date.parse(started.expiresAt) > Date.now());
  }

  assert.deepEqual(calls.starts.map((call) => call.method), methods);
});

test("[mock-adapter] selects the adapter that declares support for the requested method", async () => {
  const faceCalls = [];
  const palmCalls = [];
  const faceAdapter = makeAdapter({
    id: "face-adapter",
    supportedMethods: ["waji"],
    async start(request) {
      faceCalls.push(request.method);
      return {
        options: { challenge: "face" },
        adapterSessionId: "face-session",
        expiresAt: Date.now() + 60_000
      };
    }
  }).adapter;
  const palmAdapter = makeAdapter({
    id: "palm-adapter",
    supportedMethods: ["calaacal"],
    async start(request) {
      palmCalls.push(request.method);
      return {
        options: { challenge: "palm" },
        adapterSessionId: "palm-session",
        expiresAt: Date.now() + 60_000
      };
    }
  }).adapter;
  const sdk = new IskuBixi({
    bixiyeyaasha: { edahab: { apiKey: "test-key" } },
    amaanood: { laqabsadayaal: [faceAdapter, palmAdapter] }
  });

  assert.equal((await sdk.amaanood.waji({ userId })).options.challenge, "face");
  assert.equal((await sdk.amaanood.calaacal({ userId })).options.challenge, "palm");
  assert.deepEqual(faceCalls, ["waji"]);
  assert.deepEqual(palmCalls, ["calaacal"]);
});

test("[mock-adapter] returns unsupported-operation errors when no adapter supports a method", async () => {
  const sdk = makeSdk();
  for (const method of methods) {
    await assert.rejects(
      sdk.amaanood[method]({ userId }),
      UnsupportedOperationError
    );
  }
});

test("[mock-adapter] rejects duplicate or invalid adapter method declarations", () => {
  const first = makeAdapter({ id: "first" }).adapter;
  const second = makeAdapter({ id: "second", supportedMethods: ["waji"] }).adapter;
  assert.throws(
    () => new IskuBixi({
      bixiyeyaasha: { edahab: { apiKey: "test-key" } },
      amaanood: { laqabsadayaal: [first, second] }
    }),
    /only one adapter/
  );
  assert.throws(
    () => new IskuBixi({
      bixiyeyaasha: { edahab: { apiKey: "test-key" } },
      amaanood: {
        laqabsadayaal: [{
          ...first,
          supportedMethods: ["unknown"]
        }]
      }
    }),
    /valid and may be assigned/
  );
  assert.throws(
    () => new IskuBixi({
      bixiyeyaasha: { edahab: { apiKey: "test-key" } },
      amaanood: {
        laqabsadayaal: [{
          ...first,
          supportsPaymentAuthorization: "yes"
        }]
      }
    }),
    /does not implement its contract/
  );
});

test("[mock-adapter] reports generic user verification without claiming a biometric modality", async () => {
  const { adapter, calls } = makeAdapter();
  const sdk = makeSdk(adapter);
  const started = await sdk.amaanood.waji({ userId });
  const verified = await sdk.amaanood.xaqiiji({
    userId,
    sessionId: started.sessionId,
    response: validResponse
  });

  assert.deepEqual(verified, {
    authenticated: true,
    userId,
    sessionId: started.sessionId,
    requestedMethod: "waji",
    verifiedMethod: "user-verification",
    methodConfirmed: false,
    userVerified: true
  });
  assert.equal(calls.verifications[0].method, "waji");
  assert.equal(calls.verifications[0].adapterSessionId, "adapter-1");
});

test("[mock-adapter] rejects unsuccessful or non-user-verified adapter responses", async () => {
  for (const result of [
    { authenticated: false, userVerified: true },
    { authenticated: true, userVerified: false }
  ]) {
    const { adapter } = makeAdapter({
      async verify() {
        return result;
      }
    });
    const sdk = makeSdk(adapter);
    const started = await sdk.amaanood.faraha({ userId });
    await assert.rejects(
      sdk.amaanood.xaqiiji({
        userId,
        sessionId: started.sessionId,
        response: validResponse
      }),
      WebAuthnError
    );
  }
});

test("[mock-adapter] sanitizes adapter failures and storage errors", async () => {
  const brokenAdapter = makeAdapter({
    async start() {
      throw new Error("private adapter credential");
    }
  }).adapter;
  const brokenSdk = makeSdk(brokenAdapter);
  await assert.rejects(
    brokenSdk.amaanood.waji({ userId }),
    (error) =>
      error instanceof WebAuthnError &&
      !error.message.includes("private adapter credential") &&
      !JSON.stringify(error).includes("private adapter credential")
  );

  const failingVerifier = makeAdapter({
    async verify() {
      throw new Error("private assertion detail");
    }
  }).adapter;
  const verifySdk = makeSdk(failingVerifier);
  const session = await verifySdk.amaanood.faraha({ userId });
  await assert.rejects(
    verifySdk.amaanood.xaqiiji({
      userId,
      sessionId: session.sessionId,
      response: validResponse
    }),
    (error) =>
      error instanceof WebAuthnError &&
      !error.message.includes("private assertion detail") &&
      !JSON.stringify(error).includes("private assertion detail")
  );

  const brokenStore = new InMemoryAmaanoodAuthenticationSessionStore();
  brokenStore.create = async () => {
    throw new Error("private store detail");
  };
  const { adapter } = makeAdapter();
  const storageSdk = makeSdk(adapter, brokenStore);
  await assert.rejects(
    storageSdk.amaanood.waji({ userId }),
    (error) =>
      error.code === "ISKUBIXI_STORAGE_ERROR" &&
      !error.message.includes("private store detail")
  );
});

test("[mock-adapter] rejects expired sessions and allows only one verification for a session", async () => {
  const expiredStore = new InMemoryAmaanoodAuthenticationSessionStore();
  const create = expiredStore.create.bind(expiredStore);
  expiredStore.create = async (session) =>
    create({ ...session, expiresAt: Date.now() - 1 });
  const { adapter } = makeAdapter();
  const expiredSdk = makeSdk(adapter, expiredStore);
  const expired = await expiredSdk.amaanood.isha({ userId });
  await assert.rejects(
    expiredSdk.amaanood.xaqiiji({
      userId,
      sessionId: expired.sessionId,
      response: validResponse
    }),
    WebAuthnError
  );

  let releaseVerification;
  let verificationCount = 0;
  const concurrentAdapter = makeAdapter({
    async verify() {
      verificationCount += 1;
      await new Promise((resolve) => {
        releaseVerification = resolve;
      });
      return { authenticated: true, userVerified: true };
    }
  }).adapter;
  const sdk = makeSdk(concurrentAdapter);
  const started = await sdk.amaanood.calaacal({ userId });
  const first = sdk.amaanood.xaqiiji({
    userId,
    sessionId: started.sessionId,
    response: validResponse
  });
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(
    sdk.amaanood.xaqiiji({
      userId,
      sessionId: started.sessionId,
      response: validResponse
    }),
    WebAuthnError
  );
  releaseVerification();
  await first;
  assert.equal(verificationCount, 1);
});

test("[mock-adapter] rejects wrong-user verification without consuming the rightful user's session", async () => {
  const { adapter, calls } = makeAdapter();
  const sdk = makeSdk(adapter);
  const started = await sdk.amaanood.faraha({ userId });

  await assert.rejects(
    sdk.amaanood.xaqiiji({
      userId: "another-account",
      sessionId: started.sessionId,
      response: validResponse
    }),
    WebAuthnError
  );
  const verified = await sdk.amaanood.xaqiiji({
    userId,
    sessionId: started.sessionId,
    response: validResponse
  });

  assert.equal(verified.authenticated, true);
  assert.equal(calls.verifications.length, 1);
});

test("[mock-adapter] rejects incomplete responses and prevents replay without returning response data", async () => {
  const { adapter } = makeAdapter();
  const sdk = makeSdk(adapter);
  const started = await sdk.amaanood.waji({ userId });

  await assert.rejects(
    sdk.amaanood.xaqiiji({
      userId,
      sessionId: started.sessionId,
      response: null
    }),
    WebAuthnError
  );

  const next = await sdk.amaanood.faraha({ userId });
  const response = { assertion: "mock-private-response", biometricTemplate: "not-real-test-marker" };
  const verified = await sdk.amaanood.xaqiiji({
    userId,
    sessionId: next.sessionId,
    response
  });
  assert.equal(JSON.stringify(verified).includes("mock-private-response"), false);
  assert.equal(JSON.stringify(verified).includes("biometricTemplate"), false);
  await assert.rejects(
    sdk.amaanood.xaqiiji({
      userId,
      sessionId: next.sessionId,
      response
    }),
    WebAuthnError
  );
});
