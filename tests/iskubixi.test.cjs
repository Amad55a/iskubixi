const test = require("node:test");
const assert = require("node:assert/strict");
const { inspect } = require("node:util");
const { createHmac } = require("node:crypto");
const {
  IskuBixi,
  InMemoryPaymentIdempotencyStore,
  InMemoryRefundIdempotencyStore,
  InMemoryPaymentStore,
  InMemoryPaymentTransactionStore,
  InMemoryRefundStore,
  InMemoryQrPaymentStore,
  InMemoryWebhookEventStore,
  WaafiPayPaymentProvider,
  WaafiPayPaymentProviderFactory,
  WaafiPayWebhookAdapter,
  ConfigurationError,
  IdempotencyError,
  IskuBixiError,
  PaymentError,
  ProviderError,
  RefundError,
  StorageError,
  UnsupportedOperationError,
  ValidationError,
  WebhookVerificationError
} = require("..");

test("initializes with at least one configured provider", () => {
  const iskubixi = new IskuBixi({
    bixiyeyaasha: {
      edahab: {
        apiKey: "test-key",
        merchantId: "test-merchant"
      }
    }
  });

  assert.ok(iskubixi instanceof IskuBixi);
});

test("rejects configuration with no providers", () => {
  assert.throws(
    () => new IskuBixi({ bixiyeyaasha: {} }),
    (error) =>
      error instanceof ConfigurationError &&
      error.code === "ISKUBIXI_CONFIGURATION_ERROR" &&
      /Ugu yaraan hal bixiye/.test(error.message)
  );
});

test("rejects malformed top-level and explicitly null provider configuration", () => {
  for (const configuration of [undefined, null, [], "invalid"]) {
    assert.throws(
      () => new IskuBixi(configuration),
      (error) =>
        error instanceof ConfigurationError &&
        error.code === "ISKUBIXI_CONFIGURATION_ERROR"
    );
  }

  assert.throws(
    () => new IskuBixi({
      bixiyeyaasha: {
        edahab: null,
        evc: { apiKey: "valid-test-key" }
      }
    }),
    (error) =>
      error instanceof ConfigurationError &&
      error.code === "ISKUBIXI_CONFIGURATION_ERROR"
  );
});

test("permits providers that are omitted from an otherwise valid configuration", () => {
  const sdk = new IskuBixi({
    bixiyeyaasha: {
      edahab: undefined,
      evc: { apiKey: "valid-test-key" }
    }
  });

  assert.ok(sdk instanceof IskuBixi);
});

test("rejects invalid custom adapter and storage contracts during initialization", () => {
  const validCredentials = { apiKey: "valid-test-key" };
  const invalidConfigurations = [
    { keydkaIdempotency: {} },
    { keydkaOgolaanshaha: {} },
    { keydkaCelin: {} },
    { keydkaCelinDiiwaanka: {} },
    { keydkaLacagaha: {} },
    { keydkaLacagahaBixiyaha: {} },
    { keydkaQr: {} },
    { keydkaWebhook: {} },
    { laqabsadayaasha: { edahab: { create: () => ({}) } } },
    { laqabsadayaashaWebhook: { edahab: {} } }
  ];

  for (const extraConfiguration of invalidConfigurations) {
    assert.throws(
      () => new IskuBixi({
        bixiyeyaasha: { edahab: validCredentials },
        ...extraConfiguration
      }),
      (error) =>
        error instanceof ConfigurationError &&
        error.code === "ISKUBIXI_CONFIGURATION_ERROR"
    );
  }
});

test("invalid payment input returns a validation error with a stable code", async () => {
  const sdk = sameeIskuBixi();
  await assert.rejects(
    sdk.lacag.samee(codsiLacag({ qadarka: Infinity })),
    (error) =>
      error instanceof ValidationError &&
      error.code === "ISKUBIXI_VALIDATION_ERROR"
  );
});

test("SDK errors expose stable codes and serialize only safe fields", () => {
  const cause = new Error("sensitive provider response");
  const error = new ProviderError("Provider operation failed.", {
    cause,
    context: {
      provider: "waafipay",
      operation: "create payment",
      apiKey: "must-not-serialize"
    }
  });
  const json = JSON.stringify(error);
  const decoded = JSON.parse(json);

  assert.ok(error instanceof IskuBixiError);
  assert.equal(error.code, "ISKUBIXI_PROVIDER_ERROR");
  assert.equal(error.cause, cause);
  assert.equal(decoded.code, error.code);
  assert.equal(decoded.context.provider, "waafipay");
  assert.equal(json.includes("sensitive provider response"), false);
  assert.equal(json.includes("must-not-serialize"), false);
  assert.equal(json.includes("cause"), false);
  assert.equal(json.includes("stack"), false);
});

test("rejects provider entries that are not configured", () => {
  assert.throws(
    () => new IskuBixi({ bixiyeyaasha: { edahab: undefined } }),
    /Ugu yaraan hal bixiye/
  );
});

const sameeIskuBixi = () => new IskuBixi({
  bixiyeyaasha: {
    edahab: {
      apiKey: "test-key",
      merchantId: "test-merchant"
    }
  }
});

const codsiLacag = (isbeddel = {}) => ({
  qadarka: 20,
  lacagta: "USD",
  bixiye: "edahab",
  tixraac: "DALAB-1001",
  ...isbeddel
});

const waqtiAdoo = async (bilow, fulin) => {
  const dateNow = Date.now;
  let waqtiga = bilow;
  Date.now = () => waqtiga;
  try {
    await fulin((cusub) => {
      waqtiga = cusub;
    });
  } finally {
    Date.now = dateNow;
  }
};

const sameeLaqabsadeTijaabo = (magac, markaLaSameeyo = () => {}) => ({
  create(credentials) {
    markaLaSameeyo(credentials);
    const sir = Object.values(credentials)[0];
    const lacagaha = new Map();
    let tirada = 0;

    return {
      aqoonsiTijaabo: sir,
      async createPayment(request) {
        const lacag = {
          id: `${magac}-${++tirada}`,
          amount: request.amount,
          currency: request.currency,
          reference: request.reference,
          status: "sugaya",
          aqoonsiTijaabo: sir
        };
        lacagaha.set(lacag.id, lacag);
        return lacag;
      },
      async findPayment({ paymentId }) {
        return lacagaha.get(paymentId);
      },
      async verifyPayment({ paymentId }) {
        const lacag = lacagaha.get(paymentId);
        return {
          exists: lacag !== undefined,
          payment: lacag,
          source: "adapter"
        };
      }
    }
  }
});

const sameeLaqabsadeCelin = (celin) => ({
  create() {
    const lacagaha = new Map();
    let tirada = 0;
    return {
      async createPayment(request) {
        const lacag = {
          id: `refund-payment-${++tirada}`,
          amount: request.amount,
          currency: request.currency,
          reference: request.reference,
          status: "guuleystay"
        };
        lacagaha.set(lacag.id, lacag);
        return lacag;
      },
      async findPayment({ paymentId }) {
        return lacagaha.get(paymentId);
      },
      async verifyPayment({ paymentId }) {
        const lacag = lacagaha.get(paymentId);
        return {
          exists: lacag !== undefined,
          payment: lacag,
          source: "adapter"
        };
      },
      async refundPayment(request) {
        return celin(request);
      }
    };
  }
});

const bixiyeLaQaabeeyay = {
  apiKey: "test-key",
  merchantId: "test-merchant"
};

const waafiWebhookSecret = "fake-waafipay-webhook-secret";
const sameeWebhookSdk = (isbeddel = {}) => new IskuBixi({
  bixiyeyaasha: { waafipay: waafiCredentials },
  laqabsadayaasha: {
    waafipay: sameeLaqabsadeTijaabo("waafipay")
  },
  laqabsadayaashaWebhook: {
    waafipay: new WaafiPayWebhookAdapter({
      secret: waafiWebhookSecret,
      merchantUid: waafiCredentials.merchantUid
    })
  },
  ...isbeddel
});

const codsiWebhookLacag = (isbeddel = {}) => codsiLacag({
  bixiye: "waafipay",
  lambarka: "252611111111",
  ...isbeddel
});

const sameeWaafiWebhook = (
  body,
  eventId = "waafi-event-1",
  timestamp = Math.floor(Date.now() / 1000).toString()
) => {
  const rawBody = Buffer.from(JSON.stringify(body));
  const prefix = Buffer.from(`${timestamp}.${eventId}.`, "utf8");
  const signature = createHmac("sha256", waafiWebhookSecret)
    .update(Buffer.concat([prefix, rawBody]))
    .digest("hex");
  return {
    bixiye: "waafipay",
    rawBody,
    headers: {
      "X-Webhook-Timestamp": timestamp,
      "X-Webhook-Event-Id": eventId,
      "X-Webhook-Signature-Alg": "HMAC-SHA256",
      "X-Webhook-Signature": signature
    }
  };
};

const sameeWaafiPaymentEvent = (event, status, payment = {}) => ({
  event,
  merchant_uid: waafiCredentials.merchantUid,
  payment: {
    transaction_id: "waafipay-1",
    amount: 20,
    currency: "USD",
    status,
    reference_id: "DALAB-1001",
    ...payment
  }
});

test("creates a simulated payment with the requested details", async () => {
  const lacag = await sameeIskuBixi().lacag.samee(codsiLacag());

  assert.match(lacag.id, /^sim-/);
  assert.equal(lacag.qadarka, 20);
  assert.equal(lacag.lacagta, "USD");
  assert.equal(lacag.xaalad, "sugaya");
  assert.equal(lacag.tixraac, "DALAB-1001");
});

test("validates and stores optional payment expiry timestamps", async () => {
  await waqtiAdoo(Date.parse("2030-01-01T00:00:00.000Z"), async () => {
    const iskubixi = sameeIskuBixi();
    for (const dhacayaa of [
      "not-a-date",
      "2030-01-01T00:01:00",
      "2030-02-30T00:01:00Z",
      "2029-12-31T23:59:59.999Z"
    ]) {
      await assert.rejects(
        iskubixi.lacag.samee(codsiLacag({ dhacayaa })),
        /Payment expiry/
      );
    }

    const dhacayaa = new Date(Date.now() + 60_000).toISOString();
    const lacag = await iskubixi.lacag.samee(codsiLacag({ dhacayaa }));
    assert.equal(lacag.dhacayaa, dhacayaa);
    assert.equal(lacag.xaalad, "sugaya");
    assert.equal((await iskubixi.lacag.liiska()).lacagaha[0].dhacayaa, dhacayaa);
  });
});

test("requires expiration-aware custom transaction storage for expiring payments", async () => {
  const iskubixi = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    keydkaLacagaha: {
      async save() {},
      async list() {
        return { lacagaha: [], wadarta: 0 };
      }
    }
  });

  await assert.rejects(
    iskubixi.lacag.samee(codsiLacag({
      dhacayaa: new Date(Date.now() + 60_000).toISOString()
    })),
    /PaymentExpirationTransactionStore/
  );
});

test("expires pending payments and blocks simulated success after the deadline", async () => {
  await waqtiAdoo(Date.parse("2030-01-01T00:00:00.000Z"), async (waqtigaDeji) => {
    const iskubixi = sameeIskuBixi();
    const dhacayaa = new Date(Date.now() + 1_000).toISOString();
    const lacag = await iskubixi.lacag.samee(codsiLacag({ dhacayaa }));

    waqtigaDeji(Date.parse(dhacayaa) + 1);
    await assert.rejects(
      iskubixi.lacag.tijaabiXaalad({ lacagId: lacag.id, xaalad: "guuleystay" }),
      /Expired payments cannot be changed/
    );
    assert.equal(
      (await iskubixi.lacag.xaalad({ lacagId: lacag.id })).xaalad,
      "dhacay"
    );
    const xaqiijin = await iskubixi.lacag.cadee({ lacagId: lacag.id });
    assert.equal(xaqiijin.xaalad, "dhacay");
    assert.equal(xaqiijin.dhacayaa, dhacayaa);
    assert.equal(
      (await iskubixi.lacag.liiska({ xaalad: "dhacay" })).wadarta,
      1
    );
    assert.equal(
      (await iskubixi.lacag.liiska({ xaalad: "sugaya" })).wadarta,
      0
    );
  });
});

test("does not automatically cancel a provider payment when it expires", async () => {
  await waqtiAdoo(Date.parse("2030-01-01T00:00:00.000Z"), async (waqtigaDeji) => {
    let tiradaJoojinta = 0;
    const iskubixi = new IskuBixi({
      bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
      laqabsadayaasha: {
        edahab: {
          create() {
            return {
              async createPayment(request) {
                return {
                  id: "expiry-no-cancel",
                  amount: request.amount,
                  currency: request.currency,
                  reference: request.reference,
                  status: "sugaya"
                };
              },
              async findPayment({ paymentId }) {
                return paymentId === "expiry-no-cancel"
                  ? {
                    id: paymentId,
                    amount: 20,
                    currency: "USD",
                    reference: "DALAB-1001",
                    status: "sugaya"
                  }
                  : undefined;
              },
              async verifyPayment() {
                return { exists: false, source: "adapter" };
              },
              async cancelPayment() {
                tiradaJoojinta += 1;
              }
            };
          }
        }
      }
    });
    const dhacayaa = new Date(Date.now() + 1_000).toISOString();
    const lacag = await iskubixi.lacag.samee(codsiLacag({ dhacayaa }));
    waqtigaDeji(Date.parse(dhacayaa) + 1);

    assert.equal(
      (await iskubixi.lacag.xaalad({ lacagId: lacag.id })).xaalad,
      "dhacay"
    );
    assert.equal(tiradaJoojinta, 0);
  });
});

