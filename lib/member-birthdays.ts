import "server-only";

import { google } from "googleapis";
import { getGoogleEnv, getOptionalEnv } from "@/lib/env";
import { MemberSheetError } from "@/lib/member-sheet";
import type { BirthdayNoticeEntry } from "@/lib/birthday-types";

const DEFAULT_SHEET_ID = "1kHZCkngN1wHMaCS2U3ihWHWQ68_CAIn2hhsPbErxrpY";
const DEFAULT_SHEET_GID = 795286797;
const DAY_MS = 86_400_000;
const CACHE_MS = 60_000;

let cache: { entries: BirthdayNoticeEntry[]; expiresAt: number } | null = null;

function escapeTitle(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function cleanName(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
}

function columnLabel(index: number) {
  let label = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    label = String.fromCharCode(65 + ((value - 1) % 26)) + label;
  }
  return label;
}

export function parseBirthday(value: unknown): { month: number; day: number } | null {
  if (typeof value === "number" || /^\d+(?:\.\d+)?$/.test(String(value).trim())) {
    const serial = Number(value);
    if (serial > 1 && serial < 100_000) {
      const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * DAY_MS);
      return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
    }
  }

  const text = String(value ?? "").trim().replace(/(\d)(st|nd|rd|th)\b/gi, "$1");
  if (!text) return null;
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (match) return validMonthDay(Number(match[2]), Number(match[3]));

  match = /^(\d{1,2})[-/.](\d{1,2})(?:[-/.]\d{2,4})?$/.exec(text);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    return first > 12 ? validMonthDay(second, first) : second > 12 ? validMonthDay(first, second) : validMonthDay(second, first);
  }

  const parsed = Date.parse(/\d{4}/.test(text) ? text : `${text} 2000`);
  if (!Number.isNaN(parsed)) {
    const date = new Date(parsed);
    return validMonthDay(date.getUTCMonth() + 1, date.getUTCDate());
  }
  return null;
}

function validMonthDay(month: number, day: number) {
  const date = new Date(Date.UTC(2000, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? { month, day } : null;
}

function abujaToday(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

export async function getUpcomingBirthdays(now = new Date()) {
  if (cache && cache.expiresAt > Date.now()) return cache.entries;
  const googleEnv = getGoogleEnv();
  const spreadsheetId = getOptionalEnv("MEMBER_SHEET_ID") || DEFAULT_SHEET_ID;
  const gid = Number(getOptionalEnv("MEMBER_SHEET_GID") || DEFAULT_SHEET_GID);
  const auth = new google.auth.JWT({ email: googleEnv.serviceAccountEmail, key: googleEnv.privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  const sheets = google.sheets({ version: "v4", auth });

  try {
    const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" });
    const title = metadata.data.sheets?.find((sheet) => sheet.properties?.sheetId === gid)?.properties?.title;
    if (!title) throw new MemberSheetError("The configured member sheet tab was not found.");
    const headerResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${escapeTitle(title)}!A1:AZ15`, valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "SERIAL_NUMBER" });
    const headerRows = headerResponse.data.values || [];
    const headerIndex = headerRows.findIndex((row) => row.some((cell) => /birth\s*(day|date)|date\s*of\s*birth|\bdob\b/i.test(String(cell))));
    if (headerIndex < 0) throw new MemberSheetError("No Birthday or Date of Birth column was found in the team sheet.");
    const headers = headerRows[headerIndex].map((cell) => String(cell).trim());
    const birthdayColumn = headers.findIndex((header) => /birth\s*(day|date)|date\s*of\s*birth|\bdob\b/i.test(header));
    const fullNameColumn = headers.findIndex((header) => /^(?:(?:full|member)\s*)?names?$|name\s+of\s+(?:member|worker)/i.test(header));
    const firstNameColumn = headers.findIndex((header) => /^first\s*names?$/i.test(header));
    const lastNameColumn = headers.findIndex((header) => /^(last|sur)\s*names?$/i.test(header));
    const emailColumn = headers.findIndex((header) => /e[\s-]*mail/i.test(header));
    const selectedColumns = [...new Set([birthdayColumn, fullNameColumn, firstNameColumn, lastNameColumn, emailColumn].filter((column) => column >= 0))];
    if (selectedColumns.length < 2) throw new MemberSheetError("No member name column was found beside the birthday column.");
    const firstDataRow = headerIndex + 2;
    const columnsResponse = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: selectedColumns.map((column) => `${escapeTitle(title)}!${columnLabel(column)}${firstDataRow}:${columnLabel(column)}`),
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER",
    });
    const columnValues = new Map(selectedColumns.map((column, index) => [column, (columnsResponse.data.valueRanges?.[index]?.values || []).map((row) => row[0])]));
    const rowCount = Math.max(0, ...[...columnValues.values()].map((values) => values.length));
    const cell = (column: number, row: number) => column >= 0 ? columnValues.get(column)?.[row] : undefined;
    const today = abujaToday(now);
    const todayUtc = Date.UTC(today.year, today.month - 1, today.day);

    const entries = Array.from({ length: rowCount }, (_, row) => row).flatMap((row) => {
      const birthday = parseBirthday(cell(birthdayColumn, row));
      if (!birthday) return [];
      let name = fullNameColumn >= 0 ? cleanName(cell(fullNameColumn, row)) : cleanName(`${cell(firstNameColumn, row) || ""} ${cell(lastNameColumn, row) || ""}`);
      if (!name && emailColumn >= 0) name = cleanName(String(cell(emailColumn, row) || "").split("@")[0].replace(/[._-]+/g, " "));
      if (!name) return [];
      let occurrence = Date.UTC(today.year, birthday.month - 1, birthday.day);
      if (occurrence < todayUtc) occurrence = Date.UTC(today.year + 1, birthday.month - 1, birthday.day);
      const daysUntil = Math.round((occurrence - todayUtc) / DAY_MS);
      const dateLabel = daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(occurrence));
      return [{ name, dateLabel, daysUntil, isToday: daysUntil === 0 } satisfies BirthdayNoticeEntry];
    }).sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name)).slice(0, 6);

    cache = { entries, expiresAt: Date.now() + CACHE_MS };
    return entries;
  } catch (error) {
    if (error instanceof MemberSheetError) throw error;
    if ((error as { code?: number }).code === 403) throw new MemberSheetError("The member sheet has not been shared with the website's Google service account.");
    throw new MemberSheetError("Birthday notices could not be read from Google Sheets.");
  }
}
