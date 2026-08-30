import "server-only";

import { google, sheets_v4 } from "googleapis";
import { getGoogleEnv } from "@/lib/env";
import { callServiceReportGateway } from "@/lib/service-report-store";
import { buildFinalReportRows, FINAL_REPORT_COLUMN_COUNT, FINAL_REPORT_CONTENT_END_COLUMN, FINAL_REPORT_CONTENT_START_COLUMN, type DailyReport, type ReportStyle } from "@/lib/final-report-layout";

export const FINAL_REPORT_SPREADSHEET_ID = "1eZPJiAX4tCTX8huAAFCRrUSRr5na34VqmzXFCiqjGu0";
export const FINAL_REPORT_SHEET_ID = 1635578956;
export const FINAL_REPORT_SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${FINAL_REPORT_SPREADSHEET_ID}/edit?pli=1&gid=${FINAL_REPORT_SHEET_ID}#gid=${FINAL_REPORT_SHEET_ID}`;
const TEMPLATE_TITLE = "TEMPLATE";

function authClient() {
  const env = getGoogleEnv();
  return new google.auth.JWT({ email: env.serviceAccountEmail, key: env.privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
}

function tabTitle(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.valueOf())) throw new Error("A valid report date is required.");
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed).replace(/ /g, "-");
}

function sheetUrl(sheetId: number) {
  return `https://docs.google.com/spreadsheets/d/${FINAL_REPORT_SPREADSHEET_ID}/edit?pli=1&gid=${sheetId}#gid=${sheetId}`;
}

function color(hex: string) {
  const value = hex.replace("#", "");
  return { red: parseInt(value.slice(0, 2), 16) / 255, green: parseInt(value.slice(2, 4), 16) / 255, blue: parseInt(value.slice(4, 6), 16) / 255 };
}

function styleFormat(style: ReportStyle): sheets_v4.Schema$CellFormat {
  const formats: Record<ReportStyle, sheets_v4.Schema$CellFormat> = {
    brand: { textFormat: { foregroundColor: color("17365D"), bold: true, fontSize: 18 }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" },
    unit: { textFormat: { foregroundColor: color("007580"), bold: true, fontSize: 11 }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" },
    date: { textFormat: { foregroundColor: color("67717E"), bold: true, fontSize: 10 }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" },
    reportTitle: { textFormat: { foregroundColor: color("17365D"), bold: true, fontSize: 24 }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" },
    service: { textFormat: { foregroundColor: color("17365D"), bold: true, fontSize: 15 }, verticalAlignment: "MIDDLE", wrapStrategy: "WRAP", padding: { top: 14, bottom: 7, left: 0, right: 0 }, borders: { bottom: { style: "SOLID_MEDIUM", color: color("17365D") } } },
    section: { textFormat: { foregroundColor: color("007580"), bold: true, fontSize: 12 }, verticalAlignment: "MIDDLE", wrapStrategy: "WRAP", padding: { top: 9, bottom: 4, left: 0, right: 0 } },
    body: { textFormat: { foregroundColor: color("232B35"), fontSize: 11 }, verticalAlignment: "TOP", wrapStrategy: "WRAP", padding: { top: 3, bottom: 5, left: 0, right: 0 } },
    meta: { textFormat: { foregroundColor: color("17365D"), bold: true, fontSize: 11 }, verticalAlignment: "TOP", wrapStrategy: "WRAP", padding: { top: 2, bottom: 5, left: 0, right: 0 } },
    danger: { textFormat: { foregroundColor: color("8B1E1E"), bold: true, fontSize: 11 }, verticalAlignment: "TOP", wrapStrategy: "WRAP", padding: { top: 4, bottom: 5, left: 0, right: 0 } },
    consolidatedAttention: { textFormat: { foregroundColor: color("7A5A00"), bold: true, fontSize: 13 }, verticalAlignment: "MIDDLE", wrapStrategy: "WRAP", padding: { top: 18, bottom: 7, left: 0, right: 0 } },
  };
  return formats[style];
}

async function ensureSheet(sheets: sheets_v4.Sheets, title: string) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: FINAL_REPORT_SPREADSHEET_ID, fields: "sheets.properties" });
  const existing = metadata.data.sheets?.find((sheet) => sheet.properties?.title === title)?.properties;
  if (existing?.sheetId !== undefined && existing.sheetId !== null) return existing.sheetId;
  const blank = metadata.data.sheets?.find((sheet) => sheet.properties?.title === "Sheet1")?.properties;
  if (title === TEMPLATE_TITLE && blank?.sheetId !== undefined && blank.sheetId !== null) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: FINAL_REPORT_SPREADSHEET_ID, requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId: blank.sheetId, title }, fields: "title" } }] } });
    return blank.sheetId;
  }
  const response = await sheets.spreadsheets.batchUpdate({ spreadsheetId: FINAL_REPORT_SPREADSHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title, gridProperties: { rowCount: 200, columnCount: FINAL_REPORT_COLUMN_COUNT, frozenRowCount: 0, hideGridlines: true } } } }] } });
  const id = response.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (id === undefined || id === null) throw new Error(`Could not create sheet tab ${title}.`);
  return id;
}

