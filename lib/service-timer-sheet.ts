import "server-only";

import { google } from "googleapis";
import { getGoogleEnv } from "@/lib/env";
import { appendCategorizedReport } from "@/lib/service-report-workbook";

const SPREADSHEET_ID = "1BeoEcYvTGtVhBCp4SxX8mlfFscQD5rBrZ2tnPUdKP-8";
const SHEET_GID = 810317383;

export const SERVICE_TIMER_SEGMENTS = [
  ["openingPrayer", "Opening Prayer"],
  ["praiseWorship", "Praise & Worship"],
  ["speakingIntoWeek", "Speaking into the Week"],
  ["soloMinistration", "Solo Ministration"],
  ["declaration", "Declaration"],
  ["firstTestimony", "First Testimony"],
  ["secondTestimony", "Second Testimony"],
  ["thirdTestimony", "Third Testimony"],
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
  date: string;
  service: string;
  name: string;
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
    range: `${sheet}!A1:AR1`,
  });
  const currentHeaders = (headerResponse.data.values?.[0] || []).map((value) => String(value).trim());
  if (!currentHeaders.some(Boolean)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheet}!A1:AR1`,
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
  await appendCategorizedReport({
    tab: "Timer Logs",
    headers: ["Record ID", ...SERVICE_TIMER_HEADERS],
    row,
    date: log.date,
    service: log.service,
    category: "Timer",
    actor: log.name,
    summary: `${log.serviceStart || "Start not set"} - ${log.serviceEnd || "End not set"}`,
  });
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet}!A:AR`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[...row, new Date().toISOString()]] },
  });
}
