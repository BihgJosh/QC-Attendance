const GATEWAY_SECRET_HASH = "e961e32016c41f358eac3f9e1546b93d78bae0b9b30a446ccceecea47533fa41";
const allowedOperations = new Set(["migration.import", "report.insert", "timer.insert", "observer.insert", "emergency.insert", "emergency.list", "emergency.update", "manager.dashboard", "manager.daily-report", "document.find", "document.insert", "activity.insert", "email.insert"]);
type Json = Record<string, unknown>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function rest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { ...init, headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || `Database request failed (${response.status}).`);
  return payload;
}

async function insert(table: string, row: unknown, onConflict = "source_fingerprint") {
  return rest(`${table}?on_conflict=${onConflict}`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(row) });
}

async function importSource(source: Json) {
  const sources = await insert("sheet_sources", { source_key: source.sourceKey, spreadsheet_id: source.spreadsheetId, spreadsheet_title: source.title, last_synced_at: new Date().toISOString() }, "spreadsheet_id") as Json[];
  const sourceId = String(sources[0].id);
  for (const rawTab of Array.isArray(source.tabs) ? source.tabs : []) {
    const tab = rawTab as Json;
    const tabs = await rest("sheet_tabs?on_conflict=source_id,sheet_gid", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ source_id: sourceId, sheet_gid: tab.gid, sheet_title: tab.title, headers: tab.headers, source_sha256: tab.sha256, populated_rows: tab.populatedRows, formula_cells: tab.formulaCells, last_synced_at: new Date().toISOString() }) }) as Json[];
    const tabId = String(tabs[0].id);
    const rows = (Array.isArray(tab.rows) ? tab.rows : []).map((row) => ({ ...(row as Json), tab_id: tabId }));
    for (let offset = 0; offset < rows.length; offset += 250) await insert("sheet_rows", rows.slice(offset, offset + 250), "tab_id,source_row_number");
  }
}

function ratingSummary(rows: Json[]) {
  const scores: Record<string, number> = { Excellent: 4, Good: 3, "Needs Improvement": 2, Poor: 1 };
  const labels = ["Preparedness", "Neatness", "Orderliness", "Conduct", "Compliance", "Coordination"];
  const result: Record<string, string> = {};
  for (const label of labels) {
    const key = label.toLowerCase();
    const values = rows.flatMap((row) => {
      const ratings = row.ratings && typeof row.ratings === "object" ? row.ratings as Json : {};
      const value = String(ratings[key] || ratings[label] || "");
      return scores[value] ? [scores[value]] : [];
    });
    if (!values.length) continue;
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    result[label] = average >= 3.5 ? "Excellent" : average >= 2.5 ? "Good" : average >= 1.5 ? "Needs Improvement" : "Poor";
  }
  return result;
}

async function dashboard(date: string, service: string) {
  const filter = `report_date=eq.${encodeURIComponent(date)}&service=eq.${encodeURIComponent(service)}`;
  const [posts, timers, observers, emergencies] = await Promise.all([
    rest(`service_post_reports?select=*&${filter}&order=submitted_at.asc,created_at.asc`) as Promise<Json[]>,
    rest(`service_timer_logs?select=*&${filter}&order=submitted_at.desc.nullslast,created_at.desc&limit=1`) as Promise<Json[]>,
    rest(`service_observer_reports?select=*&${filter}&order=submitted_at.desc.nullslast,created_at.desc&limit=1`) as Promise<Json[]>,
    rest(`service_emergency_flags?select=*&${filter}&order=submitted_at.desc.nullslast,created_at.desc`) as Promise<Json[]>,
  ]);
  const areas = new Map<string, { adults: number; children: number }>();
  for (const row of posts) {
    const area = String(row.area || "Unspecified");
    const current = areas.get(area) || { adults: 0, children: 0 };
    current.adults += Number(row.adults_headcount || 0);
    current.children += Number(row.children_headcount || 0);
    areas.set(area, current);
  }
  const byDepartment = [...areas.entries()].map(([department, count]) => ({ department, ...count, total: count.adults + count.children }));
  const timer = timers[0] ? { timerName: timers[0].timer_name, serviceStart: timers[0].service_start, serviceEnd: timers[0].service_end, segments: timers[0].segments, generalObservation: timers[0].general_observation } : null;
  const observer = observers[0] ? { observerName: observers[0].observer_name, reporterRole: observers[0].reporter_role, postedLocation: observers[0].posted_location, reportingLocation: observers[0].reporting_location, generalObservations: observers[0].general_observations, unitReports: observers[0].unit_reports, recommendations: observers[0].recommendations, conclusion: observers[0].conclusion } : null;
  return { headcount: { byDepartment, grandTotal: byDepartment.reduce((sum, row) => sum + row.total, 0) }, incidentCount: posts.filter((row) => /yes|true|incident/i.test(String(row.incident_flag || ""))).length, ratings: ratingSummary(posts), timer, observer, emergencies: emergencies.map((row) => ({ location: row.location, description: row.description, reportedBy: row.reported_by, submittedAt: row.submitted_at, status: row.status })) };
}

