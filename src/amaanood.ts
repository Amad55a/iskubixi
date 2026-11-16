import { createHash, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON
} from "@simplewebauthn/server";
import {
  ConfigurationError,
  StorageError,
  ValidationError,
  WebAuthnError
} from "./errors";
import {
  InMemoryAmaanoodChallengeStore,
  InMemoryAmaanoodCredentialStore,
  type AmaanoodChallenge,
  type AmaanoodChallengeStore,
  type AmaanoodCredential,
  type AmaanoodCredentialStore
} from "./providers/webauthn-store";

const challengeLifetimeMs = 5 * 60 * 1000;
const allowedTransports = new Set([
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb"
]);

export interface AmaanoodQaabeyn {
  rpId: string;
  rpName: string;
  origins: readonly string[];
  requireUserVerification?: boolean;
  keydkaLoolan?: AmaanoodChallengeStore;
  keydkaFuraha?: AmaanoodCredentialStore;
}

export interface CodsiFurahaAbuur {
  userId: string;
  userName: string;
  displayName?: string;
}

export interface CodsiAmaanood {
  userId: string;
}

export interface CodsiAmaanoodSaxiix extends CodsiAmaanood {
  /** Internal payment-authorization binding supplied by a trusted server adapter. */
  paymentBinding?: string;
}

export interface CodsiFurahaDiiwaangeli extends CodsiAmaanood {
  response: RegistrationResponseJSON;
}

export interface CodsiSaxiixXaqiiji extends CodsiAmaanood {
  response: AuthenticationResponseJSON;
  /** Must match the binding supplied when authentication options were created. */
  paymentBinding?: string;
}

export interface NatiijoFurahaDiiwaangeli {
  credentialId: string;
  userVerified: boolean;
}

export interface NatiijoSaxiix {
  authenticated: true;
  userId: string;
  credentialId: string;
  userVerified: boolean;
}

export interface FurahaDiiwaangashan {
  credentialId: string;
  createdAt: string;
  deviceType: AmaanoodCredential["deviceType"];
  backedUp: boolean;
  transports?: readonly NonNullable<AmaanoodCredential["transports"]>[number][];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateUserId(userId: unknown): asserts userId is string {
  if (
    typeof userId !== "string" ||
    userId.length === 0 ||
    userId.length > 256
  ) {
    throw new ValidationError("A valid application user ID is required.");
  }
}

function validateUserName(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 256) {
    throw new ValidationError(`${label} must be a non-empty string of at most 256 characters.`);
  }
}

function userHandle(userId: string): Buffer {
  return createHash("sha256")
    .update("iskubixi:webauthn:user:")
    .update(userId, "utf8")
    .digest();
}

function isValidRpId(rpId: unknown): rpId is string {
  if (
    typeof rpId !== "string" ||
    rpId.length === 0 ||
    rpId.length > 253 ||
    isIP(rpId) !== 0 ||
    !/^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?))*$/.test(rpId)
  ) {
    return false;
  }
  try {
    const parsed = new URL(`https://${rpId}`);
    return (
      parsed.hostname === rpId &&
      parsed.port === "" &&
      parsed.username === "" &&
      parsed.password === ""
    );
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: unknown): origin is string {
  if (typeof origin !== "string") {
    return false;
  }
  try {
    const parsed = new URL(origin);
    const localHttp =
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    return (
      parsed.origin === origin &&
      (parsed.protocol === "https:" || localHttp) &&
      parsed.username === "" &&
      parsed.password === ""
    );
  } catch {
    return false;
  }
}

function originMatchesRpId(origin: string, rpId: string): boolean {
  const hostname = new URL(origin).hostname;
  return hostname === rpId || hostname.endsWith(`.${rpId}`);
}

function validateStores(configuration: AmaanoodQaabeyn): void {
  const challengeStore = configuration.keydkaLoolan;
  if (
    challengeStore !== undefined &&
    (!isRecord(challengeStore) ||
      typeof challengeStore.create !== "function" ||
      typeof challengeStore.consume !== "function")
  ) {
    throw new ConfigurationError("Passkey challenge storage must implement create and consume.");
  }

  const credentialStore = configuration.keydkaFuraha;
  if (
    credentialStore !== undefined &&
    (!isRecord(credentialStore) ||
      typeof credentialStore.create !== "function" ||
      typeof credentialStore.findByCredentialId !== "function" ||
      typeof credentialStore.listByUserId !== "function" ||
      typeof credentialStore.updateCounter !== "function" ||
      typeof credentialStore.remove !== "function")
  ) {
    throw new ConfigurationError("Passkey credential storage does not implement its contract.");
  }
}

