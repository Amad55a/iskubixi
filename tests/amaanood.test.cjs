const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign
} = require("node:crypto");
const {
  Amaanood,
  IskuBixi,
  InMemoryAmaanoodChallengeStore,
  InMemoryAmaanoodCredentialStore,
  ConfigurationError,
  StorageError,
  WebAuthnError
} = require("..");

const userId = "account-123";
const origin = "https://example.com";
const rpId = "example.com";

function sameeAmaanood(configuration = {}) {
  return new Amaanood({
    rpId,
    rpName: "IskuBixi test",
    origins: [origin],
    ...configuration
  });
}

function encodeLength(major, length) {
  if (length < 24) {
    return Buffer.from([(major << 5) | length]);
  }
  if (length <= 0xff) {
    return Buffer.from([(major << 5) | 24, length]);
  }
  if (length <= 0xffff) {
    const result = Buffer.alloc(3);
    result[0] = (major << 5) | 25;
    result.writeUInt16BE(length, 1);
    return result;
  }
  throw new Error("Fixture value is too large.");
}

function encodeCbor(value) {
  if (Number.isInteger(value)) {
    if (value >= 0) {
      return encodeLength(0, value);
    }
    return encodeLength(1, -1 - value);
  }
  if (typeof value === "string") {
    const content = Buffer.from(value, "utf8");
    return Buffer.concat([encodeLength(3, content.length), content]);
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    const content = Buffer.from(value);
    return Buffer.concat([encodeLength(2, content.length), content]);
  }
  if (value instanceof Map) {
    const entries = Array.from(value.entries());
    return Buffer.concat([
      encodeLength(5, entries.length),
      ...entries.flatMap(([key, item]) => [encodeCbor(key), encodeCbor(item)])
    ]);
  }
  throw new Error("Unsupported fixture CBOR value.");
}

function clientData(type, challenge, clientOrigin) {
  return Buffer.from(JSON.stringify({
    type,
    challenge,
    origin: clientOrigin,
    crossOrigin: false
  }));
}

function makeRegistrationResponse(options, keyPair, clientOrigin = origin, credentialId = randomBytes(24)) {
  const jwk = keyPair.publicKey.export({ format: "jwk" });
  const credentialPublicKey = encodeCbor(new Map([
    [1, 2],
    [3, -7],
    [-1, 1],
    [-2, Buffer.from(jwk.x, "base64url")],
    [-3, Buffer.from(jwk.y, "base64url")]
  ]));
  const authenticatorData = Buffer.concat([
    createHash("sha256").update(rpId).digest(),
    Buffer.from([0x45]),
    Buffer.alloc(4),
    Buffer.alloc(16),
    Buffer.from([credentialId.length >> 8, credentialId.length & 0xff]),
    credentialId,
    credentialPublicKey
  ]);
  const attestationObject = encodeCbor(new Map([
    ["fmt", "none"],
    ["attStmt", new Map()],
    ["authData", authenticatorData]
  ]));
  const clientDataJSON = clientData(
    "webauthn.create",
    options.challenge,
    clientOrigin
  );
  const id = credentialId.toString("base64url");
  return {
    id,
    rawId: id,
    type: "public-key",
    authenticatorAttachment: "platform",
    clientExtensionResults: {},
    response: {
      clientDataJSON: clientDataJSON.toString("base64url"),
      attestationObject: attestationObject.toString("base64url"),
      transports: ["internal"]
    }
  };
}

function makeAuthenticationResponse(
  options,
  credentialId,
  keyPair,
  {
    clientOrigin = origin,
    authenticatorRpId = rpId,
    signingKey = keyPair.privateKey,
    counter = 1
  } = {}
) {
  const clientDataJSON = clientData(
    "webauthn.get",
    options.challenge,
    clientOrigin
  );
  const authenticatorData = Buffer.concat([
    createHash("sha256").update(authenticatorRpId).digest(),
    Buffer.from([0x05]),
    Buffer.from([counter >>> 24, counter >>> 16, counter >>> 8, counter])
  ]);
  const signedData = Buffer.concat([
    authenticatorData,
    createHash("sha256").update(clientDataJSON).digest()
  ]);
  const signature = sign("sha256", signedData, signingKey);
  const id = credentialId;
  const accountHandle = createHash("sha256")
    .update("iskubixi:webauthn:user:")
    .update(userId)
    .digest("base64url");
  return {
    id,
    rawId: id,
    type: "public-key",
    authenticatorAttachment: "platform",
    clientExtensionResults: {},
    response: {
      clientDataJSON: clientDataJSON.toString("base64url"),
      authenticatorData: authenticatorData.toString("base64url"),
      signature: signature.toString("base64url"),
      userHandle: accountHandle
    }
  };
}

