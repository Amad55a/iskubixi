/**
 * Browser-side example using the built-in WebAuthn browser APIs; no client
 * package is required. Serve this application over HTTPS (localhost is
 * permitted for local development).
 *
 * Important: WebAuthn does not report whether the authenticator used face,
 * fingerprint, PIN, or another method. The IskuBixi payment-authorization API
 * requires a trusted adapter that can prove the requested modality. A generic
 * WebAuthn adapter alone will not satisfy that requirement.
 */
interface PaymentSummary {
  qadarka: number;
  lacagta: string;
  bixiye: string;
  tixraac: string;
}

interface AuthorizationEnvelope {
  authorizationId: string;
  expiresAt: string;
  authenticationOptions: Record<string, unknown>;
  lacag: PaymentSummary;
}

interface JsonCredentialDescriptor {
  id: string;
  type: "public-key";
  transports?: AuthenticatorTransport[];
}

interface JsonRequestOptions {
  challenge: string;
  rpId?: string;
  timeout?: number;
  userVerification?: UserVerificationRequirement;
  allowCredentials?: JsonCredentialDescriptor[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUserVerificationRequirement(
  value: unknown
): value is UserVerificationRequirement {
  return value === "required" || value === "preferred" || value === "discouraged";
}

function isAuthenticatorTransport(value: unknown): value is AuthenticatorTransport {
  return (
    value === "ble" ||
    value === "cable" ||
    value === "hybrid" ||
    value === "internal" ||
    value === "nfc" ||
    value === "smart-card" ||
    value === "usb"
  );
}

function decodeBase64Url(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function encodeBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toRequestOptions(value: Record<string, unknown>): PublicKeyCredentialRequestOptions {
  if (
    typeof value.challenge !== "string" ||
    (value.rpId !== undefined && typeof value.rpId !== "string") ||
    (value.timeout !== undefined && typeof value.timeout !== "number") ||
    (value.userVerification !== undefined &&
      !isUserVerificationRequirement(value.userVerification))
  ) {
    throw new Error("The backend returned incomplete WebAuthn request options.");
  }

  const allowCredentials = value.allowCredentials;
  if (allowCredentials !== undefined && !Array.isArray(allowCredentials)) {
    throw new Error("The backend returned invalid allowed credentials.");
  }

  const parsedAllowCredentials: JsonCredentialDescriptor[] | undefined =
    Array.isArray(allowCredentials)
      ? allowCredentials.map((item) => {
          if (
            !isRecord(item) ||
            typeof item.id !== "string" ||
            item.type !== "public-key"
          ) {
            throw new Error("The backend returned invalid allowed credentials.");
          }
          const transports = item.transports;
          if (
            transports !== undefined &&
            (!Array.isArray(transports) ||
              !transports.every(isAuthenticatorTransport))
          ) {
            throw new Error("The backend returned invalid credential transports.");
          }
          return {
            id: item.id,
            type: "public-key",
            ...(transports === undefined ? {} : { transports })
          };
        })
      : undefined;
  const json: JsonRequestOptions = {
    challenge: value.challenge,
    ...(typeof value.rpId === "string" ? { rpId: value.rpId } : {}),
    ...(typeof value.timeout === "number" ? { timeout: value.timeout } : {}),
    ...(isUserVerificationRequirement(value.userVerification)
      ? { userVerification: value.userVerification }
      : {}),
    ...(parsedAllowCredentials === undefined
      ? {}
      : { allowCredentials: parsedAllowCredentials })
  };
  return {
    challenge: decodeBase64Url(json.challenge),
    ...(json.rpId === undefined ? {} : { rpId: json.rpId }),
    ...(json.timeout === undefined ? {} : { timeout: json.timeout }),
    ...(json.userVerification === undefined
      ? {}
      : { userVerification: json.userVerification }),
    ...(json.allowCredentials === undefined
      ? {}
      : {
          allowCredentials: json.allowCredentials.map((credential) => ({
            id: decodeBase64Url(credential.id),
            type: credential.type,
            ...(credential.transports === undefined
              ? {}
              : { transports: credential.transports })
          }))
        })
  };
}

function serializeAssertion(credential: PublicKeyCredential): Record<string, unknown> {
  if (!(credential.response instanceof AuthenticatorAssertionResponse)) {
    throw new Error("The authenticator did not return an assertion response.");
  }
  const response = credential.response;
  return {
    id: credential.id,
    rawId: encodeBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: encodeBase64Url(response.clientDataJSON),
      authenticatorData: encodeBase64Url(response.authenticatorData),
      signature: encodeBase64Url(response.signature),
      userHandle: response.userHandle === null
        ? null
        : encodeBase64Url(response.userHandle)
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment
  };
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...init?.headers },
    ...init
  });
  if (!response.ok) {
    throw new Error(`The application backend returned HTTP ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

export async function authorizeOrderPayment(
  display: (summary: PaymentSummary) => Promise<boolean>,
  showResult: (message: string) => void
): Promise<void> {
  try {
    // The backend derives the user and order, and chooses the method from its own policy.
    const authorization = await requestJson<AuthorizationEnvelope>(
      "/api/payment-authorizations",
      {
        method: "POST",
        body: JSON.stringify({ orderId: "ORDER-1001" })
      }
    );

    const approved = await display(authorization.lacag);
    if (!approved) {
      showResult("Payment authorization cancelled.");
      return;
    }

    if (!isRecord(authorization.authenticationOptions)) {
      throw new Error("The backend returned invalid authentication options.");
    }
    const credential = await navigator.credentials.get({
      publicKey: toRequestOptions(authorization.authenticationOptions)
    });
    if (!(credential instanceof PublicKeyCredential)) {
      throw new Error("The authenticator did not return a passkey assertion.");
    }

    const result = await requestJson<{ xaalad: string; payment?: { xaalad: string } }>(
      `/api/payment-authorizations/${encodeURIComponent(authorization.authorizationId)}/verify`,
      {
        method: "POST",
        body: JSON.stringify({ response: serializeAssertion(credential) })
      }
    );

    if (result.xaalad === "processing") {
      showResult(
        `Authorization accepted; payment status is ${result.payment?.xaalad ?? "pending"}.`
      );
    } else {
      showResult(`Authorization status: ${result.xaalad}.`);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      showResult("Authentication was cancelled or timed out.");
      return;
    }
    showResult(error instanceof Error ? error.message : "Authentication failed.");
  }
}
