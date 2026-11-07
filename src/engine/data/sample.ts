import type { Phase } from "../types";

/** Test cycle + Anavar + MK-677 + creatine, trained hard. Shows every triage group. */
export const SAMPLE: { stack: string[]; train: boolean; cyc: { ph: Phase; wk: string }; me: Record<string, string>; vals: Record<string, number> } = {stack:["creatine","testc","anavar","mk677"],train:true,cyc:{ph:"on",wk:"9"},me:{age:"29",sys:"138",dia:"86",hr:"74"},vals:{hematocrit:0.55,hemoglobin:182,plt:340,alt:96,ast:71,ggt:24,bili:16,alp:85,ck:2100,creatinine:131,cystatin:0.82,urea:8.4,ldl:4.1,hdl:0.58,tg:1.4,apob:1.22,glucose:6.2,a1c:5.8,igf1:410,testo:58,lh:0.1,estradiol:230,tsh:5.6,ft4:14,ferritin:24}};
