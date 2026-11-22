const test = require("node:test");
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { createServer } = require("node:http");
const Stripe = require("stripe");
const {
  IskuBixi,
  PayPalPaymentProvider,
  PayPalPaymentProviderFactory,
  PayPalWebhookAdapter,
  StripePaymentProvider,
  StripePaymentProviderFactory,
  StripeWebhookAdapter,
  ConfigurationError,
  ProviderError,
  ValidationError,
  WebhookVerificationError
} = require("..");

const paypalCredentials = {
  clientId: "paypal-client-fixture",
  clientSecret: "paypal-secret-fixture"
};
const stripeCredentials = { apiKey: "sk_test_fixture_key" };

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function paypalOrder(status, overrides = {}) {
  return {
    id: "ORDER-PAYPAL-1",
    status,
    purchase_units: [{
      reference_id: "ORDER-2",
      amount: { currency_code: "USD", value: "12.50" },
      ...(status === "COMPLETED"
        ? { payments: { captures: [{
          id: "CAPTURE-1",
          status: "COMPLETED"
        }] } }
        : {})
    }],
    links: [{ rel: "approve", href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-PAYPAL-1" }],
    ...overrides
  };
}

function paypalFetchMock() {
  const calls = [];
  let orderStatus = "CREATED";
  let captureStatus = "COMPLETED";
  let refundStatus = "PENDING";
  const fetch = async (url, init) => {
    const parsedUrl = new URL(String(url));
    const body = typeof init.body === "string" &&
      init.headers["content-type"] === "application/json"
      ? JSON.parse(init.body)
      : init.body;
    calls.push({ path: parsedUrl.pathname, method: init.method, headers: init.headers, body });
    if (parsedUrl.pathname.endsWith("/v1/oauth2/token")) {
      return jsonResponse({ access_token: "oauth-access-token", expires_in: 3600 });
    }
    if (parsedUrl.pathname === "/v2/checkout/orders" && init.method === "POST") {
      return jsonResponse(paypalOrder("CREATED", {
        purchase_units: [{
          reference_id: body.purchase_units[0].reference_id,
          amount: body.purchase_units[0].amount
        }]
      }), 201);
    }
    if (parsedUrl.pathname.endsWith("/capture") && init.method === "POST") {
      orderStatus = "COMPLETED";
      const order = paypalOrder("COMPLETED");
      order.purchase_units[0].payments.captures[0].status = captureStatus;
      return jsonResponse(order);
    }
    if (parsedUrl.pathname.endsWith("/refund") && init.method === "POST") {
      return jsonResponse({ id: "REFUND-1", status: refundStatus }, 201);
    }
    if (parsedUrl.pathname.endsWith("/REFUND-1")) {
      return jsonResponse({ id: "REFUND-1", status: refundStatus });
    }
    if (parsedUrl.pathname.endsWith("/ORDER-PAYPAL-1")) {
      const order = paypalOrder(orderStatus);
      if (orderStatus === "COMPLETED") {
        order.purchase_units[0].payments.captures[0].status = captureStatus;
      }
      return jsonResponse(order);
    }
    if (parsedUrl.pathname.endsWith("/verify-webhook-signature")) {
      return jsonResponse({ verification_status: "SUCCESS" });
    }
    return jsonResponse({ name: "RESOURCE_NOT_FOUND" }, 404);
  };
  return {
    calls,
    fetch,
    setCaptureStatus: (value) => { captureStatus = value; },
    setRefundStatus: (value) => { refundStatus = value; }
  };
}

function paypalProvider(fetch, overrides = {}) {
  return new PayPalPaymentProvider(paypalCredentials, {
    environment: "sandbox",
    fetch,
    ...overrides
  });
}

test("unavailable real providers cannot silently use the simulator", () => {
  for (const provider of ["edahab", "evc", "zaad", "bank"]) {
    assert.throws(
      () => new IskuBixi({
        bixiyeyaasha: {
          [provider]: { apiKey: "not-a-real-provider-adapter", environment: "live" }
        }
      }),
      ConfigurationError
    );
  }
  assert.throws(
    () => new StripePaymentProvider({ apiKey: "sk_live_fixture" }, { environment: "test" }),
    ConfigurationError
  );
  assert.throws(
    () => new StripePaymentProvider({ apiKey: "sk_test_fixture" }, { environment: "live" }),
    ConfigurationError
  );
});

test("PayPal creates an approval order without treating it as paid, then captures/refunds it", async () => {
  const mock = paypalFetchMock();
  const provider = paypalProvider(mock.fetch);
  const created = await provider.createPayment({
    amount: 12.5,
    currency: "USD",
    reference: "ORDER-2",
    idempotencyKey: "paypal-create-key"
  });
  assert.equal(created.status, "sugaya");
  assert.equal(created.providerStatus, "CREATED");
  assert.equal(created.nextAction.type, "redirect");
  assert.equal(mock.calls[0].path, "/v1/oauth2/token");
  assert.deepEqual(mock.calls[1].body, {
    intent: "CAPTURE",
    purchase_units: [{
      reference_id: "ORDER-2",
      amount: { currency_code: "USD", value: "12.50" }
    }]
  });
  assert.match(mock.calls[1].headers["PayPal-Request-Id"], /^[a-f0-9]{32}$/);

  assert.equal((await provider.findPayment({ paymentId: created.id })).status, "sugaya");
  assert.equal((await provider.verifyPayment({ paymentId: created.id })).exists, true);
  const captured = await provider.confirmPayment({
    paymentId: created.id,
    idempotencyKey: "paypal-capture-key"
  });
  assert.equal(captured.status, "guuleystay");
  assert.equal(captured.providerStatus, "COMPLETED");
  mock.setRefundStatus("PENDING");
  assert.deepEqual(await provider.refundPayment({
    paymentId: created.id,
    idempotencyKey: "paypal-refund-key"
  }), { id: "REFUND-1", status: "sugaya" });
  mock.setRefundStatus("COMPLETED");
  assert.deepEqual(await provider.findRefundStatus({
    paymentId: created.id,
    refundId: "REFUND-1"
  }), { id: "REFUND-1", status: "guuleystay" });

  assert.equal(
    mock.calls.filter((call) => call.path === "/v1/oauth2/token").length,
    1
  );
  assert.equal(mock.calls[4].headers["PayPal-Request-Id"].length, 32);
  assert.equal(mock.calls[6].path, "/v2/payments/captures/CAPTURE-1/refund");
  assert.deepEqual(mock.calls[6].body, {});
});

test("PayPal maps pending and declined captures and rejects malformed provider data", async () => {
  const mock = paypalFetchMock();
  const provider = paypalProvider(mock.fetch);
  await provider.createPayment({
    amount: 12.5, currency: "USD", reference: "ORDER-2"
  });

  mock.setCaptureStatus("PENDING");
  const pending = await provider.confirmPayment({
    paymentId: "ORDER-PAYPAL-1",
    idempotencyKey: "capture-pending"
  });
  assert.equal(pending.status, "sugaya");
  assert.equal(pending.providerStatus, "PENDING");

  mock.setCaptureStatus("DECLINED");
  const declined = await provider.findPayment({ paymentId: "ORDER-PAYPAL-1" });
  assert.equal(declined.status, "fashilmay");

  const malformed = paypalProvider(async (url) => {
    if (String(url).endsWith("/v1/oauth2/token")) {
      return jsonResponse({ access_token: "token", expires_in: 3600 });
    }
    return jsonResponse({ id: "bad-order", status: "CREATED" });
  });
  await assert.rejects(malformed.createPayment({
    amount: 12.5, currency: "USD", reference: "ORDER-2"
  }), ProviderError);
});

test("PayPal rejects confirmation without a usable idempotency key and sanitizes transport failures", async () => {
  let requestCount = 0;
  const provider = paypalProvider(async () => {
    requestCount += 1;
    throw new Error(`network includes ${paypalCredentials.clientSecret}`);
  });
  await assert.rejects(provider.findPayment({ paymentId: "ORDER-PAYPAL-1" }), (error) => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.message.includes(paypalCredentials.clientSecret), false);
    assert.equal(JSON.stringify(error).includes(paypalCredentials.clientSecret), false);
    return true;
  });
  assert.equal(requestCount, 1);

  const timedOut = paypalProvider((_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () =>
      reject(new Error(paypalCredentials.clientSecret))
    );
  }), { timeoutMs: 5 });
  await assert.rejects(timedOut.findPayment({ paymentId: "ORDER-PAYPAL-1" }), (error) => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.message.includes(paypalCredentials.clientSecret), false);
    return true;
  });
});

