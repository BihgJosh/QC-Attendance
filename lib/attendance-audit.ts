import "server-only";

import { google, sheets_v4 } from "googleapis";
import { getAttendanceRecords, getWhitelist } from "@/lib/attendance-store";
import { getGoogleEnv } from "@/lib/env";
import type { AttendanceRecord } from "@/types";

const AUDIT_SHEET_TITLE = "Attendance Audit";
const MAX_SERVICE_COLUMNS = 200;

export type AuditFilters = {
  from?: string;
  to?: string;
  service?: string;
};

export type AuditServiceColumn = {
  key: string;
  date: string;
  service: string;
  label: string;
};

export type AttendanceAuditMatrix = {
  generatedAt: string;
  members: string[];
  columns: AuditServiceColumn[];
  rows: Array<{ memberName: string; times: string[] }>;
  approvedCount: number;
};

function validDate(value: string | undefined) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-NG");
}

function normalizeDate(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) return "";
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  return `${match[3]}-${month}-${day}`;
}

function timeValue(value: string) {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i.exec(value.trim());
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hours = Number(match[1]) % 12;
  if (match[4].toUpperCase() === "PM") hours += 12;
  return hours * 3600 + Number(match[2]) * 60 + Number(match[3] || 0);
}

function formatDate(date: string) {
  const parsed = new Date(`${date}T12:00:00+01:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function recordIsInRange(record: AttendanceRecord, filters: AuditFilters) {
  const date = normalizeDate(record.date);
  if (!date) return false;
  if (filters.from && date < filters.from) return false;
  if (filters.to && date > filters.to) return false;
  if (filters.service && filters.service !== "All" && record.service !== filters.service) return false;
  return true;
}

export function validateAuditFilters(filters: AuditFilters) {
  if (!validDate(filters.from) || !validDate(filters.to)) throw new Error("Use valid start and end dates.");
  if (filters.from && filters.to && filters.from > filters.to) throw new Error("The start date must be before the end date.");
  if (filters.service && !["All", "Sunday", "Thursday", "Other"].includes(filters.service)) throw new Error("Select a valid service.");
}

export async function buildAttendanceAudit(filters: AuditFilters): Promise<AttendanceAuditMatrix> {
  validateAuditFilters(filters);
  const [roster, allRecords] = await Promise.all([getWhitelist(), getAttendanceRecords()]);
  const records = allRecords.filter((record) => recordIsInRange(record, filters));

  const memberNames = new Map<string, string>();
  for (const name of roster) if (normalize(name)) memberNames.set(normalize(name), name.trim().replace(/\s+/g, " "));
  for (const record of allRecords) if (normalize(record.memberName) && !memberNames.has(normalize(record.memberName))) memberNames.set(normalize(record.memberName), record.memberName.trim().replace(/\s+/g, " "));

  const serviceColumns = new Map<string, AuditServiceColumn>();
  for (const record of records) {
    const date = normalizeDate(record.date);
    const key = `${date}\u0000${record.service}`;
    if (!serviceColumns.has(key)) serviceColumns.set(key, { key, date, service: record.service || "Unspecified", label: formatDate(date) });
  }
  const columns = [...serviceColumns.values()].sort((a, b) => a.date.localeCompare(b.date) || a.service.localeCompare(b.service));
  if (columns.length > MAX_SERVICE_COLUMNS) throw new Error(`This range contains ${columns.length} services. Narrow it to ${MAX_SERVICE_COLUMNS} services or fewer.`);

  const earliest = new Map<string, string>();
  for (const record of records) {
    if (record.status !== "Approved") continue;
    const key = `${normalize(record.memberName)}\u0001${normalizeDate(record.date)}\u0000${record.service}`;
    const current = earliest.get(key);
    if (!current || timeValue(record.time) < timeValue(current)) earliest.set(key, record.time);
  }

  const members = [...memberNames.values()].sort((a, b) => a.localeCompare(b, "en-NG", { sensitivity: "base" }));
  const rows = members.map((memberName) => ({
    memberName,
    times: columns.map((column) => earliest.get(`${normalize(memberName)}\u0001${column.key}`) || ""),
  }));
  return { generatedAt: new Date().toISOString(), members, columns, rows, approvedCount: earliest.size };
}

function sheetClient() {
  const env = getGoogleEnv();
  if (!env.sheetId || !env.serviceAccountEmail || !env.privateKey) throw new Error("Google Sheets is not configured.");
  const auth = new google.auth.JWT({ email: env.serviceAccountEmail, key: env.privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return { spreadsheetId: env.sheetId, sheets: google.sheets({ version: "v4", auth }) };
}

async function ensureAuditSheet(sheets: sheets_v4.Sheets, spreadsheetId: string) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" });
  const existing = metadata.data.sheets?.find((sheet) => sheet.properties?.title === AUDIT_SHEET_TITLE)?.properties?.sheetId;
  if (existing !== undefined && existing !== null) return existing;
  const created = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: AUDIT_SHEET_TITLE, gridProperties: { frozenRowCount: 3, frozenColumnCount: 1 } } } }] } });
  const sheetId = created.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) throw new Error("The audit sheet could not be created.");
  return sheetId;
}

export async function writeAttendanceAudit(matrix: AttendanceAuditMatrix) {
  const { spreadsheetId, sheets } = sheetClient();
  const sheetId = await ensureAuditSheet(sheets, spreadsheetId);
  const columnCount = Math.max(1, matrix.columns.length + 1);
  const rowCount = Math.max(4, matrix.rows.length + 3);
  const title = `'${AUDIT_SHEET_TITLE.replace(/'/g, "''")}'`;
  const generated = new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" }).format(new Date(matrix.generatedAt));
  const values = [
    [`Attendance Audit · Generated ${generated}`, ...matrix.columns.map(() => "")],
    ["Member name", ...matrix.columns.map((column) => column.label)],
    ["Service", ...matrix.columns.map((column) => column.service)],
    ...matrix.rows.map((row) => [row.memberName, ...row.times]),
  ];

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [
    { updateSheetProperties: { properties: { sheetId, gridProperties: { rowCount, columnCount, frozenRowCount: 3, frozenColumnCount: 1 } }, fields: "gridProperties(rowCount,columnCount,frozenRowCount,frozenColumnCount)" } },
    { unmergeCells: { range: { sheetId } } },
  ] } });
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: title });
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `${title}!A1`, valueInputOption: "RAW", requestBody: { values } });
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [
    { mergeCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: columnCount }, mergeType: "MERGE_ALL" } },
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: columnCount }, cell: { userEnteredFormat: { backgroundColor: { red: 0.04, green: 0.12, blue: 0.28 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 14 }, verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat" } },
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: columnCount }, cell: { userEnteredFormat: { backgroundColor: { red: 0.86, green: 0.97, blue: 0.99 }, textFormat: { foregroundColor: { red: 0.03, green: 0.18, blue: 0.28 }, bold: true }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" } }, fields: "userEnteredFormat" } },
    { repeatCell: { range: { sheetId, startRowIndex: 3, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.96, green: 0.98, blue: 1 } } }, fields: "userEnteredFormat" } },
    { repeatCell: { range: { sheetId, startRowIndex: 3, endRowIndex: rowCount, startColumnIndex: 1, endColumnIndex: columnCount }, cell: { userEnteredFormat: { horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(horizontalAlignment,verticalAlignment)" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 230 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: columnCount }, properties: { pixelSize: 125 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 3 }, properties: { pixelSize: 34 }, fields: "pixelSize" } },
  ] } });
  return { url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}`, sheetId };
}