async function registerCredential(amaanood, account = userId) {
  const keyPair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const options = await amaanood.furahaAbuur({
    userId: account,
    userName: "account@example.com"
  });
  const response = makeRegistrationResponse(options, keyPair);
  const registered = await amaanood.furahaDiiwaangeli({
    userId: account,
    response
  });
  return { keyPair, credentialId: registered.credentialId };
}

test("generates distinct cryptographic challenges and requires user verification", async () => {
  const amaanood = sameeAmaanood();
  const first = await amaanood.furahaAbuur({
    userId,
    userName: "account@example.com"
  });
  const second = await amaanood.furahaAbuur({
    userId,
    userName: "account@example.com"
  });

  assert.notEqual(first.challenge, second.challenge);
  assert.equal(first.authenticatorSelection.userVerification, "required");
  assert.equal(first.attestation, "none");
});

test("rejects expired, unknown, and replayed challenges", async () => {
  const expiredStore = new InMemoryAmaanoodChallengeStore();
  const originalCreate = expiredStore.create.bind(expiredStore);
  expiredStore.create = async (challenge) =>
    originalCreate({ ...challenge, expiresAt: Date.now() - 1 });
  const expiredAmaanood = sameeAmaanood({ keydkaLoolan: expiredStore });
  const expiredOptions = await expiredAmaanood.furahaAbuur({
    userId,
    userName: "account@example.com"
  });
  const expiredKeyPair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  await assert.rejects(
    expiredAmaanood.furahaDiiwaangeli({
      userId,
      response: makeRegistrationResponse(expiredOptions, expiredKeyPair)
    }),
    (error) => error instanceof WebAuthnError && /expired/.test(error.message)
  );

  const unknownAmaanood = sameeAmaanood();
  const unknownOptions = await unknownAmaanood.furahaAbuur({
    userId,
    userName: "account@example.com"
  });
  const unknownKeyPair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const unknownResponse = makeRegistrationResponse(unknownOptions, unknownKeyPair);
  const alteredClientData = JSON.parse(
    Buffer.from(unknownResponse.response.clientDataJSON, "base64url").toString("utf8")
  );
  alteredClientData.challenge = randomBytes(32).toString("base64url");
  unknownResponse.response.clientDataJSON = Buffer.from(
    JSON.stringify(alteredClientData)
  ).toString("base64url");
  await assert.rejects(
    unknownAmaanood.furahaDiiwaangeli({
      userId,
      response: unknownResponse
    }),
    (error) => error instanceof WebAuthnError && /invalid/.test(error.message)
  );
  await unknownAmaanood.furahaDiiwaangeli({
    userId,
    response: makeRegistrationResponse(unknownOptions, unknownKeyPair)
  });

  const amaanood = sameeAmaanood();
  const { keyPair, credentialId } = await registerCredential(amaanood);
  const options = await amaanood.saxiix({ userId });
  const response = makeAuthenticationResponse(options, credentialId, keyPair);
  const concurrentAttempts = await Promise.allSettled([
    amaanood.saxiixXaqiiji({ userId, response }),
    amaanood.saxiixXaqiiji({ userId, response })
  ]);
  assert.equal(
    concurrentAttempts.filter((attempt) => attempt.status === "fulfilled").length,
    1
  );
  assert.equal(
    concurrentAttempts.filter((attempt) => attempt.status === "rejected").length,
    1
  );
  await assert.rejects(
    amaanood.saxiixXaqiiji({ userId, response }),
    (error) => error instanceof WebAuthnError && /expired/.test(error.message)
  );
});

