const GATEWAY_SECRET_HASH = "e961e32016c41f358eac3f9e1546b93d78bae0b9b30a446ccceecea47533fa41";
const allowedOperations = new Set(["migration.import", "report.insert", "report.assignments", "timer.insert", "observer.insert", "emergency.insert", "emergency.list", "emergency.update", "manager.dashboard", "manager.daily-report", "manager.finalize", "admin.report-activity", "document.find", "document.insert", "activity.insert", "email.insert"]);
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
  if (!response.ok) {
    const error = new Error(payload?.message || `Database request failed (${response.status}).`) as Error & { code?: string; status?: number };
    error.code = payload?.code; error.status = response.status; throw error;
  }
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
  const dateFilter = `report_date=eq.${encodeURIComponent(date)}`;
  const [posts, timers, observers, emergencies] = await Promise.all([
    rest(`service_post_reports?select=*&${filter}&order=submitted_at.asc,created_at.asc`) as Promise<Json[]>,
    rest(`service_timer_logs?select=*&${filter}&order=submitted_at.desc.nullslast,created_at.desc&limit=1`) as Promise<Json[]>,
    rest(`service_observer_reports?select=*&${filter}&order=submitted_at.desc.nullslast,created_at.desc&limit=1`) as Promise<Json[]>,
    rest(`service_emergency_flags?select=*&${dateFilter}&order=submitted_at.desc.nullslast,created_at.desc`) as Promise<Json[]>,
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
  if (byDepartment.length) {
    await rest("headcount_reconciliations?on_conflict=service_date,service,department", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(byDepartment.map((row) => ({
        service_date: date, service, department: row.department,
        submitted_adults: row.adults, submitted_children: row.children,
        updated_at: new Date().toISOString(),
      }))),
    });
  }
  const timer = timers[0] ? { timerName: timers[0].timer_name, serviceStart: timers[0].service_start, serviceEnd: timers[0].service_end, segments: timers[0].segments, generalObservation: timers[0].general_observation } : null;
  const observer = observers[0] ? { observerName: observers[0].observer_name, reporterRole: observers[0].reporter_role, postedLocation: observers[0].posted_location, reportingLocation: observers[0].reporting_location, generalObservations: observers[0].general_observations, unitReports: observers[0].unit_reports, recommendations: observers[0].recommendations, conclusion: observers[0].conclusion } : null;
  return { headcount: { byDepartment, grandTotal: byDepartment.reduce((sum, row) => sum + row.total, 0) }, incidentCount: posts.filter((row) => /yes|true|incident/i.test(String(row.incident_flag || ""))).length, ratings: ratingSummary(posts), timer, observer, emergencies: emergencies.map((row) => ({ id: row.id, service: row.service, location: row.location, description: row.description, reportedBy: row.reported_by, submittedAt: row.submitted_at, status: row.status })) };
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

async function reportActivity(from = "", to = "") {
  const dateFilter = `${from ? `&report_date=gte.${encodeURIComponent(from)}` : ""}${to ? `&report_date=lte.${encodeURIComponent(to)}` : ""}`;
  const [posts, timers, observers, emergencies] = await Promise.all([
    rest(`service_post_reports?select=reporter_name,reporter_email,submitted_by_name,submitted_by_email,submitted_at,created_at${dateFilter}`) as Promise<Json[]>,
    rest(`service_timer_logs?select=timer_name,submitted_at,created_at${dateFilter}`) as Promise<Json[]>,
    rest(`service_observer_reports?select=observer_name,submitted_at,created_at${dateFilter}`) as Promise<Json[]>,
    rest(`service_emergency_flags?select=reported_by,submitted_at,created_at${dateFilter}`) as Promise<Json[]>,
  ]);
  const users = new Map<string, { name: string; email: string; total: number; lastSubmittedAt: string; reportTypes: Record<string, number> }>();
  const add = (nameValue: unknown, emailValue: unknown, type: string, submittedValue: unknown, createdValue: unknown) => {
    const name = String(nameValue || "Unknown user").trim() || "Unknown user";
    const email = String(emailValue || "").trim().toLowerCase();
    const key = email || name.toLowerCase();
    const submittedAt = String(submittedValue || createdValue || "");
    const current = users.get(key) || { name, email, total: 0, lastSubmittedAt: "", reportTypes: {} };
    current.total += 1;
    current.reportTypes[type] = (current.reportTypes[type] || 0) + 1;
    if (submittedAt > current.lastSubmittedAt) current.lastSubmittedAt = submittedAt;
    users.set(key, current);
  };
  posts.forEach((row) => add(row.submitted_by_name || row.reporter_name, row.submitted_by_email || row.reporter_email, "Service Post", row.submitted_at, row.created_at));
  timers.forEach((row) => add(row.timer_name, "", "Service Timer", row.submitted_at, row.created_at));
  observers.forEach((row) => add(row.observer_name, "", "Observer Report", row.submitted_at, row.created_at));
  emergencies.forEach((row) => add(row.reported_by, "", "Emergency Flag", row.submitted_at, row.created_at));
  return [...users.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
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
    if (operation === "report.assignments") {
      const date = encodeURIComponent(String(body.date || ""));
      const service = encodeURIComponent(String(body.service || ""));
      const rows = await rest(`service_post_reports?select=area,reporter_name&report_date=eq.${date}&service=eq.${service}&assignment_enforced=eq.true&order=submitted_at.asc.nullslast,created_at.asc`) as Json[];
      const assignments = new Map<string, Json>();
      for (const row of rows) {
        const key = String(row.area || "").trim().toLowerCase();
        if (key && !assignments.has(key)) assignments.set(key, { area: row.area, assignedTo: row.reporter_name || "another user" });
      }
      return json({ ok: true, assignments: [...assignments.values()] });
    }
    if (operation === "manager.daily-report") return json({ ok: true, data: await dailyReport(String(body.date || "")) });
    if (operation === "admin.report-activity") return json({ ok: true, users: await reportActivity(String(body.from || ""), String(body.to || "")) });
    if (operation === "manager.finalize") {
      const date = String(body.date || "");
      const service = String(body.service || "");
      const data = await dashboard(date, service);
      const unresolved = await rest(`headcount_reconciliations?select=department,status,discrepancy_reason&service_date=eq.${encodeURIComponent(date)}&service=eq.${encodeURIComponent(service)}&status=in.(pending,discrepancy)`) as Json[];
      if (unresolved.some((row) => row.status === "discrepancy" && !String(row.discrepancy_reason || "").trim())) return json({ error: "Resolve every headcount discrepancy before final submission." }, 409);
      await rest(`final_hod_reports?service_date=eq.${encodeURIComponent(date)}&service=eq.${encodeURIComponent(service)}&status=eq.approved`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "superseded" }) });
      const assignmentRows = await rest(`service_assignments?select=id,manager_email&service_date=eq.${encodeURIComponent(date)}&service=eq.${encodeURIComponent(service)}&status=neq.cancelled&order=created_at.desc&limit=1`) as Json[];
      const rows = await rest("final_hod_reports", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ service_date: date, service, assignment_id: assignmentRows[0]?.id || null, submitted_by: assignmentRows[0]?.manager_email || "Service Manager", totals: { worshippers: data.headcount.grandTotal, incidents: data.incidentCount }, department_breakdown: data.headcount.byDepartment, discrepancy_summary: unresolved.map((row) => `${row.department}: ${row.discrepancy_reason || row.status}`).join("; "), status: "approved" }) }) as Json[];
      if (assignmentRows[0]?.id) await rest(`service_assignments?id=eq.${encodeURIComponent(String(assignmentRows[0].id))}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "submitted", updated_at: new Date().toISOString() }) });
      return json({ ok: true, report: rows[0], data });
    }
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
      const rows = await rest(`service_emergency_flags?id=eq.${id}&report_date=eq.${date}&or=(status.is.null,status.not.in.(Resolved,Escalated))`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status }) }) as Json[];
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
    const conflictKey = String((body.row as Json)?.source_fingerprint || "") ? "source_fingerprint" : "id";
    const rows = await rest(`${table}?on_conflict=${conflictKey}`, { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(body.row) }) as Json[];
    if (operation === "report.insert" && !rows.length) {
      const id = encodeURIComponent(String((body.row as Json)?.id || ""));
      const existing = await rest(`service_post_reports?select=id&id=eq.${id}&limit=1`) as Json[];
      if (!existing.length) return json({ error: "This observation area was just assigned to another user. Choose another available area, or use an authorized override.", code: "area_assigned" }, 409);
    }
    return json({ success: true, created: rows.length > 0, row: rows[0] || null });
  } catch (error) {
    console.error("[qcu-service-reports]", error instanceof Error ? error.message : error);
    const typed = error as Error & { code?: string; status?: number };
    if (typed.code === "23505" || /duplicate key|unique constraint/i.test(typed.message || "")) return json({ error: "This observation area was just assigned to another user. Choose another available area, or use an authorized override.", code: "area_assigned" }, 409);
    return json({ error: typed.message || "Service report request failed." }, typed.status && typed.status < 500 ? typed.status : 500);
  }
});
