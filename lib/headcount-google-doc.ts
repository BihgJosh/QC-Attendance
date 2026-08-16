import "server-only";

import { google } from "googleapis";
import { getGoogleEnv } from "@/lib/env";

type HeadcountRow = { department?: unknown; adults?: unknown; children?: unknown; total?: unknown };
export type HeadcountService = { service: string; headcount: { grandTotal?: unknown; byDepartment?: HeadcountRow[] } };
type DisplayRow = { label: string; adults: number; children: number };
type DocumentTab = {
  tabProperties?: { tabId?: string | null; title?: string | null } | null;
  documentTab?: { body?: { content?: Array<{ endIndex?: number | null }> | null } | null } | null;
  childTabs?: DocumentTab[] | null;
};

const DEFAULT_DOCUMENT_ID = "1_RWF0qv-cF0MoLz53OxaxHmeVt1ODbEsYtyMwzxTLE0";
const DEFAULT_FINAL_DOCUMENT_ID = "1Krr4FVgAUzDccZTRUkOiA2216Sdb_tK4Je6lrGOI340";
const DOCS_READ_TIMEOUT_MS = 45_000;
const DOCS_WRITE_TIMEOUT_MS = 60_000;
const SUNDAY_SERVICES = ["1st Service", "2nd Service", "3rd Service", "4th Service"];
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
  return Math.round(value * 1.02);
}

function normalize(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-NG").format(value);
}

