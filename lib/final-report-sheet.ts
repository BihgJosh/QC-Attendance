import "server-only";

import { google, sheets_v4 } from "googleapis";
import { getGoogleEnv } from "@/lib/env";
import { callServiceReportGateway } from "@/lib/service-report-store";
import { buildApprovedFinalReport, type DailyReportData } from "@/lib/final-report-layout";

export const FINAL_REPORT_SPREADSHEET_ID = "1eZPJiAX4tCTX8huAAFCRrUSRr5na34VqmzXFCiqjGu0";
export const FINAL_REPORT_SHEET_ID = 1635578956;
export const FINAL_REPORT_SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${FINAL_REPORT_SPREADSHEET_ID}/edit?pli=1&gid=${FINAL_REPORT_SHEET_ID}#gid=${FINAL_REPORT_SHEET_ID}`;
const TEMPLATE_TITLE = "TEMPLATE";
const COLUMN_COUNT = 10;
const SERVICES = ["1st Service", "2nd Service", "3rd Service", "4th Service", "Thursday Service"];

type ReportRow = Record<string, unknown>;
type DailyReport = DailyReportData;
type Style = "title" | "subtitle" | "kpi" | "service" | "serviceKpi" | "coverage" | "section" | "sectionDark" | "header" | "subheader" | "total" | "danger" | "dangerStrong" | "headerDanger" | "note" | "detail" | "observation" | "recommendation" | "improvement" | "positive" | "audit" | "headerAudit";

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

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function timestamp(value: unknown) {
  if (!value) return "—";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.valueOf()) ? String(value) : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(parsed);
}

function serviceName(value: unknown) {
  const name = String(value || "").trim();
  return SERVICES.find((service) => service.toLowerCase() === name.toLowerCase()) || name;
}

