// Generated from the original single-file app; wording unchanged.
// Rules that depend on the user's situation take a Ctx instead of reading globals.
import type { Ctx } from "../ctx";
import type { ClassId, Dir } from "../types";

export const HAB: { id: string; l: string }[] = [{id:"bp",l:"Blood pressure checked (past month)"},{id:"echo",l:"Had a heart scan (echo)"},{id:"cardio",l:"2+ hrs cardio a week"},{id:"sleep",l:"Sleep 7+ hrs"},{id:"protein",l:"Protein at every meal"},{id:"alcohol",l:"Drink alcohol most weeks"}];

/** Cycle timeline stages */
export const TL: { n: string; w: string; t: string[] }[] = [
 {n:"Baseline",w:"before you start",t:["Full panel: blood count, lipids with ApoB, liver, kidney, hormones","Blood pressure","This is what every later test is compared to"]},
 {n:"On cycle",w:"mid-cycle and at the end",t:["Hematocrit, lipids, liver panel with GGT","Blood pressure, every few weeks","LH near zero is expected now [P34]"]},
 {n:"Off, 0–3 months",w:"right after stopping",t:["Flags from the cycle can linger here","Most blood changes were back to baseline by 3 months [P2]","Retest around week 12"]},
 {n:"Off, 3–12 months",w:"recovery check",t:["Testosterone and LH should be back in range for most [P34]","11% still had low testosterone at one year [P34]","Years later, 27% of former users were still below range [P62]","Still low or still flagged? See a doctor"]}
];

/** Emergency signs. rel() marks the ones more likely with this stack or these results. */
export const ER: { t: string; d: string; rel: (c: Ctx) => boolean }[] = [
 {t:"Feeling extremely hot, sweating heavily, with a racing heart",d:"After a fat burner, especially DNP, this is an emergency: there is no antidote. [P40]",rel:(c)=>c.has("dnp")||c.cls("burn")},
 {t:"Shaking, sweating, confusion or passing out",d:"Possible low blood sugar. Take fast sugar now and call for help.",rel:(c)=>c.has("insulin")||c.has("igf")||(c.v.glucose||9)<3.0},
 {t:"Sudden muscle weakness or paralysis",d:"Possible very low potassium, especially after diuretics, clenbuterol or thyroid hormone. [P50] [P61]",rel:(c)=>["diuretic","clen","t3"].some(i=>c.has(i))||(c.v.potassium||4)<3.0},
 {t:"Chest pain, pressure or tightness",d:"Especially if it spreads to the arm, jaw or back, or comes with sweating or nausea. Possible heart attack.",rel:(c)=>c.cls("inj")||c.cls("oral")||c.cls("trt")||c.cls("thy")},
 {t:"Face drooping, arm weakness or slurred speech",d:"Sudden onset on one side. Possible stroke: note the time it started.",rel:(c)=>c.cls("inj")||c.cls("oral")||(c.v.hematocrit||0)>=0.54},
 {t:"Sudden shortness of breath, or one swollen, painful calf",d:"Possible blood clot in the lung or leg.",rel:(c)=>c.cls("inj")||c.cls("oral")||c.cls("trt")||(c.v.hematocrit||0)>=0.54},
 {t:"Blood pressure over 180/120 with symptoms",d:"Headache, vision changes, chest pain, confusion or weakness. [P33]",rel:(c)=>(c.me("sys")||0)>180||(c.me("dia")||0)>120||c.cls("inj")||c.cls("oral")},
 {t:"Racing or irregular heartbeat with dizziness or fainting",d:"Especially at rest.",rel:(c)=>c.cls("thy")||c.cls("burn")||c.cls("inj")||c.cls("oral")||(c.me("hr")||0)>100},
 {t:"Dark, cola-coloured urine with severe muscle pain or weakness",d:"Possible rhabdomyolysis, which can damage the kidneys.",rel:(c)=>c.s.train||c.has("mt2")||(c.v.ck||0)>2000},
 {t:"Yellow eyes or skin",d:"With itching, dark urine or pale stools. The liver-injury pattern seen with orals and SARMs. [P6]",rel:(c)=>c.cls("oral")||c.cls("sarm")||c.has("ashwa")},
 {t:"Severe stomach pain that spreads to the back",d:"With vomiting. Possible pancreatitis, a known warning on GLP-1 drug labels.",rel:(c)=>c.cls("glp")},
 {t:"Thoughts of suicide or harming yourself",d:"Mood can drop hard after a cycle ends. Call or text 988 in the US or Canada, or your local emergency number.",rel:(c)=>c.cls("inj")||c.cls("oral")||c.cls("trt")}
];

