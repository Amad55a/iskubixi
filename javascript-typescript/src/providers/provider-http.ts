import { ConfigurationError, ProviderError, ValidationError } from "../errors";

const defaultTimeoutMs = 15_000;
const zeroDecimalCurrencies = new Set([
  "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG",
  "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"
]);
const threeDecimalCurrencies = new Set([
  "BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"
]);

export interface ProviderHttpClientOptions {
  provider: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class ProviderHttpClient {
  readonly #provider: string;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;

  constructor(options: ProviderHttpClientOptions) {
    if (!options || typeof options.provider !== "string" || options.provider.trim() === "") {
      throw new ConfigurationError("Provider HTTP client name is required.");
    }

    this.#provider = options.provider;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
    if (typeof this.#fetch !== "function") {
      throw new ConfigurationError("Fetch is required for this payment provider.");
    }
    if (!Number.isInteger(this.#timeoutMs) || this.#timeoutMs <= 0) {
      throw new ConfigurationError("Provider request timeout must be a positive integer.");
    }
  }

  async requestJson(
    url: string,
    init: RequestInit,
    operation: string,
    notFoundIsEmpty = false
  ): Promise<unknown | undefined> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await this.#fetch(url, {
        ...init,
        redirect: "error",
        signal: controller.signal
      });
      if (notFoundIsEmpty && response.status === 404) {
        return undefined;
      }
      if (!response.ok) {
        throw new ProviderError("Payment provider returned an HTTP error.", {
          context: {
            provider: this.#provider,
            operation,
            status: response.status
          }
        });
      }
      try {
        return await response.json() as unknown;
      } catch {
        throw new ProviderError("Payment provider returned invalid JSON.", {
          context: { provider: this.#provider, operation }
        });
      }
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      throw new ProviderError(
        controller.signal.aborted
          ? "Payment provider request timed out."
          : "Payment provider request failed.",
        {
          context: { provider: this.#provider, operation }
        }
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function toMinorUnits(amount: number, currency: string): number {
  const exponent = currencyExponent(currency);
  const multiplier = 10 ** exponent;
  const minorUnits = Math.round(amount * multiplier);
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isSafeInteger(minorUnits) ||
    Math.abs(amount * multiplier - minorUnits) > 1e-8
  ) {
    throw new ValidationError("Payment amount cannot be represented in the currency's minor unit.");
  }
  return minorUnits;
}

export function currencyExponent(currency: string): number {
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new ValidationError("Payment currency must be a three-letter uppercase code.");
  }
  return zeroDecimalCurrencies.has(currency)
    ? 0
    : threeDecimalCurrencies.has(currency)
      ? 3
      : 2;
}

export function fromMinorUnits(amount: unknown, currency: string): number {
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new ProviderError("Payment provider returned an invalid amount.");
  }
  const exponent = currencyExponent(currency);
  return amount / (10 ** exponent);
}

export function httpsRedirect(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) {
    return undefined;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.username === "" && url.password === ""
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
