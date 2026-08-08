import "server-only";

import { randomUUID } from "crypto";
import { google } from "googleapis";
import { getGoogleEnv } from "@/lib/env";
import { callServiceReportGateway } from "@/lib/service-report-store";

export const SERVICE_REPORT_WORKBOOK_ID = "1QuNstJwL2wxBgM-bwa83r8rU9PZNln3tmih6DOBG2oY";
export const SERVICE_REPORT_WORKBOOK_URL = `https://docs.google.com/spreadsheets/d/${SERVICE_REPORT_WORKBOOK_ID}/edit`;

export const ACTIVITY_HEADERS = [
  "Event ID", "Logged At", "Date", "Service", "Category", "Action",
  "Actor", "Summary", "Record ID", "Status",
];

let cachedSheets: ReturnType<typeof google.sheets> | null = null;
const verifiedTabs = new Set<string>();

function sheetsClient() {
  if (cachedSheets) return cachedSheets;
  const env = getGoogleEnv();
  const auth = new google.auth.JWT({
    email: env.serviceAccountEmail,
    key: env.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  cachedSheets = google.sheets({ version: "v4", auth });
  return cachedSheets;
}

function escapeTitle(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

async function appendRow(title: string, headers: string[], row: unknown[]) {
  if (row.length !== headers.length) throw new Error(`${title} row does not match its configured columns.`);
  const sheets = sheetsClient();
  const sheet = escapeTitle(title);
  if (!verifiedTabs.has(title)) {
    const headerResult = await sheets.spreadsheets.values.get({
      spreadsheetId: SERVICE_REPORT_WORKBOOK_ID,
      range: `${sheet}!1:1`,
    });
    const current = (headerResult.data.values?.[0] || []).map((value) => String(value).trim());
    if (headers.some((header, index) => current[index] !== header)) {
      throw new Error(`The "${title}" tab is missing or has incompatible columns.`);
    }
    verifiedTabs.add(title);
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId: SERVICE_REPORT_WORKBOOK_ID,
    range: `${sheet}!A:ZZ`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

export async function appendCategorizedReport(input: {
  tab: string;
  headers: string[];
  row: unknown[];
  date: string;
  service: string;
  category: string;
  actor: string;
  summary: string;
}) {
  const recordId = randomUUID();
  const loggedAt = new Date().toISOString();
  await appendRow(input.tab, input.headers, [recordId, ...input.row, loggedAt]);
  await appendRow("Activity Log", ACTIVITY_HEADERS, [
    randomUUID(), loggedAt, input.date, input.service, input.category,
    "Saved", input.actor, input.summary, recordId, "Success",
  ]);
  return recordId;
}

export async function appendGeneratedDocumentLog(input: {
  date: string;
  service: string;
  url: string;
  actor?: string;
  requestId?: string;
}) {
  const loggedAt = new Date().toISOString();
  const fingerprint = `document:full:${input.date}:${input.service}`;
  const result = await callServiceReportGateway<{ row?: { id?: unknown } }>("document.insert", {
    source_record_id: input.requestId || null,
    report_date: input.date,
    service: input.service,
    document_url: input.url,
    status: "Ready",
    generated_by: input.actor || "Service Manager",
    generated_at: loggedAt,
    source_fingerprint: fingerprint,
  });
  const recordId = typeof result.row?.id === "string" ? result.row.id : input.requestId || fingerprint;
  await callServiceReportGateway("activity.insert", {
    source_event_id: input.requestId || null,
    logged_at: loggedAt,
    report_date: input.date,
    service: input.service,
    category: "Document",
    action: "Generated",
    actor: input.actor || "Service Manager",
    summary: "Detailed service document generated",
    source_record_id: recordId,
    status: "Success",
    source_fingerprint: `activity:${fingerprint}`,
  }).catch((error) => console.error("[service-report] Document activity logging failed", error instanceof Error ? error.message : error));
  return { recordId, workbookUrl: SERVICE_REPORT_WORKBOOK_URL };
}

export async function findGeneratedDocument(date: string, service: string) {
  const result = await callServiceReportGateway<{ row?: { id?: unknown; document_url?: unknown; status?: unknown } }>("document.find", { date, service });
  if (!result.row || result.row.status !== "Ready" || typeof result.row.document_url !== "string") return null;
  return { id: typeof result.row.id === "string" ? result.row.id : "", url: result.row.document_url };
}

export async function appendEmailDeliveryLog(input: {
  date: string;
  service: string;
  recipient: string;
  reportType: "summary" | "full";
  subject: string;
  providerMessageId: string;
  documentUrl?: string;
  requestId?: string;
}) {
  const loggedAt = new Date().toISOString();
  const fingerprint = `email:${input.requestId || input.providerMessageId}`;
  const result = await callServiceReportGateway<{ row?: { id?: unknown } }>("email.insert", {
    source_message_id: input.requestId || null,
    sent_at: loggedAt,
    report_date: input.date,
    service: input.service,
    recipient: input.recipient,
    report_type: input.reportType,
    subject: input.subject,
    provider_message_id: input.providerMessageId,
    status: "Sent",
    document_url: input.documentUrl || null,
    source_fingerprint: fingerprint,
  });
  const recordId = typeof result.row?.id === "string" ? result.row.id : input.requestId || fingerprint;
  await callServiceReportGateway("activity.insert", {
    source_event_id: input.requestId || null,
    logged_at: loggedAt,
    report_date: input.date,
    service: input.service,
    category: "Email",
    action: "Sent",
    actor: input.recipient,
    summary: `${input.reportType === "full" ? "Full report" : "Summary"} emailed`,
    source_record_id: recordId,
    status: "Success",
    source_fingerprint: `activity:${fingerprint}`,
  }).catch((error) => console.error("[service-report] Email activity logging failed", error instanceof Error ? error.message : error));
  return recordId;
}