test("PayPal verifies webhooks with its official remote signature endpoint", async () => {
  const mock = paypalFetchMock();
  const adapter = new PayPalWebhookAdapter(paypalCredentials, {
    environment: "sandbox",
    webhookId: "WH-FIXTURE",
    fetch: mock.fetch
  });
  const payload = {
    id: "WH-EVENT-1",
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: {
      amount: { currency_code: "USD", value: "12.50" },
      supplementary_data: { related_ids: { order_id: "ORDER-PAYPAL-1" } }
    }
  };
  const rawBody = Buffer.from(JSON.stringify(payload));
  const event = await adapter.verifyAndParse({
    bixiye: "paypal",
    rawBody,
    headers: {
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-ID",
      "paypal-transmission-id": "transmission-id",
      "paypal-transmission-sig": "signature",
      "paypal-transmission-time": new Date().toISOString()
    }
  });
  assert.deepEqual(event, {
    bixiye: "paypal",
    dhacdoId: "WH-EVENT-1",
    xaalad: "guuleystay",
    lacagId: "ORDER-PAYPAL-1",
    qadarka: 12.5,
    lacagta: "USD"
  });
  const verificationCall = mock.calls.find((call) =>
    call.path.endsWith("/verify-webhook-signature")
  );
  assert.equal(verificationCall.body.webhook_id, "WH-FIXTURE");
  assert.equal(verificationCall.body.webhook_event.id, "WH-EVENT-1");

  await assert.rejects(adapter.verifyAndParse({
    bixiye: "paypal",
    rawBody,
    headers: {
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://attacker.example/cert",
      "paypal-transmission-id": "transmission-id",
      "paypal-transmission-sig": "signature",
      "paypal-transmission-time": new Date().toISOString()
    }
  }), WebhookVerificationError);
});

