const fs = require("node:fs");
const { google } = require("googleapis");

const INTRO_HEADERS = [
  "Testimony Introduction - Status",
  "Testimony Introduction - Min",
  "Testimony Introduction - Sec",
];

const targets = [
  { spreadsheetId: "1BeoEcYvTGtVhBCp4SxX8mlfFscQD5rBrZ2tnPUdKP-8", gid: 810317383, insertionIndex: 20 },
  { spreadsheetId: "1QuNstJwL2wxBgM-bwa83r8rU9PZNln3tmih6DOBG2oY", title: "Timer Logs", insertionIndex: 21 },
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

function columnName(index) {
  let value = index + 1;
  let name = "";
  while (value) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

async function updateTarget(sheets, target) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: target.spreadsheetId, fields: "sheets.properties(sheetId,title)" });
  const properties = metadata.data.sheets?.find((sheet) => target.gid ? sheet.properties?.sheetId === target.gid : sheet.properties?.title === target.title)?.properties;
  if (properties?.sheetId === undefined || properties.sheetId === null || !properties.title) throw new Error("The configured timer worksheet was not found.");
  const escapedTitle = `'${properties.title.replace(/'/g, "''")}'`;
  const headerResult = await sheets.spreadsheets.values.get({ spreadsheetId: target.spreadsheetId, range: `${escapedTitle}!1:1` });
  const headers = (headerResult.data.values?.[0] || []).map((value) => String(value).trim());
  if (INTRO_HEADERS.every((header, offset) => headers[target.insertionIndex + offset] === header)) {
    console.log(`Verified Testimony Introduction columns in ${properties.title}.`);
    return;
  }
  if (headers[target.insertionIndex] !== "First Testimony - Status") throw new Error(`${properties.title} does not have First Testimony at the expected column; no changes were made.`);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: target.spreadsheetId,
    requestBody: { requests: [{ insertDimension: { range: { sheetId: properties.sheetId, dimension: "COLUMNS", startIndex: target.insertionIndex, endIndex: target.insertionIndex + 3 }, inheritFromBefore: true } }] },
  });
  const start = columnName(target.insertionIndex);
  const end = columnName(target.insertionIndex + 2);
  await sheets.spreadsheets.values.update({ spreadsheetId: target.spreadsheetId, range: `${escapedTitle}!${start}1:${end}1`, valueInputOption: "RAW", requestBody: { values: [INTRO_HEADERS] } });
  console.log(`Added Testimony Introduction columns to ${properties.title}.`);
}

async function main() {
  const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
  const auth = new google.auth.JWT({ email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: env.GOOGLE_PRIVATE_KEY, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });
  for (const target of targets) await updateTarget(sheets, target);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