/** Monitoring the stack calls for. when(): applies to this stack; ok(): already covered. */
export const GAPS: { when: (c: Ctx) => boolean; ok: (c: Ctx) => boolean; t: string; why: string }[] = [
 {when:(c)=>["clen","diuretic","t3","insulin"].some(i=>c.has(i)),ok:(c)=>c.v.potassium!=null,t:"Potassium tested",why:"Clenbuterol, diuretics and thyroid hormone can all drop it. [P38] [P50] [P61]"},
 {when:(c)=>c.has("accutane"),ok:(c)=>c.v.tg!=null&&c.v.alt!=null,t:"Triglycerides and ALT",why:"Isotretinoin raised triglycerides in 44% of people. [P36]"},
 {when:(c)=>c.has("fin")||c.cls("trt")||c.cls("inj"),ok:(c)=>c.v.psa!=null,t:"PSA (optional under 40)",why:"Testosterone can raise it; finasteride halves it. [P3] [P37]"},
 {when:(c)=>c.cls("inj")||c.cls("oral")||c.cls("trt")||c.cls("sarm"),ok:(c)=>c.v.hematocrit!=null,t:"Hematocrit tested",why:"Androgens raise red cells, and guidelines act at 54%. [P3]"},
 {when:(c)=>c.cls("inj")||c.cls("oral")||c.cls("sarm"),ok:(c)=>c.v.hdl!=null&&c.v.ldl!=null,t:"Lipid panel (HDL and LDL)",why:"HDL and LDL moved the wrong way during cycles. [P2] [P5]"},
 {when:(c)=>c.cls("inj")||c.cls("oral")||c.cls("sarm"),ok:(c)=>c.v.apob!=null,t:"ApoB",why:"Counts plaque-causing particles directly. [P22]"},
 {when:(c)=>c.cls("oral")||c.cls("sarm"),ok:(c)=>c.v.alt!=null&&c.v.ggt!=null,t:"Liver panel with GGT",why:"Orals and SARMs are the compounds tied to liver injury. [P4] [P6]"},
 {when:(c)=>c.cls("inj")||c.cls("oral")||c.cls("trt")||c.cls("sarm"),ok:(c)=>c.v.lh!=null,t:"LH",why:"Shows whether your own production is shut down. [P2]"},
 {when:(c)=>c.cls("inj")||c.cls("oral")||c.cls("trt"),ok:(c)=>!!c.s.hab.bp||c.me("sys")!=null,t:"Blood pressure checked in the past month",why:"Blood pressure rose during cycles. [P2]"},
 {when:(c)=>c.cls("inj")||c.cls("oral"),ok:(c)=>c.v.creatinine!=null&&c.v.cystatin!=null,t:"Kidney check (creatinine + cystatin C)",why:"Long-term steroid use was linked to kidney scarring in bodybuilders. [P63]"},
 {when:(c)=>c.cls("inj")||c.cls("oral"),ok:(c)=>!!c.s.hab.echo,t:"Heart scan (echo) at some point",why:"Long-term users had weaker heart pumping and more coronary plaque, and plaque grew with years of use. [P24]"},
 {when:(c)=>c.cls("inj")||c.cls("oral")||c.cls("sarm"),ok:(c)=>!!c.s.hab.cardio,t:"2+ hours of cardio a week",why:"The best-proven way to raise HDL. [P17]"},
 {when:(c)=>c.cls("gh"),ok:(c)=>c.v.glucose!=null&&c.v.a1c!=null,t:"Fasting glucose and A1c",why:"MK-677 raised glucose and cut insulin sensitivity. [P8]"},
 {when:(c)=>c.cls("gh"),ok:(c)=>c.v.igf1!=null,t:"IGF-1",why:"Shows how much GH exposure you're actually getting. [P8]"},
 {when:(c)=>c.cls("glp"),ok:(c)=>!!c.s.hab.protein,t:"Protein at every meal",why:"Lean mass fell about 10% on semaglutide in STEP 1. [P28]"},
 {when:(c)=>c.has("creatine"),ok:(c)=>c.v.cystatin!=null,t:"Cystatin C (optional)",why:"Checks your kidneys without the creatine artifact. [P13]"}
];