function stripeIntent(overrides = {}) {
  return {
    id: "pi_fixture",
    object: "payment_intent",
    amount: 1250,
    amount_received: 0,
    currency: "usd",
    status: "requires_payment_method",
    client_secret: "pi_fixture_secret_client_safe",
    metadata: { iskubixi_reference: "ORDER-3" },
    last_payment_error: null,
    canceled_at: null,
    created: 1,
    capture_method: "automatic",
    confirmation_method: "automatic",
    livemode: false,
    payment_method: null,
    ...overrides
  };
}

async function stripeMock(handler) {
  const requests = [];
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", async () => {
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const entry = {
        method: request.method,
        path: request.url,
        headers: request.headers,
        body: new URLSearchParams(rawBody)
      };
      requests.push(entry);
      try {
        const result = await handler(entry);
        if (result.networkError) {
          response.destroy();
          return;
        }
        response.writeHead(result.status ?? 200, {
          "content-type": "application/json"
        });
        response.end(JSON.stringify(result.body));
      } catch {
        response.writeHead(500);
        response.end("{}");
      }
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    requests,
    apiBaseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.closeAllConnections();
      server.close((error) => error ? reject(error) : resolve());
    })
  };
}

test("Stripe PaymentIntents use minor units, preserve provider states, capture, cancel and refund", async () => {
  const mock = await stripeMock((request) => {
    if (request.path === "/v1/payment_intents" && request.method === "POST") {
      return { body: stripeIntent({
        amount: Number(request.body.get("amount")),
        currency: request.body.get("currency"),
        metadata: { iskubixi_reference: request.body.get("metadata[iskubixi_reference]") }
      }) };
    }
    if (request.path.endsWith("/confirm")) {
      return { body: stripeIntent({
        status: "succeeded",
        amount_received: 1250,
        client_secret: "pi_fixture_secret_client_safe"
      }) };
    }
    if (request.path.endsWith("/cancel")) {
      return { body: stripeIntent({ status: "canceled", client_secret: null }) };
    }
    if (request.path === "/v1/refunds" && request.method === "POST") {
      return { body: { id: "re_fixture", object: "refund", status: "pending" } };
    }
    if (request.path === "/v1/refunds/re_fixture") {
      return { body: { id: "re_fixture", object: "refund", status: "succeeded" } };
    }
    if (request.path === "/v1/payment_intents/pi_fixture") {
      return { body: stripeIntent({ status: "processing" }) };
    }
    return { status: 404, body: { error: { code: "resource_missing" } } };
  });
  try {
    const provider = new StripePaymentProvider(stripeCredentials, {
      apiBaseUrl: mock.apiBaseUrl,
      timeoutMs: 1000
    });
    const created = await provider.createPayment({
      amount: 12.5,
      currency: "USD",
      reference: "ORDER-3",
      idempotencyKey: "stripe-create-key"
    });
    assert.equal(created.amount, 12.5);
    assert.equal(created.status, "sugaya");
    assert.equal(created.providerStatus, "requires_payment_method");
    assert.deepEqual(created.nextAction, {
      type: "client_secret",
      clientSecret: "pi_fixture_secret_client_safe"
    });
    assert.equal(mock.requests[0].body.get("amount"), "1250");
    assert.equal(mock.requests[0].headers["idempotency-key"], "stripe-create-key");

    assert.equal((await provider.findPayment({ paymentId: "pi_fixture" })).providerStatus, "processing");
    assert.equal((await provider.verifyPayment({ paymentId: "pi_fixture" })).exists, true);
    assert.equal((await provider.confirmPayment({
      paymentId: "pi_fixture",
      idempotencyKey: "stripe-confirm-key"
    })).status, "guuleystay");
    await provider.cancelPayment({ paymentId: "pi_fixture" });
    assert.deepEqual(await provider.refundPayment({
      paymentId: "pi_fixture",
      idempotencyKey: "stripe-refund-key"
    }), { id: "re_fixture", status: "sugaya" });
    assert.deepEqual(await provider.findRefundStatus({
      paymentId: "pi_fixture",
      refundId: "re_fixture"
    }), { id: "re_fixture", status: "guuleystay" });
    const confirmRequest = mock.requests.find((request) =>
      request.path.endsWith("/confirm")
    );
    const refundRequest = mock.requests.find((request) =>
      request.path === "/v1/refunds"
    );
    assert.equal(confirmRequest.path, "/v1/payment_intents/pi_fixture/confirm");
    assert.equal(confirmRequest.headers["idempotency-key"], "stripe-confirm-key");
    assert.equal(refundRequest.body.get("payment_intent"), "pi_fixture");
    assert.equal(refundRequest.headers["idempotency-key"], "stripe-refund-key");
  } finally {
    await mock.close();
  }
});