function parseChallenge(clientDataJSON: unknown): string {
  if (
    typeof clientDataJSON !== "string" ||
    !/^[A-Za-z0-9_-]+$/.test(clientDataJSON)
  ) {
    throw new WebAuthnError("The WebAuthn response is incomplete or invalid.");
  }
  try {
    const bytes = Buffer.from(clientDataJSON, "base64url");
    if (bytes.toString("base64url") !== clientDataJSON) {
      throw new Error("Non-canonical client data encoding.");
    }
    const clientData: unknown = JSON.parse(bytes.toString("utf8"));
    if (
      !isRecord(clientData) ||
      typeof clientData.challenge !== "string" ||
      !/^[A-Za-z0-9_-]+$/.test(clientData.challenge)
    ) {
      throw new Error("Missing challenge.");
    }
    return clientData.challenge;
  } catch {
    throw new WebAuthnError("The WebAuthn response is incomplete or invalid.");
  }
}

function isRegistrationResponse(value: unknown): value is RegistrationResponseJSON {
  if (!isRecord(value) || !isRecord(value.response)) {
    return false;
  }
  return (
    value.type === "public-key" &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.id === value.rawId &&
    isRecord(value.clientExtensionResults) &&
    typeof value.response.clientDataJSON === "string" &&
    typeof value.response.attestationObject === "string"
  );
}

function isAuthenticationResponse(value: unknown): value is AuthenticationResponseJSON {
  if (!isRecord(value) || !isRecord(value.response)) {
    return false;
  }
  return (
    value.type === "public-key" &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.id === value.rawId &&
    isRecord(value.clientExtensionResults) &&
    typeof value.response.clientDataJSON === "string" &&
    typeof value.response.authenticatorData === "string" &&
    typeof value.response.signature === "string" &&
    (value.response.userHandle === undefined ||
      value.response.userHandle === null ||
      typeof value.response.userHandle === "string")
  );
}

function transportsFromResponse(
  transports: readonly string[] | undefined
): AmaanoodCredential["transports"] {
  return transports?.filter(
    (transport): transport is NonNullable<AmaanoodCredential["transports"]>[number] =>
      allowedTransports.has(transport)
  );
}

export class Amaanood {
  private readonly rpId: string;
  private readonly rpName: string;
  private readonly origins: readonly string[];
  private readonly requireUserVerification: boolean;
  private readonly challengeStore: AmaanoodChallengeStore;
  private readonly credentialStore: AmaanoodCredentialStore;

  constructor(configuration: AmaanoodQaabeyn) {
    if (!isRecord(configuration)) {
      throw new ConfigurationError("Passkey configuration must be an object.");
    }
    if (!isValidRpId(configuration.rpId)) {
      throw new ConfigurationError("A valid WebAuthn relying-party ID is required.");
    }
    validateUserName(configuration.rpName, "Relying-party name");
    if (
      !Array.isArray(configuration.origins) ||
      configuration.origins.length === 0 ||
      !configuration.origins.every(isAllowedOrigin) ||
      new Set(configuration.origins).size !== configuration.origins.length ||
      !configuration.origins.every((origin) =>
        originMatchesRpId(origin, configuration.rpId)
      )
    ) {
      throw new ConfigurationError(
        "Origins must be unique HTTPS origins matching the relying-party ID; HTTP is allowed only on localhost."
      );
    }
    if (
      configuration.requireUserVerification !== undefined &&
      typeof configuration.requireUserVerification !== "boolean"
    ) {
      throw new ConfigurationError("requireUserVerification must be a boolean.");
    }
    validateStores(configuration);

    this.rpId = configuration.rpId;
    this.rpName = configuration.rpName;
    this.origins = [...configuration.origins];
    this.requireUserVerification =
      configuration.requireUserVerification ?? true;
    this.challengeStore =
      configuration.keydkaLoolan ?? new InMemoryAmaanoodChallengeStore();
    this.credentialStore =
      configuration.keydkaFuraha ?? new InMemoryAmaanoodCredentialStore();
  }

  async furahaAbuur(
    request: CodsiFurahaAbuur
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    validateUserId(request?.userId);
    validateUserName(request.userName, "User name");
    const displayName = request.displayName ?? request.userName;
    validateUserName(displayName, "Display name");

    const credentials = await this.storageCall(
      "list credentials",
      () => this.credentialStore.listByUserId(request.userId)
    );
    let options: PublicKeyCredentialCreationOptionsJSON;
    try {
      options = await generateRegistrationOptions({
        rpID: this.rpId,
        rpName: this.rpName,
        userID: new Uint8Array(userHandle(request.userId)),
        userName: request.userName,
        userDisplayName: displayName,
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: this.requireUserVerification ? "required" : "preferred"
        },
        excludeCredentials: credentials.map((credential) => ({
          id: credential.credentialId,
          transports: credential.transports
        }))
      });
    } catch {
      throw new WebAuthnError("Could not generate passkey registration options.");
    }

