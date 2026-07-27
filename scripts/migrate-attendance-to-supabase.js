const fs = require("node:fs");
const crypto = require("node:crypto");
const { google } = require("googleapis");

function loadEnv(path) {
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

function dateKey(value) {
  const match = String(value || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  const iso = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? iso[0] : "";
}

function fingerprint(row, rowNumber) {
  return crypto.createHash("sha256").update(JSON.stringify([rowNumber, ...row])).digest("hex");
}

async function main() {
  const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
  const auth = new google.auth.JWT({ email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: env.GOOGLE_PRIVATE_KEY, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  const sheets = google.sheets({ version: "v4", auth });
  const result = await sheets.spreadsheets.values.batchGet({ spreadsheetId: env.GOOGLE_SHEET_ID, ranges: ["Config!A:B", "Whitelist!B:B", "Attendance!A:L"] });
  const [configRows = [], whitelistRows = [], attendanceRows = []] = (result.data.valueRanges || []).map((range) => range.values || []);
  const config = Object.fromEntries(configRows.filter((row) => row[0]).map(([key, value]) => [key, value || ""]));
  const members = [...new Map(whitelistRows.flat().map((name) => String(name || "").trim()).filter(Boolean).map((name) => [name.toLowerCase().replace(/\s+/g, " "), name])).entries()]
    .map(([normalized_name, full_name]) => ({ full_name, normalized_name, is_active: true }));

  const approvedDevices = new Set();
  const invalid = { date: 0, service: 0, name: 0, coordinates: 0, distance: 0, status: 0 };
  const records = attendanceRows.slice(1).filter((row) => row.some(Boolean)).map((row, index) => {
    const [date = "", service = "", memberName = "", time = "", latitude = "", longitude = "", distance = "", status = "", reason = "", browser = "", device = "", deviceId = ""] = row;
    const key = dateKey(date);
    if (!key) invalid.date += 1;
    if (!["Sunday", "Thursday", "Other"].includes(service)) invalid.service += 1;
    if (!String(memberName).trim()) invalid.name += 1;
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) invalid.coordinates += 1;
    if (!Number.isFinite(Number(distance))) invalid.distance += 1;
    if (!["Approved", "Rejected"].includes(status)) invalid.status += 1;
    const deviceKey = `${key}|${deviceId}`;
    const adminOverride = status === "Approved" && deviceId && approvedDevices.has(deviceKey);
    if (status === "Approved" && deviceId) approvedDevices.add(deviceKey);
    return { attendance_date: date, attendance_date_key: key, service, member_name: memberName, attendance_time: time, latitude, longitude, distance_meters: distance, status, reason, browser: browser || "Unknown", device: device || "Unknown", device_id: deviceId, admin_override: Boolean(adminOverride), source_fingerprint: fingerprint(row, index + 2) };
  });

  console.log(JSON.stringify({ members: members.length, attendanceRecords: records.length, invalid }, null, 2));
  if (process.argv.includes("--dry-run")) return;
  if (Object.values(invalid).some((count) => count > 0)) throw new Error("Migration stopped because one or more attendance rows cannot be represented safely.");

  const endpoint = `${env.SUPABASE_URL}/functions/v1/qcu-attendance`;
  const headers = { "Content-Type": "application/json", apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, "x-qcu-operation-secret": env.SUPABASE_GATEWAY_SECRET };
  const send = async (payload) => {
    const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ operation: "migration.import", ...payload }) });
    if (!response.ok) throw new Error(`Supabase import failed (${response.status}): ${await response.text()}`);
  };
  await send({ members, settings: { is_open: config.isOpen === "true", church_latitude: config.churchLat || env.CHURCH_LATITUDE || null, church_longitude: config.churchLng || env.CHURCH_LONGITUDE || null, allowed_radius_meters: config.allowedRadius || env.GEOFENCE_RADIUS || null, location_name: "Abuja", timezone_label: "WAT" } });
  for (let offset = 0; offset < records.length; offset += 100) await send({ records: records.slice(offset, offset + 100) });
  console.log(`Migration complete: ${members.length} members and ${records.length} attendance records.`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
