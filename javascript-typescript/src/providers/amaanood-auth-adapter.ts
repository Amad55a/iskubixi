export type AmaanoodHab = "waji" | "faraha" | "isha" | "calaacal";
export type AmaanoodHabLaXaqiijiyay = AmaanoodHab | "user-verification";

export type AmaanoodMacluumaadDoorasho = Readonly<Record<string, unknown>>;

export interface AmaanoodBilowLaqabsade {
  /** Client-safe ceremony options only; never include adapter credentials or biometric data. */
  options: AmaanoodMacluumaadDoorasho;
  /** Opaque adapter-side reference kept in the server session store. */
  adapterSessionId: string;
  expiresAt: number;
}

export interface AmaanoodXaqiijinLaqabsade {
  authenticated: boolean;
  userVerified: boolean;
  verifiedMethod?: AmaanoodHabLaXaqiijiyay;
}

export interface CodsiAmaanoodBilow {
  userId: string;
}

export interface NatiijoAmaanoodBilow {
  sessionId: string;
  method: AmaanoodHab;
  expiresAt: string;
  options: AmaanoodMacluumaadDoorasho;
}

export interface CodsiAmaanoodXaqiiji {
  userId: string;
  sessionId: string;
  response: unknown;
}

export interface NatiijoAmaanoodXaqiiji {
  authenticated: true;
  userId: string;
  sessionId: string;
  requestedMethod: AmaanoodHab;
  verifiedMethod?: AmaanoodHabLaXaqiijiyay;
  methodConfirmed: boolean;
  userVerified: true;
}

export interface AmaanoodLaqabsade {
  id: string;
  supportedMethods: readonly AmaanoodHab[];
  /** Must be true before this adapter can authorize payments. */
  supportsPaymentAuthorization?: boolean;
  /** Create a fresh, unpredictable, user-bound challenge and bind paymentBinding when provided. */
  start(request: {
    userId: string;
    method: AmaanoodHab;
    paymentBinding?: string;
  }): Promise<AmaanoodBilowLaqabsade>;
  /** Verify the challenge, response, user, user verification, and paymentBinding when provided. */
  verify(request: {
    userId: string;
    method: AmaanoodHab;
    adapterSessionId: string;
    response: unknown;
    paymentBinding?: string;
  }): Promise<AmaanoodXaqiijinLaqabsade>;
}
