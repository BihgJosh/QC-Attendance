import "server-only";

import { google } from "googleapis";
import { getGoogleEnv } from "@/lib/env";

const DEFAULT_DOCUMENT_ID = "1_RWF0qv-cF0MoLz53OxaxHmeVt1ODbEsYtyMwzxTLE0";
const DEFAULT_DOCUMENT_URL = `https://docs.google.com/document/d/${DEFAULT_DOCUMENT_ID}/edit?tab=t.0#heading=h.d7kpq9sl19wa`;

type HeadcountRow = { department?: unknown; adults?: unknown; children?: unknown; total?: unknown };
export type HeadcountService = { service: string; headcount: { grandTotal?: unknown; byDepartment?: HeadcountRow[] } };
type DisplayRow = { label: string; adults: number; children: number };

const SECTION_RULES = [
  { title: "MAIN CHURCH", rows: [
    { label: "Row 1: FrontRow1 + BackRow1", matches: ["frontrow1", "backrow1"] },
    { label: "Row 2: FrontRow2 + BackRow2 & Media", matches: ["frontrow2", "backrow2", "media"] },
    { label: "Row 3: FrontRow3 + BackRow3", matches: ["frontrow3", "backrow3"] },
    { label: "Row 4: FrontRow4 + BackRow4 & Back Media", matches: ["frontrow4", "backrow4", "backmedia"] },
  ] },
  { title: "OVERFLOW", rows: [1, 2, 3, 4].map((row) => ({ label: `Row ${row}`, matches: [`overflowrow${row}`, `overflow${row}`] })) },
  { title: "CHILDREN'S CHURCH (MIGHTY ARROWS & TEENS)", rows: [{ label: "Mighty Arrows & Teens", matches: ["mightyarrows", "teens", "childrenschurch", "childrensection"] }] },
  { title: "OUTSIDE", rows: [
    { label: "Vendors Gate", matches: ["vendorsgate", "vendorgate"] },
    { label: "Emporium & Toilet", matches: ["emporium", "toilet"] },
    { label: "Main Gate", matches: ["maingate"] },
  ] },
];

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}

function adjustedTotal(value: number) {
  return Math.ceil(value * 1.02);
}

function normalize(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function organizeHeadcount(rows: HeadcountRow[]) {
  const source = rows.flatMap((row, index) => row && typeof row === "object" ? [{ index, department: String(row.department || "Unspecified"), normalized: normalize(row.department), adults: numberValue(row.adults), children: numberValue(row.children) }] : []);
  const used = new Set<number>();
  const sections = SECTION_RULES.map((section) => ({ title: section.title, rows: section.rows.map((rule): DisplayRow => {
    const matched = source.filter((item) => !used.has(item.index) && rule.matches.some((match) => match === "media" ? item.normalized === "media" : item.normalized.includes(match)));
    matched.forEach((item) => used.add(item.index));
    return { label: rule.label, adults: matched.reduce((sum, item) => sum + item.adults, 0), children: matched.reduce((sum, item) => sum + item.children, 0) };
  }) }));
  const otherRows = source.filter((item) => !used.has(item.index)).map((item): DisplayRow => ({ label: item.department, adults: item.adults, children: item.children }));
  if (otherRows.length) sections.push({ title: "OTHER AREAS", rows: otherRows });
  const totals = source.reduce((sum, item) => ({ adults: sum.adults + item.adults, children: sum.children + item.children }), { adults: 0, children: 0 });
  return { sections, totals, grandTotal: totals.adults + totals.children };
}

function serviceText(input: HeadcountService) {
  const organized = organizeHeadcount(Array.isArray(input.headcount.byDepartment) ? input.headcount.byDepartment : []);
  const reported = numberValue(input.headcount.grandTotal);
  const displayedGrandTotal = adjustedTotal(organized.grandTotal || reported);
  const sections = organized.sections.map((section) => `${section.title}\n${section.rows.map((row) => `${row.label}\nAdult = ${row.adults}  |  Children = ${row.children}`).join("\n\n")}`).join("\n\n");
  const warning = organized.grandTotal > 0 && reported > 0 && reported !== organized.grandTotal ? `\nReconciliation notice: submitted area rows total ${organized.grandTotal}, while the service report records ${reported}. Please verify the source entries.` : "";
  const splitNote = organized.grandTotal === 0 && reported > 0 ? "\nAdult/children breakdown was not submitted for this service." : "";
  return `${input.service.toUpperCase()}\n\n${sections}\n\nSubtotal — Adult: ${organized.totals.adults}  |  Children: ${organized.totals.children}\nGrand Total = ${displayedGrandTotal}${splitNote}${warning}`;
}

function documentText(date: string, services: HeadcountService[]) {
  const combined = services.reduce((sum, service) => {
    const organized = organizeHeadcount(Array.isArray(service.headcount.byDepartment) ? service.headcount.byDepartment : []);
    return { adults: sum.adults + organized.totals.adults, children: sum.children + organized.totals.children, grand: sum.grand + adjustedTotal(organized.grandTotal || numberValue(service.headcount.grandTotal)) };
  }, { adults: 0, children: 0, grand: 0 });
  const summary = services.length > 1 ? `ALL SERVICES COMBINED\nAdults: ${combined.adults}  |  Children: ${combined.children}\nGrand Total = ${combined.grand}\n\n` : "";
  return `QC SERVICE HEADCOUNT\nService date: ${date}  ·  Updated: ${new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}\n\n${summary}${services.map(serviceText).join("\n\n────────────────────────────────────────\n\n")}\n`;
}

function docsClient() {
  const env = getGoogleEnv();
  const auth = new google.auth.JWT({ email: env.serviceAccountEmail, key: env.privateKey, scopes: ["https://www.googleapis.com/auth/documents"] });
  return google.docs({ version: "v1", auth });
}

let updateQueue = Promise.resolve();

async function performUpdate(date: string, services: HeadcountService[]) {
  if (!services.length) throw new Error("No headcount data is available for this selection.");
  const documentId = process.env.HEADCOUNT_GOOGLE_DOC_ID || DEFAULT_DOCUMENT_ID;
  const docs = docsClient();
  const content = documentText(date, services);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await docs.documents.get({ documentId });
    const endIndex = current.data.body?.content?.at(-1)?.endIndex || 1;
    const requests: Array<Record<string, unknown>> = [];
    if (endIndex > 2) requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } });
    requests.push({ insertText: { location: { index: 1 }, text: content } });
    requests.push({ updateTextStyle: { range: { startIndex: 1, endIndex: content.length + 1 }, textStyle: { weightedFontFamily: { fontFamily: "Arial" }, fontSize: { magnitude: 10, unit: "PT" }, foregroundColor: { color: { rgbColor: { red: 0.09, green: 0.13, blue: 0.2 } } } }, fields: "weightedFontFamily,fontSize,foregroundColor" } });
    try {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests,
          ...(current.data.revisionId ? { writeControl: { requiredRevisionId: current.data.revisionId } } : {}),
        },
      }, { timeout: 15_000 });
      break;
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
  return { id: documentId, url: documentId === DEFAULT_DOCUMENT_ID ? DEFAULT_DOCUMENT_URL : `https://docs.google.com/document/d/${documentId}/edit` };
}

export function updateHeadcountGoogleDocument(date: string, services: HeadcountService[]) {
  const operation = updateQueue.then(() => performUpdate(date, services));
  updateQueue = operation.then(() => undefined, () => undefined);
  return operation;
}
