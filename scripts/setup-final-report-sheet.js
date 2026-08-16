const fs = require("node:fs");
const path = require("node:path");
const { google } = require("googleapis");

for (const name of [".env", ".env.local"]) {
  const file = path.join(process.cwd(), name);
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "").replace(/\\n/g, "\n");
  }
}

const spreadsheetId = "1eZPJiAX4tCTX8huAAFCRrUSRr5na34VqmzXFCiqjGu0";
const services = ["1ST SERVICE", "2ND SERVICE", "3RD SERVICE", "4TH SERVICE"];
const columnCount = 10;
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const color = (hex) => {
  const value = hex.replace("#", "");
  return { red: parseInt(value.slice(0, 2), 16) / 255, green: parseInt(value.slice(2, 4), 16) / 255, blue: parseInt(value.slice(4, 6), 16) / 255 };
};

const rows = [];
const styledRows = [];
const merges = [];
const add = (values, style, merge = false) => {
  const row = rows.length;
  rows.push([...values, ...Array(Math.max(0, columnCount - values.length)).fill("")].slice(0, columnCount));
  if (style) styledRows.push({ row, style });
  if (merge) merges.push({ row, startColumn: 0, endColumn: columnCount });
};
const section = (label, style = "section") => add([label], style, true);
const note = (text) => add([text], "note", true);

add(["QC DAILY SERVICE LEADERSHIP REPORT"], "title", true);
add(["Streams of Joy International  •  Leadership and HOD review"], "subtitle", true);
add(["All four services remain on this tab. Summary first, full evidence next, reporter identities in the audit register."], "note", true);
add([]);
section("EXECUTIVE SUMMARY", "sectionDark");
add(["Report date", "—", "Adults", "—", "Children", "—", "Total", "—", "Total + 2%", "—"], "kpi");
add(["Services reported", "0 / 4", "Post reports", "—", "Timer logs", "—", "Observer reports", "—", "Incidents / emergencies", "—"], "kpi");
add([]);
section("FOUR-SERVICE COMPARISON", "sectionDark");
add(["Service", "Adults", "Children", "Raw total", "Total + 2%", "Post reports", "Timer", "Observer", "Incidents", "Coverage"], "header");
for (const service of services) add([service.replace(" SERVICE", ""), "—", "—", "—", "—", "—", "—", "—", "—", "Awaiting data"]);
add(["ALL FOUR SERVICES", "—", "—", "—", "—", "—", "—", "—", "—", "—"], "total");
add([]);