function reportDate(date: string) {
  const parsed = new Date(`${date}T12:00:00+01:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Choose a valid report date.");
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos", weekday: "long", year: "numeric", month: "long", day: "2-digit",
  }).format(parsed);
}

function tabTitle(date: string, services: HeadcountService[]) {
  const label = reportDate(date).replace(/^Sunday,\s*/i, "");
  return SUNDAY_SERVICES.every((service) => services.some((item) => item.service === service))
    ? label
    : `${label} · ${services.map((item) => item.service.replace(" Service", "")).join(", ")}`;
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

function serviceBreakdown(rows: HeadcountRow[]) {
  const source = rows.map((row, index) => ({
    index,
    label: String(row?.department || "Unspecified").trim() || "Unspecified",
    key: normalize(row?.department),
    adults: numberValue(row?.adults),
    children: numberValue(row?.children),
  }));
  const used = new Set<number>();
  const take = (matches: string[]) => {
    const selected = source.filter((item) => !used.has(item.index) && matches.some((match) => match === "media" ? item.key === "media" : item.key.includes(match)));
    selected.forEach((item) => used.add(item.index));
    return selected;
  };
  const main = SECTION_RULES[0].rows.map((rule, index) => ({ label: `Main Church – Row ${index + 1}`, rows: take(rule.matches) }));
  const overflow = take(["overflow"]);
  const children = take(["mightyarrows", "teens", "youth", "childrenschurch", "childrensection"]);
  const outside = take(["outside", "vendorsgate", "vendorgate", "emporium", "toilet", "maingate"]);
  const other = source.filter((item) => !used.has(item.index));
  const sum = (items: typeof source, field: "adults" | "children") => items.reduce((total, item) => total + item[field], 0);
  const equation = (items: typeof source) => {
    const values = items.map((item) => item.adults);
    if (!values.length) return "0";
    if (values.length === 1) return formatCount(values[0]);
    return `${values.map(formatCount).join(" + ")} = ${formatCount(values.reduce((total, value) => total + value, 0))}`;
  };
  const aggregate = (title: string, items: typeof source) => [
    title,
    `Adults = ${formatCount(sum(items, "adults"))}`,
    `Children = ${formatCount(sum(items, "children"))}`,
    `Total = ${formatCount(sum(items, "adults") + sum(items, "children"))}`,
  ].join("\n");
  return [
    "MAIN CHURCH",
    ...main.flatMap((row) => [row.label, `Adults = ${equation(row.rows)}`, `Children = ${formatCount(sum(row.rows, "children"))}`, ""]),
    aggregate("OVERFLOW", overflow),
    "",
    aggregate("CHILDREN'S CHURCH", children),
    "",
    aggregate("OUTSIDE", outside),
    ...(other.length ? ["", "OTHER AREAS", ...other.flatMap((row) => [`${row.label}`, `Adults = ${formatCount(row.adults)}`, `Children = ${formatCount(row.children)}`, `Total = ${formatCount(row.adults + row.children)}`])] : []),
  ].join("\n");
}

function serviceTotals(input: HeadcountService) {
  const organized = organizeHeadcount(Array.isArray(input.headcount.byDepartment) ? input.headcount.byDepartment : []);
  const reported = numberValue(input.headcount.grandTotal);
  return {
    adults: organized.totals.adults,
    children: organized.totals.children,
    total: organized.grandTotal || reported,
    hasBreakdown: organized.grandTotal > 0,
  };
}

function documentText(date: string, services: HeadcountService[]) {
  const ordered = [...services].sort((left, right) => SUNDAY_SERVICES.indexOf(left.service) - SUNDAY_SERVICES.indexOf(right.service));
  const detailed = ordered.map((service) => ({
    service: service.service,
    breakdown: serviceBreakdown(Array.isArray(service.headcount.byDepartment) ? service.headcount.byDepartment : []),
    ...serviceTotals(service),
  }));
  const totals = detailed.map(({ service, adults, children, total, hasBreakdown }) => ({ service, adults, children, total, hasBreakdown }));
  const combined = totals.reduce((sum, service) => ({ adults: sum.adults + service.adults, children: sum.children + service.children, total: sum.total + service.total }), { adults: 0, children: 0, total: 0 });
  const serviceSections = detailed.map((service) => {
    const breakdown = service.hasBreakdown
      ? service.breakdown
      : "LOCATION BREAKDOWN\nAdult/children figures were not submitted by location.";
    return [
      service.service.toUpperCase(),
      breakdown,
      "",
      `Total Service Adults =\t${formatCount(service.adults)}`,
      `Total Service Children =\t${formatCount(service.children)}`,
      `Total =\t${formatCount(service.total)}`,
      `2% Margin Total =\t${formatCount(adjustedTotal(service.total))}`,
    ].join("\n");
  }).join("\n\n");
  return [
    "QUALITY CONTROL SOJA",
    "SUNDAY ATTENDANCE HEADCOUNT",
    reportDate(date),
    "Main Auditorium · Children’s Church · Youth Church · Overflow · Outside",
    "",
    serviceSections,
    "",
    ...(services.length > 1 ? [
      "CONSOLIDATED TOTALS",
      `Adults\t${formatCount(combined.adults)}`,
      `Children\t${formatCount(combined.children)}`,
      `Grand Total\t${formatCount(combined.total)}`,
      `2% Margin of Error\t${formatCount(adjustedTotal(combined.total))}`,
    ] : []),
    "",
    `Generated from verified QC service submissions · ${new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })}`,
  ].join("\n");
}

function finalDocumentText(date: string, services: HeadcountService[]) {
  const ordered = [...services].sort((left, right) => SUNDAY_SERVICES.indexOf(left.service) - SUNDAY_SERVICES.indexOf(right.service));
  const totals = ordered.map((service) => ({ service: service.service, ...serviceTotals(service) }));
  const combined = totals.reduce((sum, service) => ({ adults: sum.adults + service.adults, children: sum.children + service.children }), { adults: 0, children: 0 });
  const grandTotal = combined.adults + combined.children;
  const serviceSections = totals.map((service) => [
    service.service.toUpperCase(),
    `Adults =\t${formatCount(service.adults)}`,
    `Children =\t${formatCount(service.children)}`,
  ].join("\n")).join("\n\n");
  return [
    "QUALITY CONTROL SOJA",
    "FINAL SUNDAY HEADCOUNT",
    reportDate(date),
    "",
    serviceSections,
    "",
    "CONSOLIDATED TOTALS",
    `All Adults =\t${formatCount(combined.adults)}`,
    `All Children =\t${formatCount(combined.children)}`,
    `Total =\t${formatCount(grandTotal)}`,
    `2% margin of error =\t${formatCount(adjustedTotal(grandTotal))}`,
    "",
    `Generated from verified QC service submissions · ${new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })}`,
  ].join("\n");
}

function docsClient() {
  const env = getGoogleEnv();
  const auth = new google.auth.JWT({ email: env.serviceAccountEmail, key: env.privateKey, scopes: ["https://www.googleapis.com/auth/documents"] });
  return google.docs({ version: "v1", auth });
}

function allTabs(tabs: DocumentTab[] = []): DocumentTab[] {
  return tabs.flatMap((tab) => [tab, ...allTabs(tab.childTabs || [])]);
}

function styleRequests(content: string, tabId: string) {
  const range = (startIndex: number, endIndex: number) => ({ startIndex, endIndex, tabId });
  const requests: Array<Record<string, unknown>> = [
    { updateTextStyle: { range: range(1, content.length + 1), textStyle: { weightedFontFamily: { fontFamily: "Arial" }, fontSize: { magnitude: 11, unit: "PT" }, foregroundColor: { color: { rgbColor: { red: 0.08, green: 0.12, blue: 0.2 } } } }, fields: "weightedFontFamily,fontSize,foregroundColor" } },
    { updateParagraphStyle: { range: range(1, content.length + 1), paragraphStyle: { spaceBelow: { magnitude: 6, unit: "PT" }, lineSpacing: 115 }, fields: "spaceBelow,lineSpacing" } },
  ];
  const styledLines = content.split("\n");
  let cursor = 1;
  styledLines.forEach((line, index) => {
    const start = cursor;
    const end = start + line.length;
    const isBrand = index === 0;
    const isTitle = index === 1;
    const isService = SUNDAY_SERVICES.some((service) => line === service.toUpperCase());
    const isTotals = line === "CONSOLIDATED TOTALS";
    const isGrandTotal = line.startsWith("Grand Total\t") || line.startsWith("2% Margin of Error\t") || line.startsWith("Total =\t") || line.startsWith("2% margin of error =\t");
    if (line && (isBrand || isTitle || isService || isTotals || isGrandTotal)) {
      requests.push({ updateTextStyle: { range: range(start, end), textStyle: { bold: true, fontSize: { magnitude: isTitle ? 18 : isBrand ? 10 : 12, unit: "PT" }, foregroundColor: { color: { rgbColor: isTitle || isTotals ? { red: 0.25, green: 0.08, blue: 0.65 } : { red: 0.04, green: 0.16, blue: 0.3 } } } }, fields: "bold,fontSize,foregroundColor" } });
    }
    if (isBrand || isTitle || index === 2 || index === 3) {
      requests.push({ updateParagraphStyle: { range: range(start, end + 1), paragraphStyle: { alignment: "CENTER" }, fields: "alignment" } });
    }
    cursor = end + 1;
  });
  return requests;
}

let updateQueue = Promise.resolve();

function googleStatus(error: unknown) {
  if (!error || typeof error !== "object") return 0;
  const candidate = error as { code?: unknown; status?: unknown; response?: { status?: unknown } };
  return Number(candidate.response?.status || candidate.status || candidate.code || 0);
}

function googleMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Unknown Google Docs error");
}

function isTimeoutError(error: unknown) {
  const message = googleMessage(error);
  return googleStatus(error) === 0 && /aborted|abort|timeout|timed out|etimedout/i.test(message);
}

function isTransientGoogleError(error: unknown) {
  const status = googleStatus(error);
  return isTimeoutError(error) || status === 409 || status === 429 || status >= 500;
}

export function describeHeadcountGoogleError(error: unknown) {
  const status = googleStatus(error);
  const message = googleMessage(error);
  const reason = isTimeoutError(error)
    ? "timeout"
    : status === 403 ? "permission"
    : status === 404 ? "not_found"
    : status === 400 ? "invalid_request"
    : status === 409 ? "revision_conflict"
    : status === 429 ? "rate_limited"
    : status >= 500 ? "google_unavailable"
    : "unknown";
  return { status, reason, message: message.slice(0, 500) };
}

async function updateDocument(date: string, services: HeadcountService[], documentId: string, content: string) {
  if (!services.length) throw new Error("No headcount data is available for this selection.");
  const docs = docsClient();
  const title = tabTitle(date, services);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const current = await docs.documents.get(
        { documentId, includeTabsContent: true },
        { timeout: DOCS_READ_TIMEOUT_MS },
      );
      const tabs = allTabs((current.data.tabs || []) as DocumentTab[]);
      let target = tabs.find((tab) => tab.tabProperties?.title === title);
      let revisionId = current.data.revisionId || undefined;

      if (!target?.tabProperties?.tabId) {
        const created = await docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [{ addDocumentTab: { tabProperties: { title } } } as never],
            ...(revisionId ? { writeControl: { requiredRevisionId: revisionId } } : {}),
          },
        }, { timeout: DOCS_WRITE_TIMEOUT_MS });
        const response = created.data.replies?.[0] as unknown as { addDocumentTab?: { tabProperties?: { tabId?: string } } };
        const tabId = response?.addDocumentTab?.tabProperties?.tabId;
        if (!tabId) throw new Error("Google Docs created the report tab but did not return its ID.");
        target = { tabProperties: { tabId, title }, documentTab: { body: { content: [{ endIndex: 2 }] } } };
        revisionId = created.data.writeControl?.requiredRevisionId || created.data.writeControl?.targetRevisionId || undefined;
      }

      const tabId = target?.tabProperties?.tabId;
      if (!tabId) throw new Error("The dated Google Docs tab could not be resolved.");
      const endIndex = target.documentTab?.body?.content?.at(-1)?.endIndex || 1;
      const requests: Array<Record<string, unknown>> = [];
      if (endIndex > 2) requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1, tabId } } });
      requests.push({ insertText: { location: { index: 1, tabId }, text: content } });
      requests.push(...styleRequests(content, tabId));
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: requests as never[],
          ...(revisionId ? { writeControl: { targetRevisionId: revisionId } } : {}),
        },
      }, { timeout: DOCS_WRITE_TIMEOUT_MS });
      return { id: documentId, tabId, title, url: `https://docs.google.com/document/d/${documentId}/edit?tab=${encodeURIComponent(tabId)}` };
    } catch (error) {
      if (attempt === 1 || !isTransientGoogleError(error)) throw error;
    }
  }
  throw new Error("The headcount document could not be updated.");
}