async function paintSheet(sheets: sheets_v4.Sheets, sheetId: number, title: string, data?: DailyReport) {
  const report = data || { date: "YYYY-MM-DD", posts: [], timers: [], observers: [], emergencies: [] };
  const built = buildFinalReportRows(report);
  const requiredRows = Math.max(200, built.rows.length + 20);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: FINAL_REPORT_SPREADSHEET_ID,
    requestBody: { requests: [
      { unmergeCells: { range: { sheetId } } },
      { updateSheetProperties: { properties: { sheetId, gridProperties: { rowCount: requiredRows, columnCount: FINAL_REPORT_COLUMN_COUNT, frozenRowCount: 0, hideGridlines: true } }, fields: "gridProperties.rowCount,gridProperties.columnCount,gridProperties.frozenRowCount,gridProperties.hideGridlines" } },
    ] },
  });
  await sheets.spreadsheets.values.clear({ spreadsheetId: FINAL_REPORT_SPREADSHEET_ID, range: `'${title}'!A:J` });
  await sheets.spreadsheets.values.update({ spreadsheetId: FINAL_REPORT_SPREADSHEET_ID, range: `'${title}'!A1`, valueInputOption: "RAW", requestBody: { values: built.rows } });
  const requests: sheets_v4.Schema$Request[] = [
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: requiredRows, startColumnIndex: 0, endColumnIndex: FINAL_REPORT_COLUMN_COUNT }, cell: { userEnteredFormat: { backgroundColor: color("FFFFFF"), textFormat: { foregroundColor: color("232B35"), fontFamily: "Arial", fontSize: 11 }, verticalAlignment: "TOP", wrapStrategy: "WRAP", padding: { top: 3, bottom: 3, left: 0, right: 0 } } }, fields: "userEnteredFormat" } },
    ...built.merges.map((range) => ({ mergeCells: { range: { sheetId, startRowIndex: range.startRow, endRowIndex: range.endRow, startColumnIndex: range.startColumn, endColumnIndex: range.endColumn }, mergeType: "MERGE_ALL" } })),
    ...built.styles.map(({ row, style }) => ({ repeatCell: { range: { sheetId, startRowIndex: row, endRowIndex: row + 1, startColumnIndex: FINAL_REPORT_CONTENT_START_COLUMN, endColumnIndex: FINAL_REPORT_CONTENT_END_COLUMN }, cell: { userEnteredFormat: styleFormat(style) }, fields: "userEnteredFormat" } })),
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: FINAL_REPORT_COLUMN_COUNT }, properties: { pixelSize: 96 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 30 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: FINAL_REPORT_COLUMN_COUNT - 1, endIndex: FINAL_REPORT_COLUMN_COUNT }, properties: { pixelSize: 30 }, fields: "pixelSize" } },
    { autoResizeDimensions: { dimensions: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: built.rows.length } } },
  ];
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: FINAL_REPORT_SPREADSHEET_ID, requestBody: { requests } });
}

export async function setupFinalReportTemplate() {
  const sheets = google.sheets({ version: "v4", auth: authClient() });
  const sheetId = await ensureSheet(sheets, TEMPLATE_TITLE);
  await paintSheet(sheets, sheetId, TEMPLATE_TITLE);
}

export async function syncFinalReportForDate(date: string) {
  const response = await callServiceReportGateway<{ data?: DailyReport }>("manager.daily-report", { date });
  if (!response.data) throw new Error("Supabase did not return the daily service reports.");
  const sheets = google.sheets({ version: "v4", auth: authClient() });
  const title = tabTitle(date);
  const sheetId = await ensureSheet(sheets, title);
  await paintSheet(sheets, sheetId, title, response.data);
  return { title, sheetId, url: sheetUrl(sheetId) };
}