for (const service of services) {
  section(service, "service");
  add(["Adults", "—", "Children", "—", "Raw total", "—", "Total + 2%", "—", "Incidents", "—"], "serviceKpi");
  add(["Report coverage", "Post —", "Timer —", "Observer —", "Emergency —", "Status", "Awaiting submissions"], "coverage");

  section("HEADCOUNT BY OBSERVATION AREA");
  add(["Area / location", "Adults", "Children", "Total", "Overall rating", "Preparedness", "Neatness", "Orderliness", "Conduct", "Submitted"], "header");
  note("One row appears for every Service Post submission. Reporter names are intentionally shown only in the audit register.");

  section("SERVICE POST — COMPLETE OBSERVATIONS");
  add(["Area / location", "—", "Overall rating", "—", "Submission time", "—"], "subheader");
  add(["Preparedness", "—", "Neatness", "—", "Orderliness", "—", "Conduct", "—", "Compliance", "—"]);
  add(["Coordination", "—", "Adults", "—", "Children", "—", "Total", "—"]);
  section("WHAT WENT WELL", "positive"); note("Complete submitted narrative appears here.");
  section("AREAS REQUIRING IMPROVEMENT", "improvement"); note("Complete submitted narrative appears here.");
  section("RECOMMENDATIONS / ACTIONS", "recommendation"); note("Complete submitted recommendations appear here.");
  section("INCIDENT / RISK DETAILS", "danger"); note("Shown only when an incident is reported; otherwise marked None reported.");
  section("SPECIALIST & ADDITIONAL NOTES", "observation");
  add(["Mighty Arrows", "Topic, teacher preparedness, participation, behaviour, safety flag and safety details", "Teens", "Lesson topic, teacher preparedness, engagement and classroom management"], "detail");
  note("Additional comments appear here. This complete block repeats for every submitted observation area.");

  section("SERVICE TIMING & PROGRAMME FLOW");
  add(["Service start", "—", "Service end", "—", "Timer log received", "—"], "subheader");
  add(["Programme segment", "Status", "Minutes", "Seconds", "Programme segment", "Status", "Minutes", "Seconds", "Notes", "Submitted"], "header");
  note("Every recorded programme segment and any extra segment appears as a readable row; unrecorded segments are omitted.");
  section("TIMER'S GENERAL OBSERVATION", "observation"); note("Complete timer observation appears here.");

  section("OBSERVER'S LEADERSHIP REPORT");
  add(["Reporter role", "—", "Locations covered", "—", "Submission time", "—"], "subheader");
  section("LOCATION OBSERVATIONS", "observation"); note("Each selected location receives its own labeled observation block: Outside, Main Auditorium, Overflow, and others.");
  section("GENERAL SERVICE OBSERVATIONS", "observation"); note("Complete general observation appears here.");
  section("UNIT-BY-UNIT OBSERVATIONS", "observation"); note("Every selected unit receives its own labeled observation block.");
  section("OBSERVER RECOMMENDATIONS", "recommendation"); note("Shared recommendations appear here.");
  section("OBSERVER CONCLUSION / COMMENDATIONS", "positive"); note("Shared conclusion and commendations appear here.");

  section("SUBMITTED FINDINGS FOR LEADERSHIP REVIEW", "sectionDark");
  add(["Finding type", "Source report", "Area / location", "Exact submitted entry", "Incident flag", "Submission time", "Service"], "header");
  add(["Positive observation", "Service Post", "Area from submission", "Exact What Went Well text", "No / Yes", "Submitted time", service], "detail");
  add(["Improvement", "Service Post", "Area from submission", "Exact Areas for Improvement text", "No / Yes", "Submitted time", service], "detail");
  add(["Recommendation", "Service Post or Observer", "Area or locations from submission", "Exact recommendation text", "No / Yes", "Submitted time", service], "detail");
  add(["Incident / emergency", "Service Post or Emergency", "Exact submitted location", "Exact incident or emergency description", "Yes", "Submitted time", service], "detail");
  note("Rows appear only when corresponding text was submitted. This section organizes evidence for review and does not create, approve or assign leadership actions.");
  add([]);
}

section("EMERGENCIES FOR THE DAY", "dangerStrong");
add(["Service", "Location", "Exact submitted description", "Current status", "Reported time"], "headerDanger");
note("Every emergency submission appears here. Reporter identity remains in the audit register below.");
add([]);
section("AUDIT REGISTER — REPORTER IDENTITIES & SUBMISSIONS", "audit");
add(["Submission time", "Service", "Report type", "Area / location", "Reporter name", "Reporter email (when available)", "Submitted-by name (when available)", "Submitted-by email (when available)", "Record ID", "Source reference"], "headerAudit");
note("One row per Post, Timer, Observer or Emergency submission. Fields unavailable for a report type remain blank; no status, owner or follow-up value is inferred.");
add([]);
note("TEMPLATE PREVIEW ONLY — no generated date tab or raw submission is changed. Generated reports remain authoritative and refresh from Supabase.");

