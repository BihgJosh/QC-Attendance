import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { buildFinalReportRows } from "../lib/final-report-layout.ts";

for (const name of [".env", ".env.local"]) {
  const file = path.join(process.cwd(), name);
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "").replace(/\\n/g, "\n");
  }
}

const date = process.argv[2] || new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
const url = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const anonKey = process.env.SUPABASE_ANON_KEY || "";
const secret = process.env.SUPABASE_GATEWAY_SECRET || "";
assert.ok(url && anonKey && secret, "Supabase report gateway environment is incomplete.");

const response = await fetch(`${url}/functions/v1/qcu-service-reports`, {
  method: "POST",
  signal: AbortSignal.timeout(20_000),
  headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}`, "x-qcu-operation-secret": secret },
  body: JSON.stringify({ operation: "manager.daily-report", date }),
});
assert.equal(response.ok, true, `Daily report gateway returned HTTP ${response.status}.`);
const payload = await response.json();
assert.ok(payload?.data, "Daily report gateway returned no data.");

const data = payload.data;
const built = buildFinalReportRows(data, new Date().toISOString());
const text = built.rows.flat().map(String).join("\n").toLowerCase();
const rows = (key) => Array.isArray(data[key]) ? data[key] : [];
const services = new Set([...rows("posts"), ...rows("timers"), ...rows("observers"), ...rows("emergencies")].map((row) => String(row.service || "").trim()).filter(Boolean));

const serviceHeading = (service) => ({ "1st Service": "first service", "2nd Service": "second service", "3rd Service": "third service", "4th Service": "fourth service" }[service] || service.toLowerCase());
for (const service of services) assert.ok(text.includes(serviceHeading(service)), `Missing service section: ${service}`);
for (const post of rows("posts")) assert.ok(text.includes(String(post.area || "Unspecified Area").toLowerCase()), `Missing post area: ${post.area}`);
for (const timer of rows("timers")) assert.ok(text.includes(String(timer.service_start || "—").toLowerCase()), `Missing timer start for ${timer.service}`);
for (const observer of rows("observers")) assert.ok(text.includes(String(observer.reporting_location || observer.posted_location || "GENERAL SERVICE OPERATIONS").toLowerCase()), `Missing observer location for ${observer.service}`);
for (const emergency of rows("emergencies")) assert.ok(text.includes(String(emergency.location || "—").toLowerCase()), `Missing emergency location for ${emergency.service || "unassigned"}`);
assert.ok(built.rows.every((row) => row.length === 10), "Generated rows do not consistently contain ten document-layout columns.");

console.log(JSON.stringify({ ok: true, date, services: services.size, posts: rows("posts").length, timers: rows("timers").length, observers: rows("observers").length, emergencies: rows("emergencies").length, generatedRows: built.rows.length }));
