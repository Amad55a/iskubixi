import type { Bixiye } from "./configuration";
import type { PaymentVerificationSource } from "../providers/payment-provider";
import type { XaaladdaQr } from "../providers/qr-payment-store";

export type XaaladdaLacagta =
  | "sugaya"
  | "guuleystay"
  | "fashilmay"
  | "joojiyay"
  | "dhacay"
  | "laCeliyay";
export type XaaladLacagDhamaad = "guuleystay" | "fashilmay";
export type XaaladdaCelin = "sugaya" | "guuleystay" | "fashilmay";

export interface CodsiCelin {
  lacagId: string;
  furahaIdempotency: string;
}

export interface CodsiCelinXaalad {
  celinId: string;
}

export interface NatiijoCelin {
  id: string;
  lacagId: string;
  xaalad: XaaladdaCelin;
}

export interface CodsiLacag {
  qadarka: number;
  lacagta: string;
  bixiye: Bixiye;
  tixraac: string;
  lambarka?: string;
  furahaIdempotency?: string;
  dhacayaa?: string;
}

export interface NatiijoLacag {
  id: string;
  qadarka: number;
  lacagta: string;
  xaalad: XaaladdaLacagta;
  tixraac: string;
  dhacayaa?: string;
  celin?: NatiijoCelin;
}

export interface CodsiLacagId {
  lacagId: string;
}

export interface CodsiTijaabiXaalad extends CodsiLacagId {
  xaalad: XaaladLacagDhamaad;
}

export interface CodsiLiiskaLacag {
  bixiye?: Bixiye;
  xaalad?: XaaladdaLacagta;
  lacagta?: string;
  lagaBilaabo?: string;
  ilaa?: string;
  bogga?: number;
  xadka?: number;
}

export interface NatiijoLacagLiiska extends NatiijoLacag {
  bixiye: Bixiye;
  laAbuuray: string;
}

export interface NatiijoLiiskaLacag {
  lacagaha: NatiijoLacagLiiska[];
  wadarta: number;
  bogga: number;
  xadka: number;
  wadartaBogagga: number;
}

export interface CodsiQrLacag extends Omit<CodsiLacag, "tixraac"> {
  dhacayaa: string;
}

export interface CodsiQrTixraac {
  tixraac: string;
}

export interface CodsiQrNuxur {
  nuxur: string;
}

export interface NatiijoQrXaqiijin {
  waaSax: true;
  tixraac: string;
  nuxur: string;
  lacagId: string;
  bixiye: Bixiye;
  xaaladQr: XaaladdaQr;
  laAbuuray: string;
  dhacayaa: string;
}

export interface NatiijoQr extends NatiijoQrXaqiijin {
  lacagTixraac: string;
  qadarka: number;
  lacagta: string;
  xaalad: XaaladdaLacagta;
}

export interface NatiijoQrXaalad {
  tixraac: string;
  lacagId: string;
  bixiye: Bixiye;
  xaalad: XaaladdaLacagta;
  xaaladQr: XaaladdaQr;
  dhacayaa: string;
}

export interface NatiijoXaqiijin extends NatiijoLacag {
  waaJiraa: true;
  xaqiijin: PaymentVerificationSource;
}