test("Stripe declines are not reported as successes and malformed inputs are rejected", async () => {
  const mock = await stripeMock((request) => ({
    body: stripeIntent({
      amount: Number(request.body.get("amount")),
      currency: request.body.get("currency"),
      status: "requires_payment_method",
      last_payment_error: {
        type: "card_error",
        code: "card_declined",
        message: "declined"
      },
      metadata: { iskubixi_reference: request.body.get("metadata[iskubixi_reference]") }
    })
  }));
  try {
    const provider = new StripePaymentProvider(stripeCredentials, {
      apiBaseUrl: mock.apiBaseUrl
    });
    const declined = await provider.createPayment({
      amount: 12.5,
      currency: "USD",
      reference: "ORDER-3"
    });
    assert.equal(declined.status, "fashilmay");
    assert.equal(declined.providerStatus, "requires_payment_method");
    assert.equal(declined.nextAction, undefined);
    await assert.rejects(provider.createPayment({
      amount: 12.555,
      currency: "USD",
      reference: "ORDER-3"
    }), ValidationError);
  } finally {
    await mock.close();
  }
});

test("Stripe applies its ISK and UGX charge conventions and rejects malformed intents", async () => {
  const mock = await stripeMock((request) => ({
    body: stripeIntent({
      amount: Number(request.body.get("amount")),
      currency: request.body.get("currency"),
      metadata: { iskubixi_reference: request.body.get("metadata[iskubixi_reference]") }
    })
  }));
  try {
    const provider = new StripePaymentProvider(stripeCredentials, {
      apiBaseUrl: mock.apiBaseUrl
    });
    const payment = await provider.createPayment({
      amount: 5,
      currency: "ISK",
      reference: "ISK-ORDER"
    });
    assert.equal(mock.requests[0].body.get("amount"), "500");
    assert.equal(payment.amount, 5);
    await assert.rejects(provider.createPayment({
      amount: 5.5,
      currency: "UGX",
      reference: "UGX-ORDER"
    }), ValidationError);
  } finally {
    await mock.close();
  }

  const malformedMock = await stripeMock(() => ({ body: { id: "pi_missing" } }));
  try {
    const provider = new StripePaymentProvider(stripeCredentials, {
      apiBaseUrl: malformedMock.apiBaseUrl
    });
    await assert.rejects(provider.createPayment({
      amount: 12.5,
      currency: "USD",
      reference: "ORDER-3"
    }), ProviderError);
  } finally {
    await malformedMock.close();
  }
});

