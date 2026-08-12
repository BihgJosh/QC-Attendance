const fs = require("fs");
const { google } = require("googleapis");

for (const file of [".env", ".env.local"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

const spreadsheetId = "1eZPJiAX4tCTX8huAAFCRrUSRr5na34VqmzXFCiqjGu0";
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

(async () => {
  const sheets = google.sheets({ version: "v4", auth });
  const result = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: true,
    ranges: ["A1:N30"],
    fields: "properties(title,locale,timeZone),sheets(properties(sheetId,title,index,gridProperties),data(startRow,startColumn,rowData.values(formattedValue,userEnteredValue,effectiveFormat)))",
  });
  const summary = {
    serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    workbook: result.data.properties,
    sheets: (result.data.sheets || []).map((sheet) => ({
      properties: sheet.properties,
      populatedPreview: (sheet.data?.[0]?.rowData || []).map((row) => (row.values || []).map((cell) => cell.formattedValue || "")).filter((row) => row.some(Boolean)),
      firstCellFormat: sheet.data?.[0]?.rowData?.[0]?.values?.[0]?.effectiveFormat || null,
    })),
  };
  console.log(JSON.stringify(summary, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ status: error.response?.status, message: error.response?.data?.error?.message || error.message }));
  process.exit(1);
});
