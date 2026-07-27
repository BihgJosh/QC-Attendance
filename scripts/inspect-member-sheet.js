const { google } = require("googleapis");

const spreadsheetId = "1kHZCkngN1wHMaCS2U3ihWHWQ68_CAIn2hhsPbErxrpY";
const sheetId = 795286797;

async function main() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const selected = metadata.data.sheets?.find((sheet) => sheet.properties?.sheetId === sheetId);
  const title = selected?.properties?.title;
  if (!title) throw new Error("The requested sheet tab was not found.");

  const values = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${title.replace(/'/g, "''")}'!A:Z`,
  });
  const rows = values.data.values || [];
  const headers = rows[0] || [];
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
  const emailColumns = headers
    .map((header, index) => ({ header: String(header).trim(), index }))
    .filter(({ header }) => /e-?mail/i.test(header));
  const emailCount = rows.slice(1).filter((row) => emailColumns.some(({ index }) => emailPattern.test(String(row[index] || "").trim()))).length;

  console.log(JSON.stringify({ title, headers, rows: Math.max(rows.length - 1, 0), emailColumns: emailColumns.map((column) => column.header), emailCount }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
