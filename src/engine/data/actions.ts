// Generated from the original single-file app; content unchanged.
import type { Dir } from "../types";

/** What to do, by marker and the direction it is off in. */
export const ACT: Record<string, Partial<Record<Dir, string[]>>> = {
 hematocrit:{up:["Drink plenty of water before the draw; dehydration reads high.","Short-acting testosterone injections carry the highest risk of high hematocrit. [P66]","On testosterone, guidelines hold it above 54%, check for sleep apnea, then restart at a lower dose. [P3]","In the HAARLEM study, hematocrit returned to baseline after cycles ended. [P2]","Whether you need phlebotomy is a doctor's call, not a DIY fix."]},
 hemoglobin:{up:["Hydrate before the draw.","Read it alongside hematocrit. [P3]"]},
 plt:{up:["Recheck. Platelets rose with hematocrit on cycles and fell back after. [P2]"]},
 alt:{up:["Retest after 7 days without lifting; one session kept ALT up for a week. [P12]","If CK is high and GGT is normal, it's more likely muscle than liver. [P65]","Add GGT. Lifting didn't raise it, so a high GGT points to the liver. [P12]","Skip alcohol and high-dose acetaminophen until it's sorted.","With an oral or a SARM in your stack, stopping it early is what prevents worse injury. [P6]"]},
 ast:{up:["Retest after 7 days without lifting. [P12]","Add GGT or CK to tell liver from muscle. [P12]"]},
 ggt:{up:["Lifting doesn't raise GGT, so take this one seriously. [P12]","Cut alcohol."]},
 bili:{up:["Yellow eyes or skin, itching or dark urine: go to urgent care. [P6]","Stop any oral steroid or SARM and see a doctor; most cases improve after stopping. [P6]"]},
 alp:{up:["Ask for GGT to tell liver from bone. [P14]"]},
 ck:{up:["Expected for days after hard training; retest after 7 days off. [P12]","Very high CK with muscle pain, weakness or dark urine needs urgent care."]},
 creatinine:{up:["Ask for cystatin C. Muscle and creatine don't affect it, and combined with creatinine it's more accurate. [P13]","Tell your doctor you take creatine. [P11]"]},
 cystatin:{up:["Unlike creatinine, this isn't a creatine or muscle artifact. Follow up with a doctor. [P13]"]},
 urea:{up:["Usually high protein intake or dehydration."]},
 ldl:{up:["Swap saturated fat for unsaturated fats; trials show it lowers LDL. [P18]","Ask for ApoB, which counts the particles directly. [P22]","At 5.0 mmol/L or above, Canadian guidelines recommend treatment. [P15]"]},
 hdl:{down:["Do 2+ hours of cardio a week; session length mattered more than intensity. [P17]","Orals and SARMs hit HDL hardest. In studies it recovered after stopping. [P2] [P5]","Ask for ApoB to see the full risk picture. [P22]"]},
 tg:{up:["Avoid a big meal the night before the test.","Cut sugar and alcohol."],down:["Low triglycerides aren't a problem on their own."]},
 apob:{up:["Swap saturated fat for unsaturated fats. [P18]","Cut the oral or SARM if you're on one. [P2]"]},
 glucose:{up:["Confirm you fasted 8+ hours.","Walk for a few minutes after meals and through the day. [P19]","On MK-677 or GH, rising glucose is a known effect; get an A1c. [P8]","6.1–6.9 mmol/L is impaired fasting glucose; 7.0+ is the diabetes range. [P16]"],down:["Low fasting glucose on a GLP-1 drug can happen; tell your prescriber if you feel shaky."]},
 a1c:{up:["Walk after meals. [P19]","On MK-677 or GH, this is a known effect. [P8]","6.0–6.4% is prediabetes; 6.5%+ is the diabetes range. [P16]"]},
 igf1:{up:["High IGF-1 means high GH exposure. Check fasting glucose and A1c too. [P8]"]},
 testo:{down:["Sleep 7–9 hours. A week of 5-hour nights cut testosterone 10–15% in young men. [P20]","After steroids or SARMs, low natural testosterone usually means suppression. See a doctor about recovery rather than guessing."],up:["Above-range testosterone means outside hormones. Watch hematocrit and HDL. [P2]"]},
 lh:{down:["Near-zero LH means your own production is shut off. In HAARLEM it recovered after cycles, slowly. [P2]","See a doctor, ideally an endocrinologist, about recovery and fertility."]},
 estradiol:{up:["Usually from testosterone converting to estrogen.","Ask a doctor before trying to push it down; very low estradiol has its own harms."]},
 tsh:{down:["Expected on thyroid hormone. Long-term suppression is a medical issue; see a doctor."]},
 ft4:{up:["Too much thyroid hormone can cause fast heart rate and bone loss; see a doctor."]},
 potassium:{down:["Low potassium can cause weakness and dangerous heart rhythms. If it's under 3.0 or you have palpitations, get seen today."],up:["Often a lab artifact from a hard-to-draw sample. Ask for a repeat before worrying."]},
 psa:{up:["Testosterone can raise PSA; guidelines monitor it on TRT. [P3]","A rising PSA needs a doctor, especially if you're over 40."]},
 ferritin:{down:["Eat heme iron: red meat, chicken thighs, mussels.","If you need a supplement, ask about every-other-day dosing; it absorbs better. [P23]"]}
};