test("rejects incorrect origins and relying-party IDs", async () => {
  const originAmaanood = sameeAmaanood();
  const registrationOptions = await originAmaanood.furahaAbuur({
    userId,
    userName: "account@example.com"
  });
  const registrationKey = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  await assert.rejects(
    originAmaanood.furahaDiiwaangeli({
      userId,
      response: makeRegistrationResponse(
        registrationOptions,
        registrationKey,
        "https://attacker.example"
      )
    }),
    WebAuthnError
  );

  const amaanood = sameeAmaanood();
  const { keyPair, credentialId } = await registerCredential(amaanood);
  const authenticationOptions = await amaanood.saxiix({ userId });
  const response = makeAuthenticationResponse(
    authenticationOptions,
    credentialId,
    keyPair,
    { authenticatorRpId: "attacker.example" }
  );
  await assert.rejects(
    amaanood.saxiixXaqiiji({ userId, response }),
    WebAuthnError
  );
});

test("rejects invalid assertion signatures without authenticating", async () => {
  const amaanood = sameeAmaanood();
  const { credentialId } = await registerCredential(amaanood);
  const options = await amaanood.saxiix({ userId });
  const wrongKey = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  await assert.rejects(
    amaanood.saxiixXaqiiji({
      userId,
      response: makeAuthenticationResponse(options, credentialId, wrongKey)
    }),
    WebAuthnError
  );
});

test("binds WebAuthn authentication challenges to payment authorization digests", async () => {
  const paymentBinding = "a".repeat(64);
  const otherBinding = "b".repeat(64);
  const amaanood = sameeAmaanood();
  const { credentialId, keyPair } = await registerCredential(amaanood);
  const options = await amaanood.saxiix({ userId, paymentBinding });
  assert.notEqual(options.challenge, paymentBinding);
  const response = makeAuthenticationResponse(options, credentialId, keyPair);

  await assert.rejects(
    amaanood.saxiixXaqiiji({
      userId,
      response,
      paymentBinding: otherBinding
    }),
    WebAuthnError
  );

  const correctlyBound = sameeAmaanood({ requireUserVerification: false });
  const registered = await registerCredential(correctlyBound);
  const boundOptions = await correctlyBound.saxiix({ userId, paymentBinding });
  assert.equal(boundOptions.userVerification, "required");
  const boundResponse = makeAuthenticationResponse(
    boundOptions,
    registered.credentialId,
    registered.keyPair
  );
  assert.deepEqual(
    await correctlyBound.saxiixXaqiiji({
      userId,
      response: boundResponse,
      paymentBinding
    }),
    {
      authenticated: true,
      userId,
      credentialId: registered.credentialId,
      userVerified: true
    }
  );
});

test("registers, binds, lists, and safely revokes credentials", async () => {
  const amaanood = sameeAmaanood();
  const { credentialId, keyPair } = await registerCredential(amaanood);
  const listed = await amaanood.furahaLiiska({ userId });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].credentialId, credentialId);
  assert.equal(Object.hasOwn(listed[0], "publicKey"), false);
  assert.equal(JSON.stringify(listed).includes("privateKey"), false);

  assert.equal(await amaanood.furahaJooji({ userId: "other-account", credentialId }), false);
  const options = await amaanood.saxiix({ userId });
  const response = makeAuthenticationResponse(options, credentialId, keyPair);
  assert.deepEqual(await amaanood.saxiixXaqiiji({ userId, response }), {
    authenticated: true,
    userId,
    credentialId,
    userVerified: true
  });
  assert.equal(await amaanood.furahaJooji({ userId, credentialId }), true);
  assert.deepEqual(await amaanood.furahaLiiska({ userId }), []);
  await assert.rejects(amaanood.saxiix({ userId }), WebAuthnError);
});

