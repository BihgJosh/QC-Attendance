const fs = require("node:fs");
const { google } = require("googleapis");

const SPREADSHEET_ID = "1N2kyYbaOFDryoukMGrxyJplrDTvgXHUSPnBG_8jo7Q4";
const SHEET_GID = 1227078310;
const HEADERS = [
  "Date", "Service", "Observer Name", "General Observations", "Units Reported On",
  "Unit Reports JSON", "Recommendations", "Conclusion", "Submitted At",
];

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
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets.properties(sheetId,title)",
  });
  const title = metadata.data.sheets?.find((sheet) => sheet.properties?.sheetId === SHEET_GID)?.properties?.title;
  if (!title) throw new Error("The selected Service Observer tab was not found.");
  const escapedTitle = `'${title.replace(/'/g, "''")}'`;
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${escapedTitle}!A1:I1` });
  const current = (result.data.values?.[0] || []).map((value) => String(value).trim());
  if (!current.some(Boolean)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${escapedTitle}!A1:I1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS] },
    });
    console.log(`Initialized "${title}" with ${HEADERS.length} Service Observer columns.`);
    return;
  }
  if (HEADERS.some((header, index) => current[index] !== header)) {
    throw new Error(`"${title}" has incompatible headers. No changes were made.`);
  }
  console.log(`Verified "${title}" with all ${HEADERS.length} Service Observer columns.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
