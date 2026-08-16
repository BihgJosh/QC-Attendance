export type ReportRow = Record<string, unknown>;
export type DailyReportData = { date: string; posts: ReportRow[]; timers: ReportRow[]; observers: ReportRow[]; emergencies: ReportRow[] };
export type ReportStyle = "title" | "subtitle" | "kpi" | "service" | "serviceKpi" | "coverage" | "section" | "sectionDark" | "header" | "subheader" | "total" | "danger" | "dangerStrong" | "headerDanger" | "note" | "detail" | "observation" | "recommendation" | "improvement" | "positive" | "audit" | "headerAudit";

const SERVICES = ["1st Service", "2nd Service", "3rd Service", "4th Service", "Thursday Service"];
const COLUMN_COUNT = 10;

function text(value: unknown) { return value === null || value === undefined || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value); }
function count(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0; }
function markup(value: number) { return Math.ceil(value * 1.02); }
function entries(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? Object.entries(value as ReportRow) : []; }
function label(value: string) { return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function serviceName(value: unknown) { const name = String(value || "").trim(); return SERVICES.find((service) => service.toLowerCase() === name.toLowerCase()) || name; }
function submitted(value: unknown) { if (!value) return "—"; const date = new Date(String(value)); return Number.isNaN(date.valueOf()) ? String(value) : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(date); }
function incident(row: ReportRow) { return Boolean(row.incident_description) || /yes|true|incident/i.test(String(row.incident_flag || "")); }

export function buildApprovedFinalReport(data: DailyReportData) {
  const rows: unknown[][] = [];
  const styles: Array<{ row: number; style: ReportStyle }> = [];
  const merges: Array<{ startRow: number; endRow: number; startColumn: number; endColumn: number }> = [];
  const add = (values: unknown[], style?: ReportStyle, merge = false) => {
    const row = rows.length;
    rows.push([...values, ...Array(Math.max(0, COLUMN_COUNT - values.length)).fill("")].slice(0, COLUMN_COUNT));
    if (style) styles.push({ row, style });
    if (merge) merges.push({ startRow: row, endRow: row + 1, startColumn: 0, endColumn: COLUMN_COUNT });
  };
  const section = (value: string, style: ReportStyle = "section") => add([value], style, true);
  const note = (value: unknown) => add([text(value)], "note", true);
  const narrative = (title: string, value: unknown, style: ReportStyle = "observation") => { if (value === null || value === undefined || value === "") return; section(title, style); note(value); };
  const structured = (title: string, value: unknown) => { const items = entries(value).filter(([, item]) => item !== null && item !== undefined && item !== ""); if (!items.length) return; section(title, "observation"); items.forEach(([key, item]) => add([label(key), text(item)], "detail")); };

  const reported = new Set([...data.posts, ...data.timers, ...data.observers, ...data.emergencies].map((row) => serviceName(row.service)).filter(Boolean));
  const serviceOrder = [...SERVICES.slice(0, 4), ...SERVICES.slice(4).filter((service) => reported.has(service)), ...[...reported].filter((service) => !SERVICES.includes(service))];
  const adults = data.posts.reduce((sum, row) => sum + count(row.adults_headcount), 0);
  const children = data.posts.reduce((sum, row) => sum + count(row.children_headcount), 0);
  const grand = adults + children;
  const incidents = data.posts.filter(incident).length;

  add(["QC DAILY SERVICE LEADERSHIP REPORT"], "title", true);
  add([`Streams of Joy International  •  Leadership and HOD review  •  ${data.date}`], "subtitle", true);
  add([`All services remain on this tab. Summary first, complete submitted evidence next, reporter identities in the audit register. Refreshed ${submitted(new Date().toISOString())}`], "note", true);
  add([]); section("EXECUTIVE SUMMARY", "sectionDark");
  add(["Report date", data.date, "Adults", adults, "Children", children, "Total", grand, "Total + 2%", markup(grand)], "kpi");
  add(["Services reported", `${reported.size} / ${serviceOrder.length}`, "Post reports", data.posts.length, "Timer logs", data.timers.length, "Observer reports", data.observers.length, "Incidents / emergencies", incidents + data.emergencies.length], "kpi");
  add([]); section("SERVICE COMPARISON", "sectionDark");
  add(["Service", "Adults", "Children", "Raw total", "Total + 2%", "Post reports", "Timer", "Observer", "Incidents", "Coverage"], "header");
  for (const service of serviceOrder) {
    const posts = data.posts.filter((row) => serviceName(row.service) === service);
    const a = posts.reduce((sum, row) => sum + count(row.adults_headcount), 0); const c = posts.reduce((sum, row) => sum + count(row.children_headcount), 0);
    const timers = data.timers.filter((row) => serviceName(row.service) === service).length; const observers = data.observers.filter((row) => serviceName(row.service) === service).length;
    add([service, a, c, a + c, markup(a + c), posts.length, timers, observers, posts.filter(incident).length, `${[posts.length, timers, observers].filter(Boolean).length} / 3`]);
  }
  add(["ALL REPORTED SERVICES", adults, children, grand, markup(grand), data.posts.length, data.timers.length, data.observers.length, incidents, `${reported.size} service(s)`], "total"); add([]);

  for (const service of serviceOrder) {
    const posts = data.posts.filter((row) => serviceName(row.service) === service);
    const timers = data.timers.filter((row) => serviceName(row.service) === service);
    const observers = data.observers.filter((row) => serviceName(row.service) === service);
    const emergencies = data.emergencies.filter((row) => serviceName(row.service) === service);
    const a = posts.reduce((sum, row) => sum + count(row.adults_headcount), 0); const c = posts.reduce((sum, row) => sum + count(row.children_headcount), 0);
    section(service.toUpperCase(), "service");
    add(["Adults", a, "Children", c, "Raw total", a + c, "Total + 2%", markup(a + c), "Incidents", posts.filter(incident).length], "serviceKpi");
    add(["Report coverage", `Post ${posts.length}`, `Timer ${timers.length}`, `Observer ${observers.length}`, `Emergency ${emergencies.length}`, "Status", posts.length || timers.length || observers.length ? "Data received" : "Awaiting submissions"], "coverage");

    section("HEADCOUNT BY OBSERVATION AREA");
    add(["Area / location", "Adults", "Children", "Total", "Overall rating", "Preparedness", "Neatness", "Orderliness", "Conduct", "Submitted"], "header");
    if (!posts.length) note("No Service Post report has been submitted for this service.");
    posts.forEach((row) => { const ratings = Object.fromEntries(entries(row.ratings)); add([row.area, count(row.adults_headcount), count(row.children_headcount), count(row.adults_headcount) + count(row.children_headcount), row.overall_rating, ratings.preparedness || "—", ratings.neatness || "—", ratings.orderliness || "—", ratings.conduct || "—", submitted(row.submitted_at)]); });

    section("SERVICE POST — COMPLETE OBSERVATIONS");
    if (!posts.length) note("No complete Service Post observation is available.");
    posts.forEach((row, index) => {
      const ratings = Object.fromEntries(entries(row.ratings)); section(`POST REPORT ${index + 1} — ${text(row.area)}`, "subheader");
      add(["Area / location", row.area, "Overall rating", row.overall_rating, "Submission time", submitted(row.submitted_at)], "subheader");
      add(["Preparedness", ratings.preparedness || "—", "Neatness", ratings.neatness || "—", "Orderliness", ratings.orderliness || "—", "Conduct", ratings.conduct || "—", "Compliance", ratings.compliance || "—"]);
      add(["Coordination", ratings.coordination || "—", "Adults", count(row.adults_headcount), "Children", count(row.children_headcount), "Total", count(row.adults_headcount) + count(row.children_headcount)]);
      narrative("WHAT WENT WELL", row.what_went_well, "positive"); narrative("AREAS REQUIRING IMPROVEMENT", row.areas_for_improvement, "improvement"); narrative("RECOMMENDATIONS / ACTIONS", row.recommendations, "recommendation");
      if (incident(row)) narrative("INCIDENT / RISK DETAILS", row.incident_description || row.incident_flag, "danger");
      structured("MIGHTY ARROWS MINISTRY NOTES", row.mighty_arrows); structured("TEENS MINISTRY NOTES", row.teens); narrative("ADDITIONAL COMMENTS", row.additional_comments);
    });

    section("SERVICE TIMING & PROGRAMME FLOW");
    if (!timers.length) note("No timer log has been submitted for this service.");
    timers.forEach((row, index) => {
      section(`TIMER LOG ${index + 1}`, "subheader"); add(["Service start", row.service_start || "—", "Service end", row.service_end || "—", "Submission time", submitted(row.submitted_at)], "subheader");
      add(["Programme segment", "Status", "Minutes", "Seconds", "Notes", "Submitted"], "header");
      const segments = Array.isArray(row.segments) ? row.segments as ReportRow[] : [];
      segments.filter((segment) => Object.values(segment).some((value) => value !== null && value !== undefined && value !== "" && value !== 0 && value !== "0")).forEach((segment) => add([segment.label || segment.name || "Programme segment", segment.status || "—", count(segment.min ?? segment.minutes), count(segment.sec ?? segment.seconds), segment.observation || segment.notes || "", submitted(row.submitted_at)]));
      const extra = Object.fromEntries(entries(row.extra_segment)); if (Object.keys(extra).length) add([extra.name || "Additional programme segment", extra.status || "—", count(extra.min ?? extra.minutes), count(extra.sec ?? extra.seconds), extra.observation || extra.notes || "", submitted(row.submitted_at)]);
      narrative("TIMER'S GENERAL OBSERVATION", row.general_observation);
    });

    section("OBSERVER'S LEADERSHIP REPORT");
    if (!observers.length) note("No observer report has been submitted for this service.");
    observers.forEach((row, index) => {
      section(`OBSERVER REPORT ${index + 1}`, "subheader"); add(["Reporter role", row.reporter_role || "—", "Locations covered", row.reporting_location || text(row.locations_reported), "Submission time", submitted(row.submitted_at)], "subheader");
      entries(row.location_observations).forEach(([location, report]) => narrative(`OBSERVATION FOR ${location.toUpperCase()}`, report));
      narrative("GENERAL SERVICE OBSERVATIONS", row.general_observations); entries(row.unit_reports).forEach(([unit, report]) => narrative(`UNIT OBSERVATION — ${unit.toUpperCase()}`, report));
      narrative("OBSERVER RECOMMENDATIONS", row.recommendations, "recommendation"); narrative("OBSERVER CONCLUSION / COMMENDATIONS", row.conclusion, "positive");
    });

    section("SUBMITTED FINDINGS FOR LEADERSHIP REVIEW", "sectionDark");
    add(["Finding type", "Source report", "Area / location", "Exact submitted entry", "Incident flag", "Submission time", "Service"], "header");
    let findings = 0;
    const finding = (kind: string, source: string, location: unknown, value: unknown, flagged: string, time: unknown) => { if (value === null || value === undefined || value === "") return; findings += 1; add([kind, source, location || "—", value, flagged, submitted(time), service], "detail"); };
    posts.forEach((row) => { finding("Positive observation", "Service Post", row.area, row.what_went_well, incident(row) ? "Yes" : "No", row.submitted_at); finding("Improvement", "Service Post", row.area, row.areas_for_improvement, incident(row) ? "Yes" : "No", row.submitted_at); finding("Recommendation", "Service Post", row.area, row.recommendations, incident(row) ? "Yes" : "No", row.submitted_at); if (incident(row)) finding("Incident", "Service Post", row.area, row.incident_description || row.incident_flag, "Yes", row.submitted_at); });
    observers.forEach((row) => { finding("Recommendation", "Observer Report", row.reporting_location, row.recommendations, "No", row.submitted_at); finding("Conclusion / commendation", "Observer Report", row.reporting_location, row.conclusion, "No", row.submitted_at); });
    emergencies.forEach((row) => finding("Emergency", "Emergency Flag", row.location, row.description, "Yes", row.submitted_at));
    if (!findings) note("No submitted findings are available for this service."); note("This section organizes exact submitted evidence and does not create, approve or assign leadership actions."); add([]);
  }

  section("EMERGENCIES FOR THE DAY", "dangerStrong"); add(["Service", "Location", "Exact submitted description", "Current status", "Reported time"], "headerDanger");
  if (!data.emergencies.length) note("No emergency flag was recorded for this date."); data.emergencies.forEach((row) => add([row.service || "Not specified", row.location, row.description, row.status || "—", submitted(row.submitted_at)], "danger")); add([]);
  section("AUDIT REGISTER — REPORTER IDENTITIES & SUBMISSIONS", "audit");
  add(["Submission time", "Service", "Report type", "Area / location", "Reporter name", "Reporter email (when available)", "Submitted-by name (when available)", "Submitted-by email (when available)", "Record ID", "Source reference"], "headerAudit");
  data.posts.forEach((row) => add([submitted(row.submitted_at), serviceName(row.service), "Service Post", row.area, row.reporter_name, row.reporter_email, row.submitted_by_name, row.submitted_by_email, row.id, row.source_fingerprint], "detail"));
  data.timers.forEach((row) => add([submitted(row.submitted_at), serviceName(row.service), "Service Timer", "Service flow", row.timer_name, "", "", "", row.id, row.source_fingerprint], "detail"));
  data.observers.forEach((row) => add([submitted(row.submitted_at), serviceName(row.service), "Observer Report", row.reporting_location || text(row.locations_reported), row.observer_name, "", "", "", row.id, row.source_fingerprint], "detail"));
  data.emergencies.forEach((row) => add([submitted(row.submitted_at), serviceName(row.service), "Emergency Flag", row.location, row.reported_by, "", "", "", row.id, row.source_fingerprint], "detail"));
  if (![...data.posts, ...data.timers, ...data.observers, ...data.emergencies].length) note("No submissions are available for this date."); add([]); note("Generated from the authoritative QC Supabase report store. Do not type over this tab; it refreshes automatically.");
  return { rows, styles, merges };
}