test("registers multiple configured provider adapters", async () => {
  const iskubixi = new IskuBixi({
    bixiyeyaasha: {
      edahab: bixiyeLaQaabeeyay,
      evc: bixiyeLaQaabeeyay
    },
    laqabsadayaasha: {
      edahab: sameeLaqabsadeTijaabo("edahab"),
      evc: sameeLaqabsadeTijaabo("evc")
    }
  });

  const edahab = await iskubixi.lacag.samee(codsiLacag({ bixiye: "edahab" }));
  const evc = await iskubixi.lacag.samee(codsiLacag({ bixiye: "evc" }));

  assert.match(edahab.id, /^edahab-/);
  assert.match(evc.id, /^evc-/);
});

test("passes each provider only its own provider-specific credentials", async () => {
  const sirtaEdahab = {
    appSecret: "fake-edahab-secret",
    merchantCode: "edahab-test-merchant"
  };
  const sirtaEvc = {
    clientToken: "fake-evc-token",
    accountName: "evc-test-account"
  };
  const laHelay = {};
  const iskubixi = new IskuBixi({
    bixiyeyaasha: {
      edahab: sirtaEdahab,
      evc: sirtaEvc
    },
    laqabsadayaasha: {
      edahab: sameeLaqabsadeTijaabo("edahab", (aqoonsi) => {
        laHelay.edahab = aqoonsi;
      }),
      evc: sameeLaqabsadeTijaabo("evc", (aqoonsi) => {
        laHelay.evc = aqoonsi;
      })
    }
  });
  const lacag = await iskubixi.lacag.samee(codsiLacag({ bixiye: "edahab" }));
  const xaqiijin = await iskubixi.lacag.cadee({ lacagId: lacag.id });
  const muuqaal = inspect(iskubixi);

  assert.deepEqual(laHelay.edahab, sirtaEdahab);
  assert.deepEqual(laHelay.evc, sirtaEvc);
  assert.notStrictEqual(laHelay.edahab, laHelay.evc);
  assert.equal(JSON.stringify(lacag).includes("fake-edahab-secret"), false);
  assert.equal(JSON.stringify(xaqiijin).includes("fake-edahab-secret"), false);
  assert.equal(muuqaal.includes("fake-edahab-secret"), false);
  assert.equal(muuqaal.includes("fake-evc-token"), false);
  assert.equal(
    Object.prototype.hasOwnProperty.call(iskubixi, "paymentProviders"),
    false
  );
});

test("selects the explicitly requested provider adapter for each payment", async () => {
  const iskubixi = new IskuBixi({
    bixiyeyaasha: {
      edahab: bixiyeLaQaabeeyay,
      evc: bixiyeLaQaabeeyay
    },
    laqabsadayaasha: {
      edahab: sameeLaqabsadeTijaabo("edahab"),
      evc: sameeLaqabsadeTijaabo("evc")
    }
  });

  const lacagtaEdahab = await iskubixi.lacag.samee(codsiLacag({ bixiye: "edahab" }));
  const lacagtaEvc = await iskubixi.lacag.samee(codsiLacag({ bixiye: "evc" }));

  assert.match(lacagtaEdahab.id, /^edahab-/);
  assert.match(lacagtaEvc.id, /^evc-/);
  assert.notEqual(lacagtaEdahab.id, lacagtaEvc.id);
});

test("routes status lookup and verification to the adapter that created the payment", async () => {
  const iskubixi = new IskuBixi({
    bixiyeyaasha: {
      edahab: bixiyeLaQaabeeyay,
      evc: bixiyeLaQaabeeyay
    },
    laqabsadayaasha: {
      edahab: sameeLaqabsadeTijaabo("edahab"),
      evc: sameeLaqabsadeTijaabo("evc")
    }
  });
  const lacag = await iskubixi.lacag.samee(codsiLacag({ bixiye: "evc" }));
  const xaalad = await iskubixi.lacag.xaalad({ lacagId: lacag.id });
  const xaqiijin = await iskubixi.lacag.cadee({ lacagId: lacag.id });

  assert.equal(xaalad.id, lacag.id);
  assert.equal(xaqiijin.id, lacag.id);
  assert.equal(xaqiijin.xaqiijin, "adapter");
  await assert.rejects(
    iskubixi.lacag.tijaabiXaalad({ lacagId: lacag.id, xaalad: "guuleystay" }),
    /only available for simulated payments/
  );
});

test("generates a unique ID for each simulated payment", async () => {
  const iskubixi = sameeIskuBixi();
  const koowaad = await iskubixi.lacag.samee(codsiLacag());
  const labaad = await iskubixi.lacag.samee(codsiLacag());

  assert.notEqual(koowaad.id, labaad.id);
});

test("retrieves a created payment status from the same instance", async () => {
  const iskubixi = sameeIskuBixi();
  const lacag = await iskubixi.lacag.samee(codsiLacag());
  const xaalad = await iskubixi.lacag.xaalad({ lacagId: lacag.id });

  assert.deepEqual(xaalad, lacag);
  assert.equal(xaalad.xaalad, "sugaya");
});

test("transitions a pending payment to success and returns its latest status", async () => {
  const iskubixi = sameeIskuBixi();
  const lacag = await iskubixi.lacag.samee(codsiLacag());
  assert.equal(lacag.xaalad, "sugaya");

  const laCusboonaysiiyay = await iskubixi.lacag.tijaabiXaalad({
    lacagId: lacag.id,
    xaalad: "guuleystay"
  });
  const xaalad = await iskubixi.lacag.xaalad({ lacagId: lacag.id });
  const xaqiijin = await iskubixi.lacag.cadee({ lacagId: lacag.id });

  assert.equal(laCusboonaysiiyay.xaalad, "guuleystay");
  assert.equal(xaalad.xaalad, "guuleystay");
  assert.equal(xaqiijin.waaJiraa, true);
  assert.equal(xaqiijin.xaqiijin, "simulated");
  assert.equal(xaqiijin.xaalad, "guuleystay");
  assert.equal(xaqiijin.id, lacag.id);
  assert.equal(xaqiijin.tixraac, lacag.tixraac);
});

test("transitions a pending payment to failure", async () => {
  const iskubixi = sameeIskuBixi();
  const lacag = await iskubixi.lacag.samee(codsiLacag());
  const laCusboonaysiiyay = await iskubixi.lacag.tijaabiXaalad({
    lacagId: lacag.id,
    xaalad: "fashilmay"
  });
  const xaalad = await iskubixi.lacag.xaalad({ lacagId: lacag.id });

  assert.equal(laCusboonaysiiyay.xaalad, "fashilmay");
  assert.equal(xaalad.xaalad, "fashilmay");
});

test("rejects unknown payment IDs when simulating a status", async () => {
  const iskubixi = sameeIskuBixi();

  await assert.rejects(
    iskubixi.lacag.tijaabiXaalad({
      lacagId: "sim-not-found",
      xaalad: "guuleystay"
    }),
    /was not found/
  );
});

test("rejects empty or missing IDs and invalid simulated target statuses", async () => {
  const iskubixi = sameeIskuBixi();
  const lacag = await iskubixi.lacag.samee(codsiLacag());

  for (const lacagId of ["", undefined]) {
    await assert.rejects(
      iskubixi.lacag.tijaabiXaalad({ lacagId, xaalad: "guuleystay" }),
      /lacagId/
    );
  }

  for (const xaalad of ["sugaya", "simulated", "unknown"]) {
    await assert.rejects(
      iskubixi.lacag.tijaabiXaalad({ lacagId: lacag.id, xaalad }),
      /Target status/
    );
  }

  const xaalad = await iskubixi.lacag.xaalad({ lacagId: lacag.id });
  assert.equal(xaalad.xaalad, "sugaya");
});

test("does not allow a successful payment to transition to failed", async () => {
  const iskubixi = sameeIskuBixi();
  const lacag = await iskubixi.lacag.samee(codsiLacag());
  await iskubixi.lacag.tijaabiXaalad({ lacagId: lacag.id, xaalad: "guuleystay" });

  await assert.rejects(
    iskubixi.lacag.tijaabiXaalad({ lacagId: lacag.id, xaalad: "fashilmay" }),
    (error) =>
      error instanceof PaymentError &&
      error.code === "ISKUBIXI_PAYMENT_ERROR" &&
      /terminal status/.test(error.message)
  );
  assert.equal((await iskubixi.lacag.xaalad({ lacagId: lacag.id })).xaalad, "guuleystay");
});

test("does not allow a failed payment to transition to successful", async () => {
  const iskubixi = sameeIskuBixi();
  const lacag = await iskubixi.lacag.samee(codsiLacag());
  await iskubixi.lacag.tijaabiXaalad({ lacagId: lacag.id, xaalad: "fashilmay" });

  await assert.rejects(
    iskubixi.lacag.tijaabiXaalad({ lacagId: lacag.id, xaalad: "guuleystay" }),
    /terminal status/
  );
  assert.equal((await iskubixi.lacag.xaalad({ lacagId: lacag.id })).xaalad, "fashilmay");
});

test("successfully refunds a confirmed simulated payment and updates its status", async () => {
  const iskubixi = sameeIskuBixi();
  const lacag = await iskubixi.lacag.samee(codsiLacag());
  await iskubixi.lacag.tijaabiXaalad({
    lacagId: lacag.id,
    xaalad: "guuleystay"
  });

  const celin = await iskubixi.lacag.celi({
    lacagId: lacag.id,
    furahaIdempotency: "simulated-refund-001"
  });
  const xaalad = await iskubixi.lacag.xaalad({ lacagId: lacag.id });
  const liiska = await iskubixi.lacag.liiska({ xaalad: "laCeliyay" });
  const xaaladdaCelin = await iskubixi.lacag.celintaXaalad({
    celinId: celin.id
  });

  assert.match(celin.id, /^celin-/);
  assert.equal(celin.lacagId, lacag.id);
  assert.equal(celin.xaalad, "guuleystay");
  assert.deepEqual(xaaladdaCelin, celin);
  assert.equal(xaalad.xaalad, "laCeliyay");
  assert.deepEqual(xaalad.celin, celin);
  assert.equal(liiska.wadarta, 1);
  assert.deepEqual(liiska.lacagaha[0].celin, celin);
  await assert.rejects(
    iskubixi.lacag.celi({
      lacagId: lacag.id,
      furahaIdempotency: "simulated-refund-002"
    }),
    /already been refunded/
  );
});

test("requires a refund idempotency key and rejects partial refund fields", async () => {
  const iskubixi = sameeIskuBixi();
  const lacag = await iskubixi.lacag.samee(codsiLacag());
  await iskubixi.lacag.tijaabiXaalad({
    lacagId: lacag.id,
    xaalad: "guuleystay"
  });

  await assert.rejects(
    iskubixi.lacag.celi({ lacagId: lacag.id }),
    /idempotency key/
  );
  await assert.rejects(
    iskubixi.lacag.celi({
      lacagId: lacag.id,
      furahaIdempotency: "partial-refund",
      qadarka: 5
    }),
    /Only full refunds/
  );
  assert.equal((await iskubixi.lacag.xaalad({ lacagId: lacag.id })).xaalad, "guuleystay");
});

test("rejects refunds for pending, failed, and expired payments", async () => {
  const iskubixi = sameeIskuBixi();
  const sugaya = await iskubixi.lacag.samee(codsiLacag());
  await assert.rejects(
    iskubixi.lacag.celi({
      lacagId: sugaya.id,
      furahaIdempotency: "refund-pending"
    }),
    (error) =>
      error instanceof RefundError &&
      error.code === "ISKUBIXI_REFUND_ERROR" &&
      /Only verified successful payments/.test(error.message)
  );
  await iskubixi.lacag.tijaabiXaalad({
    lacagId: sugaya.id,
    xaalad: "guuleystay"
  });
  assert.equal(
    (await iskubixi.lacag.celi({
      lacagId: sugaya.id,
      furahaIdempotency: "refund-pending"
    })).xaalad,
    "guuleystay"
  );

  const fashilmay = await iskubixi.lacag.samee(codsiLacag({ tixraac: "FAILED-REFUND" }));
  await iskubixi.lacag.tijaabiXaalad({
    lacagId: fashilmay.id,
    xaalad: "fashilmay"
  });
  await assert.rejects(
    iskubixi.lacag.celi({
      lacagId: fashilmay.id,
      furahaIdempotency: "refund-failed"
    }),
    /Only verified successful payments/
  );

  await waqtiAdoo(Date.parse("2030-01-01T00:00:00.000Z"), async (waqtigaDeji) => {
    const sdk = sameeIskuBixi();
    const dhacayaa = new Date(Date.now() + 1_000).toISOString();
    const dhacay = await sdk.lacag.samee(codsiLacag({
      tixraac: "EXPIRED-REFUND",
      dhacayaa
    }));
    waqtigaDeji(Date.parse(dhacayaa) + 1);
    await assert.rejects(
      sdk.lacag.celi({
        lacagId: dhacay.id,
        furahaIdempotency: "refund-expired"
      }),
      /Only verified successful payments/
    );
    assert.equal(
      (await sdk.lacag.xaalad({ lacagId: dhacay.id })).xaalad,
      "dhacay"
    );
  });
});

test("returns the original refund for an identical idempotent retry", async () => {
  let tiradaCelin = 0;
  const iskubixi = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    laqabsadayaasha: {
      edahab: sameeLaqabsadeCelin(async () => {
        tiradaCelin += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { id: "provider-refund-1", status: "guuleystay" };
      })
    }
  });
  const lacag = await iskubixi.lacag.samee(codsiLacag());
  const codsi = {
    lacagId: lacag.id,
    furahaIdempotency: "refund-retry-001"
  };
  const [koowaad, labaad] = await Promise.all([
    iskubixi.lacag.celi(codsi),
    iskubixi.lacag.celi({ ...codsi })
  ]);

  assert.deepEqual(labaad, koowaad);
  assert.equal(tiradaCelin, 1);
});

