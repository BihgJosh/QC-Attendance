const fs = require("node:fs");
const { google } = require("googleapis");

const DEFAULT_SHEET_ID = "1kHZCkngN1wHMaCS2U3ihWHWQ68_CAIn2hhsPbErxrpY";
const DEFAULT_SHEET_GID = 795286797;
const COLUMNS = ["Timestamp", "Surname", "Other Names", "Home Address", "Phone Number", "Email", "Birthday", "Gender"];

function loadEnv(path) {
  if (!fs.existsSync(path)) return {};
  const env = {};
  for (const rawLine of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals < 1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[key] = value.replace(/\\n/g, "\n");
  }
  return env;
}

async function main() {
  const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
  const auth = new google.auth.JWT({ email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: env.GOOGLE_PRIVATE_KEY, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = env.MEMBER_SHEET_ID || DEFAULT_SHEET_ID;
  const gid = Number(env.MEMBER_SHEET_GID || DEFAULT_SHEET_GID);
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" });
  const title = metadata.data.sheets?.find((sheet) => sheet.properties?.sheetId === gid)?.properties?.title;
  if (!title) throw new Error("The configured team sheet tab was not found.");
  const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${title.replace(/'/g, "''")}'!A:AZ` });
  const rows = result.data.values || [];
  const headerIndex = rows.findIndex((row) => COLUMNS.every((column) => row.some((cell) => String(cell).trim().toLowerCase() === column.toLowerCase())));
  if (headerIndex < 0) throw new Error("The team sheet does not contain all expected columns.");
  const headers = rows[headerIndex].map((cell) => String(cell).trim().toLowerCase());
  const indexes = Object.fromEntries(COLUMNS.map((column) => [column, headers.indexOf(column.toLowerCase())]));
  const deduplicated = new Map();
  for (const row of rows.slice(headerIndex + 1)) {
    const member = Object.fromEntries(COLUMNS.map((column) => [column, String(row[indexes[column]] || "").trim()]));
    const email = member.Email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    member.Email = email;
    deduplicated.set(email, member);
  }
  const members = [...deduplicated.values()];
  if (!members.length) throw new Error("No valid team members were found.");
  console.log(`Prepared ${members.length} unique team profiles.`);
  if (process.argv.includes("--dry-run")) return;
  const response = await fetch(`${env.SUPABASE_URL}/functions/v1/qcu-team-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, "x-qcu-operation-secret": env.SUPABASE_GATEWAY_SECRET },
    body: JSON.stringify({ operation: "team.import", members }),
  });
  if (!response.ok) throw new Error(`Supabase import failed (${response.status}): ${await response.text()}`);
  console.log(`Migration complete: ${members.length} team profiles imported.`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
