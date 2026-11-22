/**
 * HTML templates that follow the table structure of four common lab report styles.
 * Fictional lab names, no logos, and a synthetic-data watermark on every page.
 */
import type { Case, Dates, Row, Section } from "./cases";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const parts = (iso: string) => iso.split("-").map(Number) as [number, number, number];
const us = (iso: string) => {
  const [y, m, d] = parts(iso);
  return `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${y}`;
};
const dmy = (iso: string) => {
  const [y, m, d] = parts(iso);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
};
const dMonY = (iso: string) => {
  const [y, m, d] = parts(iso);
  return `${String(d).padStart(2, "0")}-${MON[m - 1]}-${y}`;
};

const WATERMARK = `<div class="wm">SYNTHETIC TEST REPORT, NOT A REAL RESULT</div>`;
const BASE_CSS = `
  @page { size: 8.5in 11in; margin: 0 }
  * { box-sizing: border-box }
  body { margin: 0; background: #fff; color: #111 }
  .page { width: 8.5in; height: 11in; padding: 0.55in 0.6in; position: relative; overflow: hidden; page-break-after: always; background: #fff }
  .page:last-child { page-break-after: auto }
  .wm { position: absolute; bottom: 0.3in; left: 0; right: 0; text-align: center; font: 9px sans-serif; color: #777; letter-spacing: 1px }
  table { border-collapse: collapse; width: 100% }
  td, th { padding: 2px 4px; text-align: left; vertical-align: top; white-space: nowrap }
  .foot { position: absolute; bottom: 0.5in; right: 0.6in; font-size: 10px }
`;