test("rejects refund idempotency keys reused for another payment", async () => {
  const iskubixi = sameeIskuBixi();
  const koowaad = await iskubixi.lacag.samee(codsiLacag());
  const labaad = await iskubixi.lacag.samee(codsiLacag({ tixraac: "DALAB-1002" }));
  await iskubixi.lacag.tijaabiXaalad({
    lacagId: koowaad.id,
    xaalad: "guuleystay"
  });
  await iskubixi.lacag.tijaabiXaalad({
    lacagId: labaad.id,
    xaalad: "guuleystay"
  });
  await iskubixi.lacag.celi({
    lacagId: koowaad.id,
    furahaIdempotency: "refund-shared-key"
  });

  await assert.rejects(
    iskubixi.lacag.celi({
      lacagId: labaad.id,
      furahaIdempotency: "refund-shared-key"
    }),
    /different details/
  );
});

test("rejects refund requests when an adapter does not support refunds", async () => {
  const iskubixi = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    laqabsadayaasha: { edahab: sameeLaqabsadeTijaabo("no-refund") }
  });
  const lacag = await iskubixi.lacag.samee(codsiLacag());

  await assert.rejects(
    iskubixi.lacag.celi({
      lacagId: lacag.id,
      furahaIdempotency: "unsupported-refund"
    }),
    /does not support refunds/
  );
});

test("sanitizes refund adapter errors and does not retry the provider call", async () => {
  const secret = "refund-provider-secret";
  let tiradaCelin = 0;
  const iskubixi = new IskuBixi({
    bixiyeyaasha: { edahab: { apiKey: secret } },
    laqabsadayaasha: {
      edahab: sameeLaqabsadeCelin(async () => {
        tiradaCelin += 1;
        throw new Error(secret);
      })
    }
  });
  const lacag = await iskubixi.lacag.samee(codsiLacag());
  const codsi = {
    lacagId: lacag.id,
    furahaIdempotency: "refund-error-001"
  };
  for (let iskuDay = 0; iskuDay < 2; iskuDay += 1) {
    await assert.rejects(
      iskubixi.lacag.celi(codsi),
      (error) =>
        error.message.includes("failed to refund payment") &&
        !error.message.includes(secret)
    );
  }
  assert.equal(tiradaCelin, 1);
});

test("refund results and transaction records omit provider credentials", async () => {
  const secret = "refund-result-secret";
  const iskubixi = new IskuBixi({
    bixiyeyaasha: { edahab: { apiKey: secret } },
    laqabsadayaasha: {
      edahab: sameeLaqabsadeCelin(async () => ({
        id: "provider-refund-safe-id",
        status: "guuleystay",
        apiKey: secret
      }))
    }
  });
  const lacag = await iskubixi.lacag.samee(codsiLacag());
  const celin = await iskubixi.lacag.celi({
    lacagId: lacag.id,
    furahaIdempotency: "refund-result-redaction"
  });
  const xaalad = await iskubixi.lacag.xaalad({ lacagId: lacag.id });
  const liiska = await iskubixi.lacag.liiska();

  assert.equal(
    JSON.stringify({ celin, xaalad, liiska }).includes(secret),
    false
  );
});

test("does not mark a pending provider refund as completed", async () => {
  const iskubixi = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    laqabsadayaasha: {
      edahab: sameeLaqabsadeCelin(async () => ({
        id: "provider-refund-pending",
        status: "sugaya"
      }))
    }
  });
  const lacag = await iskubixi.lacag.samee(codsiLacag());
  const celin = await iskubixi.lacag.celi({
    lacagId: lacag.id,
    furahaIdempotency: "refund-pending-001"
  });
  const xaalad = await iskubixi.lacag.xaalad({ lacagId: lacag.id });

  assert.equal(celin.xaalad, "sugaya");
  assert.equal(xaalad.xaalad, "guuleystay");
  assert.deepEqual(xaalad.celin, celin);
  await assert.rejects(
    iskubixi.lacag.celi({
      lacagId: lacag.id,
      furahaIdempotency: "refund-pending-002"
    }),
    /already pending/
  );
});

test("keeps a failed refund distinct from payment success and permits a new retry key", async () => {
  let tiradaCelin = 0;
  const iskubixi = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    laqabsadayaasha: {
      edahab: sameeLaqabsadeCelin(async () => {
        tiradaCelin += 1;
        return tiradaCelin === 1
          ? { id: "provider-refund-failed", status: "fashilmay" }
          : { id: "provider-refund-retry", status: "guuleystay" };
      })
    }
  });
  const lacag = await iskubixi.lacag.samee(codsiLacag());
  const fashil = await iskubixi.lacag.celi({
    lacagId: lacag.id,
    furahaIdempotency: "refund-failed-result"
  });

  assert.equal(fashil.xaalad, "fashilmay");
  assert.equal((await iskubixi.lacag.xaalad({ lacagId: lacag.id })).xaalad, "guuleystay");

  const dibLooTijaabiyay = await iskubixi.lacag.celi({
    lacagId: lacag.id,
    furahaIdempotency: "refund-retry-after-failure"
  });
  assert.equal(dibLooTijaabiyay.xaalad, "guuleystay");
  assert.equal((await iskubixi.lacag.xaalad({ lacagId: lacag.id })).xaalad, "laCeliyay");
  assert.equal(tiradaCelin, 2);
});

test("tracks pending refund status separately and updates it through provider lookup", async () => {
  let providerStatus = "sugaya";
  const refundId = "provider-refund-status-1";
  const factory = sameeLaqabsadeCelin(async () => ({
    id: refundId,
    status: "sugaya"
  }));
  const iskubixi = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    laqabsadayaasha: {
      edahab: {
        create(credentials) {
          const provider = factory.create(credentials);
          provider.findRefundStatus = async ({ refundId: requestedId }) =>
            requestedId === refundId
              ? { id: refundId, status: providerStatus }
              : undefined;
          return provider;
        }
      }
    }
  });
  const lacag = await iskubixi.lacag.samee(codsiLacag());
  const celin = await iskubixi.lacag.celi({
    lacagId: lacag.id,
    furahaIdempotency: "refund-status-pending"
  });
  assert.equal(celin.xaalad, "sugaya");
  assert.equal((await iskubixi.lacag.xaalad({ lacagId: lacag.id })).xaalad, "guuleystay");

  providerStatus = "guuleystay";
  const xaalad = await iskubixi.lacag.celintaXaalad({ celinId: celin.id });
  assert.equal(xaalad.xaalad, "guuleystay");
  assert.equal((await iskubixi.lacag.xaalad({ lacagId: lacag.id })).xaalad, "laCeliyay");
  assert.equal((await iskubixi.lacag.liiska()).lacagaha[0].celin.xaalad, "guuleystay");
});

test("tracks provider-reported failed refund status without changing payment status", async () => {
  let providerStatus = "sugaya";
  const refundId = "provider-refund-status-failed";
  const factory = sameeLaqabsadeCelin(async () => ({
    id: refundId,
    status: "sugaya"
  }));
  const iskubixi = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    laqabsadayaasha: {
      edahab: {
        create(credentials) {
          const provider = factory.create(credentials);
          provider.findRefundStatus = async () => ({
            id: refundId,
            status: providerStatus
          });
          return provider;
        }
      }
    }
  });
  const lacag = await iskubixi.lacag.samee(codsiLacag());
  const celin = await iskubixi.lacag.celi({
    lacagId: lacag.id,
    furahaIdempotency: "refund-status-failed"
  });

  providerStatus = "fashilmay";
  assert.equal(
    (await iskubixi.lacag.celintaXaalad({ celinId: celin.id })).xaalad,
    "fashilmay"
  );
  assert.equal((await iskubixi.lacag.xaalad({ lacagId: lacag.id })).xaalad, "guuleystay");
});

test("rejects unknown refund IDs and unsupported provider status lookups", async () => {
  const iskubixi = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    laqabsadayaasha: {
      edahab: sameeLaqabsadeCelin(async () => ({
        id: "refund-status-unsupported",
        status: "sugaya"
      }))
    }
  });
  const lacag = await iskubixi.lacag.samee(codsiLacag());
  const celin = await iskubixi.lacag.celi({
    lacagId: lacag.id,
    furahaIdempotency: "refund-status-unsupported"
  });

  await assert.rejects(
    iskubixi.lacag.celintaXaalad({ celinId: "unknown-refund" }),
    /was not found/
  );
  await assert.rejects(
    iskubixi.lacag.celintaXaalad({ celinId: celin.id }),
    /does not support refund status lookup/
  );
});

test("supports replaceable refund-record storage", async () => {
  const innerStore = new InMemoryRefundStore();
  let writes = 0;
  const keydkaCelinDiiwaanka = {
    async save(...args) {
      writes += 1;
      return innerStore.save(...args);
    },
    findById: (...args) => innerStore.findById(...args),
    findByProviderRefundId: (...args) => innerStore.findByProviderRefundId(...args),
    findByPaymentId: (...args) => innerStore.findByPaymentId(...args),
    applyWebhookStatus: (...args) => innerStore.applyWebhookStatus(...args)
  };
  const iskubixi = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    keydkaCelinDiiwaanka,
    laqabsadayaasha: {
      edahab: {
        create(credentials) {
          const provider = sameeLaqabsadeCelin(async () => ({
            id: "refund-custom-store",
            status: "sugaya"
          })).create(credentials);
          provider.findRefundStatus = async () => ({
            id: "refund-custom-store",
            status: "guuleystay"
          });
          return provider;
        }
      }
    }
  });
  const lacag = await iskubixi.lacag.samee(codsiLacag());
  const celin = await iskubixi.lacag.celi({
    lacagId: lacag.id,
    furahaIdempotency: "refund-custom-store"
  });

  assert.equal(writes, 1);
  assert.equal(
    (await iskubixi.lacag.celintaXaalad({ celinId: celin.id })).xaalad,
    "guuleystay"
  );
  assert.equal(writes, 2);
  assert.equal((await innerStore.findById(celin.id)).xaalad, "guuleystay");
});

test("serializes concurrent refund status transitions", async () => {
  const store = new InMemoryRefundStore();
  await store.save({
    id: "concurrent-refund",
    providerRefundId: "concurrent-refund",
    lacagId: "payment-1",
    bixiye: "edahab",
    xaalad: "sugaya",
    laAbuuray: new Date().toISOString(),
    laCusboonaysiiyay: new Date().toISOString()
  });

  const results = await Promise.all([
    store.applyWebhookStatus("edahab", "concurrent-refund", "guuleystay"),
    store.applyWebhookStatus("edahab", "concurrent-refund", "fashilmay")
  ]);
  assert.deepEqual(results.sort(), ["invalid-transition", "updated"]);
  const refund = await store.findById("concurrent-refund");
  assert.ok(refund.xaalad === "guuleystay" || refund.xaalad === "fashilmay");
  assert.equal(
    await store.applyWebhookStatus("edahab", "concurrent-refund", "sugaya"),
    "invalid-transition"
  );
});

test("simulated provider supports pending refund completion", async () => {
  const { SimulatedPaymentProvider } =
    require("../dist/providers/simulated-payment-provider");
  const { InMemoryPaymentStore } =
    require("../dist/providers/in-memory-payment-store");
  const paymentStore = new InMemoryPaymentStore();
  paymentStore.save({
    id: "simulated-refund-payment",
    amount: 20,
    currency: "USD",
    reference: "SIM-REFUND",
    status: "guuleystay"
  });
  const provider = new SimulatedPaymentProvider(paymentStore, "sugaya");
  const refund = await provider.refundPayment({
    paymentId: "simulated-refund-payment",
    idempotencyKey: "simulated-status-test"
  });

  assert.equal(refund.status, "sugaya");
  assert.equal(
    (await provider.findRefundStatus({
      paymentId: "simulated-refund-payment",
      refundId: refund.id
    })).status,
    "sugaya"
  );
  await provider.simulateRefundStatus(refund.id, "guuleystay");
  assert.equal(
    (await provider.findRefundStatus({
      paymentId: "simulated-refund-payment",
      refundId: refund.id
    })).status,
    "guuleystay"
  );
  assert.equal(paymentStore.findById("simulated-refund-payment").status, "laCeliyay");
});

test("rejects unknown payment IDs for lookup and verification", async () => {
  const iskubixi = sameeIskuBixi();

  await assert.rejects(
    iskubixi.lacag.xaalad({ lacagId: "sim-not-found" }),
    /was not found/
  );
  await assert.rejects(
    iskubixi.lacag.cadee({ lacagId: "sim-not-found" }),
    /was not found/
  );
});

test("rejects missing or empty payment IDs", async () => {
  const iskubixi = sameeIskuBixi();

  for (const codsi of [{ lacagId: "" }, { lacagId: undefined }, {}]) {
    await assert.rejects(
      iskubixi.lacag.xaalad(codsi),
      /lacagId/
    );
    await assert.rejects(
      iskubixi.lacag.cadee(codsi),
      /lacagId/
    );
  }

  await assert.rejects(
    iskubixi.lacag.xaalad(null),
    /lookup request/
  );
});

test("rejects invalid payment amounts", async () => {
  const iskubixi = sameeIskuBixi();

  for (const qadarka of [0, -1, NaN, Infinity, -Infinity]) {
    await assert.rejects(
      iskubixi.lacag.samee(codsiLacag({ qadarka })),
      /finite number greater than zero/
    );
  }
});