    await this.storeChallenge(options.challenge, request.userId, "diiwaangelin");
    return options;
  }

  async furahaDiiwaangeli(
    request: CodsiFurahaDiiwaangeli
  ): Promise<NatiijoFurahaDiiwaangeli> {
    validateUserId(request?.userId);
    if (!isRegistrationResponse(request.response)) {
      throw new WebAuthnError("The passkey registration response is incomplete or invalid.");
    }
    const challenge = parseChallenge(request.response.response.clientDataJSON);
    const stored = await this.consumeChallenge(challenge);
    this.requireChallenge(stored, challenge, request.userId, "diiwaangelin");

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: request.response,
        expectedChallenge: stored.challenge,
        expectedOrigin: [...this.origins],
        expectedRPID: this.rpId,
        requireUserVerification: this.requireUserVerification
      });
    } catch {
      throw new WebAuthnError("Passkey registration could not be verified.");
    }
    if (
      !verification.verified ||
      (this.requireUserVerification && !verification.registrationInfo.userVerified)
    ) {
      throw new WebAuthnError("Passkey registration could not be verified.");
    }

    const info = verification.registrationInfo;
    const credential: AmaanoodCredential = {
      credentialId: info.credential.id,
      userId: request.userId,
      publicKey: Uint8Array.from(info.credential.publicKey),
      counter: info.credential.counter,
      transports: transportsFromResponse(info.credential.transports),
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
      createdAt: new Date().toISOString()
    };
    const created = await this.storageCall(
      "create credential",
      () => this.credentialStore.create(credential)
    );
    if (!created) {
      throw new WebAuthnError("This passkey is already registered.");
    }
    return {
      credentialId: credential.credentialId,
      userVerified: info.userVerified
    };
  }

  async saxiix(
    request: CodsiAmaanoodSaxiix
  ): Promise<PublicKeyCredentialRequestOptionsJSON> {
    validateUserId(request?.userId);
    if (
      request.paymentBinding !== undefined &&
      !/^[a-f0-9]{64}$/.test(request.paymentBinding)
    ) {
      throw new ValidationError("Payment authorization binding must be a SHA-256 digest.");
    }
    const credentials = await this.storageCall(
      "list credentials",
      () => this.credentialStore.listByUserId(request.userId)
    );
    if (credentials.length === 0) {
      throw new WebAuthnError("No passkeys are registered for this account.");
    }

    const requireUserVerification =
      this.requireUserVerification || request.paymentBinding !== undefined;
    let options: PublicKeyCredentialRequestOptionsJSON;
    try {
      options = await generateAuthenticationOptions({
        rpID: this.rpId,
        ...(request.paymentBinding === undefined
          ? {}
          : {
              challenge: createHash("sha256")
                .update("iskubixi:payment-authorization:webauthn:v1:")
                .update(randomBytes(32))
                .update(request.paymentBinding, "ascii")
                .digest("base64url")
            }),
        allowCredentials: credentials.map((credential) => ({
          id: credential.credentialId,
          transports: credential.transports
        })),
        userVerification: requireUserVerification ? "required" : "preferred"
      });
    } catch {
      throw new WebAuthnError("Could not generate passkey authentication options.");
    }

    await this.storeChallenge(
      options.challenge,
      request.userId,
      "xaqiijin",
      request.paymentBinding
    );
    return options;
  }

  async saxiixXaqiiji(
    request: CodsiSaxiixXaqiiji
  ): Promise<NatiijoSaxiix> {
    validateUserId(request?.userId);
    if (!isAuthenticationResponse(request.response)) {
      throw new WebAuthnError("The passkey authentication response is incomplete or invalid.");
    }
    if (
      request.paymentBinding !== undefined &&
      !/^[a-f0-9]{64}$/.test(request.paymentBinding)
    ) {
      throw new ValidationError("Payment authorization binding must be a SHA-256 digest.");
    }
    const challenge = parseChallenge(request.response.response.clientDataJSON);
    const stored = await this.consumeChallenge(challenge);
    this.requireChallenge(
      stored,
      challenge,
      request.userId,
      "xaqiijin",
      request.paymentBinding
    );

    const credential = await this.storageCall(
      "find credential",
      () => this.credentialStore.findByCredentialId(request.response.id)
    );
    if (!credential || credential.userId !== request.userId) {
      throw new WebAuthnError("The passkey is invalid or does not belong to this account.");
    }
    const expectedUserHandle = userHandle(request.userId).toString("base64url");
    if (
      request.response.response.userHandle !== undefined &&
      request.response.response.userHandle !== null &&
      request.response.response.userHandle !== expectedUserHandle
    ) {
      throw new WebAuthnError("The passkey is invalid or does not belong to this account.");
    }

    let verification;
    const requireUserVerification =
      this.requireUserVerification || request.paymentBinding !== undefined;
    try {
      verification = await verifyAuthenticationResponse({
        response: request.response,
        expectedChallenge: stored.challenge,
        expectedOrigin: [...this.origins],
        expectedRPID: this.rpId,
        credential: {
          id: credential.credentialId,
          publicKey: Uint8Array.from(credential.publicKey),
          counter: credential.counter,
          transports: credential.transports
        },
        requireUserVerification,
        advancedFIDOConfig: {
          userVerification: requireUserVerification ? "required" : "preferred"
        }
      });
    } catch {
      throw new WebAuthnError("Passkey authentication could not be verified.");
    }
    if (
      !verification.verified ||
      (requireUserVerification && !verification.authenticationInfo.userVerified)
    ) {
      throw new WebAuthnError("Passkey authentication could not be verified.");
    }

    const info = verification.authenticationInfo;
    const updated = await this.storageCall(
      "update credential counter",
      () =>
        this.credentialStore.updateCounter(
          request.userId,
          credential.credentialId,
          credential.counter,
          info.newCounter,
          info.credentialDeviceType,
          info.credentialBackedUp
        )
    );
    if (!updated) {
      throw new WebAuthnError("The passkey changed during authentication; try again.");
    }
    return {
      authenticated: true,
      userId: request.userId,
      credentialId: credential.credentialId,
      userVerified: info.userVerified
    };
  }

  async furahaLiiska(request: CodsiAmaanood): Promise<readonly FurahaDiiwaangashan[]> {
    validateUserId(request?.userId);
    const credentials = await this.storageCall(
      "list credentials",
      () => this.credentialStore.listByUserId(request.userId)
    );
    return credentials.map((credential) => ({
      credentialId: credential.credentialId,
      createdAt: credential.createdAt,
      deviceType: credential.deviceType,
      backedUp: credential.backedUp,
      ...(credential.transports === undefined
        ? {}
        : { transports: [...credential.transports] })
    }));
  }

  async furahaJooji(
    request: CodsiAmaanood & { credentialId: string }
  ): Promise<boolean> {
    validateUserId(request?.userId);
    if (
      typeof request.credentialId !== "string" ||
      request.credentialId.length === 0
    ) {
      throw new ValidationError("A valid passkey credential ID is required.");
    }
    return this.storageCall(
      "remove credential",
      () => this.credentialStore.remove(request.userId, request.credentialId)
    );
  }

  private async storeChallenge(
    challenge: string,
    userId: string,
    ceremony: AmaanoodChallenge["ceremony"],
    paymentBinding?: string
  ): Promise<void> {
    const created = await this.storageCall(
      "create challenge",
      () =>
        this.challengeStore.create({
          challenge,
          userId,
          ceremony,
          expiresAt: Date.now() + challengeLifetimeMs,
          ...(paymentBinding === undefined ? {} : { paymentBinding })
        })
    );
    if (!created) {
      throw new WebAuthnError("Could not create a unique passkey challenge; try again.");
    }
  }

  private consumeChallenge(challenge: string): Promise<AmaanoodChallenge | undefined> {
    return this.storageCall(
      "consume challenge",
      () => this.challengeStore.consume(challenge, Date.now())
    );
  }

  private requireChallenge(
    challenge: AmaanoodChallenge | undefined,
    expectedChallenge: string,
    userId: string,
    ceremony: AmaanoodChallenge["ceremony"],
    paymentBinding?: string
  ): asserts challenge is AmaanoodChallenge {
    if (
      !challenge ||
      challenge.challenge !== expectedChallenge ||
      challenge.userId !== userId ||
      challenge.ceremony !== ceremony ||
      challenge.paymentBinding !== paymentBinding ||
      !Number.isFinite(challenge.expiresAt) ||
      challenge.expiresAt <= Date.now()
    ) {
      throw new WebAuthnError("The passkey challenge is invalid, expired, or already used.");
    }
  }

  private async storageCall<T>(
    operation: string,
    action: () => Promise<T>
  ): Promise<T> {
    try {
      return await action();
    } catch {
      throw new StorageError(`Passkey storage operation "${operation}" failed.`, {
        context: { storage: "passkey", operation }
      });
    }
  }
}
