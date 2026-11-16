export type AmaanoodCeremony = "diiwaangelin" | "xaqiijin";
export type AmaanoodDeviceType = "singleDevice" | "multiDevice";
export type AmaanoodTransport =
  | "ble"
  | "cable"
  | "hybrid"
  | "internal"
  | "nfc"
  | "smart-card"
  | "usb";

export interface AmaanoodChallenge {
  challenge: string;
  userId: string;
  ceremony: AmaanoodCeremony;
  expiresAt: number;
  paymentBinding?: string;
}

export interface AmaanoodChallengeStore {
  /** Atomically save the complete record, including paymentBinding; return false on duplicate. */
  create(challenge: AmaanoodChallenge): Promise<boolean>;
  /** Atomically remove a challenge, including expired challenges, before returning it. */
  consume(challenge: string, now: number): Promise<AmaanoodChallenge | undefined>;
}

export interface AmaanoodCredential {
  credentialId: string;
  userId: string;
  publicKey: Uint8Array;
  counter: number;
  transports?: AmaanoodTransport[];
  deviceType: AmaanoodDeviceType;
  backedUp: boolean;
  createdAt: string;
}

export interface AmaanoodCredentialStore {
  /** Atomically create a globally unique credential ID without replacing an existing record. */
  create(credential: AmaanoodCredential): Promise<boolean>;
  findByCredentialId(credentialId: string): Promise<AmaanoodCredential | undefined>;
  listByUserId(userId: string): Promise<readonly AmaanoodCredential[]>;
  /** Atomically compare the old counter and update only the matching user's credential. */
  updateCounter(
    userId: string,
    credentialId: string,
    expectedCounter: number,
    newCounter: number,
    deviceType: AmaanoodDeviceType,
    backedUp: boolean
  ): Promise<boolean>;
  /** Atomically remove a credential only when it belongs to the supplied user. */
  remove(userId: string, credentialId: string): Promise<boolean>;
}

export interface AmaanoodAuthenticationSession {
  sessionId: string;
  userId: string;
  method: import("./amaanood-auth-adapter").AmaanoodHab;
  adapterId: string;
  adapterSessionId: string;
  expiresAt: number;
  purpose?: "authentication" | "payment-authorization";
  paymentBinding?: string;
}

export interface AmaanoodAuthenticationSessionStore {
  /** Atomically save a session without replacing an existing session ID. */
  create(session: AmaanoodAuthenticationSession): Promise<boolean>;
  /** Atomically consume only a matching user's unexpired session; prevent replay across instances. */
  consume(
    sessionId: string,
    userId: string,
    now: number
  ): Promise<AmaanoodAuthenticationSession | undefined>;
}

export class InMemoryAmaanoodAuthenticationSessionStore
implements AmaanoodAuthenticationSessionStore {
  private readonly sessions = new Map<string, AmaanoodAuthenticationSession>();

  async create(session: AmaanoodAuthenticationSession): Promise<boolean> {
    for (const [id, existing] of this.sessions) {
      if (existing.expiresAt <= Date.now()) {
        this.sessions.delete(id);
      }
    }
    if (this.sessions.has(session.sessionId)) {
      return false;
    }
    this.sessions.set(session.sessionId, { ...session });
    return true;
  }

  async consume(
    sessionId: string,
    userId: string,
    now: number
  ): Promise<AmaanoodAuthenticationSession | undefined> {
    const stored = this.sessions.get(sessionId);
    if (!stored) {
      return undefined;
    }
    if (!Number.isFinite(stored.expiresAt) || stored.expiresAt <= now) {
      this.sessions.delete(sessionId);
      return undefined;
    }
    if (stored.userId !== userId) {
      return undefined;
    }
    this.sessions.delete(sessionId);
    return { ...stored };
  }
}

export class InMemoryAmaanoodChallengeStore implements AmaanoodChallengeStore {
  private readonly challenges = new Map<string, AmaanoodChallenge>();

  async create(challenge: AmaanoodChallenge): Promise<boolean> {
    for (const [key, existing] of this.challenges) {
      if (existing.expiresAt <= Date.now()) {
        this.challenges.delete(key);
      }
    }

    if (this.challenges.has(challenge.challenge)) {
      return false;
    }
    this.challenges.set(challenge.challenge, { ...challenge });
    return true;
  }

  async consume(
    challenge: string,
    now: number
  ): Promise<AmaanoodChallenge | undefined> {
    const stored = this.challenges.get(challenge);
    if (!stored) {
      return undefined;
    }
    this.challenges.delete(challenge);
    return stored.expiresAt > now ? { ...stored } : undefined;
  }
}

function copyCredential(credential: AmaanoodCredential): AmaanoodCredential {
  return {
    ...credential,
    publicKey: Uint8Array.from(credential.publicKey),
    ...(credential.transports === undefined
      ? {}
      : { transports: [...credential.transports] })
  };
}

export class InMemoryAmaanoodCredentialStore
implements AmaanoodCredentialStore {
  private readonly credentials = new Map<string, AmaanoodCredential>();

  async create(credential: AmaanoodCredential): Promise<boolean> {
    if (this.credentials.has(credential.credentialId)) {
      return false;
    }
    this.credentials.set(
      credential.credentialId,
      copyCredential(credential)
    );
    return true;
  }

  async findByCredentialId(
    credentialId: string
  ): Promise<AmaanoodCredential | undefined> {
    const credential = this.credentials.get(credentialId);
    return credential ? copyCredential(credential) : undefined;
  }

  async listByUserId(
    userId: string
  ): Promise<readonly AmaanoodCredential[]> {
    return Array.from(this.credentials.values())
      .filter((credential) => credential.userId === userId)
      .map(copyCredential);
  }

  async updateCounter(
    userId: string,
    credentialId: string,
    expectedCounter: number,
    newCounter: number,
    deviceType: AmaanoodDeviceType,
    backedUp: boolean
  ): Promise<boolean> {
    const credential = this.credentials.get(credentialId);
    if (
      !credential ||
      credential.userId !== userId ||
      credential.counter !== expectedCounter
    ) {
      return false;
    }
    this.credentials.set(credentialId, {
      ...credential,
      counter: newCounter,
      deviceType,
      backedUp
    });
    return true;
  }

  async remove(userId: string, credentialId: string): Promise<boolean> {
    const credential = this.credentials.get(credentialId);
    if (!credential || credential.userId !== userId) {
      return false;
    }
    this.credentials.delete(credentialId);
    return true;
  }
}