test("rejects invalid currency and provider selections", async () => {
  const iskubixi = sameeIskuBixi();

  await assert.rejects(
    iskubixi.lacag.samee(codsiLacag({ lacagta: "" })),
    /Currency/
  );
  await assert.rejects(
    iskubixi.lacag.samee(codsiLacag({ lacagta: undefined })),
    /Currency/
  );
  await assert.rejects(
    iskubixi.lacag.samee(codsiLacag({ lacagta: "usd" })),
    /Currency/
  );
  await assert.rejects(
    iskubixi.lacag.samee(codsiLacag({ bixiye: undefined })),
    /Provider selection/
  );
  await assert.rejects(
    iskubixi.lacag.samee(codsiLacag({ bixiye: "unsupported" })),
    /Provider selection/
  );
  await assert.rejects(
    iskubixi.lacag.samee(codsiLacag({ bixiye: "evc" })),
    /not configured/
  );
});

test("rejects missing and invalid provider configuration", () => {
  assert.throws(
    () => new IskuBixi({}),
    /Ugu yaraan hal bixiye/
  );
  assert.throws(
    () => new IskuBixi({
      bixiyeyaasha: {
        edahab: { apiKey: "", merchantId: "test-merchant" }
      }
    }),
    /waa khalad/
  );
  assert.throws(
    () => new IskuBixi({
      bixiyeyaasha: {
        unknown: { apiKey: "test-key", merchantId: "test-merchant" }
      }
    }),
    /lama taageero/
  );
});

test("rejects missing, empty, whitespace-only, and non-string credentials", () => {
  const sir = "fake-secret-that-must-not-appear";
  const invalidCredentials = [
    {},
    { token: sir, merchantId: "" },
    { token: "   " },
    { token: 123 }
  ];

  for (const credentials of invalidCredentials) {
    assert.throws(
      () => new IskuBixi({ bixiyeyaasha: { edahab: credentials } }),
      (error) => !error.message.includes(sir)
    );
  }
});

test("does not expose credentials in provider adapter error messages", async () => {
  const sir = "fake-adapter-secret";
  assert.throws(
    () => new IskuBixi({
      bixiyeyaasha: { edahab: { token: sir } },
      laqabsadayaasha: {
        edahab: {
          create(credentials) {
            throw new Error(`Could not configure using ${credentials.token}`);
          }
        }
      }
    }),
    (error) =>
      error.message.includes("could not be initialized") &&
      !error.message.includes(sir)
  );

  const iskubixi = new IskuBixi({
    bixiyeyaasha: { edahab: { token: sir } },
    laqabsadayaasha: {
      edahab: {
        create(credentials) {
          return {
            async createPayment() {
              throw new Error(`Failed with ${credentials.token}`);
            },
            async findPayment() {
              return undefined;
            },
            async verifyPayment() {
              return { exists: false, source: "adapter" };
            }
          };
        }
      }
    }
  });

  await assert.rejects(
    iskubixi.lacag.samee(codsiLacag()),
    (error) =>
      error instanceof ProviderError &&
      error.code === "ISKUBIXI_PROVIDER_ERROR" &&
      error.message.includes("failed to create payment") &&
      !error.message.includes(sir)
  );
});

test("rejects provider payment details that do not match the request", async () => {
  const secret = "provider-response-secret";
  const sdk = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    laqabsadayaasha: {
      edahab: {
        create() {
          return {
            async createPayment(request) {
              return {
                id: "mismatched-provider-payment",
                amount: request.amount + 1,
                currency: request.currency,
                reference: request.reference,
                status: "guuleystay",
                apiKey: secret
              };
            },
            async findPayment() {
              return undefined;
            },
            async verifyPayment() {
              return { exists: false, source: "adapter" };
            }
          };
        }
      }
    }
  });

  await assert.rejects(
    sdk.lacag.samee(codsiLacag()),
    (error) =>
      error instanceof ProviderError &&
      error.code === "ISKUBIXI_PROVIDER_ERROR" &&
      error.message.includes("do not match the request") &&
      !JSON.stringify(error).includes(secret)
  );
  assert.equal((await sdk.lacag.liiska()).wadarta, 0);
});

const waafiCredentials = {
  merchantUid: "merchant123",
  apiUserId: "user123",
  apiKey: "12345678901234567890"
};
const waafiTimestamp = "12345678901234567890";
const waafiRequest = (isbeddel = {}) => ({
  amount: 20,
  currency: "USD",
  reference: "DALAB-1001",
  accountNumber: "252611111111",
  ...isbeddel
});

test("validates WaafiPay credential fields and documented lengths", () => {
  for (const credentials of [
    {},
    { ...waafiCredentials, merchantUid: "short" },
    { ...waafiCredentials, apiUserId: "       " },
    { ...waafiCredentials, apiKey: "too-short" }
  ]) {
    assert.throws(
      () => new WaafiPayPaymentProvider(credentials, {
        formatTimestamp: () => waafiTimestamp
      }),
      (error) =>
        error.message.includes("credentials are missing or invalid") &&
        !error.message.includes(JSON.stringify(credentials))
    );
  }
});

test("rejects invalid WaafiPay timeout configuration", () => {
  for (const timeoutMs of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => new WaafiPayPaymentProvider(waafiCredentials, {
        formatTimestamp: () => waafiTimestamp,
        timeoutMs
      }),
      (error) =>
        error instanceof ConfigurationError &&
        /timeout must be a positive integer/.test(error.message)
    );
  }
});

test("builds a sandbox purchase request with documented fields and omits secrets from results", async () => {
  let url;
  let payload;
  const provider = new WaafiPayPaymentProvider(waafiCredentials, {
    formatTimestamp: () => waafiTimestamp,
    fetch: async (target, options) => {
      url = target;
      payload = JSON.parse(options.body);
      return {
        ok: true,
        async json() {
          return {
            params: {
              transactionId: "waafi-transaction-1",
              state: "APPROVED"
            }
          };
        }
      };
    }
  });

  const payment = await provider.createPayment(waafiRequest());

  assert.equal(url, "https://sandbox.waafipay.com/asm");
  assert.equal(payload.schemaVersion, "1.0");
  assert.match(payload.requestId, /^[0-9a-f-]{36}$/i);
  assert.equal(payload.timestamp, waafiTimestamp);
  assert.equal(payload.channelName, "WEB");
  assert.equal(payload.serviceName, "API_PURCHASE");
  assert.equal(payload.serviceParams.paymentMethod, "MWALLET_ACCOUNT");
  assert.equal(payload.serviceParams.payerInfo.accountNo, "252611111111");
  assert.deepEqual(payload.serviceParams.transactionInfo, {
    referenceId: "DALAB-1001",
    invoiceId: "DALAB-1001",
    amount: "20",
    currency: "USD"
  });
  assert.equal(payload.serviceParams.apiKey, waafiCredentials.apiKey);
  assert.equal(payment.id, "waafi-transaction-1");
  assert.equal(payment.status, "guuleystay");
  assert.equal(JSON.stringify(payment).includes(waafiCredentials.apiKey), false);
});

test("accepts EVC Plus, ZAAD, and SAHAL wallet numbers in the documented purchase mapping", async () => {
  const numbers = ["252611111111", "252631111111", "252901111111"];

  for (const accountNumber of numbers) {
    let payload;
    const provider = new WaafiPayPaymentProvider(waafiCredentials, {
      formatTimestamp: () => waafiTimestamp,
      fetch: async (_url, options) => {
        payload = JSON.parse(options.body);
        return {
          ok: true,
          async json() {
            return { params: { transactionId: "waafi-id", state: "PENDING" } };
          }
        };
      }
    });

    const payment = await provider.createPayment(waafiRequest({ accountNumber }));

    assert.equal(payload.serviceParams.payerInfo.accountNo, accountNumber);
    assert.equal(payment.status, "sugaya");
  }
});

test("maps documented final states and leaves unknown states pending", async () => {
  for (const [state, expected] of [
    ["DECLINED", "fashilmay"],
    ["FAILED", "fashilmay"],
    ["CANCELLED", "joojiyay"],
    ["UNRECOGNIZED", "sugaya"]
  ]) {
    const provider = new WaafiPayPaymentProvider(waafiCredentials, {
      formatTimestamp: () => waafiTimestamp,
      fetch: async () => ({
        ok: true,
        async json() {
          return { params: { transactionId: "waafi-id", state } };
        }
      })
    });

    assert.equal((await provider.createPayment(waafiRequest())).status, expected);
  }
});

test("does not treat a processed request code alone as payment success", async () => {
  const provider = new WaafiPayPaymentProvider(waafiCredentials, {
    formatTimestamp: () => waafiTimestamp,
    fetch: async () => ({
      ok: true,
      async json() {
        return {
          responseCode: "2001",
          params: { transactionId: "waafi-id" }
        };
      }
    })
  });

  assert.equal((await provider.createPayment(waafiRequest())).status, "sugaya");
});

test("rejects invalid WaafiPay request fields before sending a request", async () => {
  let requestCount = 0;
  const provider = new WaafiPayPaymentProvider(waafiCredentials, {
    formatTimestamp: () => waafiTimestamp,
    fetch: async () => {
      requestCount += 1;
      return { ok: true, async json() {
        return { params: { transactionId: "waafi-id", state: "PENDING" } };
      } };
    }
  });

  await assert.rejects(
    provider.createPayment(waafiRequest({ accountNumber: "025261111111" })),
    /wallet number/
  );
  await assert.rejects(
    provider.createPayment(waafiRequest({ reference: "invalid reference" })),
    /reference/
  );
  await assert.rejects(
    provider.createPayment(waafiRequest({ amount: 1.234 })),
    /two decimal places/
  );
  assert.equal(requestCount, 0);
});

test("blocks requests when the timestamp format is unresolved", async () => {
  let requestCount = 0;
  const provider = new WaafiPayPaymentProvider(waafiCredentials, {
    formatTimestamp: () => "not-a-20-char-timestamp",
    fetch: async () => {
      requestCount += 1;
      return { ok: true, async json() { return {}; } };
    }
  });

  await assert.rejects(
    provider.createPayment(waafiRequest()),
    /20-character value/
  );
  assert.equal(requestCount, 0);
});

test("sanitizes WaafiPay HTTP, network, and timeout errors", async () => {
  const secretError = new Error(`network failed with ${waafiCredentials.apiKey}`);

  for (const fetchImpl of [
    async () => ({ ok: false, status: 500 }),
    async () => { throw secretError; },
    async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(secretError));
    })
  ]) {
    const provider = new WaafiPayPaymentProvider(waafiCredentials, {
      formatTimestamp: () => waafiTimestamp,
      fetch: fetchImpl,
      timeoutMs: 5
    });

    await assert.rejects(
      provider.createPayment(waafiRequest()),
      (error) =>
        error.message.includes("payment request failed") &&
        !error.message.includes(waafiCredentials.apiKey)
    );
  }
});

test("keeps WaafiPay status lookup and verification unsupported without official operations", async () => {
  const provider = new WaafiPayPaymentProvider(waafiCredentials, {
    formatTimestamp: () => waafiTimestamp,
    fetch: async () => { throw new Error("not expected"); }
  });

  await assert.rejects(provider.findPayment({ paymentId: "waafi-id" }), /lookup is unavailable/);
  await assert.rejects(provider.verifyPayment({ paymentId: "waafi-id" }), /verification is unavailable/);
});

test("registers WaafiPay explicitly and requires a valid wallet number", async () => {
  const iskubixi = new IskuBixi({
    bixiyeyaasha: { waafipay: waafiCredentials },
    laqabsadayaasha: {
      waafipay: new WaafiPayPaymentProviderFactory({
        formatTimestamp: () => waafiTimestamp,
        fetch: async (_url, options) => {
          const payload = JSON.parse(options.body);
          return {
            ok: true,
            async json() {
              return {
                params: {
                  transactionId: "waafi-sdk-id",
                  state: "PENDING",
                  accountNo: payload.serviceParams.payerInfo.accountNo
                }
              };
            }
          };
        }
      })
    }
  });

  const payment = await iskubixi.lacag.samee({
    qadarka: 20,
    lacagta: "USD",
    bixiye: "waafipay",
    tixraac: "DALAB-1001",
    lambarka: "252611111111"
  });
  assert.equal(payment.id, "waafi-sdk-id");
  assert.equal(payment.xaalad, "sugaya");

  await assert.rejects(
    iskubixi.lacag.samee({
      qadarka: 20,
      lacagta: "USD",
      bixiye: "waafipay",
      tixraac: "DALAB-1002"
    }),
    /wallet number/
  );
});

test("lists capabilities for providers without exposing credentials", async () => {
  const secret = "capability-secret-should-not-leak";
  const iskubixi = new IskuBixi({
    bixiyeyaasha: { edahab: { apiKey: secret } }
  });
  const result = await iskubixi.bixiye.awood({ bixiye: "edahab" });

  assert.deepEqual(result, {
    bixiye: "edahab",
    awoodaha: {
      paymentCreation: true,
      paymentLookup: true,
      paymentVerification: true,
      paymentCancellation: false,
      refundCreation: true,
      refundStatusLookup: true,
      qrPayment: true,
      webhookSignatureVerification: false
    }
  });
  assert.equal(JSON.stringify(result).includes(secret), false);
  await assert.rejects(
    iskubixi.bixiye.awood({ bixiye: "unknown" }),
    /unknown provider/
  );
  await assert.rejects(
    iskubixi.bixiye.awood({ bixiye: "evc" }),
    /not configured/
  );
});

