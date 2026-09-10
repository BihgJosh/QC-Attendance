export const FINAL_REPORT_COLUMN_COUNT = 10;
export const FINAL_REPORT_CONTENT_START_COLUMN = 1;
export const FINAL_REPORT_CONTENT_END_COLUMN = 9;
export const STANDARD_FINAL_REPORT_SERVICES = ["1st Service", "2nd Service", "3rd Service", "4th Service", "Thursday Service"];

export type ReportRow = Record<string, unknown>;
export type DailyReport = { date: string; posts?: ReportRow[]; timers?: ReportRow[]; observers?: ReportRow[]; emergencies?: ReportRow[] };
export type ReportStyle = "brand" | "unit" | "date" | "reportTitle" | "service" | "section" | "body" | "meta" | "danger" | "consolidatedAttention";
export type BuiltFinalReport = {
  rows: unknown[][];
  styles: Array<{ row: number; style: ReportStyle }>;
  merges: Array<{ startRow: number; endRow: number; startColumn: number; endColumn: number }>;
};

function humanize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function useful(value: unknown) {
  const text = String(value ?? "").trim();
  return Boolean(text && !/^(?:—|-|n\/?a|nil|none!?|no(?:thing)?(?: for now)?|not applicable|null|undefined)$/i.test(text));
}

function readableText(value: unknown, depth = 0): string {
  if (Array.isArray(value)) return value.map((item) => readableText(item, depth + 1)).filter(Boolean).join("\n");
  if (value && typeof value === "object") {
    return Object.entries(value as ReportRow).map(([key, item]) => {
      const text = readableText(item, depth + 1);
      if (!text) return "";
      const indented = text.replace(/\n/g, "\n  ");
      return `${humanize(key)}: ${indented}`;
    }).filter(Boolean).join("\n");
  }
  return useful(value) ? String(value).trim() : "";
}

function uniqueText(values: unknown[]) {
  const seen = new Set<string>();
  return values.map((value) => readableText(value)).filter((text) => {
    const key = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function contentItems(values: unknown[]) {
  return uniqueText(values).flatMap((text) => text.split(/\n\s*\n+/)).map((text) => text.trim()).filter(Boolean);
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function isIncident(value: unknown) {
  return /^(?:yes|true|incident|1)$/i.test(String(value || "").trim());
}

function serviceName(value: unknown) {
  const name = String(value || "").trim();
  return STANDARD_FINAL_REPORT_SERVICES.find((service) => service.toLowerCase() === name.toLowerCase()) || name;
}

function timestamp(value: unknown) {
  if (!value) return "—";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.valueOf()) ? String(value) : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(parsed);
}

function tabTitle(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.valueOf())) throw new Error("A valid report date is required.");
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed).replace(/ /g, "-");
}

function display(value: unknown) {
  return readableText(value) || "—";
}

function serviceHeading(service: string) {
  const headings: Record<string, string> = {
    "1st Service": "FIRST SERVICE",
    "2nd Service": "SECOND SERVICE",
    "3rd Service": "THIRD SERVICE",
    "4th Service": "FOURTH SERVICE",
    "Thursday Service": "THURSDAY SERVICE",
  };
  return headings[service] || service.toUpperCase();
}

function reportDate(date: string) {
  if (date === "YYYY-MM-DD") return "REPORT DATE";
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(parsed);
}

function timingLog(value: unknown) {
  if (!value || typeof value !== "object") return readableText(value);
  const entries = Array.isArray(value) ? value.map((item, index) => [String(index + 1), item] as const) : Object.entries(value as ReportRow);
  return entries.map(([key, item]) => {
    if (!item || typeof item !== "object") return useful(item) ? `${humanize(key)}: ${String(item).trim()}` : "";
    const segment = item as ReportRow;
    const name = String(segment.label || segment.name || segment.segment || humanize(key));
    const status = readableText(segment.status || segment.timing_status || segment.result);
    const planned = readableText(segment.planned || segment.planned_time || segment.planned_minutes);
    const actual = readableText(segment.actual || segment.actual_time || segment.actual_minutes);
    const variance = readableText(segment.variance || segment.duration || segment.overrun);
    const details = [status, planned && `Planned ${planned}`, actual && `Actual ${actual}`, variance && `Variance ${variance}`].filter(Boolean).join(" • ");
    return details ? `${name}: ${details}` : `${name}: ${readableText(segment)}`;
  }).filter(Boolean).join("\n");
}

