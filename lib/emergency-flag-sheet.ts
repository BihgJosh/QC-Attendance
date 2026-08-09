import "server-only";

import { google } from "googleapis";
import { getGoogleEnv } from "@/lib/env";
import { callServiceReportGateway } from "@/lib/service-report-store";
import { syncFinalReportForDate } from "@/lib/final-report-sheet";

const SPREADSHEET_ID = "1AODePttGGYTO9VWRX2Pmwziy-9_Za7W0aravOvTQwdE";
const SHEET_GID = 562930473;

export const EMERGENCY_FLAG_HEADERS = [
  "Date", "Service", "Location", "Reported By", "Description", "Status",
  "Submitted At", "Submitted At (ms)",
];

export type EmergencyFlag = {
  location: string;
  reportedBy: string;
  description: string;
};

function escapeTitle(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

export async function appendEmergencyFlag(flag: EmergencyFlag) {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const recordId = crypto.randomUUID();
  await callServiceReportGateway("emergency.insert", {
    id: recordId,
    report_date: date,
    service: "",
    location: flag.location,
    reported_by: flag.reportedBy,
    description: flag.description,
    status: "Active",
    submitted_at: now.toISOString(),
    submitted_at_ms: now.getTime(),
    source_fingerprint: `live:${recordId}`,
  });
  try {
    const env = getGoogleEnv();
    const auth = new google.auth.JWT({
      email: env.serviceAccountEmail,
      key: env.privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      fields: "sheets.properties(sheetId,title)",
    });
    const title = metadata.data.sheets?.find((sheet) => sheet.properties?.sheetId === SHEET_GID)?.properties?.title;
    if (!title) throw new Error("The configured Emergency Flag sheet tab was not found.");
    const sheet = escapeTitle(title);
    const headerResponse = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheet}!A1:H1` });
    const currentHeaders = (headerResponse.data.values?.[0] || []).map((value) => String(value).trim());
    if (!currentHeaders.some(Boolean)) {
      await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `${sheet}!A1:H1`, valueInputOption: "RAW", requestBody: { values: [EMERGENCY_FLAG_HEADERS] } });
    } else if (EMERGENCY_FLAG_HEADERS.some((header, index) => currentHeaders[index] !== header)) {
      throw new Error("The Emergency Flag sheet headers do not match the required emergency columns.");
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheet}!A:H`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[date, "", flag.location, flag.reportedBy, flag.description, "Active", now.toISOString(), now.getTime()]] },
    });
  } catch (error) {
    console.error("[emergency-flag] Legacy workbook write failed", error instanceof Error ? error.message : error);
  }
  await syncFinalReportForDate(date).catch((error) => console.error("[emergency-flag] Final daily report refresh failed", error instanceof Error ? error.message : error));
}

export async function updateEmergencyFlagStatus(input: { id: string; date: string; status: "Resolved" | "Escalated" }) {
  const result = await callServiceReportGateway<{ row?: Record<string, unknown> }>("emergency.update", input);
  if (!result.row) throw new Error("The emergency flag could not be found.");

  try {
    const env = getGoogleEnv();
    const auth = new google.auth.JWT({ email: env.serviceAccountEmail, key: env.privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
    const sheets = google.sheets({ version: "v4", auth });
    const metadata = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: "sheets.properties(sheetId,title)" });
    const title = metadata.data.sheets?.find((sheet) => sheet.properties?.sheetId === SHEET_GID)?.properties?.title;
    if (!title) throw new Error("The configured Emergency Flag sheet tab was not found.");
    const sheet = escapeTitle(title);
    const values = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheet}!A2:H` });
    const submittedAtMs = String(result.row.submitted_at_ms || "");
    const submittedAt = String(result.row.submitted_at || "");
    const rowIndex = (values.data.values || []).findIndex((row) => String(row[7] || "") === submittedAtMs || String(row[6] || "") === submittedAt);
    if (rowIndex >= 0) {
      await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `${sheet}!F${rowIndex + 2}`, valueInputOption: "RAW", requestBody: { values: [[input.status]] } });
    }
  } catch (error) {
    console.error("[emergency-flag] Legacy status sync failed", error instanceof Error ? error.message : error);
  }

  await syncFinalReportForDate(input.date).catch((error) => {
    console.error("[emergency-flag] Final daily report status refresh failed", error instanceof Error ? error.message : error);
  });
  return result.row;
}