function doc(css: string, pages: string[]) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}${css}</style></head><body>${pages
    .map((p, i) => `<div class="page">${p}<div class="foot">Page ${i + 1} of ${pages.length}</div>${WATERMARK}</div>`)
    .join("")}</body></html>`;
}

// ---------- LifeLabs style: Test | Result | Flag | Reference Range | Units, ISO dates, SI
function lifelabs(c: Case): string {
  const d = c.dates;
  const css = `.page { font: 11.5px Arial, "Liberation Sans", FreeSans, sans-serif }
    h1 { font-size: 17px; margin: 0 0 2px } .hd td { padding: 1px 6px 1px 0 } .sec td { font-weight: bold; padding-top: 10px }
    .res th { border-bottom: 1px solid #333; font-size: 11px } .flag { font-weight: bold }`;
  const header = `<h1>Maplewood Medical Laboratories</h1><div style="font-size:10px;margin-bottom:10px">Community Laboratory Services</div>
    <table class="hd"><tr><td>Patient: SAMPLE, ALEX</td><td>Date of Birth: ${d.dob}</td><td>Sex: ${c.sex.toUpperCase()}</td></tr>
    <tr><td>Ordering: Dr. T. Placeholder</td><td>Collected: ${d.collected} 08:${String(10 + (d.collected.charCodeAt(9) % 40))}</td><td>Received: ${d.received}</td></tr>
    <tr><td>Accession: 26-${c.id.length}04${c.id.slice(-2)}</td><td>Reported: ${d.reported}</td><td>Printed: ${d.printed}</td></tr></table><br>`;
  const body = (secs: Section[]) =>
    `<table class="res"><tr><th>Test</th><th>Result</th><th>Flag</th><th>Reference Range</th><th>Units</th></tr>${secs
      .map(
        (s) =>
          `<tr class="sec"><td colspan="5">${s.title}</td></tr>` +
          s.rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.value)}</td><td class="flag">${r.flag}</td><td>${esc(r.ref)}</td><td>${esc(r.unit)}</td></tr>`).join(""),
      )
      .join("")}</table>`;
  return doc(css, c.pages.map((p) => header + body(p)));
}

// ---------- Dynacare style: caps, monospace, Test | Result+flag | Units | Reference Interval, dd-MON-yyyy, optional 2-column CBC
function dynacare(c: Case): string {
  const d = c.dates;
  const css = `.page { font: 11.5px "Courier New", "Liberation Mono", FreeMono, monospace }
    h1 { font-size: 16px; margin: 0 } .hd td { padding: 1px 10px 1px 0 } .sec td { padding-top: 10px; text-decoration: underline }
    .res th { border-bottom: 1px dashed #333 } .two { display: flex; gap: 0.3in } .two table { width: auto }
    .res { table-layout: fixed } .res td:nth-child(1), .res th:nth-child(1) { width: 2.6in } .res td:nth-child(2), .res th:nth-child(2) { width: 1.1in }
    .res td:nth-child(3), .res th:nth-child(3) { width: 1.1in }`;
  const header = `<table class="hd" style="margin-bottom:6px"><tr><td><h1>NORTHSHORE DIAGNOSTICS</h1></td><td>REPORT DATE: ${dMonY(d.reported)}</td></tr></table>
    <table class="hd"><tr><td>NAME: SAMPLE, ALEX</td><td>DOB: ${dmy(d.dob)}</td><td>SEX: ${c.sex.toUpperCase()}</td></tr>
    <tr><td>COLLECTION DATE: ${dMonY(d.collected)} 07:45</td><td>DATE RECEIVED: ${dMonY(d.received)}</td><td>LAB NO: D${c.id.slice(-2)}7731</td></tr></table><br>`;
  const result = (r: Row) => esc(r.value) + (r.flag ? ` ${r.flag}` : "");
  const rowHtml = (r: Row) => `<tr><td>${esc(r.name)}</td><td>${result(r)}</td><td>${esc(r.unit)}</td><td>${esc(r.ref)}</td></tr>`;
  const body = (secs: Section[]) => {
    let out = "";
    for (const s of secs) {
      if (c.twoColCbc && s.title === "HEMATOLOGY" && s.rows.length > 2) {
        const half = Math.ceil(s.rows.length / 2);
        const col = (rows: Row[]) => `<table>${rows.map(rowHtml).join("")}</table>`;
        out += `<table><tr class="sec"><td>${s.title}</td></tr></table><div class="two">${col(s.rows.slice(0, half))}${col(s.rows.slice(half))}</div>`;
      } else {
        out += `<table class="res"><tr class="sec"><td>${s.title}</td><td></td><td></td><td></td></tr>${s.rows.map(rowHtml).join("")}</table>`;
      }
    }
    return `<table class="res"><tr><th>TEST</th><th>RESULT</th><th>UNITS</th><th>REFERENCE INTERVAL</th></tr></table>${out}`;
  };
  return doc(css, c.pages.map((p) => header + body(p)));
}

// ---------- Quest style: Test Name | In Range | Out Of Range | Reference Range (with units) | Lab, US dates
function quest(c: Case): string {
  const d = c.dates;
  const css = `.page { font: 11px Helvetica, Arial, "Liberation Sans", sans-serif }
    h1 { font-size: 15px; margin: 0 } .hd td { padding: 1px 12px 1px 0 } .sec td { font-weight: bold; background: #e6e6e6; padding: 3px 4px }
    .res th { font-size: 10px; border-bottom: 1px solid #000 } .oor { font-weight: bold }`;
  const header = `<table class="hd"><tr><td><h1>Ridgeline Clinical Labs</h1></td><td style="text-align:right">Report Status: Final</td></tr></table>
    <table class="hd" style="margin-top:6px"><tr><td>Patient Information</td><td>Specimen Information</td><td>Client Information</td></tr>
    <tr><td>SAMPLE, ALEX</td><td>Specimen: QR${c.id.slice(-2)}88213</td><td>Client #: 90210</td></tr>
    <tr><td>DOB: ${us(d.dob)} AGE: ${2026 - +d.dob.slice(0, 4)}</td><td>Collected: ${us(d.collected)} / 08:12 EDT</td><td>Dr. T. Placeholder</td></tr>
    <tr><td>Gender: ${c.sex.toUpperCase()}</td><td>Received: ${us(d.received)} / 10:02 EDT</td><td></td></tr>
    <tr><td>Fasting: Y</td><td>Reported: ${us(d.reported)} / 14:37 EDT</td><td></td></tr></table><br>`;
  const ref = (r: Row) => (r.ref ? `${esc(r.ref)} ${esc(r.unit)}` : esc(r.unit));
  const body = (secs: Section[]) =>
    `<table class="res"><tr><th>Test Name</th><th>In Range</th><th>Out Of Range</th><th>Reference Range</th><th>Lab</th></tr>${secs
      .map(
        (s) =>
          `<tr class="sec"><td colspan="5">${s.title}</td></tr>` +
          s.rows
            .map(
              (r) =>
                `<tr><td>${esc(r.name)}</td><td>${r.flag ? "" : esc(r.value)}</td><td class="oor">${r.flag ? esc(r.value) + " " + r.flag : ""}</td><td>${ref(r)}</td><td>EN</td></tr>`,
            )
            .join(""),
      )
      .join("")}</table>`;
  return doc(css, c.pages.map((p) => header + body(p)));
}

// ---------- LabCorp style: labels row then values row for dates; Test + lab code superscript | Current Result and Flag | Previous Result and Date | Units | Reference Interval
function labcorp(c: Case): string {
  const d: Dates = c.dates;
  const css = `.page { font: 11px Arial, "Liberation Sans", sans-serif }
    h1 { font-size: 15px; margin: 0 } .box td { border: 1px solid #999; padding: 2px 6px } .lbl td { font-size: 9px; color: #333 }
    .sec td { font-weight: bold; padding-top: 10px } .res th { font-size: 10px; border-bottom: 1px solid #000; white-space: normal } sup { font-size: 7px }`;
  const header = `<h1>Harborview Laboratory Services</h1><div style="font-size:10px;margin-bottom:8px">Patient Report</div>
    <table class="box"><tr class="lbl"><td>Patient Name</td><td>Patient ID</td><td>DOB</td><td>Age</td><td>Sex</td></tr>
    <tr><td>SAMPLE, ALEX</td><td>${c.id.length}7${c.id.slice(-2)}511</td><td>${us(d.dob)}</td><td>${2026 - +d.dob.slice(0, 4)}</td><td>${c.sex === "m" ? "Male" : "Female"}</td></tr></table>
    <table class="box" style="margin-top:6px"><tr class="lbl"><td>Specimen ID</td><td>Date Collected</td><td>Date Received</td><td>Date Reported</td><td>Fasting</td></tr>
    <tr><td>0${c.id.slice(-2)}-412-7781-0</td><td>${us(d.collected)}</td><td>${us(d.received)}</td><td>${us(d.reported)}</td><td>Yes</td></tr></table><br>`;
  const flag = (f: Row["flag"]) => (f === "H" ? "High" : f === "L" ? "Low" : "");
  const body = (secs: Section[]) =>
    `<table class="res"><tr><th>Tests</th><th>Current Result and Flag</th><th>Previous Result and Date</th><th>Units</th><th>Reference Interval</th></tr>${secs
      .map(
        (s) =>
          `<tr class="sec"><td colspan="5">${s.title}</td></tr>` +
          s.rows
            .map(
              (r) =>
                `<tr><td>${esc(r.name)} <sup>01</sup></td><td>${esc(r.value)} ${flag(r.flag)}</td><td>${r.prev ? `${esc(r.prev)} ${us(d.prevDraw)}` : ""}</td><td>${esc(r.unit)}</td><td>${esc(r.ref)}</td></tr>`,
            )
            .join(""),
      )
      .join("")}</table>`;
  return doc(css, c.pages.map((p) => header + body(p)));
}

export const RENDER: Record<Case["layout"], (c: Case) => string> = { lifelabs, dynacare, quest, labcorp };
