import type { Bixiye } from "./configuration";
import type { CodsiWebhook } from "../providers/payment-webhook-adapter";
import type { XaaladdaCelin, XaaladdaLacagta } from "./payment";

export interface CodsiWebhookFashilmay {
  bixiye?: Bixiye;
}

export interface CodsiWebhookDibUshaqee {
  bixiye: Bixiye;
  dhacdoId: string;
  codsi?: CodsiWebhook;
}

export interface NatiijoWebhookDhacdoFashilmay {
  bixiye: Bixiye;
  dhacdoId: string;
  xaalad: "fashilmay";
  iskuDayo: number;
  iskuDaygiiUguDanbeeyay?: string;
  fashil: string;
}

interface NatiijoWebhookLaXaqiijiyay {
  waaSax: true;
  bixiye: Bixiye;
  dhacdoId: string;
}

export type NatiijoWebhookCadee =
  | (NatiijoWebhookLaXaqiijiyay & {
      xaalad: XaaladdaLacagta;
    })
  | (NatiijoWebhookLaXaqiijiyay & {
      providerRefundId: string;
      xaaladCelin: XaaladdaCelin;
    })
  | (NatiijoWebhookLaXaqiijiyay & {
      laIskaIndhoTiray: true;
    });

export type NatiijoWebhookShaqeeyay =
  | (NatiijoWebhookLaXaqiijiyay & {
      xaalad: XaaladdaLacagta;
      lacagId: string;
      tixraac: string;
      horeLooShaqeeyay: boolean;
    })
  | (NatiijoWebhookLaXaqiijiyay & {
      celinId: string;
      providerRefundId: string;
      xaaladCelin: XaaladdaCelin;
      horeLooShaqeeyay: boolean;
    })
  | (NatiijoWebhookLaXaqiijiyay & {
      laIskaIndhoTiray: true;
      horeLooShaqeeyay: boolean;
    });