test("infers optional capabilities for backward-compatible custom adapters", async () => {
  const iskubixi = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    laqabsadayaasha: {
      edahab: sameeLaqabsadeTijaabo("capability-custom")
    }
  });
  const result = await iskubixi.bixiye.awood({ bixiye: "edahab" });

  assert.deepEqual(result.awoodaha, {
    paymentCreation: true,
    paymentLookup: true,
    paymentVerification: true,
    paymentCancellation: false,
    refundCreation: false,
    refundStatusLookup: false,
    qrPayment: true,
    webhookSignatureVerification: false
  });
  assert.equal((await iskubixi.lacag.samee(codsiLacag())).xaalad, "sugaya");
});

test("WaafiPay reports only implemented capabilities without making requests", async () => {
  let requests = 0;
  const iskubixi = new IskuBixi({
    bixiyeyaasha: { waafipay: waafiCredentials },
    laqabsadayaasha: {
      waafipay: new WaafiPayPaymentProviderFactory({
        formatTimestamp: () => waafiTimestamp,
        fetch: async () => {
          requests += 1;
          throw new Error("Capability discovery must not make a request.");
        }
      })
    }
  });
  const result = await iskubixi.bixiye.awood({ bixiye: "waafipay" });

  assert.deepEqual(result.awoodaha, {
    paymentCreation: true,
    paymentLookup: false,
    paymentVerification: false,
    paymentCancellation: false,
    refundCreation: false,
    refundStatusLookup: false,
    qrPayment: false,
    webhookSignatureVerification: false
  });
  assert.equal(requests, 0);
});

test("webhook verification capability requires a configured signature adapter", async () => {
  const iskubixi = sameeWebhookSdk();
  const result = await iskubixi.bixiye.awood({ bixiye: "waafipay" });
  assert.equal(result.awoodaha.webhookSignatureVerification, true);
});

test("unsupported provider operations fail before calling the adapter", async () => {
  let lookups = 0;
  const base = sameeLaqabsadeTijaabo("capability-disabled");
  const iskubixi = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    laqabsadayaasha: {
      edahab: {
        create(credentials) {
          const provider = base.create(credentials);
          const findPayment = provider.findPayment.bind(provider);
          provider.findPayment = async (...args) => {
            lookups += 1;
            return findPayment(...args);
          };
          provider.capabilities = { paymentLookup: false };
          return provider;
        }
      }
    }
  });
  const payment = await iskubixi.lacag.samee(codsiLacag());

  await assert.rejects(
    iskubixi.lacag.xaalad({ lacagId: payment.id }),
    (error) =>
      error instanceof UnsupportedOperationError &&
      error.code === "ISKUBIXI_UNSUPPORTED_OPERATION" &&
      /Payment provider "edahab" does not support payment lookup/.test(error.message)
  );
  assert.equal(lookups, 0);
});

test("WaafiPay unsupported lookup and refund operations report capability errors", async () => {
  const iskubixi = new IskuBixi({
    bixiyeyaasha: { waafipay: waafiCredentials },
    laqabsadayaasha: {
      waafipay: new WaafiPayPaymentProviderFactory({
        formatTimestamp: () => waafiTimestamp,
        fetch: async () => ({
          ok: true,
          async json() {
            return { params: { transactionId: "waafi-capability-id", state: "PENDING" } };
          }
        })
      })
    }
  });
  const payment = await iskubixi.lacag.samee(codsiWebhookLacag());

  await assert.rejects(
    iskubixi.lacag.xaalad({ lacagId: payment.id }),
    /Payment provider "waafipay" does not support payment lookup; select another provider/
  );
  await assert.rejects(
    iskubixi.lacag.cadee({ lacagId: payment.id }),
    /Payment provider "waafipay" does not support payment verification; select another provider/
  );
  await assert.rejects(
    iskubixi.lacag.celi({
      lacagId: payment.id,
      furahaIdempotency: "waafi-unsupported-refund"
    }),
    /Payment provider "waafipay" does not support refunds \(refund creation\); select another provider/
  );
});

test("returns the original payment for an identical idempotency key and request", async () => {
  const iskubixi = sameeIskuBixi();
  const codsi = codsiLacag({ furahaIdempotency: "request-001" });

  const lacagtiiKoowaad = await iskubixi.lacag.samee(codsi);
  const lacagtiiLabaad = await iskubixi.lacag.samee({ ...codsi });

  assert.deepEqual(lacagtiiLabaad, lacagtiiKoowaad);
  assert.equal((await iskubixi.lacag.xaalad({ lacagId: lacagtiiKoowaad.id })).id, lacagtiiKoowaad.id);
});

test("rejects an idempotency key reused with changed payment details", async () => {
  const iskubixi = sameeIskuBixi();
  const codsi = codsiLacag({ furahaIdempotency: "request-002" });
  await iskubixi.lacag.samee(codsi);

  await assert.rejects(
    iskubixi.lacag.samee({ ...codsi, qadarka: 21 }),
    (error) =>
      error instanceof IdempotencyError &&
      error.code === "ISKUBIXI_IDEMPOTENCY_ERROR" &&
      /Idempotency key was already used with different payment details/.test(error.message)
  );
});

test("includes payment expiry in idempotency request matching", async () => {
  await waqtiAdoo(Date.parse("2030-01-01T00:00:00.000Z"), async () => {
    const iskubixi = sameeIskuBixi();
    const codsi = codsiLacag({
      furahaIdempotency: "request-expiry-match",
      dhacayaa: new Date(Date.now() + 60_000).toISOString()
    });
    await iskubixi.lacag.samee(codsi);

    await assert.rejects(
      iskubixi.lacag.samee({
        ...codsi,
        dhacayaa: new Date(Date.now() + 120_000).toISOString()
      }),
      /different payment details/
    );
  });
});

test("returns the original expired payment for an idempotent retry", async () => {
  await waqtiAdoo(Date.parse("2030-01-01T00:00:00.000Z"), async (waqtigaDeji) => {
    const iskubixi = sameeIskuBixi();
    const dhacayaa = new Date(Date.now() + 1_000).toISOString();
    const codsi = codsiLacag({
      furahaIdempotency: "request-expired-retry",
      dhacayaa
    });
    const lacagtiiKoowaad = await iskubixi.lacag.samee(codsi);

    waqtigaDeji(Date.parse(dhacayaa) + 1);
    const lacagtiiLabaad = await iskubixi.lacag.samee({ ...codsi });

    assert.equal(lacagtiiLabaad.id, lacagtiiKoowaad.id);
    assert.equal(lacagtiiLabaad.xaalad, "dhacay");
  });
});

test("allows separate payments for different idempotency keys", async () => {
  const iskubixi = sameeIskuBixi();

  const lacagtiiKoowaad = await iskubixi.lacag.samee(
    codsiLacag({ furahaIdempotency: "request-003-a" })
  );
  const lacagtiiLabaad = await iskubixi.lacag.samee(
    codsiLacag({ furahaIdempotency: "request-003-b" })
  );

  assert.notEqual(lacagtiiKoowaad.id, lacagtiiLabaad.id);
});

test("coalesces simultaneous identical requests into one provider payment", async () => {
  let tiradaAbuurista = 0;
  const iskubixi = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    laqabsadayaasha: {
      edahab: {
        create() {
          return {
            async createPayment(request) {
              tiradaAbuurista += 1;
              await new Promise((resolve) => setTimeout(resolve, 20));
              return {
                id: "concurrent-payment",
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
        }
      }
    }
  });
  const codsi = codsiLacag({ furahaIdempotency: "request-concurrent" });

  const [koowaad, labaad] = await Promise.all([
    iskubixi.lacag.samee(codsi),
    iskubixi.lacag.samee({ ...codsi })
  ]);

  assert.equal(tiradaAbuurista, 1);
  assert.deepEqual(labaad, koowaad);
});

test("rejects empty idempotency keys and permits a replaceable idempotency store", async () => {
  const iskubixi = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    keydkaIdempotency: new InMemoryPaymentIdempotencyStore()
  });

  await assert.rejects(
    iskubixi.lacag.samee(codsiLacag({ furahaIdempotency: "   " })),
    /Idempotency key/
  );

  const lacag = await iskubixi.lacag.samee(
    codsiLacag({ furahaIdempotency: "request-custom-store" })
  );
  assert.equal(lacag.xaalad, "sugaya");
});

test("returns an empty transaction page with useful metadata", async () => {
  const liiska = await sameeIskuBixi().lacag.liiska();

  assert.deepEqual(liiska, {
    lacagaha: [],
    wadarta: 0,
    bogga: 1,
    xadka: 20,
    wadartaBogagga: 0
  });
});

test("lists transactions from different providers with provider identity", async () => {
  const iskubixi = new IskuBixi({
    bixiyeyaasha: {
      edahab: bixiyeLaQaabeeyay,
      evc: bixiyeLaQaabeeyay
    }
  });
  const lacagtaEdahab = await iskubixi.lacag.samee(codsiLacag({ bixiye: "edahab" }));
  const lacagtaEvc = await iskubixi.lacag.samee(codsiLacag({ bixiye: "evc" }));

  const dhammaan = await iskubixi.lacag.liiska();
  const kuwaEvc = await iskubixi.lacag.liiska({ bixiye: "evc" });

  assert.equal(dhammaan.wadarta, 2);
  assert.deepEqual(new Set(dhammaan.lacagaha.map((lacag) => lacag.bixiye)), new Set(["edahab", "evc"]));
  assert.equal(kuwaEvc.wadarta, 1);
  assert.equal(kuwaEvc.lacagaha[0].id, lacagtaEvc.id);
  assert.equal(kuwaEvc.lacagaha[0].bixiye, "evc");
  assert.equal(kuwaEvc.lacagaha.some((lacag) => lacag.id === lacagtaEdahab.id), false);
});

test("filters listed transactions by their latest payment status", async () => {
  const iskubixi = sameeIskuBixi();
  const guul = await iskubixi.lacag.samee(codsiLacag({ furahaIdempotency: "list-status-1" }));
  const fashil = await iskubixi.lacag.samee(codsiLacag({ furahaIdempotency: "list-status-2" }));
  await iskubixi.lacag.tijaabiXaalad({ lacagId: guul.id, xaalad: "guuleystay" });
  await iskubixi.lacag.tijaabiXaalad({ lacagId: fashil.id, xaalad: "fashilmay" });

  const liiskaGuusha = await iskubixi.lacag.liiska({ xaalad: "guuleystay" });
  const liiskaSugaya = await iskubixi.lacag.liiska({ xaalad: "sugaya" });

  assert.equal(liiskaGuusha.wadarta, 1);
  assert.equal(liiskaGuusha.lacagaha[0].id, guul.id);
  assert.equal(liiskaGuusha.lacagaha[0].xaalad, "guuleystay");
  assert.equal(liiskaSugaya.wadarta, 0);
});

test("filters listed transactions by currency", async () => {
  const iskubixi = sameeIskuBixi();
  const djf = await iskubixi.lacag.samee(codsiLacag({ lacagta: "DJF" }));
  await iskubixi.lacag.samee(codsiLacag({ lacagta: "USD" }));

  const liiska = await iskubixi.lacag.liiska({ lacagta: "DJF" });

  assert.equal(liiska.wadarta, 1);
  assert.equal(liiska.lacagaha[0].id, djf.id);
  assert.equal(liiska.lacagaha[0].lacagta, "DJF");
});

test("filters transactions using inclusive ISO date-time bounds", async () => {
  const iskubixi = sameeIskuBixi();
  const lacag = await iskubixi.lacag.samee(codsiLacag());
  const hadda = Date.now();
  const liiskaDhexdiisa = await iskubixi.lacag.liiska({
    lagaBilaabo: new Date(hadda - 60_000).toISOString(),
    ilaa: new Date(hadda + 60_000).toISOString()
  });
  const kaDib = await iskubixi.lacag.liiska({
    lagaBilaabo: new Date(hadda + 60_000).toISOString()
  });
  const kaHorreeya = await iskubixi.lacag.liiska({
    ilaa: new Date(hadda - 60_000).toISOString()
  });

  assert.equal(liiskaDhexdiisa.wadarta, 1);
  assert.equal(liiskaDhexdiisa.lacagaha[0].id, lacag.id);
  assert.equal(kaDib.wadarta, 0);
  assert.equal(kaHorreeya.wadarta, 0);
});

test("paginates transaction records and returns total-page metadata", async () => {
  const iskubixi = sameeIskuBixi();
  for (let index = 0; index < 5; index += 1) {
    await iskubixi.lacag.samee(codsiLacag({ tixraac: `PAGE-${index}` }));
  }

  const boggaKoowaad = await iskubixi.lacag.liiska({ bogga: 1, xadka: 2 });
  const boggaLabaad = await iskubixi.lacag.liiska({ bogga: 2, xadka: 2 });
  const boggaSaddexaad = await iskubixi.lacag.liiska({ bogga: 3, xadka: 2 });

  assert.equal(boggaKoowaad.lacagaha.length, 2);
  assert.equal(boggaLabaad.lacagaha.length, 2);
  assert.equal(boggaSaddexaad.lacagaha.length, 1);
  assert.equal(boggaKoowaad.wadarta, 5);
  assert.equal(boggaKoowaad.wadartaBogagga, 3);
  assert.equal(boggaLabaad.bogga, 2);
  assert.equal(boggaSaddexaad.xadka, 2);
  assert.equal(new Set([
    ...boggaKoowaad.lacagaha,
    ...boggaLabaad.lacagaha,
    ...boggaSaddexaad.lacagaha
  ].map((lacag) => lacag.id)).size, 5);
});

