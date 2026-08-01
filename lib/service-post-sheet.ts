import "server-only";

import { google } from "googleapis";
import { getGoogleEnv } from "@/lib/env";
import { appendCategorizedReport } from "@/lib/service-report-workbook";

const SPREADSHEET_ID = "1B-tojwzi1WFsXWRuKdJ4g9M01tiZClDFCISndxTR7gg";
const SHEET_GID = 1234691256;

export const SERVICE_POST_HEADERS = [
  "Date", "Service", "Name", "Area", "Adults Headcount", "Children Headcount",
  "Preparedness", "Neatness", "Orderliness", "Conduct", "Compliance", "Coordination",
  "Overall Rating", "What Went Well", "Areas For Improvement", "Recommendations",
  "Incident Flag", "Incident Description", "MA Topic Taught", "MA Teacher Preparedness",
  "MA Children Participation", "MA Children Behaviour", "MA Safety Concern Flag",
  "MA Safety Concern Description", "Teens Lesson Topic",
  "Teens Teacher Preparedness", "Teens Engagement", "Teens Classroom Mgmt",
  "Additional Comments", "Submitted At",
];

export type ServicePostReport = {
  date: string;
  service: string;
  name: string;
  email: string;
  area: string;
  adultsHeadcount: number;
  childrenHeadcount: number;
  preparedness: string;
  neatness: string;
  orderliness: string;
  conduct: string;
  compliance: string;
  coordination: string;
  overallRating: string;
  whatWentWell: string;
  areasForImprovement: string;
  recommendations: string;
  incidentFlag: string;
  incidentDescribe: string;
  ma: Record<string, string>;
  teens: Record<string, string>;
  additionalComments: string;
  confirmAccurate: boolean;
};

function escapeTitle(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

export async function appendServicePostReport(report: ServicePostReport) {
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
  if (!title) throw new Error("The configured Service Post sheet tab was not found.");
  const sheet = escapeTitle(title);
  const headerResponse = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheet}!A1:AD1` });
  const currentHeaders = (headerResponse.data.values?.[0] || []).map((value) => String(value).trim());
  if (!currentHeaders.some(Boolean)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheet}!A1:AD1`,
      valueInputOption: "RAW",
      requestBody: { values: [SERVICE_POST_HEADERS] },
    });
  } else if (SERVICE_POST_HEADERS.some((header, index) => currentHeaders[index] !== header)) {
    throw new Error("The Service Post sheet headers do not match the required report columns.");
  }
  const row = [
    report.date, report.service, report.name, report.area, report.adultsHeadcount,
    report.childrenHeadcount, report.preparedness, report.neatness,
    report.orderliness, report.conduct, report.compliance, report.coordination, report.overallRating,
    report.whatWentWell, report.areasForImprovement, report.recommendations, report.incidentFlag,
    report.incidentDescribe, report.ma.topicTaught || "", report.ma.teacherPreparedness || "",
    report.ma.childrenParticipation || "", report.ma.childrenBehaviour || "", report.ma.safetyFlag || "",
    report.ma.safetyDescribe || "", report.teens.lessonTopic || "", report.teens.teacherPreparedness || "",
    report.teens.engagement || "", report.teens.classroomMgmt || "", report.additionalComments,
  ];
  const submittedAt = new Date().toISOString();
  const [dashboardResult, primaryResult] = await Promise.allSettled([
    appendCategorizedReport({
      tab: "Post Reports",
      headers: ["Record ID", ...SERVICE_POST_HEADERS],
      row,
      date: report.date,
      service: report.service,
      category: "Service Post",
      actor: `${report.name} <${report.email}>`,
      summary: `${report.area}: ${report.adultsHeadcount + report.childrenHeadcount} worshippers, ${report.overallRating} overall`,
    }),
    sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheet}!A:AD`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[...row, submittedAt]] },
    }),
  ]);

  if (dashboardResult.status === "rejected") {
    console.error("[service-post] Dashboard workbook write failed", dashboardResult.reason);
  }
  if (primaryResult.status === "rejected") {
    console.error("[service-post] Primary workbook write failed", primaryResult.reason);
  }
  if (dashboardResult.status === "rejected" && primaryResult.status === "rejected") {
    throw new AggregateError(
      [dashboardResult.reason, primaryResult.reason],
      "Both Service Post report destinations rejected the submission.",
    );
  }
}
