const fs = require("node:fs");
const { google } = require("googleapis");

const SPREADSHEET_ID = "1BeoEcYvTGtVhBCp4SxX8mlfFscQD5rBrZ2tnPUdKP-8";
const SHEET_GID = 810317383;
const SEGMENTS = [
  "Opening Prayer", "Praise & Worship", "Speaking into the Week", "Solo Ministration",
  "Declaration", "First Testimony", "Second Testimony", "Third Testimony",
  "Choir Ministration", "Pastor's Ministration", "Offering & Announcement",
];
const HEADERS = [
  "Date", "Service", "Timer Name", "Service Start", "Service End",
  ...SEGMENTS.flatMap((label) => [`${label} - Status`, `${label} - Min`, `${label} - Sec`]),
  "Extra Segment Name", "Extra Segment Status", "Extra Segment Min", "Extra Segment Sec",
  "Timer General Observation", "Submitted At",
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
  if (!title) throw new Error("The selected Service Timer tab was not found.");
  const escapedTitle = `'${title.replace(/'/g, "''")}'`;
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${escapedTitle}!A1:AR1` });
  const current = (result.data.values?.[0] || []).map((value) => String(value).trim());
  if (!current.some(Boolean)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${escapedTitle}!A1:AR1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS] },
    });
    console.log(`Initialized "${title}" with ${HEADERS.length} Service Timer columns.`);
    return;
  }
  if (HEADERS.some((header, index) => current[index] !== header)) {
    throw new Error(`"${title}" has incompatible headers. No changes were made.`);
  }
  console.log(`Verified "${title}" with all ${HEADERS.length} Service Timer columns.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