test("rejects invalid transaction listing filters and pagination", async () => {
  const iskubixi = sameeIskuBixi();

  for (const [filters, error] of [
    [{ bixiye: "unsupported" }, /Provider filter/],
    [{ xaalad: "unknown" }, /status filter/],
    [{ lacagta: "usd" }, /Currency filter/],
    [{ lagaBilaabo: "2026-01-01" }, /ISO 8601/],
    [{
      lagaBilaabo: "2026-01-02T00:00:00Z",
      ilaa: "2026-01-01T00:00:00Z"
    }, /cannot be later/],
    [{ bogga: 0 }, /Page/],
    [{ xadka: 0 }, /Page size/]
  ]) {
    await assert.rejects(iskubixi.lacag.liiska(filters), error);
  }
});

test("supports replaceable transaction storage without exposing provider secrets", async () => {
  const innerStore = new InMemoryPaymentTransactionStore();
  let tiradaKaydinta = 0;
  const secret = "provider-secret-not-for-listing";
  const iskubixi = new IskuBixi({
    bixiyeyaasha: { edahab: { apiKey: secret } },
    laqabsadayaasha: {
      edahab: {
        create() {
          return {
            async createPayment(request) {
              return {
                id: "stored-payment",
                amount: request.amount,
                currency: request.currency,
                reference: request.reference,
                status: "sugaya",
                apiKey: secret
              };
            },
            async findPayment() {
              return undefined;
            },
            async verifyPayment() {
              return { exists: false, source: "adapter" };
            }
          };
        }
      }
    },
    keydkaLacagaha: {
      async save(transaction) {
        tiradaKaydinta += 1;
        await innerStore.save(transaction);
      },
      async list(query) {
        return innerStore.list(query);
      }
    }
  });

  const lacag = await iskubixi.lacag.samee(codsiLacag());
  const liiska = await iskubixi.lacag.liiska();

  assert.equal(tiradaKaydinta, 1);
  assert.equal(lacag.id, "stored-payment");
  assert.equal(JSON.stringify(liiska).includes(secret), false);
  assert.equal(JSON.stringify(await innerStore.list({ bogga: 1, xadka: 20 })).includes(secret), false);
});

test("shared transaction, provider, and idempotency stores route payments across SDK instances", async () => {
  const keydkaLacagaha = new InMemoryPaymentTransactionStore();
  const keydkaLacagahaBixiyaha = new InMemoryPaymentStore();
  const keydkaIdempotency = new InMemoryPaymentIdempotencyStore();
  const sameeSdk = () => new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    keydkaLacagaha,
    keydkaLacagahaBixiyaha,
    keydkaIdempotency
  });
  const koowaad = sameeSdk();
  const codsi = codsiLacag({ furahaIdempotency: "shared-instance-payment" });
  const lacag = await koowaad.lacag.samee(codsi);
  const labaad = sameeSdk();

  assert.deepEqual(await labaad.lacag.samee({ ...codsi }), lacag);
  assert.deepEqual(await labaad.lacag.xaalad({ lacagId: lacag.id }), lacag);
  await labaad.lacag.tijaabiXaalad({
    lacagId: lacag.id,
    xaalad: "guuleystay"
  });
  assert.equal((await koowaad.lacag.xaalad({ lacagId: lacag.id })).xaalad, "guuleystay");
});

test("coalesces concurrent payment creation across SDK instances with shared storage", async () => {
  const keydkaLacagaha = new InMemoryPaymentTransactionStore();
  const keydkaLacagahaBixiyaha = new InMemoryPaymentStore();
  const keydkaIdempotency = new InMemoryPaymentIdempotencyStore();
  const sameeSdk = () => new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    keydkaLacagaha,
    keydkaLacagahaBixiyaha,
    keydkaIdempotency
  });
  const codsi = codsiLacag({ furahaIdempotency: "concurrent-shared-payment" });
  const [koowaad, labaad] = await Promise.all([
    sameeSdk().lacag.samee(codsi),
    sameeSdk().lacag.samee({ ...codsi })
  ]);

  assert.equal(koowaad.id, labaad.id);
  assert.equal(
    (await keydkaLacagaha.list({ bogga: 1, xadka: 20 })).wadarta,
    1
  );
});

test("persistent transaction storage rejects a provider ID reused with another key", async () => {
  const keydkaLacagaha = new InMemoryPaymentTransactionStore();
  const factory = {
    create() {
      return {
        async createPayment(request) {
          return {
            id: "provider-reused-id",
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
    }
  };
  const sameeSdk = () => new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    laqabsadayaasha: { edahab: factory },
    keydkaLacagaha
  });
  await sameeSdk().lacag.samee(codsiLacag({ furahaIdempotency: "duplicate-id-1" }));

  await assert.rejects(
    sameeSdk().lacag.samee(codsiLacag({
      tixraac: "OTHER-ORDER",
      furahaIdempotency: "duplicate-id-2"
    })),
    /duplicate payment ID/
  );
  assert.equal((await keydkaLacagaha.list({ bogga: 1, xadka: 20 })).wadarta, 1);
});

test("shared refund stores preserve records and status lookup across SDK instances", async () => {
  const keydkaLacagaha = new InMemoryPaymentTransactionStore();
  const keydkaCelinDiiwaanka = new InMemoryRefundStore();
  const keydkaCelin = new InMemoryRefundIdempotencyStore();
  const refundId = "shared-provider-refund";
  const factory = {
    create(credentials) {
      const provider = sameeLaqabsadeCelin(async () => ({
        id: refundId,
        status: "sugaya"
      })).create(credentials);
      provider.findRefundStatus = async ({ refundId: id }) =>
        id === refundId ? { id, status: "sugaya" } : undefined;
      return provider;
    }
  };
  const sameeSdk = () => new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    laqabsadayaasha: { edahab: factory },
    keydkaLacagaha,
    keydkaCelinDiiwaanka,
    keydkaCelin
  });
  const koowaad = sameeSdk();
  const lacag = await koowaad.lacag.samee(codsiLacag());
  const celin = await koowaad.lacag.celi({
    lacagId: lacag.id,
    furahaIdempotency: "shared-refund-status"
  });
  const labaad = sameeSdk();

  assert.deepEqual(
    await labaad.lacag.celi({
      lacagId: lacag.id,
      furahaIdempotency: "shared-refund-status"
    }),
    celin
  );
  assert.equal(
    (await labaad.lacag.celintaXaalad({ celinId: celin.id })).xaalad,
    "sugaya"
  );
  assert.equal((await keydkaCelinDiiwaanka.findById(celin.id)).lacagId, lacag.id);
});

test("shared QR storage preserves QR references across SDK instances", async () => {
  const keydkaQr = new InMemoryQrPaymentStore();
  const keydkaLacagaha = new InMemoryPaymentTransactionStore();
  const keydkaLacagahaBixiyaha = new InMemoryPaymentStore();
  const sameeSdk = () => new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    keydkaQr,
    keydkaLacagaha,
    keydkaLacagahaBixiyaha
  });
  const qr = await sameeSdk().qr.samee(codsiQr());

  const record = await sameeSdk().qr.xog({ tixraac: qr.tixraac });
  assert.equal(record.tixraac, qr.tixraac);
  assert.equal(record.lacagId, qr.lacagId);
  assert.equal(record.xaalad, "sugaya");
});

test("shared webhook storage deduplicates events across SDK instances", async () => {
  const keydkaWebhook = new InMemoryWebhookEventStore();
  const keydkaLacagaha = new InMemoryPaymentTransactionStore();
  const sameeSdk = () => sameeWebhookSdk({ keydkaWebhook, keydkaLacagaha });
  const koowaad = sameeSdk();
  const lacag = await koowaad.lacag.samee(codsiWebhookLacag());
  const codsi = sameeWaafiWebhook(
    sameeWaafiPaymentEvent("authorization", "APPROVED"),
    "shared-webhook-event"
  );
  const firstResult = await koowaad.webhook.kaShaqee(codsi);
  const secondResult = await sameeSdk().webhook.kaShaqee(codsi);

  assert.equal(firstResult.horeLooShaqeeyay, false);
  assert.equal(secondResult.horeLooShaqeeyay, true);
  assert.equal(secondResult.lacagId, lacag.id);
  assert.equal((await keydkaLacagaha.findById("waafipay", lacag.id)).status, "guuleystay");
});

test("custom storage failures are sanitized and retain a storage error code", async () => {
  const secret = "custom-storage-secret";
  const sdk = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    keydkaLacagaha: {
      async save() {
        throw new ProviderError(`custom transaction store unavailable: ${secret}`);
      },
      async list() {
        throw new Error(`custom transaction store unavailable: ${secret}`);
      }
    }
  });

  await assert.rejects(
    sdk.lacag.samee(codsiLacag()),
    (error) =>
      error instanceof StorageError &&
      error.code === "ISKUBIXI_STORAGE_ERROR" &&
      !error.message.includes(secret)
  );
  await assert.rejects(
    sdk.lacag.liiska(),
    (error) =>
      error instanceof StorageError &&
      error.code === "ISKUBIXI_STORAGE_ERROR" &&
      !error.message.includes(secret)
  );
});

const codsiQr = (isbeddel = {}) => ({
  qadarka: 20,
  lacagta: "USD",
  bixiye: "edahab",
  dhacayaa: new Date(Date.now() + 60_000).toISOString(),
  ...isbeddel
});

test("creates a QR reference and an associated pending payment", async () => {
  const iskubixi = sameeIskuBixi();
  const qr = await iskubixi.qr.samee(codsiQr());
  const lacagaha = await iskubixi.lacag.liiska();

  assert.match(qr.tixraac, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(qr.nuxur, `iskubixi:qr:v1:${qr.tixraac}`);
  assert.equal(qr.xaalad, "sugaya");
  assert.equal(qr.xaaladQr, "furan");
  assert.equal(qr.bixiye, "edahab");
  assert.equal(lacagaha.wadarta, 1);
  assert.equal(lacagaha.lacagaha[0].id, qr.lacagId);
});

test("generates unique QR payment references and linked payments", async () => {
  const iskubixi = sameeIskuBixi();
  const koowaad = await iskubixi.qr.samee(codsiQr());
  const labaad = await iskubixi.qr.samee(codsiQr());

  assert.notEqual(koowaad.tixraac, labaad.tixraac);
  assert.notEqual(koowaad.lacagId, labaad.lacagId);
});

test("reuses QR payments for idempotent creation retries and rejects changed details", async () => {
  const iskubixi = sameeIskuBixi();
  const codsi = codsiQr({ furahaIdempotency: "qr-order-1001" });
  const koowaad = await iskubixi.qr.samee(codsi);
  const labaad = await iskubixi.qr.samee({ ...codsi });

  assert.equal(labaad.tixraac, koowaad.tixraac);
  assert.equal(labaad.lacagId, koowaad.lacagId);
  assert.equal((await iskubixi.lacag.liiska()).wadarta, 1);
  await assert.rejects(
    iskubixi.qr.samee({ ...codsi, qadarka: 21 }),
    /different payment details/
  );
});

test("returns the original expired QR reference for an idempotent retry", async () => {
  await waqtiAdoo(Date.parse("2030-01-01T00:00:00.000Z"), async (waqtigaDeji) => {
    const iskubixi = sameeIskuBixi();
    const dhacayaa = new Date(Date.now() + 1_000).toISOString();
    const codsi = codsiQr({
      furahaIdempotency: "qr-expired-retry",
      dhacayaa
    });
    const qrKoowaad = await iskubixi.qr.samee(codsi);

    waqtigaDeji(Date.parse(dhacayaa) + 1);
    const qrLabaad = await iskubixi.qr.samee({ ...codsi });

    assert.equal(qrLabaad.tixraac, qrKoowaad.tixraac);
    assert.equal(qrLabaad.lacagId, qrKoowaad.lacagId);
    assert.equal(qrLabaad.xaalad, "dhacay");
    assert.equal(qrLabaad.xaaladQr, "dhacay");
  });
});

test("coalesces simultaneous QR creation retries with the same idempotency key", async () => {
  const iskubixi = sameeIskuBixi();
  const codsi = codsiQr({ furahaIdempotency: "qr-concurrent-order" });

  const [koowaad, labaad] = await Promise.all([
    iskubixi.qr.samee(codsi),
    iskubixi.qr.samee({ ...codsi })
  ]);

  assert.equal(koowaad.tixraac, labaad.tixraac);
  assert.equal(koowaad.lacagId, labaad.lacagId);
  assert.equal((await iskubixi.lacag.liiska()).wadarta, 1);
});

test("reads and validates an active QR payload", async () => {
  const iskubixi = sameeIskuBixi();
  const qr = await iskubixi.qr.samee(codsiQr());

  const laAkhristay = await iskubixi.qr.akhriso({ nuxur: qr.nuxur });
  const laXaqiijiyay = await iskubixi.qr.cadee({ tixraac: qr.tixraac });

  assert.equal(laAkhristay.tixraac, qr.tixraac);
  assert.equal(laAkhristay.lacagId, qr.lacagId);
  assert.equal(laAkhristay.waaSax, true);
  assert.equal(laXaqiijiyay.waaSax, true);
});

test("rejects malformed, tampered, and unknown QR references", async () => {
  const iskubixi = sameeIskuBixi();
  const qr = await iskubixi.qr.samee(codsiQr());
  const ending = qr.nuxur.endsWith("A") ? "B" : "A";
  const tampered = `${qr.nuxur.slice(0, -1)}${ending}`;

  await assert.rejects(iskubixi.qr.akhriso({ nuxur: "not-a-qr-payload" }), /malformed/);
  await assert.rejects(iskubixi.qr.akhriso({ nuxur: tampered }), /not found or is invalid/);
  await assert.rejects(
    iskubixi.qr.cadee({ tixraac: "unknown-reference" }),
    /malformed/
  );
});

test("enforces QR expiry before creating a payment and when validating stored references", async () => {
  const iskubixi = sameeIskuBixi();
  await assert.rejects(
    iskubixi.qr.samee(codsiQr({ dhacayaa: new Date(Date.now() - 1_000).toISOString() })),
    /must be in the future/
  );
  assert.equal((await iskubixi.lacag.liiska()).wadarta, 0);

  const tixraacDhacay = "A".repeat(43);
  const keydkaQr = new InMemoryQrPaymentStore();
  await keydkaQr.create({
    tixraac: tixraacDhacay,
    lacagId: "expired-payment",
    bixiye: "edahab",
    laAbuuray: new Date(Date.now() - 120_000).toISOString(),
    dhacayaa: new Date(Date.now() - 60_000).toISOString(),
    xaalad: "furan"
  });
  const sdkKeydLaBeddelay = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    keydkaQr
  });

  await assert.rejects(
    sdkKeydLaBeddelay.qr.cadee({ tixraac: tixraacDhacay }),
    /has expired/
  );
});

