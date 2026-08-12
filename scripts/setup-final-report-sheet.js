const fs = require("node:fs");
const path = require("node:path");
const { google } = require("googleapis");

for (const name of [".env", ".env.local"]) {
  const file = path.join(process.cwd(), name);
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "").replace(/\\n/g, "\n");
  }
}

const spreadsheetId = "1eZPJiAX4tCTX8huAAFCRrUSRr5na34VqmzXFCiqjGu0";
const auth = new google.auth.JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_PRIVATE_KEY, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
const sheets = google.sheets({ version: "v4", auth });
const c = (hex) => { const h = hex.replace("#", ""); return { red: parseInt(h.slice(0,2),16)/255, green: parseInt(h.slice(2,4),16)/255, blue: parseInt(h.slice(4,6),16)/255 }; };

(async () => {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  let properties = metadata.data.sheets.find((sheet) => sheet.properties.title === "TEMPLATE")?.properties;
  if (!properties) {
    properties = metadata.data.sheets.find((sheet) => sheet.properties.title === "Sheet1")?.properties;
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId: properties.sheetId, title: "TEMPLATE", gridProperties: { frozenRowCount: 3, hideGridlines: true } }, fields: "title,gridProperties.frozenRowCount,gridProperties.hideGridlines" } }] } });
  }
  const values = [["QC DAILY SERVICE LEADERSHIP REPORT"],["Streams of Joy International  •  Detailed service review for church authorities"],["A vertical, narrative report highlighting observations, recommendations, risks and action points."],[],["TOTAL WORSHIPPERS","—","SERVICES REPORTED","—","INCIDENTS","—","EMERGENCIES","—"],[],["SERVICE NAME","","Worshippers","—","Adults","—","Children","—"],["SERVICE OVERVIEW"],["Report coverage","Post, timer and observer submissions","Incidents","—","Overall attendance","—"],["HEADCOUNT — SUPPORTING DETAIL"],["Area / Unit","Reporter","Adults","Children","Total","Overall rating","Submitted"],["No reports yet — date tabs populate automatically from Supabase."],[],["DETAILED POST REPORT — AREA / UNIT"],["Reporter","—","Overall rating","—","Submitted","—"],["WHAT WENT WELL"],["Detailed positive observations will appear here in a readable narrative block."],["AREAS REQUIRING IMPROVEMENT"],["All improvement points will be separated and clearly highlighted."],["RECOMMENDATIONS / ACTIONS FOR LEADERSHIP"],["Specific recommendations and service action points will be highlighted here."],["INCIDENT / RISK DETAILS"],["Incident details appear in red only when reported."],[],["SERVICE TIMING & FLOW"],["TIMER'S GENERAL OBSERVATION"],["Timing notes and full programme segment details will appear vertically."],[],["OBSERVER'S LEADERSHIP REPORT"],["GENERAL SERVICE OBSERVATIONS"],["Observer narratives and individual unit observations will each receive a dedicated block."],["OBSERVER RECOMMENDATIONS"],["Leadership recommendations from the observer will appear here."],["OBSERVER CONCLUSION"],["The final observer conclusion will appear here."],[],["Generated from the authoritative QC Supabase report store. Generated date tabs are presentation-ready and should not be manually overwritten."]];
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: "'TEMPLATE'!A:N" });
  await sheets.spreadsheets.values.update({ spreadsheetId, range: "'TEMPLATE'!A1", valueInputOption: "RAW", requestBody: { values } });
  const id = properties.sheetId;
  const requests = [
    { unmergeCells: { range: { sheetId: id } } },
    { repeatCell: { range: { sheetId:id,startRowIndex:0,endRowIndex:120,startColumnIndex:0,endColumnIndex:8 }, cell:{userEnteredFormat:{backgroundColor:c("F4F7FB"),textFormat:{foregroundColor:c("0F172A"),fontFamily:"Arial",fontSize:10},wrapStrategy:"WRAP",verticalAlignment:"TOP",padding:{top:8,bottom:8,left:9,right:9}}},fields:"userEnteredFormat" } },
    ...[[0,"0B1738","FFFFFF",20],[1,"172554","CFFAFE",11],[2,"F8FAFC","64748B",10],[4,"E0F2FE","0F172A",10],[6,"1D4ED8","FFFFFF",12],[7,"EDE9FE","4C1D95",10],[8,"E0F2FE","0F172A",10],[9,"EDE9FE","4C1D95",10],[10,"0F766E","FFFFFF",10],[11,"F8FAFC","64748B",10],[13,"1D4ED8","FFFFFF",11],[14,"0F766E","FFFFFF",10],[15,"ECFEFF","155E75",10],[16,"F8FAFC","334155",10],[17,"FFF7ED","9A3412",10],[18,"FFFDF5","334155",10],[19,"ECFDF5","065F46",10],[20,"F0FDF4","334155",10],[21,"FEF2F2","991B1B",10],[22,"FEF2F2","991B1B",10],[24,"EDE9FE","4C1D95",10],[25,"ECFEFF","155E75",10],[26,"F8FAFC","334155",10],[28,"EDE9FE","4C1D95",10],[29,"ECFEFF","155E75",10],[30,"F8FAFC","334155",10],[31,"ECFDF5","065F46",10],[32,"F0FDF4","334155",10],[33,"FFF7ED","9A3412",10],[34,"FFFDF5","334155",10],[36,"F8FAFC","64748B",10]].map(([r,b,f,s])=>({repeatCell:{range:{sheetId:id,startRowIndex:r,endRowIndex:r+1,startColumnIndex:0,endColumnIndex:8},cell:{userEnteredFormat:{backgroundColor:c(b),textFormat:{foregroundColor:c(f),bold:[0,1,4,6,7,9,10,13,14,15,17,19,21,24,25,28,29,31,33].includes(r),italic:[2,11,36].includes(r),fontSize:s},verticalAlignment:"MIDDLE",wrapStrategy:"WRAP"}},fields:"userEnteredFormat"}})),
    ...[0,1,2,7,9,11,13,15,16,17,18,19,20,21,22,24,25,26,28,29,30,31,32,33,34,36].map((r)=>({mergeCells:{range:{sheetId:id,startRowIndex:r,endRowIndex:r+1,startColumnIndex:0,endColumnIndex:8},mergeType:"MERGE_ALL"}})),
    { updateDimensionProperties:{range:{sheetId:id,dimension:"COLUMNS",startIndex:0,endIndex:8},properties:{pixelSize:135},fields:"pixelSize"} },
    { updateDimensionProperties:{range:{sheetId:id,dimension:"COLUMNS",startIndex:0,endIndex:1},properties:{pixelSize:190},fields:"pixelSize"} },
    { autoResizeDimensions:{dimensions:{sheetId:id,dimension:"ROWS",startIndex:0,endIndex:values.length}} },
  ];
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  console.log(JSON.stringify({ ok:true, title:"TEMPLATE", spreadsheetId }));
})().catch((error)=>{ console.error(error.message); process.exitCode=1; });
