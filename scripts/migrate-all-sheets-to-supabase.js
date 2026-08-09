const fs = require("node:fs");
const crypto = require("node:crypto");
const { google } = require("googleapis");

const SOURCES = [
  ["attendance", null],
  ["service_post", "1B-tojwzi1WFsXWRuKdJ4g9M01tiZClDFCISndxTR7gg"],
  ["service_timer", "1BeoEcYvTGtVhBCp4SxX8mlfFscQD5rBrZ2tnPUdKP-8"],
  ["service_observer", "1N2kyYbaOFDryoukMGrxyJplrDTvgXHUSPnBG_8jo7Q4"],
  ["emergency_flags", "1AODePttGGYTO9VWRX2Pmwziy-9_Za7W0aravOvTQwdE"],
  ["service_report_workbook", "1QuNstJwL2wxBgM-bwa83r8rU9PZNln3tmih6DOBG2oY"],
];

function loadEnv(path) {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(fs.readFileSync(path, "utf8").split(/\r?\n/).flatMap((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) return [];
    const index = line.indexOf("=");
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return [[line.slice(0, index).trim(), value.replace(/\\n/g, "\n")]];
  }));
}

function hash(value) { return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function text(value) { return String(value ?? "").trim(); }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.round(parsed) : 0; }
function date(value) {
  const raw = text(value);
  let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  throw new Error(`Unrecognized source date: ${raw}`);
}
function timestamp(value) { const parsed = Date.parse(text(value)); return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null; }
function escaped(title) { return `'${title.replace(/'/g, "''")}'`; }
function objectFrom(headers, row) { return Object.fromEntries(headers.map((header, index) => [text(header), row[index] ?? ""])); }
function field(record, name) { return record[name] ?? ""; }
function fingerprint(table, row) { return hash([table, row]); }

function normalizePost(record) {
  const row = {
    report_date: date(field(record, "Date")), service: text(field(record, "Service")), reporter_name: text(field(record, "Name")), reporter_email: "", area: text(field(record, "Area")),
    adults_headcount: number(field(record, "Adults Headcount")), children_headcount: number(field(record, "Children Headcount")),
    ratings: { preparedness: text(field(record, "Preparedness")), neatness: text(field(record, "Neatness")), orderliness: text(field(record, "Orderliness")), conduct: text(field(record, "Conduct")), compliance: text(field(record, "Compliance")), coordination: text(field(record, "Coordination")) },
    overall_rating: text(field(record, "Overall Rating")), what_went_well: text(field(record, "What Went Well")), areas_for_improvement: text(field(record, "Areas For Improvement")), recommendations: text(field(record, "Recommendations")), incident_flag: text(field(record, "Incident Flag")), incident_description: text(field(record, "Incident Description")),
    mighty_arrows: { topicTaught: text(field(record, "MA Topic Taught")), teacherPreparedness: text(field(record, "MA Teacher Preparedness")), childrenParticipation: text(field(record, "MA Children Participation")), childrenBehaviour: text(field(record, "MA Children Behaviour")), safetyFlag: text(field(record, "MA Safety Concern Flag")), safetyDescribe: text(field(record, "MA Safety Concern Description")) },
    teens: { lessonTopic: text(field(record, "Teens Lesson Topic")), teacherPreparedness: text(field(record, "Teens Teacher Preparedness")), engagement: text(field(record, "Teens Engagement")), classroomMgmt: text(field(record, "Teens Classroom Mgmt")) },
    additional_comments: text(field(record, "Additional Comments")), submitted_at: timestamp(field(record, "Submitted At")),
  };
  return { ...row, source_fingerprint: fingerprint("service_post_reports", row) };
}

