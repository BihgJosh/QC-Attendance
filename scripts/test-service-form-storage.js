const fs = require("node:fs");
const { randomUUID } = require("node:crypto");

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

async function main() {
  const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
  const marker = "codex-form-test@example.invalid";
  const endpoint = `${env.SUPABASE_URL}/functions/v1/qcu-service-reports`;
  const commonHeaders = { "Content-Type": "application/json", apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, "x-qcu-operation-secret": env.SUPABASE_GATEWAY_SECRET };
  const cases = [
    ["report.insert", { id: randomUUID(), report_date: "2099-12-31", service: "Storage test", reporter_name: "Codex form test", reporter_email: marker, submitted_by_name: "Codex form test", submitted_by_email: marker, area: `Storage test ${randomUUID()}`, assignment_override: true }],
    ["timer.insert", { id: randomUUID(), report_date: "2099-12-31", service: "Storage test", timer_name: "Codex form test", reporter_email: marker, source_fingerprint: `test:${randomUUID()}` }],
    ["observer.insert", { id: randomUUID(), report_date: "2099-12-31", service: "Storage test", observer_name: "Codex form test", reporter_email: marker }],
    ["emergency.insert", { id: randomUUID(), report_date: "2099-12-31", service: "Storage test", location: "Storage test", reported_by: "Codex form test", reporter_email: marker, description: "Temporary form-storage verification row." }],
  ];

  for (const [operation, row] of cases) {
    const response = await fetch(endpoint, { method: "POST", headers: commonHeaders, body: JSON.stringify({ operation, row }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.created !== true) throw new Error(`${operation} failed (${response.status}): ${body.error || "row was not created"}`);
  }

  console.log(JSON.stringify({ marker, operations: cases.map(([operation]) => operation), created: cases.length }));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
