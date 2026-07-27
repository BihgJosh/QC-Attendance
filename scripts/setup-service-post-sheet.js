const fs = require("node:fs");
const { google } = require("googleapis");

const SPREADSHEET_ID = "1B-tojwzi1WFsXWRuKdJ4g9M01tiZClDFCISndxTR7gg";
const SHEET_GID = 1234691256;
const HEADERS = [
  "Date", "Service", "Name", "Area", "Adults Headcount", "Children Headcount",
  "Preparedness", "Neatness", "Orderliness", "Conduct", "Compliance", "Coordination",
  "Overall Rating", "What Went Well", "Areas For Improvement", "Recommendations",
  "Incident Flag", "Incident Description", "MA Topic Taught", "MA Teacher Preparedness",
  "MA Children Participation", "MA Children Behaviour", "MA Safety Concern Flag",
  "MA Safety Concern Description", "Teens Lesson Topic", "Teens Teacher Preparedness",
  "Teens Engagement", "Teens Classroom Mgmt", "Additional Comments", "Submitted At",
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
  if (!title) throw new Error("The selected Service Post tab was not found.");
  const escapedTitle = `'${title.replace(/'/g, "''")}'`;
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${escapedTitle}!A1:AD1` });
  const current = (result.data.values?.[0] || []).map((value) => String(value).trim());
  if (!current.some(Boolean)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${escapedTitle}!A1:AD1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS] },
    });
    console.log(`Initialized "${title}" with ${HEADERS.length} Service Post columns.`);
    return;
  }
  if (HEADERS.some((header, index) => current[index] !== header)) {
    throw new Error(`"${title}" already has incompatible headers: ${JSON.stringify(current)}. No changes were made.`);
  }
  console.log(`Verified "${title}" with all ${HEADERS.length} Service Post columns.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
