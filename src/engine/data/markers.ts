// Generated from the original single-file app; content unchanged.
import type { Marker } from "../types";

export const PANELS = ["Blood","Liver","Muscle, kidney & salts","Lipids","Glucose & GH","Hormones","Iron"];

// Values are stored in SI. ri = typical adult range, read as 2.5th–97.5th percentile.
export const M: Marker[] = [
 {id:"hematocrit",name:"Hematocrit",abbr:"Hct",panel:0,unit:"L/L",us:["%",100],dp:[2,0],dist:"norm",ri:{m:[0.40,0.52],f:[0.36,0.47]},al:["hematocrit","haematocrit","hct"],what:"The share of your blood that is red cells. Too high thickens blood and raises clot risk."},
 {id:"hemoglobin",name:"Hemoglobin",abbr:"Hb",panel:0,unit:"g/L",us:["g/dL",0.1],dp:[0,1],dist:"norm",ri:{m:[135,175],f:[120,160]},al:["hemoglobin","haemoglobin","hgb"],what:"The oxygen-carrying protein in red cells; moves with hematocrit."},
 {id:"plt",name:"Platelets",abbr:"Plt",panel:0,unit:"×10⁹/L",us:["×10³/µL",1],dp:[0,0],dist:"log",ri:[150,400],al:["platelets","platelet count","plt"],what:"Cell fragments that start clotting."},
 {id:"alt",name:"ALT",abbr:"Alanine aminotransferase",panel:1,unit:"U/L",us:["U/L",1],dp:[0,0],dist:"log",ri:{m:[10,50],f:[7,35]},al:["alt","alanine aminotransferase","sgpt"],what:"A liver enzyme, also released by damaged muscle."},
 {id:"ast",name:"AST",abbr:"Aspartate aminotransferase",panel:1,unit:"U/L",us:["U/L",1],dp:[0,0],dist:"log",ri:[10,40],al:["ast","aspartate aminotransferase","sgot"],what:"An enzyme in liver and muscle. Training raises it a lot."},
 {id:"ggt",name:"GGT",abbr:"Gamma-glutamyl transferase",panel:1,unit:"U/L",us:["U/L",1],dp:[0,0],dist:"log",ri:{m:[10,70],f:[6,40]},al:["ggt","gamma gt","gamma-glutamyl transferase"],what:"A liver enzyme that lifting doesn't raise, so it helps tell liver from muscle."},
 {id:"bili",name:"Bilirubin",abbr:"Total bilirubin",panel:1,unit:"µmol/L",us:["mg/dL",1/17.1],dp:[0,1],dist:"log",ri:[3,21],al:["bilirubin","total bilirubin","bili"],what:"A pigment the liver clears. It climbs in the cholestatic liver injury linked to oral steroids and SARMs."},
 {id:"alp",name:"ALP",abbr:"Alkaline phosphatase",panel:1,unit:"U/L",us:["U/L",1],dp:[0,0],dist:"log",ri:[40,130],al:["alp","alkaline phosphatase","alk phos"],what:"An enzyme from bile ducts and bone."},
 {id:"ck",name:"Creatine kinase",abbr:"CK",panel:2,unit:"U/L",us:["U/L",1],dp:[0,0],dist:"log",ri:{m:[40,320],f:[25,200]},al:["ck","creatine kinase","cpk","creatine phosphokinase"],what:"An enzyme that leaks out of muscle after hard training."},
 {id:"creatinine",name:"Creatinine",abbr:"Creat",panel:2,unit:"µmol/L",us:["mg/dL",1/88.4],dp:[0,2],dist:"log",ri:{m:[60,110],f:[45,90]},al:["creatinine","creat"],what:"A muscle breakdown product used to estimate kidney function. More muscle and creatine both raise it."},
 {id:"cystatin",name:"Cystatin C",abbr:"CysC",panel:2,unit:"mg/L",us:["mg/L",1],dp:[2,2],dist:"norm",ri:[0.6,1.0],al:["cystatin c","cystatin"],what:"A kidney filtration marker that muscle mass and creatine don't affect."},
 {id:"potassium",name:"Potassium",abbr:"K",panel:2,unit:"mmol/L",us:["mEq/L",1],dp:[1,1],dist:"norm",ri:[3.5,5.0],al:["potassium","k+"],what:"A salt your heart and muscles need to fire normally. Diuretics, clenbuterol and thyroid hormone can drop it fast."},
 {id:"urea",name:"Urea",abbr:"BUN",panel:2,unit:"mmol/L",us:["mg/dL BUN",2.8],dp:[1,0],dist:"log",ri:[2.5,7.1],al:["urea","bun","blood urea nitrogen"],what:"A protein breakdown product; high-protein diets raise it."},
 {id:"ldl",name:"LDL cholesterol",abbr:"LDL-C",panel:3,unit:"mmol/L",us:["mg/dL",38.67],dp:[2,0],dist:"log",ri:[1.5,5.0],opt:{o:[null,2.6],l:[null,3.4]},al:["ldl","ldl cholesterol","ldl-c"],what:"The main cholesterol behind artery plaque."},
 {id:"hdl",name:"HDL cholesterol",abbr:"HDL-C",panel:3,unit:"mmol/L",us:["mg/dL",38.67],dp:[2,0],dist:"log",ri:{m:[0.8,2.0],f:[1.0,2.5]},opt:{m:{o:[1.0,null],l:[0.9,null]},f:{o:[1.3,null],l:[1.1,null]}},al:["hdl","hdl cholesterol","hdl-c"],what:"Cholesterol carried back to the liver. Steroids and SARMs can crush it."},
 {id:"tg",name:"Triglycerides",abbr:"TG",panel:3,unit:"mmol/L",us:["mg/dL",88.57],dp:[2,0],dist:"log",ri:[0.5,3.0],opt:{o:[null,1.7],l:[null,2.3]},al:["triglycerides","trig","tg"],what:"Blood fat, very sensitive to your last meal."},
 {id:"apob",name:"Apolipoprotein B",abbr:"ApoB",panel:3,unit:"g/L",us:["mg/dL",100],dp:[2,0],dist:"log",ri:[0.5,1.4],opt:{o:[null,0.9],l:[null,1.05]},al:["apob","apo b","apolipoprotein b"],what:"A direct count of plaque-causing particles."},
 {id:"glucose",name:"Fasting glucose",abbr:"FBG",panel:4,unit:"mmol/L",us:["mg/dL",18.016],dp:[1,0],dist:"log",ri:[3.9,6.0],al:["glucose","fasting glucose","glucose fasting","fbg"],what:"Blood sugar after 8+ hours without food."},
 {id:"a1c",name:"Hemoglobin A1c",abbr:"HbA1c",panel:4,unit:"%",us:["%",1],dp:[1,1],dist:"norm",ri:[4.3,5.9],al:["a1c","hba1c","hemoglobin a1c"],what:"Average blood sugar over the last 2–3 months."},
 {id:"igf1",name:"IGF-1",abbr:"Insulin-like growth factor 1",panel:4,unit:"µg/L",us:["ng/mL",1],dp:[0,0],dist:"log",ri:[100,350],al:["igf-1","igf1","insulin-like growth factor","somatomedin"],what:"Made by the liver in response to growth hormone; it tracks your GH exposure. Strongly age-dependent."},
 {id:"testo",name:"Total testosterone",abbr:"TT",panel:5,unit:"nmol/L",us:["ng/dL",28.84],dp:[1,0],dist:"log",ri:{m:[8.6,29],f:[0.3,2.4]},al:["testosterone","total testosterone"],what:"Includes any testosterone you inject, so on a cycle it reflects the dose, not your own production."},
 {id:"lh",name:"LH",abbr:"Luteinizing hormone",panel:5,unit:"IU/L",us:["IU/L",1],dp:[1,1],dist:"log",ri:{m:[1.5,9.3],f:[2,13]},al:["lh","luteinizing hormone","luteinising hormone"],what:"The pituitary signal to make testosterone. Near zero means your own production is shut down."},
 {id:"estradiol",name:"Estradiol",abbr:"E2",panel:5,unit:"pmol/L",us:["pg/mL",0.2724],dp:[0,0],dist:"log",ri:{m:[40,160],f:[70,1300]},al:["estradiol","oestradiol","e2"],what:"The main estrogen. In men most of it is made from testosterone."},
 {id:"tsh",name:"TSH",abbr:"Thyroid-stimulating hormone",panel:5,unit:"mIU/L",us:["mIU/L",1],dp:[2,2],dist:"log",ri:[0.4,4.0],al:["tsh","thyroid stimulating hormone"],what:"The pituitary's thyroid signal. Taking thyroid hormone suppresses it."},
 {id:"ft4",name:"Free T4",abbr:"fT4",panel:5,unit:"pmol/L",us:["ng/dL",1/12.87],dp:[0,2],dist:"norm",ri:[10,23],al:["free t4","ft4","free thyroxine"],what:"The main thyroid hormone."},
 {id:"psa",name:"PSA",abbr:"Prostate-specific antigen",panel:5,unit:"µg/L",us:["ng/mL",1],dp:[2,2],dist:"log",ri:{m:[0.2,4.0],f:[0.01,0.1]},al:["psa","prostate specific antigen","prostate-specific antigen"],what:"A prostate marker. Testosterone can raise it; finasteride roughly halves it."},
 {id:"ferritin",name:"Ferritin",abbr:"Ferr",panel:6,unit:"µg/L",us:["ng/mL",1],dp:[0,0],dist:"log",ri:{m:[30,400],f:[15,200]},al:["ferritin"],what:"Your iron stores."}
];

export const BYID: Record<string, Marker> = Object.fromEntries(M.map((m) => [m.id, m]));