export function buildFinalReportRows(input: DailyReport, refreshedAt = new Date().toISOString()): BuiltFinalReport {
  const data = {
    date: input.date,
    posts: Array.isArray(input.posts) ? input.posts : [],
    timers: Array.isArray(input.timers) ? input.timers : [],
    observers: Array.isArray(input.observers) ? input.observers : [],
    emergencies: Array.isArray(input.emergencies) ? input.emergencies : [],
  };
  const rows: unknown[][] = [];
  const styles: BuiltFinalReport["styles"] = [];
  const merges: BuiltFinalReport["merges"] = [];
  const add = (values: unknown[], style?: ReportStyle, merge = false) => {
    const row = rows.length;
    const cells = Array(FINAL_REPORT_COLUMN_COUNT).fill("");
    if (merge) cells[FINAL_REPORT_CONTENT_START_COLUMN] = values[0] ?? "";
    else values.slice(0, FINAL_REPORT_COLUMN_COUNT).forEach((value, index) => { cells[index] = value; });
    rows.push(cells);
    if (style) styles.push({ row, style });
    if (merge) merges.push({ startRow: row, endRow: row + 1, startColumn: FINAL_REPORT_CONTENT_START_COLUMN, endColumn: FINAL_REPORT_CONTENT_END_COLUMN });
  };
  const section = (label: string) => add([label], "section", true);
  const paragraph = (value: unknown, style: ReportStyle = "body") => add([value], style, true);
  const narrative = (label: string, values: unknown[], style: ReportStyle = "section") => {
    const items = contentItems(values);
    if (!items.length) return;
    add([label], style, true);
    for (const item of items) paragraph(item);
  };

  const allRows = [...data.posts, ...data.timers, ...data.observers, ...data.emergencies];
  const reportedServices = new Set(allRows.map((row) => serviceName(row.service)).filter(Boolean));
  const namedServiceCount = reportedServices.size;
  add(["STREAMS OF JOY"], "brand", true);
  add(["QUALITY ASSURANCE"], "unit", true);
  add([reportDate(data.date)], "date", true);
  add([namedServiceCount === 4 ? "ALL FOUR SERVICES SUMMARY REPORT" : "ALL SERVICES SUMMARY REPORT"], "reportTitle", true);
  add([]);

  const serviceOrder = [...STANDARD_FINAL_REPORT_SERVICES, ...[...reportedServices].filter((service) => !STANDARD_FINAL_REPORT_SERVICES.includes(service))];
  for (const service of serviceOrder) {
    const posts = data.posts.filter((row) => serviceName(row.service) === service);
    const timers = data.timers.filter((row) => serviceName(row.service) === service);
    const observers = data.observers.filter((row) => serviceName(row.service) === service);
    const emergencies = data.emergencies.filter((row) => serviceName(row.service) === service);
    if (!posts.length && !timers.length && !observers.length && !emergencies.length) continue;
    const adults = posts.reduce((sum, row) => sum + number(row.adults_headcount), 0);
    const children = posts.reduce((sum, row) => sum + number(row.children_headcount), 0);
    add([serviceHeading(service)], "service", true);
    section("Service Overview");
    paragraph(`Reporting approach: This section presents the ${serviceHeading(service).toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())} findings as the collective assessment of the Quality Assurance team.`, "meta");
    paragraph(`Attendance: ${(adults + children).toLocaleString()} worshippers (${adults.toLocaleString()} adults, ${children.toLocaleString()} children). Reports received: ${posts.length} area, ${timers.length} timer, ${observers.length} observer.`, "meta");

    let itemNumber = 0;
    for (const row of posts) {
      if (row.headcount_only) continue;
      section(`${++itemNumber}. ${display(row.area || "Unspecified Area")}`);
      narrative("OBSERVATIONS", [row.what_went_well, row.additional_comments, row.mighty_arrows, row.teens]);
      narrative("AREAS REQUIRING ATTENTION", [row.areas_for_improvement]);
      narrative("RECOMMENDATIONS", [row.recommendations]);
      if (isIncident(row.incident_flag) || useful(row.incident_description)) narrative("INCIDENT / RISK DETAILS", [row.incident_description || row.incident_flag], "danger");
    }

    for (const row of timers) {
      section(`${++itemNumber}. SERVICE TIMING`);
      paragraph(`Service window: ${display(row.service_start)} - ${display(row.service_end)}`, "meta");
      paragraph(`Collective timing observation: ${readableText(row.general_observation) || "No exception noted"}`, "meta");
      narrative("Service timing log", [timingLog(row.segments), timingLog(row.extra_segment)]);
    }

    for (const row of observers) {
      section(`${++itemNumber}. ${display(row.reporting_location || row.posted_location || "GENERAL SERVICE OPERATIONS")}`);
      narrative("OBSERVATIONS", [row.general_observations]);
      const unitReports = row.unit_reports && typeof row.unit_reports === "object" ? row.unit_reports as ReportRow : {};
      for (const [unit, report] of Object.entries(unitReports)) narrative(`${humanize(unit)} — OBSERVATION`, [report]);
      narrative("RECOMMENDATIONS", [row.recommendations]);
      narrative("CONCLUSION", [row.conclusion]);
    }

    for (const row of emergencies) {
      section(`${++itemNumber}. EMERGENCY — ${display(row.location)}`);
      narrative("EMERGENCY DETAILS", [row.description], "danger");
      paragraph(`Status: ${display(row.status)} • Reported by: ${display(row.reported_by)} • Submitted: ${timestamp(row.submitted_at)}`, "danger");
    }

    narrative("CONSOLIDATED AREAS REQUIRING ATTENTION", posts.map((row) => row.areas_for_improvement), "consolidatedAttention");
    narrative("CONSOLIDATED RECOMMENDATIONS", [...posts.map((row) => row.recommendations), ...observers.map((row) => row.recommendations)]);
    add([]);
  }

  const unassignedEmergencies = data.emergencies.filter((row) => !serviceName(row.service));
  if (unassignedEmergencies.length) {
    section("UNASSIGNED EMERGENCY FLAGS");
    for (const row of unassignedEmergencies) {
      paragraph(`Location: ${display(row.location)} • Status: ${display(row.status)} • Reported by: ${display(row.reported_by)}`, "danger");
      narrative("EMERGENCY DETAILS", [row.description], "danger");
    }
  }
  add([]);
  paragraph(`Generated from the authoritative QC report store • Refreshed ${timestamp(refreshedAt)}`, "date");
  return { rows, styles, merges };
}