async function performUpdate(date: string, services: HeadcountService[], options?: { documentId?: string; content?: string }) {
  const content = options?.content || documentText(date, services);
  if (options?.documentId) return updateDocument(date, services, options.documentId, content);

  const configured = process.env.HEADCOUNT_GOOGLE_DOC_ID?.trim();
  const candidates = [...new Set([configured, DEFAULT_DOCUMENT_ID].filter((id): id is string => Boolean(id)))];
  let lastError: unknown;
  for (const documentId of candidates) {
    try {
      return await updateDocument(date, services, documentId, content);
    } catch (error) {
      lastError = error;
      const status = googleStatus(error);
      const canUseFallback = documentId !== DEFAULT_DOCUMENT_ID && (status === 403 || status === 404);
      if (!canUseFallback) throw error;
      console.warn("[headcount-google-doc] Configured document is inaccessible; using the writable service headcount document.");
    }
  }
  throw lastError || new Error("The headcount document could not be updated.");
}

export function updateHeadcountGoogleDocument(date: string, services: HeadcountService[]) {
  const operation = updateQueue.then(() => performUpdate(date, services));
  updateQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export function updateFinalHeadcountGoogleDocument(date: string, services: HeadcountService[]) {
  const documentId = process.env.FINAL_HEADCOUNT_GOOGLE_DOC_ID?.trim() || DEFAULT_FINAL_DOCUMENT_ID;
  const operation = updateQueue.then(() => performUpdate(date, services, { documentId, content: finalDocumentText(date, services) }));
  updateQueue = operation.then(() => undefined, () => undefined);
  return operation;
}