test("rejects incomplete responses and credentials owned by another account", async () => {
  const amaanood = sameeAmaanood();
  const options = await amaanood.furahaAbuur({
    userId,
    userName: "account@example.com"
  });
  await assert.rejects(
    amaanood.furahaDiiwaangeli({
      userId,
      response: { type: "public-key" }
    }),
    WebAuthnError
  );
  const keyPair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  await amaanood.furahaDiiwaangeli({
    userId,
    response: makeRegistrationResponse(options, keyPair)
  });
  const otherAccount = "other-account";
  const otherKeyPair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const otherOptions = await amaanood.furahaAbuur({
    userId: otherAccount,
    userName: "other@example.com"
  });
  const otherRegistration = await amaanood.furahaDiiwaangeli({
    userId: otherAccount,
    response: makeRegistrationResponse(otherOptions, otherKeyPair)
  });
  const authenticationOptions = await amaanood.saxiix({ userId });
  const response = makeAuthenticationResponse(
    authenticationOptions,
    otherRegistration.credentialId,
    otherKeyPair
  );
  await assert.rejects(
    amaanood.saxiixXaqiiji({ userId: "other-account", response }),
    WebAuthnError
  );
});

test("wraps challenge and credential storage failures without leaking details", async () => {
  const challengeStore = new InMemoryAmaanoodChallengeStore();
  challengeStore.create = async () => {
    throw new Error("stored secret detail");
  };
  const amaanood = sameeAmaanood({ keydkaLoolan: challengeStore });
  await assert.rejects(
    amaanood.furahaAbuur({ userId, userName: "account@example.com" }),
    (error) =>
      error instanceof StorageError &&
      !error.message.includes("stored secret detail") &&
      !JSON.stringify(error).includes("stored secret detail")
  );

  const credentialStore = new InMemoryAmaanoodCredentialStore();
  credentialStore.listByUserId = async () => {
    throw new Error("credential storage secret");
  };
  const brokenCredentials = sameeAmaanood({ keydkaFuraha: credentialStore });
  await assert.rejects(
    brokenCredentials.saxiix({ userId }),
    (error) =>
      error instanceof StorageError &&
      !error.message.includes("credential storage secret")
  );
});

test("validates relying-party configuration and storage contracts", () => {
  assert.throws(
    () => sameeAmaanood({ rpId: "other.example" }),
    ConfigurationError
  );
  assert.throws(
    () => sameeAmaanood({ origins: ["http://example.com"] }),
    ConfigurationError
  );
  assert.throws(
    () => sameeAmaanood({ rpId: "127.0.0.1" }),
    ConfigurationError
  );
  assert.throws(
    () => sameeAmaanood({ keydkaFuraha: {} }),
    ConfigurationError
  );
});

test("[mock-adapter] routes a modality session through the existing WebAuthn verifier", async () => {
  const amaanood = sameeAmaanood();
  const { keyPair, credentialId } = await registerCredential(amaanood);
  const adapter = {
    id: "mock-webauthn-device-adapter",
    supportedMethods: ["faraha"],
    async start({ userId: account }) {
      const options = await amaanood.saxiix({ userId: account });
      return {
        options,
        adapterSessionId: options.challenge,
        expiresAt: Date.now() + 60_000
      };
    },
    async verify({ userId: account, adapterSessionId, response }) {
      const clientDataJSON = JSON.parse(
        Buffer.from(response.response.clientDataJSON, "base64url").toString("utf8")
      );
      if (clientDataJSON.challenge !== adapterSessionId) {
        return { authenticated: false, userVerified: false };
      }
      const result = await amaanood.saxiixXaqiiji({
        userId: account,
        response
      });
      return {
        authenticated: result.authenticated,
        userVerified: result.userVerified,
        verifiedMethod: "faraha"
      };
    }
  };
  const sdk = new IskuBixi({
    bixiyeyaasha: { edahab: { apiKey: "test-key" } },
    amaanood: { laqabsadayaal: [adapter] }
  });

  const session = await sdk.amaanood.faraha({ userId });
  const response = makeAuthenticationResponse(
    session.options,
    credentialId,
    keyPair
  );
  const result = await sdk.amaanood.xaqiiji({
    userId,
    sessionId: session.sessionId,
    response
  });

  assert.equal(result.authenticated, true);
  assert.equal(result.userVerified, true);
  assert.equal(result.verifiedMethod, "faraha");
  assert.equal(result.methodConfirmed, true);
});