test("Stripe reports timed-out and dropped network requests with sanitized errors", async () => {
  for (const handler of [
    () => new Promise(() => {}),
    () => ({ networkError: true })
  ]) {
    const mock = await stripeMock(handler);
    try {
      const provider = new StripePaymentProvider(stripeCredentials, {
        apiBaseUrl: mock.apiBaseUrl,
        timeoutMs: 20
      });
      await assert.rejects(provider.createPayment({
        amount: 12.5,
        currency: "USD",
        reference: "ORDER-3"
      }), (error) => {
        assert.ok(error instanceof ProviderError);
        assert.equal(error.message.includes(stripeCredentials.apiKey), false);
        return true;
      });
    } finally {
      await mock.close();
    }
  }
});

test("Stripe sanitizes errors and verifies signed raw-body webhooks", async () => {
  const mock = await stripeMock(() => ({
    status: 500,
    body: { error: { message: stripeCredentials.apiKey } }
  }));
  try {
    const provider = new StripePaymentProvider(stripeCredentials, {
      apiBaseUrl: mock.apiBaseUrl
    });
    await assert.rejects(provider.createPayment({
      amount: 12.5, currency: "USD", reference: "ORDER-3"
    }), (error) => {
      assert.ok(error instanceof ProviderError);
      assert.equal(error.message.includes(stripeCredentials.apiKey), false);
      assert.equal(JSON.stringify(error).includes(stripeCredentials.apiKey), false);
      return true;
    });
  } finally {
    await mock.close();
  }

  const secret = "whsec_fixture_secret";
  const signingClient = new Stripe(stripeCredentials.apiKey);
  const payload = JSON.stringify({
    id: "evt_fixture",
    object: "event",
    api_version: "2025-03-31.basil",
    created: Math.floor(Date.now() / 1000),
    data: { object: stripeIntent({ status: "succeeded", amount_received: 1250 }) },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "payment_intent.succeeded"
  });
  const signature = signingClient.webhooks.generateTestHeaderString({
    payload,
    secret
  });
  const adapter = new StripeWebhookAdapter({ secret });
  assert.deepEqual(await adapter.verifyAndParse({
    bixiye: "stripe",
    rawBody: Buffer.from(payload),
    headers: { "Stripe-Signature": signature }
  }), {
    bixiye: "stripe",
    dhacdoId: "evt_fixture",
    xaalad: "guuleystay",
    lacagId: "pi_fixture",
    tixraac: "ORDER-3",
    qadarka: 12.5,
    lacagta: "USD"
  });
  await assert.rejects(adapter.verifyAndParse({
    bixiye: "stripe",
    rawBody: Buffer.from(payload),
    headers: { "Stripe-Signature": "t=1,v1=invalid" }
  }), WebhookVerificationError);
});

