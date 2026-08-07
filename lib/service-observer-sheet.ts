import "server-only";

import { google } from "googleapis";
import { getGoogleEnv } from "@/lib/env";
import { appendCategorizedReport } from "@/lib/service-report-workbook";

const SPREADSHEET_ID = "1N2kyYbaOFDryoukMGrxyJplrDTvgXHUSPnBG_8jo7Q4";
const SHEET_GID = 1227078310;

export const SERVICE_OBSERVER_UNITS = [
  "Teens Ministries", "Mighty Arrows", "Chabod Ministrels", "Ushering", "Protocol",
  "Traffic Unit (Watch Tower)", "Security", "Media", "Meeters and Greeters",
  "Temple Keepers", "Medical Care", "Streams Emporium", "Streams Enquiry Unit",
  "Instrumental Unit", "Transport Unit", "Other",
] as const;

export const SERVICE_OBSERVER_HEADERS = [
  "Date", "Service", "Observer Name", "General Observations", "Units Reported On",
  "Unit Reports JSON", "Recommendations", "Conclusion", "Who Are You", "Posted Location", "Reporting Location", "Submitted At",
];

export type ServiceObserverReport = {
  date: string;
  service: string;
  observerName: string;
  generalObservations: string;
  unitsReported: string[];
  unitReports: Record<string, string>;
  recommendations: string;
  conclusion: string;
  reporterRole: string;
  postedLocation: string;
  reportingLocation: string;
};

function escapeTitle(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

export async function appendServiceObserverReport(report: ServiceObserverReport) {
  const env = getGoogleEnv();
  const auth = new google.auth.JWT({
    email: env.serviceAccountEmail,
    key: env.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets.properties(sheetId,title)",
  });
  const title = metadata.data.sheets?.find((sheet) => sheet.properties?.sheetId === SHEET_GID)?.properties?.title;
  if (!title) throw new Error("The configured Service Observer sheet tab was not found.");
  const sheet = escapeTitle(title);
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet}!A1:L1`,
  });
  const currentHeaders = (headerResponse.data.values?.[0] || []).map((value) => String(value).trim());
  if (!currentHeaders.some(Boolean)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheet}!A1:L1`,
      valueInputOption: "RAW",
      requestBody: { values: [SERVICE_OBSERVER_HEADERS] },
    });
  } else if (currentHeaders.some((header, index) => header && SERVICE_OBSERVER_HEADERS[index] !== header)) {
    throw new Error("The Service Observer sheet headers do not match the required observer columns.");
  }

  const row = [
    report.date, report.service, report.observerName, report.generalObservations,
    report.unitsReported.join(", "), JSON.stringify(report.unitReports),
    report.recommendations, report.conclusion, report.reporterRole, report.postedLocation, report.reportingLocation,
  ];
  const submittedAt = new Date().toISOString();
  const [dashboardResult, primaryResult] = await Promise.allSettled([appendCategorizedReport({
    tab: "Observer Reports",
    headers: ["Record ID", ...SERVICE_OBSERVER_HEADERS],
    row,
    date: report.date,
    service: report.service,
    category: "Observer",
    actor: report.observerName,
    summary: `${report.unitsReported.length} unit${report.unitsReported.length === 1 ? "" : "s"} observed`,
  }), sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet}!A:L`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[...row, submittedAt]],
    },
  })]);
  if (dashboardResult.status === "rejected") console.error("[service-observer] Dashboard write failed", dashboardResult.reason);
  if (primaryResult.status === "rejected") console.error("[service-observer] Primary write failed", primaryResult.reason);
  if (dashboardResult.status === "rejected" && primaryResult.status === "rejected") {
    throw new AggregateError([dashboardResult.reason, primaryResult.reason], "Both observer report destinations failed.");
  }
}