export type Grade = "proven" | "weak" | "avoid";
/** Habits and supplements rated by evidence. helps: [marker, direction it fixes]. */
export const SUP: { g: Grade; n: string; helps: [string, Dir][]; d: string }[] = [
 {g:"proven",n:"Cardio, 2+ hours a week",helps:[["hdl","down"]],d:"Raised HDL across trials; session length mattered most. [P17]"},
 {g:"proven",n:"Psyllium fibre",helps:[["ldl","up"],["apob","up"]],d:"Across 28 trials, about 10 g a day lowered LDL by 0.33 mmol/L and lowered ApoB. [P25]"},
 {g:"proven",n:"Less saturated fat",helps:[["ldl","up"],["apob","up"]],d:"Swapping it for unsaturated fats lowers LDL. [P18]"},
 {g:"proven",n:"Prescription omega-3",helps:[["tg","up"]],d:"Prescription-strength omega-3 lowered triglycerides 20–30%. Ask a doctor; store-bought fish oil isn't a substitute. [P29]"},
 {g:"proven",n:"Sleep 7–9 hours",helps:[["testo","down"]],d:"A week of 5-hour nights cut testosterone 10–15%. [P20]"},
 {g:"proven",n:"Creatine",helps:[],d:"Safe for healthy kidneys. It only raises creatinine on tests. [P11]"},
 {g:"proven",n:"Vitamin D in winter, if low",helps:[],d:"Fixing a deficiency is guideline-backed. Test first. [P30]"},
 {g:"proven",n:"Iron every other day, if ferritin is low",helps:[["ferritin","down"]],d:"Absorbed better than daily dosing. [P23]"},
 {g:"weak",n:"Citrus bergamot",helps:[["ldl","up"]],d:"Lowered lipids in 14 small trials, but reviewers say better studies are needed. [P26]"},
 {g:"weak",n:"TUDCA",helps:[["alt","up"],["ast","up"]],d:"Studied in liver diseases, but we found no controlled trials in steroid users. It doesn't make an oral safe."},
 {g:"avoid",n:"Red yeast rice",helps:[["ldl","up"]],d:"Its active ingredient is identical to the statin lovastatin, doses vary wildly between brands, and some contain a kidney toxin. [P27]"}
];
export const GRADE: Record<Grade, { n: string; c: string }> = {proven:{n:"Proven",c:"var(--ok)"},weak:{n:"Weak evidence",c:"var(--warn)"},avoid:{n:"Avoid",c:"var(--danger)"}};

/** Organ systems and the markers that belong to each */
export const SYS: { id: string; n: string; sn: string; m: string[] }[] = [
 {id:"blood",n:"Blood & hematocrit",sn:"Blood",m:["hematocrit","hemoglobin","plt"]},
 {id:"heart",n:"Heart & rhythm",sn:"Heart",m:["potassium"]},
 {id:"lipids",n:"Lipids & plaque",sn:"Lipids",m:["ldl","hdl","tg","apob"]},
 {id:"liver",n:"Liver",sn:"Liver",m:["alt","ast","ggt","bili","alp"]},
 {id:"hpta",n:"Hormones & prostate",sn:"Hormones",m:["testo","lh","estradiol","psa"]},
 {id:"sugar",n:"Blood sugar & GH",sn:"Sugar & GH",m:["glucose","a1c","igf1"]},
 {id:"kidney",n:"Kidneys",sn:"Kidneys",m:["creatinine","cystatin","urea"]},
 {id:"muscle",n:"Muscle",sn:"Muscle",m:["ck"]},
 {id:"thyroid",n:"Thyroid",sn:"Thyroid",m:["tsh","ft4"]},
 {id:"iron",n:"Iron",sn:"Iron",m:["ferritin"]}];