test("Stripe and PayPal built-in factories are not replaced with the simulator", async () => {
  assert.throws(
    () => new IskuBixi({ bixiyeyaasha: { stripe: stripeCredentials } }),
    ConfigurationError
  );
  assert.throws(
    () => new IskuBixi({ bixiyeyaasha: { paypal: paypalCredentials } }),
    ConfigurationError
  );
  const sdk = new IskuBixi({
    bixiyeyaasha: { stripe: stripeCredentials },
    laqabsadayaasha: {
      stripe: new StripePaymentProviderFactory({
        apiBaseUrl: "http://127.0.0.1:32123"
      })
    }
  });

  test("IskuBixi selects Stripe explicitly, exposes confirmation actions, and confirms by ID", async () => {
    const mock = await stripeMock((request) => {
      const reference = request.body.get("metadata[iskubixi_reference]") ?? "ORDER-4";
      if (request.path.endsWith("/confirm")) {
        return {
          body: stripeIntent({
            status: "succeeded",
            amount_received: 1250,
            metadata: { iskubixi_reference: "ORDER-4" }
          })
        };
      }
      if (request.method === "GET") {
        return {
          body: stripeIntent({
            status: "requires_payment_method",
            metadata: { iskubixi_reference: "ORDER-4" }
          })
        };
      }
      return {
        body: stripeIntent({
          amount: Number(request.body.get("amount")),
          currency: request.body.get("currency"),
          metadata: { iskubixi_reference: reference }
        })
      };
    });
    try {
      const sdk = new IskuBixi({
        bixiyeyaasha: { stripe: stripeCredentials },
        laqabsadayaasha: {
          stripe: new StripePaymentProviderFactory({
            apiBaseUrl: mock.apiBaseUrl
          })
        }
      });
      const payment = await sdk.lacag.samee({
        qadarka: 12.5,
        lacagta: "USD",
        bixiye: "stripe",
        tixraac: "ORDER-4",
        furahaIdempotency: "order-4-create"
      });
      assert.equal(payment.xaalad, "sugaya");
      assert.deepEqual(payment.nextAction, {
        type: "client_secret",
        clientSecret: "pi_fixture_secret_client_safe"
      });
      const confirmation = await sdk.lacag.qabso({
        lacagId: payment.id,
        furahaIdempotency: "order-4-confirm"
      });
      assert.equal(confirmation.xaalad, "guuleystay");
      assert.equal(
        mock.requests.find((request) => request.path.endsWith("/confirm"))
          .headers["idempotency-key"].length,
        64
      );
    } finally {
      await mock.close();
    }
  });
  assert.equal(
    (await sdk.bixiye.awood({ bixiye: "stripe" })).awoodaha.paymentConfirmation,
    true
  );
});
