// Generated from the original single-file app; content unchanged.
import type { RedFlag } from "../types";

/** Thresholds that matter whatever the cause. */
export const RED: RedFlag[] = [
 {m:"hematocrit",test:(x)=>x>=0.54,txt:"At or above 54%: the guideline point where testosterone is held until it falls. [P3]"},
 {m:"bili",test:(x)=>x>42,txt:"More than double the upper limit. With an oral or a SARM, this is the typical liver-injury pattern. Yellow eyes, itching or dark urine means urgent care. [P6]"},
 {m:"alt",test:(x,r)=>x>5*r[1],txt:"More than 5× the upper limit, a moderate elevation by ACG categories. [P14] If you haven't lifted in a week, see a doctor soon."},
 {m:"ck",test:(x,r)=>x>10*r[1],txt:"More than 10× the upper limit. With muscle pain, weakness or dark urine, go to urgent care."},
 {m:"glucose",test:(x)=>x>=7.0,txt:"7.0 mmol/L or higher is in the diabetes range; it needs a repeat test and a doctor. [P16]"},
 {m:"a1c",test:(x)=>x>=6.5,txt:"6.5% or higher is in the diabetes range. [P16]"},
 {m:"potassium",test:(x)=>x<3.0||x>6.0,txt:"Potassium this far out of range can disturb heart rhythm. With weakness or palpitations, go to the ER."},
 {m:"glucose",test:(x)=>x<3.0,txt:"Under 3.0 mmol/L is low enough to cause confusion or passing out. Eat fast sugar and get help if you feel off."},
 {m:"ldl",test:(x)=>x>=5.0,txt:"5.0 mmol/L or higher: Canadian guidelines recommend a statin at this level. [P15]"}
];