test("keeps QR expiry and its underlying payment status consistent", async () => {
  await waqtiAdoo(Date.parse("2030-01-01T00:00:00.000Z"), async (waqtigaDeji) => {
    const iskubixi = sameeIskuBixi();
    const dhacayaa = new Date(Date.now() + 1_000).toISOString();
    const qr = await iskubixi.qr.samee(codsiQr({ dhacayaa }));

    waqtigaDeji(Date.parse(dhacayaa) + 1);
    const xaalad = await iskubixi.qr.xaalad({ tixraac: qr.tixraac });
    const xog = await iskubixi.qr.xog({ tixraac: qr.tixraac });
    const lacagahaDhacay = await iskubixi.lacag.liiska({ xaalad: "dhacay" });

    assert.equal(xaalad.xaalad, "dhacay");
    assert.equal(xaalad.xaaladQr, "dhacay");
    assert.equal(xog.xaalad, "dhacay");
    assert.equal(xog.dhacayaa, dhacayaa);
    assert.equal(lacagahaDhacay.wadarta, 1);
    await assert.rejects(
      iskubixi.qr.cadee({ tixraac: qr.tixraac }),
      /has expired/
    );
  });
});

test("QR status follows the latest status of its associated payment", async () => {
  const iskubixi = sameeIskuBixi();
  const qr = await iskubixi.qr.samee(codsiQr());
  await iskubixi.lacag.tijaabiXaalad({
    lacagId: qr.lacagId,
    xaalad: "guuleystay"
  });

  const xaalad = await iskubixi.qr.xaalad({ tixraac: qr.tixraac });

  assert.equal(xaalad.xaalad, "guuleystay");
  assert.equal(xaalad.xaaladQr, "laIsticmaalay");
  assert.equal(xaalad.lacagId, qr.lacagId);
  await assert.rejects(
    iskubixi.qr.cadee({ tixraac: qr.tixraac }),
    /already been used/
  );
});

test("QR cancellation requires provider support and only cancels pending QR payments", async () => {
  const unsupportedSdk = sameeIskuBixi();
  const unsupportedQr = await unsupportedSdk.qr.samee(codsiQr());
  await assert.rejects(
    unsupportedSdk.qr.jooji({ tixraac: unsupportedQr.tixraac }),
    /does not support cancellation/
  );
  assert.equal(
    (await unsupportedSdk.qr.xog({ tixraac: unsupportedQr.tixraac })).xaaladQr,
    "furan"
  );

  let currentPayment;
  let tiradaJoojinta = 0;
  const sdk = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    laqabsadayaasha: {
      edahab: {
        create() {
          return {
            async createPayment(request) {
              currentPayment = {
                id: "cancellable-payment",
                amount: request.amount,
                currency: request.currency,
                reference: request.reference,
                status: "sugaya"
              };
              return currentPayment;
            },
            async findPayment() {
              return currentPayment;
            },
            async verifyPayment() {
              return { exists: true, payment: currentPayment, source: "adapter" };
            },
            async cancelPayment() {
              tiradaJoojinta += 1;
              currentPayment = { ...currentPayment, status: "joojiyay" };
            }
          };
        }
      }
    }
  });
  const qr = await sdk.qr.samee(codsiQr());
  const laJoojiyay = await sdk.qr.jooji({ tixraac: qr.tixraac });
  const xaalad = await sdk.qr.xaalad({ tixraac: qr.tixraac });

  assert.equal(tiradaJoojinta, 1);
  assert.equal(laJoojiyay.xaaladQr, "joojiyay");
  assert.equal(xaalad.xaaladQr, "joojiyay");
  assert.equal(xaalad.xaalad, "joojiyay");
  await assert.rejects(sdk.qr.cadee({ tixraac: qr.tixraac }), /has been cancelled/);
});

test("scanning a QR payload does not create or fulfill another payment", async () => {
  const sdk = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    laqabsadayaasha: {
      edahab: sameeLaqabsadeTijaabo("qr-replay")
    }
  });
  const qr = await sdk.qr.samee(codsiQr());
  await sdk.qr.akhriso({ nuxur: qr.nuxur });
  await sdk.qr.akhriso({ nuxur: qr.nuxur });

  assert.equal((await sdk.lacag.liiska()).wadarta, 1);
  assert.equal(qr.xaalad, "sugaya");
});

test("QR payloads and QR records do not expose provider credentials", async () => {
  const secret = "qr-provider-secret";
  const keydkaQr = new InMemoryQrPaymentStore();
  const sdk = new IskuBixi({
    bixiyeyaasha: { edahab: { apiKey: secret } },
    keydkaQr,
    laqabsadayaasha: {
      edahab: {
        create() {
          return {
            async createPayment(request) {
              return {
                id: "private-payment",
                amount: request.amount,
                currency: request.currency,
                reference: request.reference,
                status: "sugaya",
                apiKey: secret
              };
            },
            async findPayment() {
              return {
                id: "private-payment",
                amount: 20,
                currency: "USD",
                reference: "QR-reference",
                status: "sugaya",
                apiKey: secret
              };
            },
            async verifyPayment() {
              return { exists: false, source: "adapter" };
            }
          };
        }
      }
    }
  });
  const qr = await sdk.qr.samee(codsiQr());
  const stored = await keydkaQr.find(qr.tixraac);

  assert.equal(JSON.stringify(qr).includes(secret), false);
  assert.equal(JSON.stringify(stored).includes(secret), false);
  assert.equal(qr.nuxur.includes(secret), false);
});

test("verifies WaafiPay webhook signatures over the unchanged raw body", async () => {
  const sdk = sameeWebhookSdk();
  const lacag = await sdk.lacag.samee(codsiWebhookLacag());
  const codsi = sameeWaafiWebhook(
    sameeWaafiPaymentEvent("authorization", "APPROVED")
  );

  const laXaqiijiyay = await sdk.webhook.cadee(codsi);
  const bilow = await sdk.lacag.liiska({ bixiye: "waafipay" });

  assert.deepEqual(laXaqiijiyay, {
    waaSax: true,
    bixiye: "waafipay",
    dhacdoId: "waafi-event-1",
    xaalad: "guuleystay"
  });
  assert.equal(bilow.lacagaha[0].id, lacag.id);
  assert.equal(bilow.lacagaha[0].xaalad, "sugaya");
});

test("maps documented WaafiPay decline and cancellation events", async () => {
  const sdk = sameeWebhookSdk();

  const decline = await sdk.webhook.cadee(sameeWaafiWebhook(
    sameeWaafiPaymentEvent("authorization", "DECLINED"),
    "waafi-decline-event"
  ));
  const cancellation = await sdk.webhook.cadee(sameeWaafiWebhook(
    sameeWaafiPaymentEvent("declined", "CANCELLED"),
    "waafi-cancel-event"
  ));

  assert.equal(decline.xaalad, "fashilmay");
  assert.equal(cancellation.xaalad, "joojiyay");
});

test("rejects invalid and stale WaafiPay webhook signatures without exposing secrets", async () => {
  const sdk = sameeWebhookSdk();
  const lacag = await sdk.lacag.samee(codsiWebhookLacag());
  const codsi = sameeWaafiWebhook(
    sameeWaafiPaymentEvent("authorization", "APPROVED")
  );
  const signature = codsi.headers["X-Webhook-Signature"];
  const altered = {
    ...codsi,
    headers: {
      ...codsi.headers,
      "X-Webhook-Signature": `${signature.slice(0, -1)}${signature.endsWith("0") ? "1" : "0"}`
    }
  };
  const changedBody = {
    ...codsi,
    rawBody: Buffer.concat([codsi.rawBody, Buffer.from(" ", "utf8")])
  };
  const stale = sameeWaafiWebhook(
    sameeWaafiPaymentEvent("authorization", "APPROVED"),
    "waafi-stale-event",
    (Math.floor(Date.now() / 1000) - 301).toString()
  );

  for (const invalid of [altered, changedBody, stale]) {
    await assert.rejects(
      sdk.webhook.cadee(invalid),
      (error) =>
        error instanceof WebhookVerificationError &&
        error.code === "ISKUBIXI_WEBHOOK_VERIFICATION_ERROR" &&
        error.message.includes("rejected or could not verify") &&
        !error.message.includes(waafiWebhookSecret)
    );
  }
  assert.equal((await sdk.lacag.liiska()).lacagaha[0].id, lacag.id);
  assert.equal((await sdk.lacag.liiska()).lacagaha[0].xaalad, "sugaya");
});

test("processes a signed WaafiPay event once and updates the transaction store", async () => {
  const sdk = sameeWebhookSdk();
  const lacag = await sdk.lacag.samee(codsiWebhookLacag());
  const codsi = sameeWaafiWebhook(
    sameeWaafiPaymentEvent("authorization", "APPROVED")
  );

  const koowaad = await sdk.webhook.kaShaqee(codsi);
  const labaad = await sdk.webhook.kaShaqee(codsi);
  const liiska = await sdk.lacag.liiska({ xaalad: "guuleystay" });

  assert.equal(koowaad.horeLooShaqeeyay, false);
  assert.equal(labaad.horeLooShaqeeyay, true);
  assert.equal(koowaad.xaalad, "guuleystay");
  assert.equal(koowaad.lacagId, lacag.id);
  assert.equal(koowaad.tixraac, "DALAB-1001");
  assert.equal(labaad.lacagId, lacag.id);
  assert.equal(labaad.tixraac, "DALAB-1001");
  assert.equal(liiska.wadarta, 1);
  assert.equal(liiska.lacagaha[0].id, lacag.id);
});

test("does not allow a verified webhook to succeed a payment after expiry", async () => {
  await waqtiAdoo(Date.parse("2030-01-01T00:00:00.000Z"), async (waqtigaDeji) => {
    const sdk = sameeWebhookSdk();
    const dhacayaa = new Date(Date.now() + 1_000).toISOString();
    const lacag = await sdk.lacag.samee(codsiWebhookLacag({ dhacayaa }));

    waqtigaDeji(Date.parse(dhacayaa) + 1);
    const processed = await sdk.webhook.kaShaqee(sameeWaafiWebhook(
      sameeWaafiPaymentEvent("authorization", "APPROVED"),
      "late-expiration-event"
    ));

    assert.equal(processed.xaalad, "dhacay");
    assert.equal(processed.lacagId, lacag.id);
    assert.equal(
      (await sdk.lacag.liiska({ xaalad: "dhacay" })).wadarta,
      1
    );
    assert.equal(
      (await sdk.lacag.liiska({ xaalad: "guuleystay" })).wadarta,
      0
    );
  });
});

test("coalesces simultaneous duplicate webhook deliveries", async () => {
  const sdk = sameeWebhookSdk();
  await sdk.lacag.samee(codsiWebhookLacag());
  const codsi = sameeWaafiWebhook(
    sameeWaafiPaymentEvent("authorization", "APPROVED"),
    "waafi-concurrent-event"
  );

  const natiijooyinka = await Promise.all([
    sdk.webhook.kaShaqee(codsi),
    sdk.webhook.kaShaqee(codsi)
  ]);
  const processedCounts = natiijooyinka
    .map((natiijo) => natiijo.horeLooShaqeeyay)
    .filter((hore) => !hore).length;

  assert.equal(processedCounts, 1);
  assert.equal((await sdk.lacag.liiska({ xaalad: "guuleystay" })).wadarta, 1);
});

test("rejects reuse of a webhook event ID with different payment data", async () => {
  const sdk = sameeWebhookSdk();
  await sdk.lacag.samee(codsiWebhookLacag());
  await sdk.webhook.kaShaqee(sameeWaafiWebhook(
    sameeWaafiPaymentEvent("authorization", "APPROVED"),
    "waafi-reused-event"
  ));

  await assert.rejects(
    sdk.webhook.kaShaqee(sameeWaafiWebhook(
      sameeWaafiPaymentEvent("authorization", "FAILED"),
      "waafi-reused-event"
    )),
    /reused with different event data/
  );
  assert.equal((await sdk.lacag.liiska()).lacagaha[0].xaalad, "guuleystay");
});

test("rejects unknown webhook transactions and does not consume their event IDs", async () => {
  const sdk = sameeWebhookSdk();
  await sdk.lacag.samee(codsiWebhookLacag());
  const codsi = sameeWaafiWebhook(
    sameeWaafiPaymentEvent(
      "authorization",
      "APPROVED",
      {
        transaction_id: "unknown-payment",
        reference_id: "UNKNOWN-REFERENCE"
      }
    ),
    "waafi-unknown-event"
  );

  await assert.rejects(
    sdk.webhook.kaShaqee(codsi),
    /not found or its identifiers do not match/
  );
  assert.equal((await sdk.lacag.liiska()).lacagaha[0].xaalad, "sugaya");
});

