const fs = require("node:fs");
const crypto = require("node:crypto");
const { google } = require("googleapis");

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

function escapeTitle(title) {
  return `'${title.replace(/'/g, "''")}'`;
}

function digest(rows) {
  return crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

async function main() {
  const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
  const sources = [
    ["attendance_and_team_data", env.GOOGLE_SHEET_ID],
    ["team_data", env.MEMBER_SHEET_ID || "1kHZCkngN1wHMaCS2U3ihWHWQ68_CAIn2hhsPbErxrpY"],
    ["service_post", "1B-tojwzi1WFsXWRuKdJ4g9M01tiZClDFCISndxTR7gg"],
    ["service_timer", "1BeoEcYvTGtVhBCp4SxX8mlfFscQD5rBrZ2tnPUdKP-8"],
    ["service_observer", "1N2kyYbaOFDryoukMGrxyJplrDTvgXHUSPnBG_8jo7Q4"],
    ["emergency_flags", "1AODePttGGYTO9VWRX2Pmwziy-9_Za7W0aravOvTQwdE"],
    ["service_report_workbook", "1QuNstJwL2wxBgM-bwa83r8rU9PZNln3tmih6DOBG2oY"],
  ].filter(([, id], index, all) => id && all.findIndex(([, candidate]) => candidate === id) === index);
  const auth = new google.auth.JWT({ email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: env.GOOGLE_PRIVATE_KEY, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  const sheets = google.sheets({ version: "v4", auth });
  const inventory = [];
  for (const [source, spreadsheetId] of sources) {
    const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "properties.title,sheets.properties(sheetId,title,gridProperties)" });
    const tabs = [];
    for (const sheet of metadata.data.sheets || []) {
      const title = String(sheet.properties?.title || "");
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: escapeTitle(title), valueRenderOption: "FORMULA", dateTimeRenderOption: "FORMATTED_STRING" });
      const values = response.data.values || [];
      const dataRows = values.slice(1).filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""));
      tabs.push({
        gid: sheet.properties?.sheetId,
        title,
        header: values[0] || [],
        populatedRows: dataRows.length,
        populatedColumns: values.reduce((max, row) => Math.max(max, row.length), 0),
        formulaCells: values.flat().filter((value) => typeof value === "string" && value.startsWith("=")).length,
        sha256: digest(values),
      });
    }
    inventory.push({ source, spreadsheetId, title: metadata.data.properties?.title || "Untitled", tabs });
  }
  console.log(JSON.stringify(inventory, null, 2));
}

main().catch((error) => {
  console.error(`Inventory failed: ${error.message}`);
  process.exitCode = 1;
});