const formats = {
  title: { backgroundColor: color("07152F"), textFormat: { foregroundColor: color("FFFFFF"), bold: true, fontSize: 20 }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" },
  subtitle: { backgroundColor: color("172554"), textFormat: { foregroundColor: color("CFFAFE"), bold: true, fontSize: 11 }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" },
  note: { backgroundColor: color("F8FAFC"), textFormat: { foregroundColor: color("475569"), italic: true }, verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" },
  sectionDark: { backgroundColor: color("0F294A"), textFormat: { foregroundColor: color("FFFFFF"), bold: true, fontSize: 11 }, verticalAlignment: "MIDDLE" },
  section: { backgroundColor: color("E8EEF8"), textFormat: { foregroundColor: color("17365D"), bold: true }, verticalAlignment: "MIDDLE" },
  service: { backgroundColor: color("1D4ED8"), textFormat: { foregroundColor: color("FFFFFF"), bold: true, fontSize: 13 }, verticalAlignment: "MIDDLE" },
  kpi: { backgroundColor: color("E0F2FE"), textFormat: { foregroundColor: color("0F294A"), bold: true }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" },
  serviceKpi: { backgroundColor: color("DBEAFE"), textFormat: { foregroundColor: color("1E3A8A"), bold: true }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" },
  coverage: { backgroundColor: color("EFF6FF"), textFormat: { foregroundColor: color("1E3A8A"), bold: true }, verticalAlignment: "MIDDLE" },
  header: { backgroundColor: color("0F766E"), textFormat: { foregroundColor: color("FFFFFF"), bold: true }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" },
  subheader: { backgroundColor: color("DDE7F3"), textFormat: { foregroundColor: color("17365D"), bold: true }, verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" },
  total: { backgroundColor: color("CFFAFE"), textFormat: { foregroundColor: color("164E63"), bold: true }, verticalAlignment: "MIDDLE" },
  positive: { backgroundColor: color("DCFCE7"), textFormat: { foregroundColor: color("166534"), bold: true }, verticalAlignment: "MIDDLE" },
  improvement: { backgroundColor: color("FFEDD5"), textFormat: { foregroundColor: color("9A3412"), bold: true }, verticalAlignment: "MIDDLE" },
  recommendation: { backgroundColor: color("FEF3C7"), textFormat: { foregroundColor: color("92400E"), bold: true }, verticalAlignment: "MIDDLE" },
  danger: { backgroundColor: color("FEE2E2"), textFormat: { foregroundColor: color("991B1B"), bold: true }, verticalAlignment: "MIDDLE" },
  dangerStrong: { backgroundColor: color("991B1B"), textFormat: { foregroundColor: color("FFFFFF"), bold: true }, verticalAlignment: "MIDDLE" },
  headerDanger: { backgroundColor: color("B91C1C"), textFormat: { foregroundColor: color("FFFFFF"), bold: true }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" },
  observation: { backgroundColor: color("CFFAFE"), textFormat: { foregroundColor: color("155E75"), bold: true }, verticalAlignment: "MIDDLE" },
  detail: { backgroundColor: color("FFFFFF"), textFormat: { foregroundColor: color("1E293B") }, verticalAlignment: "TOP", wrapStrategy: "WRAP" },
  audit: { backgroundColor: color("312E81"), textFormat: { foregroundColor: color("FFFFFF"), bold: true }, verticalAlignment: "MIDDLE" },
  headerAudit: { backgroundColor: color("4338CA"), textFormat: { foregroundColor: color("FFFFFF"), bold: true }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" },
};

(async () => {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  let properties = metadata.data.sheets.find((sheet) => sheet.properties.title === "TEMPLATE")?.properties;
  if (!properties) {
    properties = metadata.data.sheets.find((sheet) => sheet.properties.title === "Sheet1")?.properties;
    if (!properties) throw new Error("The TEMPLATE sheet could not be found or created.");
  }
  const sheetId = properties.sheetId;
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: "'TEMPLATE'!A:N" });
  await sheets.spreadsheets.values.update({ spreadsheetId, range: "'TEMPLATE'!A1", valueInputOption: "RAW", requestBody: { values: rows } });
  const requests = [
    { unmergeCells: { range: { sheetId } } },
    { updateSheetProperties: { properties: { sheetId, gridProperties: { rowCount: Math.max(600, rows.length + 30), columnCount, frozenRowCount: 7, hideGridlines: true } }, fields: "gridProperties.rowCount,gridProperties.columnCount,gridProperties.frozenRowCount,gridProperties.hideGridlines" } },
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: Math.max(600, rows.length + 30), startColumnIndex: 0, endColumnIndex: columnCount }, cell: { userEnteredFormat: { backgroundColor: color("F4F7FB"), textFormat: { foregroundColor: color("0F172A"), fontFamily: "Arial", fontSize: 10 }, verticalAlignment: "TOP", wrapStrategy: "WRAP", padding: { top: 7, bottom: 7, left: 8, right: 8 } } }, fields: "userEnteredFormat" } },
    ...merges.map(({ row, startColumn, endColumn }) => ({ mergeCells: { range: { sheetId, startRowIndex: row, endRowIndex: row + 1, startColumnIndex: startColumn, endColumnIndex: endColumn }, mergeType: "MERGE_ALL" } })),
    ...styledRows.map(({ row, style }) => ({ repeatCell: { range: { sheetId, startRowIndex: row, endRowIndex: row + 1, startColumnIndex: 0, endColumnIndex: columnCount }, cell: { userEnteredFormat: formats[style] }, fields: "userEnteredFormat" } })),
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: columnCount }, properties: { pixelSize: 125 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 190 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 4, endIndex: 7 }, properties: { pixelSize: 145 }, fields: "pixelSize" } },
    { autoResizeDimensions: { dimensions: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: rows.length } } },
  ];
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  console.log(JSON.stringify({ ok: true, title: "TEMPLATE", sheetId, rows: rows.length, columns: columnCount }));
})().catch((error) => {
  console.error(error.response?.data?.error?.message || error.message);
  process.exitCode = 1;
});