test("rejects signed webhook details that do not match the stored payment", async () => {
  const sdk = sameeWebhookSdk();
  await sdk.lacag.samee(codsiWebhookLacag());
  const codsi = sameeWaafiWebhook(
    sameeWaafiPaymentEvent("authorization", "APPROVED", { amount: 21 }),
    "waafi-mismatched-amount"
  );

  await assert.rejects(
    sdk.webhook.kaShaqee(codsi),
    /details do not match/
  );
  assert.equal((await sdk.lacag.liiska()).lacagaha[0].xaalad, "sugaya");
});

test("rejects conflicting terminal webhook statuses but accepts a documented reversal", async () => {
  const sdk = sameeWebhookSdk();
  const lacag = await sdk.lacag.samee(codsiWebhookLacag());
  await sdk.webhook.kaShaqee(sameeWaafiWebhook(
    sameeWaafiPaymentEvent("authorization", "APPROVED"),
    "waafi-success-event"
  ));

  await assert.rejects(
    sdk.webhook.kaShaqee(sameeWaafiWebhook(
      sameeWaafiPaymentEvent("authorization", "FAILED"),
      "waafi-conflicting-failure"
    )),
    /status transition is invalid/
  );
  const laCeliyay = await sdk.webhook.kaShaqee(sameeWaafiWebhook(
    sameeWaafiPaymentEvent("void", "CANCELLED", {
      transaction_id: "waafi-reversal",
      original_transaction_id: lacag.id,
      reference_id: "DALAB-1001"
    }),
    "waafi-reversal-event"
  ));
  const dibLooDirayGuusha = await sdk.webhook.kaShaqee(sameeWaafiWebhook(
    sameeWaafiPaymentEvent("authorization", "APPROVED"),
    "waafi-success-event"
  ));

  assert.equal(laCeliyay.xaalad, "joojiyay");
  assert.equal(dibLooDirayGuusha.horeLooShaqeeyay, true);
  assert.equal(dibLooDirayGuusha.xaalad, "joojiyay");
  assert.equal((await sdk.lacag.liiska()).lacagaha[0].xaalad, "joojiyay");
});

test("supports pending events from provider-specific webhook adapters", async () => {
  const sdk = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    laqabsadayaasha: {
      edahab: sameeLaqabsadeTijaabo("pending-webhook")
    },
    laqabsadayaashaWebhook: {
      edahab: {
        async verifyAndParse({ headers }) {
          if (headers["x-test-signature"] !== "valid") {
            throw new Error("invalid test signature");
          }
          return {
            bixiye: "edahab",
            dhacdoId: "pending-event",
            xaalad: "sugaya",
            lacagId: "pending-webhook-1"
          };
        }
      }
    }
  });
  const lacag = await sdk.lacag.samee(codsiLacag());

  const natiijo = await sdk.webhook.kaShaqee({
    bixiye: "edahab",
    rawBody: Buffer.from("{}"),
    headers: { "x-test-signature": "valid" }
  });

  assert.equal(natiijo.xaalad, "sugaya");
  assert.equal((await sdk.lacag.liiska()).lacagaha[0].id, lacag.id);
});

test("supports replaceable webhook event storage", async () => {
  const innerStore = new InMemoryWebhookEventStore();
  let tiradaWicitaanka = 0;
  const sdk = sameeWebhookSdk({
    keydkaWebhook: {
      async processOnce(...args) {
        tiradaWicitaanka += 1;
        return innerStore.processOnce(...args);
      }
    }
  });
  await sdk.lacag.samee(codsiWebhookLacag());
  const codsi = sameeWaafiWebhook(
    sameeWaafiPaymentEvent("authorization", "DECLINED"),
    "waafi-custom-store-event"
  );

  await sdk.webhook.kaShaqee(codsi);
  await sdk.webhook.kaShaqee(codsi);

  assert.equal(tiradaWicitaanka, 2);
  assert.equal((await sdk.lacag.liiska()).lacagaha[0].xaalad, "fashilmay");
});

test("acknowledges signed unsupported WaafiPay events without changing payment status", async () => {
  const sdk = sameeWebhookSdk();
  await sdk.lacag.samee(codsiWebhookLacag());
  const codsi = sameeWaafiWebhook({
    event: "refund",
    merchant_uid: waafiCredentials.merchantUid
  }, "waafi-refund-event");

  const verified = await sdk.webhook.cadee(codsi);
  const processed = await sdk.webhook.kaShaqee(codsi);

  assert.equal(verified.laIskaIndhoTiray, true);
  assert.equal(processed.laIskaIndhoTiray, true);
  assert.equal(processed.horeLooShaqeeyay, false);
  assert.equal((await sdk.lacag.liiska()).lacagaha[0].xaalad, "sugaya");
});

test("applies only provider-normalized refund webhook events with valid transitions", async () => {
  const refundId = "provider-webhook-refund";
  const sdk = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    laqabsadayaasha: {
      edahab: sameeLaqabsadeCelin(async () => ({
        id: refundId,
        status: "sugaya"
      }))
    },
    laqabsadayaashaWebhook: {
      edahab: {
        async verifyAndParse({ headers }) {
          if (headers.signature !== "valid") {
            throw new Error("invalid signature");
          }
          return {
            nooca: "celin",
            bixiye: "edahab",
            dhacdoId: headers.eventId,
            providerRefundId: refundId,
            xaalad: headers.status
          };
        }
      }
    }
  });
  const lacag = await sdk.lacag.samee(codsiLacag());
  const celin = await sdk.lacag.celi({
    lacagId: lacag.id,
    furahaIdempotency: "webhook-refund-status"
  });
  const codsi = {
    bixiye: "edahab",
    rawBody: Buffer.from("{}"),
    headers: {
      signature: "valid",
      eventId: "refund-success-event",
      status: "guuleystay"
    }
  };

  const koowaad = await sdk.webhook.kaShaqee(codsi);
  const labaad = await sdk.webhook.kaShaqee(codsi);
  assert.equal(koowaad.horeLooShaqeeyay, false);
  assert.equal(labaad.horeLooShaqeeyay, true);
  assert.equal(koowaad.celinId, celin.id);
  assert.equal(koowaad.providerRefundId, refundId);
  assert.equal(koowaad.xaaladCelin, "guuleystay");
  assert.equal(labaad.xaaladCelin, "guuleystay");
  assert.equal((await sdk.lacag.xaalad({ lacagId: lacag.id })).xaalad, "laCeliyay");

  await assert.rejects(
    sdk.webhook.kaShaqee({
      ...codsi,
      headers: { ...codsi.headers, eventId: "refund-conflict-event", status: "fashilmay" }
    }),
    /refund status transition is invalid/
  );
  assert.equal((await sdk.lacag.xaalad({ lacagId: lacag.id })).xaalad, "laCeliyay");
});

test("does not apply verified webhooks to simulated payments", async () => {
  const sdk = new IskuBixi({
    bixiyeyaasha: { waafipay: waafiCredentials },
    laqabsadayaashaWebhook: {
      waafipay: new WaafiPayWebhookAdapter({
        secret: waafiWebhookSecret,
        merchantUid: waafiCredentials.merchantUid
      })
    }
  });
  const lacag = await sdk.lacag.samee(codsiWebhookLacag());
  const codsi = sameeWaafiWebhook(
    sameeWaafiPaymentEvent("authorization", "APPROVED", {
      transaction_id: lacag.id
    })
  );

  await assert.rejects(
    sdk.webhook.kaShaqee(codsi),
    /cannot update simulated payments/
  );
  assert.equal((await sdk.lacag.xaalad({ lacagId: lacag.id })).xaalad, "sugaya");
});

test("rejects unsigned WaafiPay test pings and mismatched merchant events", async () => {
  const sdk = sameeWebhookSdk();
  const testPing = sameeWaafiWebhook({
    event: "webhook.test",
    merchant_uid: waafiCredentials.merchantUid
  });
  const mismatchedMerchant = sameeWaafiWebhook({
    ...sameeWaafiPaymentEvent("authorization", "APPROVED"),
    merchant_uid: "another-merchant"
  });

  await assert.rejects(sdk.webhook.cadee(testPing), /rejected or could not verify/);
  await assert.rejects(
    sdk.webhook.cadee(mismatchedMerchant),
    /rejected or could not verify/
  );
});

test("records failed webhook processing and retries only after signature verification", async () => {
  const keydkaGudaha = new InMemoryPaymentTransactionStore();
  let fashilHalMar = true;
  const keydkaLacagaha = {
    save: (...args) => keydkaGudaha.save(...args),
    list: (...args) => keydkaGudaha.list(...args),
    findById: (...args) => keydkaGudaha.findById(...args),
    findPaymentById: (...args) => keydkaGudaha.findPaymentById(...args),
    findByReference: (...args) => keydkaGudaha.findByReference(...args),
    expireDue: (...args) => keydkaGudaha.expireDue(...args),
    async applyWebhookStatus(...args) {
      if (fashilHalMar) {
        fashilHalMar = false;
        throw new Error("storage-secret-must-not-leak");
      }
      return keydkaGudaha.applyWebhookStatus(...args);
    }
  };
  let tiradaXaqiijinta = 0;
  const sdk = new IskuBixi({
    bixiyeyaasha: { edahab: bixiyeLaQaabeeyay },
    laqabsadayaasha: {
      edahab: sameeLaqabsadeTijaabo("recoverable-webhook")
    },
    laqabsadayaashaWebhook: {
      edahab: {
        async verifyAndParse({ headers }) {
          tiradaXaqiijinta += 1;
          if (headers["x-test-signature"] !== "valid") {
            throw new Error("invalid signature");
          }
          return {
            bixiye: "edahab",
            dhacdoId: "recoverable-event",
            xaalad: "guuleystay",
            lacagId: headers["x-payment-id"]
          };
        }
      }
    },
    keydkaLacagaha
  });
  const lacag = await sdk.lacag.samee(codsiLacag());
  const codsi = {
    bixiye: "edahab",
    rawBody: Buffer.from('{"event":"payment"}'),
    headers: {
      "x-test-signature": "valid",
      "x-payment-id": lacag.id
    }
  };

  await assert.rejects(
    sdk.webhook.kaShaqee(codsi),
    (error) =>
      error instanceof StorageError &&
      error.code === "ISKUBIXI_STORAGE_ERROR" &&
      !error.message.includes("storage-secret")
  );
  const fashilmay = await sdk.webhook.fashilmay({ bixiye: "edahab" });
  assert.equal(fashilmay.length, 1);
  assert.equal(fashilmay[0].xaalad, "fashilmay");
  assert.equal(fashilmay[0].iskuDayo, 1);
  assert.equal(fashilmay[0].fashil, "Webhook event processing failed.");
  assert.equal(JSON.stringify(fashilmay).includes("storage-secret"), false);
  assert.equal("codsi" in fashilmay[0], false);

  await assert.rejects(
    sdk.webhook.dibUshaqee({
      bixiye: "edahab",
      dhacdoId: "recoverable-event",
      codsi: {
        ...codsi,
        headers: { ...codsi.headers, "x-test-signature": "invalid" }
      }
    }),
    /rejected or could not verify/
  );
  assert.equal((await sdk.webhook.fashilmay()).length, 1);

  const laSooCeliyay = await sdk.webhook.dibUshaqee({
    bixiye: "edahab",
    dhacdoId: "recoverable-event"
  });
  assert.equal(laSooCeliyay.xaalad, "guuleystay");
  assert.equal(laSooCeliyay.horeLooShaqeeyay, false);
  assert.equal(tiradaXaqiijinta, 3);
  assert.equal((await sdk.webhook.fashilmay()).length, 0);
});

test("coalesces concurrent retries after a recorded webhook failure", async () => {
  const store = new InMemoryWebhookEventStore();
  const request = {
    bixiye: "edahab",
    rawBody: Buffer.from("{}"),
    headers: {}
  };
  await assert.rejects(
    store.processOnce("edahab", "retry-race", "same-fingerprint", async () => {
      throw new Error("temporary failure");
    }, request),
    /temporary failure/
  );

  let siiWad;
  const bilowday = new Promise((resolve) => {
    siiWad = resolve;
  });
  let siiDay;
  const albaab = new Promise((resolve) => {
    siiDay = resolve;
  });
  const retry = () => store.processOnce(
    "edahab",
    "retry-race",
    "same-fingerprint",
    async () => {
      siiWad();
      await albaab;
    },
    request
  );
  const retries = [retry(), retry()];
  await bilowday;
  assert.equal(
    (await store.get("edahab", "retry-race")).xaalad,
    "laShaqeynayo"
  );
  siiDay();
  const natiijooyin = await Promise.all(retries);

  assert.deepEqual(
    natiijooyin.map((natiijo) => natiijo.horeLooShaqeeyay).sort(),
    [false, true]
  );
  const record = await store.get("edahab", "retry-race");
  assert.equal(record.xaalad, "guuleystay");
  assert.equal(record.iskuDayo, 2);
});

test("keeps recovery optional for legacy webhook event stores", async () => {
  const sdk = sameeWebhookSdk({
    keydkaWebhook: {
      async processOnce() {
        return { horeLooShaqeeyay: false };
      }
    }
  });

  await assert.rejects(
    sdk.webhook.fashilmay(),
    /does not support failed-event inspection or retry/
  );
  await assert.rejects(
    sdk.webhook.dibUshaqee({
      bixiye: "waafipay",
      dhacdoId: "unknown-event"
    }),
    /does not support failed-event inspection or retry/
  );
});
