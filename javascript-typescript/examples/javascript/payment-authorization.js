"use strict";

// LOCAL DEMO ONLY: both the authenticator and the default payment provider
// are simulations. Do not deploy this mock adapter or treat it as biometrics.
const {
  InMemoryAmaanoodAuthenticationSessionStore,
  InMemoryPaymentAuthorizationStore,
  IskuBixi,
  IskuBixiError,
  UnsupportedOperationError
} = require("../..");
const { randomBytes, randomUUID } = require("node:crypto");

function createDemoAuthenticationAdapter() {
  const sessions = new Map();

  return {
    id: "local-demo-only",
    supportedMethods: ["waji"],
    supportsPaymentAuthorization: true,
    async start({ userId, method, paymentBinding }) {
      if (!paymentBinding) {
        throw new Error("A payment-binding digest is required.");
      }

      const challenge = randomBytes(32).toString("base64url");
      const adapterSessionId = randomUUID();
      sessions.set(adapterSessionId, { userId, method, paymentBinding, challenge });

      return {
        options: {
          challenge,
          userVerification: "required",
          demoOnly: true
        },
        adapterSessionId,
        expiresAt: Date.now() + 60_000
      };
    },
    async verify({ userId, method, adapterSessionId, response, paymentBinding }) {
      const session = sessions.get(adapterSessionId);
      sessions.delete(adapterSessionId);

      const valid =
        session &&
        session.userId === userId &&
        session.method === method &&
        session.paymentBinding === paymentBinding &&
        response &&
        response.demoOnly === true &&
        response.challenge === session.challenge;

      return {
        authenticated: Boolean(valid),
        userVerified: Boolean(valid),
        verifiedMethod: valid ? method : undefined
      };
    }
  };
}

const iskubixi = new IskuBixi({
  allowSimulation: true,
  bixiyeyaasha: {
    // The SDK's default provider is simulated. This value does not connect to eDahab.
    edahab: { apiKey: process.env.EDAHAB_API_KEY || "local-demo-not-a-secret" }
  },
  amaanood: {
    laqabsadayaal: [createDemoAuthenticationAdapter()],
    keydkaKulamada: new InMemoryAmaanoodAuthenticationSessionStore()
  },
  keydkaOgolaanshaha: new InMemoryPaymentAuthorizationStore()
});

async function beginPaymentAuthorization(userId, order) {
  // Call this only after the backend has authenticated userId and loaded order.
  return iskubixi.lacag.ogolaanshoAbuur({
    userId,
    lacag: {
      qadarka: order.amount,
      lacagta: order.currency,
      bixiye: "edahab",
      tixraac: order.reference
    },
    hab: "waji"
  });
}

async function verifyAuthenticationResponse(userId, authorizationId, response) {
  return iskubixi.lacag.ogolaanshoXaqiiji({
    userId,
    authorizationId,
    response
  });
}

async function completePaymentAuthorization(userId, authorization) {
  // This response is intentionally fabricated to exercise the mock adapter.
  const response = {
    demoOnly: true,
    challenge: authorization.authenticationOptions.challenge
  };
  return verifyAuthenticationResponse(userId, authorization.authorizationId, response);
}

async function handleBeginRequest(request, response, loadOrder) {
  const userId = request.authenticatedUser.id;
  const order = await loadOrder(request.params.orderId, userId);
  const authorization = await beginPaymentAuthorization(userId, order);
  response.json(authorization);
}

async function handleVerifyRequest(request, response) {
  const userId = request.authenticatedUser.id;
  const result = await verifyAuthenticationResponse(
    userId,
    request.body.authorizationId,
    request.body.authenticationResponse
  );
  response.json(result);
}

async function getAuthorizationStatus(userId, authorizationId) {
  return iskubixi.lacag.ogolaanshoXaalad({ userId, authorizationId });
}

async function checkPaymentWithProvider(paymentId) {
  return iskubixi.lacag.cadee({ lacagId: paymentId });
}

async function runLocalDemo() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The local demo must not run in production.");
  }

  const userId = "local-demo-customer";
  const authorization = await beginPaymentAuthorization(userId, {
    amount: 25,
    currency: "USD",
    reference: "LOCAL-DEMO-ORDER-1"
  });
  console.log("Review this simulated payment summary:", authorization.lacag);
  const result = await completePaymentAuthorization(userId, authorization);
  console.log("Authorization result:", result.xaalad);

  if (result.payment) {
    const verification = await checkPaymentWithProvider(result.payment.id);
    console.log("Simulated payment status:", verification.xaalad);
    console.log("Verification source:", verification.xaqiijin);
  }

  console.log(
    "Authorization status:",
    await getAuthorizationStatus(userId, authorization.authorizationId)
  );
}

module.exports = {
  iskubixi,
  beginPaymentAuthorization,
  verifyAuthenticationResponse,
  completePaymentAuthorization,
  handleBeginRequest,
  handleVerifyRequest,
  getAuthorizationStatus,
  checkPaymentWithProvider,
  runLocalDemo,
  UnsupportedOperationError,
  IskuBixiError
};

if (process.env.RUN_LOCAL_DEMO === "1") {
  runLocalDemo().catch((error) => {
    if (error instanceof UnsupportedOperationError) {
      console.error("The configured authentication method is unsupported.");
    } else if (error instanceof IskuBixiError) {
      console.error(error.code, error.message);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  });
}
