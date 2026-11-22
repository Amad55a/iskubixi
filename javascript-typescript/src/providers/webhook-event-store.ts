import type {
  CodsiWebhook,
  WebhookHeaders
} from "./payment-webhook-adapter";
import type { Bixiye } from "../types/configuration";
import { IdempotencyError } from "../errors";

export type XaaladdaDhacdoWebhook =
  | "sugaya"
  | "laShaqeynayo"
  | "guuleystay"
  | "fashilmay";

export interface WebhookEventProcessingResult {
  horeLooShaqeeyay: boolean;
}

export interface WebhookEventRecord {
  bixiye: Bixiye;
  dhacdoId: string;
  fingerprint: string;
  xaalad: XaaladdaDhacdoWebhook;
  iskuDayo: number;
  laAbuuray: string;
  iskuDaygiiUguDanbeeyay?: string;
  fashil?: string;
  /** Protected signed request needed to verify a retry; omit from API results. */
  codsi?: CodsiWebhook;
}

/** Event IDs must be claimed atomically; failed claims may be retried. */
export interface WebhookEventStore {
  processOnce(
    bixiye: Bixiye,
    dhacdoId: string,
    fingerprint: string,
    process: () => Promise<void>,
    codsi?: CodsiWebhook
  ): Promise<WebhookEventProcessingResult>;
}

export interface RecoverableWebhookEventStore extends WebhookEventStore {
  get(
    bixiye: Bixiye,
    dhacdoId: string
  ): Promise<WebhookEventRecord | undefined>;
  listFailed(bixiye?: Bixiye): Promise<readonly WebhookEventRecord[]>;
}

function copyHeaders(headers: WebhookHeaders): WebhookHeaders {
  const copied: Record<string, string | readonly string[] | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    copied[key] = Array.isArray(value) ? [...value] : value;
  }
  return copied;
}

function copyRequest(codsi: CodsiWebhook): CodsiWebhook {
  return {
    bixiye: codsi.bixiye,
    rawBody: new Uint8Array(codsi.rawBody),
    headers: copyHeaders(codsi.headers)
  };
}

function copyRecord(record: WebhookEventRecord): WebhookEventRecord {
  return {
    ...record,
    codsi: record.codsi ? copyRequest(record.codsi) : undefined
  };
}

function sameKey(bixiye: Bixiye, dhacdoId: string): string {
  return JSON.stringify([bixiye, dhacdoId]);
}

export class InMemoryWebhookEventStore implements RecoverableWebhookEventStore {
  readonly #records = new Map<string, WebhookEventRecord>();
  readonly #inFlight = new Map<string, Promise<void>>();

  async processOnce(
    bixiye: Bixiye,
    dhacdoId: string,
    fingerprint: string,
    process: () => Promise<void>,
    codsi?: CodsiWebhook
  ): Promise<WebhookEventProcessingResult> {
    const key = sameKey(bixiye, dhacdoId);
    const existing = this.#records.get(key);
    if (existing && existing.fingerprint !== fingerprint) {
      throw new IdempotencyError("Webhook event ID was reused with different event data.");
    }

    if (existing?.xaalad === "guuleystay") {
      return { horeLooShaqeeyay: true };
    }

    const current = this.#inFlight.get(key);
    if (current) {
      await current;
      return { horeLooShaqeeyay: true };
    }
    if (existing?.xaalad === "laShaqeynayo") {
      throw new IdempotencyError("Webhook event is already being processed.");
    }

    const hadda = new Date().toISOString();
    const record: WebhookEventRecord = existing ?? {
      bixiye,
      dhacdoId,
      fingerprint,
      xaalad: "sugaya",
      iskuDayo: 0,
      laAbuuray: hadda
    };
    if (codsi) {
      record.codsi = copyRequest(codsi);
    }
    record.xaalad = "laShaqeynayo";
    record.iskuDayo += 1;
    record.iskuDaygiiUguDanbeeyay = hadda;
    record.fashil = undefined;
    this.#records.set(key, record);

    const processing = Promise.resolve()
      .then(process)
      .then(() => {
        record.xaalad = "guuleystay";
        record.fashil = undefined;
      })
      .catch((error: unknown) => {
        record.xaalad = "fashilmay";
        record.fashil = "Webhook event processing failed.";
        throw error;
      })
      .finally(() => {
        this.#inFlight.delete(key);
      });
    this.#inFlight.set(key, processing);
    await processing;
    return { horeLooShaqeeyay: false };
  }

  async get(
    bixiye: Bixiye,
    dhacdoId: string
  ): Promise<WebhookEventRecord | undefined> {
    const record = this.#records.get(sameKey(bixiye, dhacdoId));
    return record ? copyRecord(record) : undefined;
  }

  async listFailed(bixiye?: Bixiye): Promise<readonly WebhookEventRecord[]> {
    return [...this.#records.values()]
      .filter((record) =>
        record.xaalad === "fashilmay" &&
        (bixiye === undefined || record.bixiye === bixiye)
      )
      .map(copyRecord);
  }
}