async function dailyReport(date: string) {
  const filter = `report_date=eq.${encodeURIComponent(date)}&order=service.asc,submitted_at.asc.nullslast,created_at.asc`;
  const [posts, timers, observers, emergencies] = await Promise.all([
    rest(`service_post_reports?select=*&${filter}`) as Promise<Json[]>,
    rest(`service_timer_logs?select=*&${filter}`) as Promise<Json[]>,
    rest(`service_observer_reports?select=*&${filter}`) as Promise<Json[]>,
    rest(`service_emergency_flags?select=*&${filter}`) as Promise<Json[]>,
  ]);
  return { date, posts, timers, observers, emergencies };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const body = await request.json() as Json;
    const operation = String(body.operation || "");
    const suppliedHash = await sha256(request.headers.get("x-qcu-operation-secret") || "");
    if (!allowedOperations.has(operation) || !safeEqual(suppliedHash, GATEWAY_SECRET_HASH)) return json({ error: "Unauthorized." }, 401);
    if (operation === "migration.import") {
      for (const source of Array.isArray(body.sources) ? body.sources : []) await importSource(source as Json);
      const tables = body.tables && typeof body.tables === "object" ? body.tables as Json : {};
      for (const [table, rows] of Object.entries(tables)) if (Array.isArray(rows) && rows.length) for (let offset = 0; offset < rows.length; offset += 200) await insert(table, rows.slice(offset, offset + 200));
      return json({ success: true });
    }
    if (operation === "manager.dashboard") return json({ ok: true, data: await dashboard(String(body.date || ""), String(body.service || "")) });
    if (operation === "manager.daily-report") return json({ ok: true, data: await dailyReport(String(body.date || "")) });
    if (operation === "emergency.list") {
      const date = encodeURIComponent(String(body.date || ""));
      const rows = await rest(`service_emergency_flags?select=id,report_date,service,location,reported_by,description,status,submitted_at,submitted_at_ms&report_date=eq.${date}&order=submitted_at.desc.nullslast,created_at.desc`) as Json[];
      return json({ ok: true, rows });
    }
    if (operation === "emergency.update") {
      const id = encodeURIComponent(String(body.id || ""));
      const date = encodeURIComponent(String(body.date || ""));
      const status = String(body.status || "");
      if (!id || !date || !["Resolved", "Escalated"].includes(status)) return json({ error: "Invalid emergency update." }, 400);
      const rows = await rest(`service_emergency_flags?id=eq.${id}&report_date=eq.${date}&status=eq.Active`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status }) }) as Json[];
      if (!rows.length) return json({ error: "Emergency flag not found or already accounted for." }, 409);
      return json({ ok: true, row: rows[0] });
    }
    if (operation === "document.find") {
      const date = encodeURIComponent(String(body.date || ""));
      const service = encodeURIComponent(String(body.service || ""));
      const rows = await rest(`service_generated_documents?select=id,document_url,status,generated_at&report_date=eq.${date}&service=eq.${service}&status=eq.Ready&order=generated_at.desc&limit=1`) as Json[];
      return json({ ok: true, row: rows[0] || null });
    }
    const table = ({ "report.insert": "service_post_reports", "timer.insert": "service_timer_logs", "observer.insert": "service_observer_reports", "emergency.insert": "service_emergency_flags", "document.insert": "service_generated_documents", "activity.insert": "service_activity_log", "email.insert": "service_email_log" } as Record<string, string>)[operation];
    const rows = await insert(table, body.row, String((body.row as Json)?.source_fingerprint || "") ? "source_fingerprint" : "id") as Json[];
    return json({ success: true, row: rows[0] || null });
  } catch (error) {
    console.error("[qcu-service-reports]", error instanceof Error ? error.message : error);
    return json({ error: error instanceof Error ? error.message : "Service report request failed." }, 500);
  }
});