export const SYS_OF: Record<string, string> = Object.fromEntries(SYS.flatMap((x) => x.m.map((m) => [m, x.id])));
/** Heart load from a drug class when no marker captures it */
export const HEART_FX: Partial<Record<ClassId, { w: number; why: string }>> = {inj:{w:16,why:"Blood pressure rose during cycles. [P2]"},oral:{w:16,why:"Blood pressure rose during cycles. [P2]"},trt:{w:8,why:"Raises red cells, which thickens blood. [P3]"},thy:{w:16,why:"Too much thyroid hormone speeds up the heart."}};

export const PRESETS: [string, string][] = [["Natty","creatine,ashwa"],["TRT","trt,hcg"],["First cycle","testc,ai"],["Test + Anavar","testc,anavar"],["Blast","testc,tren,dbol"],["SARMs","rad,lgd,cardarine"],["Cut","testc,clen,t3"],["Show prep","testc,tren,diuretic,clen,insulin"],["GH stack","mk677,tesa,ipa"],["GLP-1","reta,creatine"],["Peptides","bpc,tb500,mt2"]];

/** Body map: colour per system, and [x, y, label side] per spot */
export const SYSC: Record<string, string> = {blood:"#ef4444",heart:"#fb7185",lipids:"#facc15",liver:"#f97316",hpta:"#3b82f6",sugar:"#22c55e",kidney:"#a78bfa",muscle:"#2dd4bf",thyroid:"#e879f9",iron:"#94a3b8"};
export const SPOT: Record<string, [number, number, "L" | "R"]> = {hpta:[280,46,"R"],thyroid:[280,86,"L"],heart:[294,140,"R"],lipids:[264,168,"L"],liver:[256,206,"L"],sugar:[302,222,"R"],kidney:[280,258,"R"],blood:[194,220,"L"],iron:[366,220,"R"],muscle:[252,382,"L"]};
export const SILHOUETTE = '<g transform="translate(80,0)"><ellipse cx="200" cy="44" rx="23" ry="28"/><path d="M190,68 C190,82 188,90 176,94 C158,99 140,100 132,110 C124,120 124,136 126,150 L134,196 C136,214 140,232 142,250 C142,262 140,272 142,284 L258,284 C260,272 258,262 258,250 C260,232 264,214 266,196 L274,150 C276,136 276,120 268,110 C260,100 242,99 224,94 C212,90 210,82 210,68 Z"/><path d="M130,112 C116,118 112,134 110,152 L104,206 C102,222 100,240 98,258 L94,290 C93,301 99,307 105,305 C110,303 111,297 112,289 L120,238 C122,222 126,206 128,190 L134,150 Z"/><path d="M270,112 C284,118 288,134 290,152 L296,206 C298,222 300,240 302,258 L306,290 C307,301 301,307 295,305 C290,303 289,297 288,289 L280,238 C278,222 274,206 272,190 L266,150 Z"/><path d="M142,280 L258,280 C262,300 260,330 254,360 L248,420 C246,446 246,466 246,484 C247,494 252,500 244,504 L222,504 C216,500 220,492 220,484 L214,420 C210,380 206,350 202,322 L198,322 C194,350 190,380 186,420 L180,484 C180,492 184,500 178,504 L156,504 C148,500 153,494 154,484 C154,466 154,446 152,420 L146,360 C140,330 138,300 142,280 Z"/></g>';
