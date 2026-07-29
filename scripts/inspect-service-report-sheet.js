const fs = require("node:fs");
const { google } = require("googleapis");

const SPREADSHEET_ID = "1QuNstJwL2wxBgM-bwa83r8rU9PZNln3tmih6DOBG2oY";

function loadEnv(path) {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(fs.readFileSync(path, "utf8").split(/\r?\n/).flatMap((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) return [];
    const equals = line.indexOf("=");
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return [[line.slice(0, equals).trim(), value.replace(/\\n/g, "\n")]];
  }));
}

async function main() {
  const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
  const auth = new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: env.GOOGLE_PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "properties.title,sheets.properties(sheetId,title,gridProperties)",
  });
  console.log(`Spreadsheet: ${metadata.data.properties?.title || "Untitled"}`);
  for (const sheet of metadata.data.sheets || []) {
    const properties = sheet.properties || {};
    const title = String(properties.title || "");
    const escaped = `'${title.replace(/'/g, "''")}'`;
    const values = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${escaped}!1:5`,
    });
    console.log(JSON.stringify({
      gid: properties.sheetId,
      title,
      rows: properties.gridProperties?.rowCount,
      columns: properties.gridProperties?.columnCount,
      preview: values.data.values || [],
    }));
  }
}

main().catch((error) => {
  console.error(`Inspection failed: ${error.message}`);
  process.exitCode = 1;
});