function buildRows(data: DailyReport) {
  const rows: unknown[][] = [];
  const styles: Array<{ row: number; style: Style }> = [];
  const merges: Array<{ startRow: number; endRow: number; startColumn: number; endColumn: number }> = [];
  const add = (values: unknown[], style?: Style, merge = false) => {
    const row = rows.length;
    rows.push([...values, ...Array(Math.max(0, COLUMN_COUNT - values.length)).fill("")].slice(0, COLUMN_COUNT));
    if (style) styles.push({ row, style });
    if (merge) merges.push({ startRow: row, endRow: row + 1, startColumn: 0, endColumn: COLUMN_COUNT });
  };
  const section = (label: string) => add([label], "section", true);
  const narrative = (label: string, value: unknown, style: Style = "observation") => {
    add([label], style, true);
    add([display(value)], "note", true);
  };

  const reportedServices = new Set([...data.posts, ...data.timers, ...data.observers].map((row) => serviceName(row.service)).filter(Boolean));
  const totalAdults = data.posts.reduce((sum, row) => sum + Number(row.adults_headcount || 0), 0);
  const totalChildren = data.posts.reduce((sum, row) => sum + Number(row.children_headcount || 0), 0);
  const incidents = data.posts.filter((row) => /yes|true|incident/i.test(String(row.incident_flag || ""))).length;

  add(["QC DAILY SERVICE REPORT"], "title", true);
  add([`Streams of Joy International  •  ${data.date === "YYYY-MM-DD" ? "REPORT DATE" : tabTitle(data.date)}`], "subtitle", true);
  add([`Last refreshed ${timestamp(new Date().toISOString())}`], "note", true);
  add([]);
  add(["TOTAL WORSHIPPERS", totalAdults + totalChildren, "SERVICES REPORTED", reportedServices.size, "INCIDENTS", incidents, "EMERGENCIES", data.emergencies.length], "kpi");
  add([]);

  const serviceOrder = [...SERVICES, ...[...reportedServices].filter((service) => !SERVICES.includes(service))];
  for (const service of serviceOrder) {
    const posts = data.posts.filter((row) => serviceName(row.service) === service);
    const timers = data.timers.filter((row) => serviceName(row.service) === service);
    const observers = data.observers.filter((row) => serviceName(row.service) === service);
    if (!posts.length && !timers.length && !observers.length) continue;
    const adults = posts.reduce((sum, row) => sum + Number(row.adults_headcount || 0), 0);
    const children = posts.reduce((sum, row) => sum + Number(row.children_headcount || 0), 0);
    add([service.toUpperCase(), "", "Worshippers", adults + children, "Adults", adults, "Children", children], "service");

    section("SERVICE OVERVIEW");
    add(["Report coverage", `${posts.length} post report(s) • ${timers.length} timer log(s) • ${observers.length} observer report(s)`, "Incidents", posts.filter((row) => /yes|true|incident/i.test(String(row.incident_flag || ""))).length, "Overall attendance", adults + children], "kpi");

    section("HEADCOUNT — SUPPORTING DETAIL");
    add(["Area / Unit", "Reporter", "Adults", "Children", "Total", "Overall rating", "Submitted"], "header");
    if (!posts.length) add(["No service-post report has been submitted for this service."], "note", true);
    for (const row of posts) add([row.area, row.reporter_name, row.adults_headcount, row.children_headcount, Number(row.adults_headcount || 0) + Number(row.children_headcount || 0), row.overall_rating, timestamp(row.submitted_at)]);

    for (const [index, row] of posts.entries()) {
      const ratings = (row.ratings && typeof row.ratings === "object" ? row.ratings : {}) as ReportRow;
      section(`DETAILED POST REPORT ${index + 1} — ${display(row.area)}`);
      add(["Reporter", row.reporter_name, "Overall rating", row.overall_rating, "Submitted", timestamp(row.submitted_at)], "header");
      add(["Preparedness", ratings.preparedness, "Neatness", ratings.neatness, "Orderliness", ratings.orderliness, "Conduct", ratings.conduct]);
      add(["Compliance", ratings.compliance, "Coordination", ratings.coordination]);
      narrative("WHAT WENT WELL", row.what_went_well, "observation");
      narrative("AREAS REQUIRING IMPROVEMENT", row.areas_for_improvement, "improvement");
      narrative("RECOMMENDATIONS / ACTIONS FOR LEADERSHIP", row.recommendations, "recommendation");
      if (row.incident_description || /yes|true|incident/i.test(String(row.incident_flag || ""))) narrative("INCIDENT / RISK DETAILS", row.incident_description || row.incident_flag, "danger");
      if (row.mighty_arrows && Object.keys(row.mighty_arrows as object).length) narrative("MIGHTY ARROWS MINISTRY NOTES", row.mighty_arrows);
      if (row.teens && Object.keys(row.teens as object).length) narrative("TEENS MINISTRY NOTES", row.teens);
      if (row.additional_comments) narrative("ADDITIONAL SERVICE POINTERS", row.additional_comments);
    }

    section("SERVICE TIMING & FLOW");
    if (!timers.length) add(["No timer log has been submitted for this service."], "note", true);
    for (const row of timers) {
      add(["Timer", row.timer_name, "Service window", `${display(row.service_start)} – ${display(row.service_end)}`, "Submitted", timestamp(row.submitted_at)], "header");
      narrative("ORDER OF SERVICE — DETAILED TIMING", row.segments);
      if (row.extra_segment) narrative("ADDITIONAL PROGRAMME SEGMENT", row.extra_segment);
      narrative("TIMER'S GENERAL OBSERVATION", row.general_observation, "observation");
    }

    section("OBSERVER'S LEADERSHIP REPORT");
    if (!observers.length) add(["No observer report has been submitted for this service."], "note", true);
    for (const row of observers) {
      add(["Observer", row.observer_name, "Role", row.reporter_role, "Reporting location", row.reporting_location, "Submitted", timestamp(row.submitted_at)], "header");
      const locationObservations = row.location_observations && typeof row.location_observations === "object" ? row.location_observations as ReportRow : {};
      for (const [location, report] of Object.entries(locationObservations)) narrative(`LOCATION OBSERVATION — ${location.toUpperCase()}`, report, "observation");
      narrative("GENERAL SERVICE OBSERVATIONS", row.general_observations, "observation");
      const unitReports = row.unit_reports && typeof row.unit_reports === "object" ? row.unit_reports as ReportRow : {};
      for (const [unit, report] of Object.entries(unitReports)) narrative(`UNIT OBSERVATION — ${unit.toUpperCase()}`, report, "observation");
      narrative("OBSERVER RECOMMENDATIONS", row.recommendations, "recommendation");
      narrative("OBSERVER CONCLUSION", row.conclusion, "improvement");
    }
    add([]);
  }

  section("EMERGENCY FLAGS FOR THE DAY");
  if (!data.emergencies.length) add(["No emergency flag was recorded for this date."], "note", true);
  for (const row of data.emergencies) {
    add(["Location", row.location, "Service", row.service || "Not specified", "Status", row.status, "Reported by", row.reported_by], "danger");
    narrative("EMERGENCY DETAILS", row.description, "danger");
  }
  add([]);
  add(["Generated from the authoritative QC Supabase report store. Do not type over this tab; it refreshes automatically."], "note", true);
  return { rows, styles, merges };
}