function normalizeTimer(record) {
  const segmentLabels = ["Opening Prayer", "Praise & Worship", "Speaking into the Week", "Solo Ministration", "Declaration", "First Testimony", "Second Testimony", "Third Testimony", "Fourth Testimony", "Fifth Testimony", "Choir Ministration", "Pastor's Ministration", "Offering & Announcement"];
  const segments = segmentLabels.map((label) => ({ label, status: text(field(record, `${label} - Status`)), min: number(field(record, `${label} - Min`)), sec: number(field(record, `${label} - Sec`)) }));
  const row = { report_date: date(field(record, "Date")), service: text(field(record, "Service")), timer_name: text(field(record, "Timer Name")), service_start: text(field(record, "Service Start")), service_end: text(field(record, "Service End")), segments, extra_segment: { name: text(field(record, "Extra Segment Name")), status: text(field(record, "Extra Segment Status")), min: number(field(record, "Extra Segment Min")), sec: number(field(record, "Extra Segment Sec")) }, general_observation: text(field(record, "Timer General Observation")), submitted_at: timestamp(field(record, "Submitted At")) };
  return { ...row, source_fingerprint: fingerprint("service_timer_logs", row) };
}

function normalizeObserver(record) {
  let unitReports = {};
  try { unitReports = JSON.parse(text(field(record, "Unit Reports JSON")) || "{}"); } catch { unitReports = { _unparsed: text(field(record, "Unit Reports JSON")) }; }
  const row = { report_date: date(field(record, "Date")), service: text(field(record, "Service")), observer_name: text(field(record, "Observer Name")), reporter_role: text(field(record, "Who Are You")), posted_location: text(field(record, "Posted Location")), reporting_location: text(field(record, "Reporting Location")), general_observations: text(field(record, "General Observations")), units_reported: text(field(record, "Units Reported On")).split(",").map((value) => value.trim()).filter(Boolean), unit_reports: unitReports, recommendations: text(field(record, "Recommendations")), conclusion: text(field(record, "Conclusion")), submitted_at: timestamp(field(record, "Submitted At")) };
  return { ...row, source_fingerprint: fingerprint("service_observer_reports", row) };
}

function normalizeEmergency(record) {
  const row = { report_date: date(field(record, "Date")), service: text(field(record, "Service")), location: text(field(record, "Location")), reported_by: text(field(record, "Reported By")), description: text(field(record, "Description")), status: text(field(record, "Status")) || "Active", submitted_at: timestamp(field(record, "Submitted At")), submitted_at_ms: number(field(record, "Submitted At (ms)")) || null };
  return { ...row, source_fingerprint: fingerprint("service_emergency_flags", row) };
}

function normalizeDocument(record) {
  const row = { source_record_id: text(field(record, "Record ID")) || null, report_date: date(field(record, "Date")), service: text(field(record, "Service")), document_url: text(field(record, "Document URL")), status: text(field(record, "Status")) || "Ready", generated_by: text(field(record, "Generated By")) || "Service Manager", generated_at: timestamp(field(record, "Generated At")) || new Date(0).toISOString() };
  return { ...row, source_fingerprint: fingerprint("service_generated_documents", row) };
}

function normalizeActivity(record) {
  const row = { source_event_id: text(field(record, "Event ID")) || null, logged_at: timestamp(field(record, "Logged At")) || new Date(0).toISOString(), report_date: text(field(record, "Date")) ? date(field(record, "Date")) : null, service: text(field(record, "Service")), category: text(field(record, "Category")), action: text(field(record, "Action")), actor: text(field(record, "Actor")), summary: text(field(record, "Summary")), source_record_id: text(field(record, "Record ID")) || null, status: text(field(record, "Status")) };
  return { ...row, source_fingerprint: fingerprint("service_activity_log", row) };
}

function normalizeEmail(record) {
  const row = { source_message_id: text(field(record, "Message ID")) || null, sent_at: timestamp(field(record, "Sent At")) || new Date(0).toISOString(), report_date: date(field(record, "Date")), service: text(field(record, "Service")), recipient: text(field(record, "Recipient")), report_type: text(field(record, "Report Type")), subject: text(field(record, "Subject")), provider_message_id: text(field(record, "Brevo Message ID")) || null, status: text(field(record, "Status")), document_url: text(field(record, "Document URL")) || null };
  return { ...row, source_fingerprint: fingerprint("service_email_log", row) };
}

