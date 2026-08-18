import "server-only";

import { google } from "googleapis";
import { getGoogleEnv } from "@/lib/env";
import { appendCategorizedReport } from "@/lib/service-report-workbook";
import { callServiceReportGateway } from "@/lib/service-report-store";
import { syncFinalReportForDate } from "@/lib/final-report-sheet";

const SPREADSHEET_ID = "1BeoEcYvTGtVhBCp4SxX8mlfFscQD5rBrZ2tnPUdKP-8";
const SHEET_GID = 810317383;

export const SERVICE_TIMER_SEGMENTS = [
  ["openingPrayer", "Opening Prayer"],
  ["praiseWorship", "Praise & Worship"],
  ["speakingIntoWeek", "Speaking into the Week"],
  ["soloMinistration", "Solo Ministration"],
  ["declaration", "Declaration"],
  ["testimonyIntroduction", "Testimony Introduction"],
  ["firstTestimony", "First Testimony"],
  ["secondTestimony", "Second Testimony"],
  ["thirdTestimony", "Third Testimony"],
  ["fourthTestimony", "Fourth Testimony"],
  ["fifthTestimony", "Fifth Testimony"],
  ["choirMinistration", "Choir Ministration"],
  ["pastorMinistration", "Pastor's Ministration"],
  ["offeringAnnouncement", "Offering & Announcement"],
] as const;

export const SERVICE_TIMER_HEADERS = [
  "Date", "Service", "Timer Name", "Service Start", "Service End",
  ...SERVICE_TIMER_SEGMENTS.flatMap(([, label]) => [
    `${label} - Status`, `${label} - Min`, `${label} - Sec`,
  ]),
  "Extra Segment Name", "Extra Segment Status", "Extra Segment Min", "Extra Segment Sec",
  "Timer General Observation", "Submitted At",
];

export type TimerSegment = { status: string; min: number; sec: number };
export type ServiceTimerLog = {
  submissionId: string;
  date: string;
  service: string;
  name: string;
  reporterEmail: string;
  serviceStart: string;
  serviceEnd: string;
  segments: Record<string, TimerSegment>;
  extra: { name: string; status: string; min: number; sec: number };
  generalObservation: string;
};

function escapeTitle(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

export async function appendServiceTimerLog(log: ServiceTimerLog) {
  const submittedAt = new Date().toISOString();
  const recordId = log.submissionId;
  const inserted = await callServiceReportGateway<{ created?: boolean }>("timer.insert", {
    id: recordId,
    report_date: log.date,
    service: log.service,
    timer_name: log.name,
    reporter_email: log.reporterEmail,
    service_start: log.serviceStart,
    service_end: log.serviceEnd,
    segments: log.segments,
    extra_segment: log.extra,
    general_observation: log.generalObservation,
    submitted_at: submittedAt,
    source_fingerprint: `live:${recordId}`,
  });
  if (inserted.created === false) return;
  try {
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
  if (!title) throw new Error("The configured Service Timer sheet tab was not found.");
  const sheet = escapeTitle(title);
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet}!A1:AX1`,
  });
  const currentHeaders = (headerResponse.data.values?.[0] || []).map((value) => String(value).trim());
  if (!currentHeaders.some(Boolean)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheet}!A1:AX1`,
      valueInputOption: "RAW",
      requestBody: { values: [SERVICE_TIMER_HEADERS] },
    });
  } else if (SERVICE_TIMER_HEADERS.some((header, index) => currentHeaders[index] !== header)) {
    throw new Error("The Service Timer sheet headers do not match the required timer columns.");
  }

  const row = [
    log.date, log.service, log.name, log.serviceStart, log.serviceEnd,
    ...SERVICE_TIMER_SEGMENTS.flatMap(([id]) => {
      const segment = log.segments[id] || { status: "", min: 0, sec: 0 };
      return [segment.status, segment.min, segment.sec];
    }),
    log.extra.name, log.extra.status, log.extra.min, log.extra.sec,
    log.generalObservation,
  ];
  const [dashboardResult, primaryResult] = await Promise.allSettled([appendCategorizedReport({
    tab: "Timer Logs",
    headers: ["Record ID", ...SERVICE_TIMER_HEADERS],
    row,
    date: log.date,
    service: log.service,
    category: "Timer",
    actor: log.name,
    summary: `${log.serviceStart || "Start not set"} - ${log.serviceEnd || "End not set"}`,
  }), sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet}!A:AX`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[...row, submittedAt]] },
  })]);
  if (dashboardResult.status === "rejected") console.error("[service-timer] Dashboard write failed", dashboardResult.reason);
  if (primaryResult.status === "rejected") console.error("[service-timer] Primary write failed", primaryResult.reason);
  } catch (error) {
    console.error("[service-timer] Google workbook mirror failed", error instanceof Error ? error.message : error);
  }
  await syncFinalReportForDate(log.date).catch((error) => console.error("[service-timer] Final daily report refresh failed", error instanceof Error ? error.message : error));
}