function color(hex: string) {
  const value = hex.replace("#", "");
  return { red: parseInt(value.slice(0, 2), 16) / 255, green: parseInt(value.slice(2, 4), 16) / 255, blue: parseInt(value.slice(4, 6), 16) / 255 };
}

function styleFormat(style: Style): sheets_v4.Schema$CellFormat {
  const formats: Record<Style, sheets_v4.Schema$CellFormat> = {
    title: { backgroundColor: color("07152F"), textFormat: { foregroundColor: color("FFFFFF"), bold: true, fontSize: 20 }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" },
    subtitle: { backgroundColor: color("172554"), textFormat: { foregroundColor: color("CFFAFE"), bold: true, fontSize: 11 }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" },
    kpi: { backgroundColor: color("E0F2FE"), textFormat: { foregroundColor: color("0F294A"), bold: true }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" },
    service: { backgroundColor: color("1D4ED8"), textFormat: { foregroundColor: color("FFFFFF"), bold: true, fontSize: 12 }, verticalAlignment: "MIDDLE" },
    serviceKpi: { backgroundColor: color("DBEAFE"), textFormat: { foregroundColor: color("1E3A8A"), bold: true }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" },
    coverage: { backgroundColor: color("EFF6FF"), textFormat: { foregroundColor: color("1E3A8A"), bold: true }, verticalAlignment: "MIDDLE" },
    section: { backgroundColor: color("E8EEF8"), textFormat: { foregroundColor: color("17365D"), bold: true }, verticalAlignment: "MIDDLE" },
    sectionDark: { backgroundColor: color("0F294A"), textFormat: { foregroundColor: color("FFFFFF"), bold: true }, verticalAlignment: "MIDDLE" },
    header: { backgroundColor: color("0F766E"), textFormat: { foregroundColor: color("FFFFFF"), bold: true }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" },
    subheader: { backgroundColor: color("DDE7F3"), textFormat: { foregroundColor: color("17365D"), bold: true }, verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" },
    total: { backgroundColor: color("CFFAFE"), textFormat: { foregroundColor: color("164E63"), bold: true }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" },
    positive: { backgroundColor: color("DCFCE7"), textFormat: { foregroundColor: color("166534"), bold: true }, verticalAlignment: "MIDDLE" },
    improvement: { backgroundColor: color("FFEDD5"), textFormat: { foregroundColor: color("9A3412"), bold: true }, verticalAlignment: "MIDDLE" },
    recommendation: { backgroundColor: color("FEF3C7"), textFormat: { foregroundColor: color("92400E"), bold: true }, verticalAlignment: "MIDDLE" },
    danger: { backgroundColor: color("FEE2E2"), textFormat: { foregroundColor: color("991B1B") }, verticalAlignment: "TOP", wrapStrategy: "WRAP" },
    dangerStrong: { backgroundColor: color("991B1B"), textFormat: { foregroundColor: color("FFFFFF"), bold: true }, verticalAlignment: "MIDDLE" },
    headerDanger: { backgroundColor: color("B91C1C"), textFormat: { foregroundColor: color("FFFFFF"), bold: true }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" },
    note: { backgroundColor: color("F8FAFC"), textFormat: { foregroundColor: color("475569"), italic: true }, verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" },
    detail: { backgroundColor: color("FFFFFF"), textFormat: { foregroundColor: color("1E293B") }, verticalAlignment: "TOP", wrapStrategy: "WRAP" },
    observation: { backgroundColor: color("CFFAFE"), textFormat: { foregroundColor: color("155E75"), bold: true }, verticalAlignment: "MIDDLE" },
    audit: { backgroundColor: color("312E81"), textFormat: { foregroundColor: color("FFFFFF"), bold: true }, verticalAlignment: "MIDDLE" },
    headerAudit: { backgroundColor: color("4338CA"), textFormat: { foregroundColor: color("FFFFFF"), bold: true }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" },
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
  const response = await sheets.spreadsheets.batchUpdate({ spreadsheetId: FINAL_REPORT_SPREADSHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title, gridProperties: { rowCount: 600, columnCount: COLUMN_COUNT, frozenRowCount: 7, hideGridlines: true } } } }] } });
  const id = response.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (id === undefined || id === null) throw new Error(`Could not create sheet tab ${title}.`);
  return id;
}

async function paintSheet(sheets: sheets_v4.Sheets, sheetId: number, title: string, data?: DailyReport) {
  const report = data || { date: "YYYY-MM-DD", posts: [], timers: [], observers: [], emergencies: [] };
  const built = buildApprovedFinalReport(report);
  await sheets.spreadsheets.values.clear({ spreadsheetId: FINAL_REPORT_SPREADSHEET_ID, range: `'${title}'!A:N` });
  await sheets.spreadsheets.values.update({ spreadsheetId: FINAL_REPORT_SPREADSHEET_ID, range: `'${title}'!A1`, valueInputOption: "RAW", requestBody: { values: built.rows } });
  const requests: sheets_v4.Schema$Request[] = [
    { unmergeCells: { range: { sheetId } } },
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 7, hideGridlines: true } }, fields: "gridProperties.frozenRowCount,gridProperties.hideGridlines" } },
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: Math.max(600, built.rows.length + 20), startColumnIndex: 0, endColumnIndex: COLUMN_COUNT }, cell: { userEnteredFormat: { backgroundColor: color("F4F7FB"), textFormat: { foregroundColor: color("0F172A"), fontFamily: "Arial", fontSize: 10 }, verticalAlignment: "TOP", wrapStrategy: "WRAP", padding: { top: 6, bottom: 6, left: 7, right: 7 } } }, fields: "userEnteredFormat" } },
    ...built.merges.map((range) => ({ mergeCells: { range: { sheetId, startRowIndex: range.startRow, endRowIndex: range.endRow, startColumnIndex: range.startColumn, endColumnIndex: range.endColumn }, mergeType: "MERGE_ALL" } })),
    ...built.styles.map(({ row, style }) => ({ repeatCell: { range: { sheetId, startRowIndex: row, endRowIndex: row + 1, startColumnIndex: 0, endColumnIndex: COLUMN_COUNT }, cell: { userEnteredFormat: styleFormat(style) }, fields: "userEnteredFormat" } })),
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: COLUMN_COUNT }, properties: { pixelSize: 150 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 180 }, fields: "pixelSize" } },
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