async function main() {
  const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
  SOURCES[0][1] = env.GOOGLE_SHEET_ID;
  const auth = new google.auth.JWT({ email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: env.GOOGLE_PRIVATE_KEY, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  const sheets = google.sheets({ version: "v4", auth });
  const sources = [];
  const tables = { service_post_reports: [], service_timer_logs: [], service_observer_reports: [], service_emergency_flags: [], service_generated_documents: [], service_activity_log: [], service_email_log: [] };
  const seen = Object.fromEntries(Object.keys(tables).map((table) => [table, new Set()]));
  for (const [sourceKey, spreadsheetId] of SOURCES) {
    const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "properties.title,sheets.properties(sheetId,title)" });
    const source = { sourceKey, spreadsheetId, title: metadata.data.properties?.title || "Untitled", tabs: [] };
    for (const sheet of metadata.data.sheets || []) {
      const gid = sheet.properties?.sheetId;
      const title = text(sheet.properties?.title);
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: escaped(title), valueRenderOption: "FORMULA", dateTimeRenderOption: "FORMATTED_STRING" });
      const values = response.data.values || [];
      const headers = values[0] || [];
      const dataRows = values.slice(1).map((cells, index) => ({ cells, rowNumber: index + 2 })).filter(({ cells }) => cells.some((cell) => text(cell)));
      source.tabs.push({ gid, title, headers, populatedRows: dataRows.length, formulaCells: values.flat().filter((value) => typeof value === "string" && value.startsWith("=")).length, sha256: hash(values), rows: values.map((cells, index) => ({ source_row_number: index + 1, cells, source_fingerprint: hash([spreadsheetId, gid, index + 1, cells]) })) });
      for (const { cells, rowNumber } of dataRows) {
        const record = objectFrom(headers, cells);
        let table; let normalized;
        if (title === "PostReports") { table = "service_post_reports"; normalized = normalizePost(record); }
        else if (title === "TimerLog") { table = "service_timer_logs"; normalized = normalizeTimer(record); }
        else if (title === "ObserverLog") { table = "service_observer_reports"; normalized = normalizeObserver(record); }
        else if (title === "EmergencyFlags") { table = "service_emergency_flags"; normalized = normalizeEmergency(record); }
        else if (title === "Generated Documents") { table = "service_generated_documents"; normalized = normalizeDocument(record); }
        else if (title === "Activity Log") { table = "service_activity_log"; normalized = normalizeActivity(record); }
        else if (title === "Email Log") { table = "service_email_log"; normalized = normalizeEmail(record); }
        else continue;
        normalized.source_fingerprint = hash([sourceKey, title, rowNumber, cells]);
        if (!seen[table].has(normalized.source_fingerprint)) { seen[table].add(normalized.source_fingerprint); tables[table].push(normalized); }
      }
    }
    sources.push(source);
  }
  const summary = { sources: sources.length, tabs: sources.reduce((sum, source) => sum + source.tabs.length, 0), rawRows: sources.reduce((sum, source) => sum + source.tabs.reduce((tabSum, tab) => tabSum + tab.rows.length, 0), 0), normalized: Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.length])) };
  console.log(JSON.stringify(summary, null, 2));
  if (process.argv.includes("--dry-run")) return;
  const response = await fetch(`${env.SUPABASE_URL}/functions/v1/qcu-service-reports`, { method: "POST", headers: { "Content-Type": "application/json", apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, "x-qcu-operation-secret": env.SUPABASE_GATEWAY_SECRET }, body: JSON.stringify({ operation: "migration.import", sources, tables }) });
  if (!response.ok) throw new Error(`Supabase migration failed (${response.status}): ${await response.text()}`);
  console.log("Migration import completed.");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
