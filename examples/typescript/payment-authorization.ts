// LOCAL DEMO ONLY: the authenticator and default payment provider below are
// simulations. Replace both with trusted application-owned integrations.
import { randomBytes, randomUUID } from "node:crypto";
import {
  InMemoryAmaanoodAuthenticationSessionStore,
  InMemoryPaymentAuthorizationStore,
  IskuBixi,
  IskuBixiError,
  UnsupportedOperationError,
  type AmaanoodLaqabsade,
  type IskuBixiQaabeyn,
  type NatiijoOgolaanshoAbuur,
  type NatiijoOgolaanshoXaqiiji,
  type NatiijoOgolaanshoXaalad,
  type NatiijoXaqiijin
} from "../..";

interface DemoSession {
  userId: string;
  method: "waji" | "faraha" | "isha" | "calaacal";
  paymentBinding: string;
  challenge: string;
}

const demoSessions = new Map<string, DemoSession>();

const demoAuthenticationAdapter: AmaanoodLaqabsade = {
  id: "local-demo-only",
  supportedMethods: ["waji"],
  supportsPaymentAuthorization: true,
  async start({ userId, method, paymentBinding }) {
    if (!paymentBinding) {
      throw new Error("A payment-binding digest is required.");
    }
    const adapterSessionId = `demo-${randomUUID()}`;
    const challenge = randomBytes(32).toString("base64url");
    demoSessions.set(adapterSessionId, {
      userId,
      method,
      paymentBinding,
      challenge
    });
    return {
      options: { challenge, userVerification: "required", demoOnly: true },
      adapterSessionId,
      expiresAt: Date.now() + 60_000
    };
  },
  async verify({ userId, method, adapterSessionId, response, paymentBinding }) {
    const session = demoSessions.get(adapterSessionId);
    demoSessions.delete(adapterSessionId);
    const reply =
      typeof response === "object" && response !== null && !Array.isArray(response)
        ? response as { demoOnly?: unknown; challenge?: unknown }
        : undefined;
    const valid =
      session !== undefined &&
      session.userId === userId &&
      session.method === method &&
      session.paymentBinding === paymentBinding &&
      reply?.demoOnly === true &&
      reply.challenge === session.challenge;
    return {
      authenticated: Boolean(valid),
      userVerified: Boolean(valid),
      verifiedMethod: valid ? method : undefined
    };
  }
};

const configuration: IskuBixiQaabeyn = {
  bixiyeyaasha: {
    // The SDK's default provider is simulated; this value does not connect to eDahab.
    edahab: {
      apiKey: process.env.EDAHAB_API_KEY ?? "local-demo-not-a-secret"
    }
  },
  amaanood: {
    laqabsadayaal: [demoAuthenticationAdapter],
    keydkaKulamada: new InMemoryAmaanoodAuthenticationSessionStore()
  },
  keydkaOgolaanshaha: new InMemoryPaymentAuthorizationStore()
};

export const iskubixi = new IskuBixi(configuration);

export async function beginPaymentAuthorization(
  authenticatedUserId: string,
  order: { amount: number; currency: string; reference: string }
): Promise<NatiijoOgolaanshoAbuur> {
  // In a server route, get authenticatedUserId from the server session.
  return iskubixi.lacag.ogolaanshoAbuur({
    userId: authenticatedUserId,
    lacag: {
      qadarka: order.amount,
      lacagta: order.currency,
      bixiye: "edahab",
      tixraac: order.reference
    },
    hab: "waji"
  });
}

export async function completePaymentAuthorization(
  authenticatedUserId: string,
  authorization: NatiijoOgolaanshoAbuur
): Promise<NatiijoOgolaanshoXaqiiji> {
  // This response is fabricated solely for the explicitly mocked local demo.
  const response = {
    demoOnly: true,
    challenge: authorization.authenticationOptions.challenge
  };
  return iskubixi.lacag.ogolaanshoXaqiiji({
    userId: authenticatedUserId,
    authorizationId: authorization.authorizationId,
    response
  });
}

export function getAuthorizationStatus(
  authenticatedUserId: string,
  authorizationId: string
): Promise<NatiijoOgolaanshoXaalad> {
  return iskubixi.lacag.ogolaanshoXaalad({
    userId: authenticatedUserId,
    authorizationId
  });
}

export function checkPaymentWithProvider(
  paymentId: string
): Promise<NatiijoXaqiijin> {
  return iskubixi.lacag.cadee({ lacagId: paymentId });
}

export function reportSdkError(error: unknown): void {
  if (error instanceof UnsupportedOperationError) {
    console.error("The configured authentication method is unsupported.");
    return;
  }
  if (error instanceof IskuBixiError) {
    console.error(error.code, error.message);
    return;
  }
  throw error;
}
