import "server-only";

import { google } from "googleapis";
import { getGoogleEnv, getOptionalEnv } from "@/lib/env";

const DEFAULT_SHEET_ID = "1kHZCkngN1wHMaCS2U3ihWHWQ68_CAIn2hhsPbErxrpY";
const DEFAULT_SHEET_GID = 795286797;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CACHE_MS = 60_000;

let cache: { emails: string[]; expiresAt: number } | null = null;

export class MemberSheetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberSheetError";
  }
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function escapeSheetTitle(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

export async function getMemberEmails() {
  if (cache && cache.expiresAt > Date.now()) return cache.emails;

  const googleEnv = getGoogleEnv();
  const spreadsheetId = getOptionalEnv("MEMBER_SHEET_ID") || DEFAULT_SHEET_ID;
  const gid = Number(getOptionalEnv("MEMBER_SHEET_GID") || DEFAULT_SHEET_GID);
  const auth = new google.auth.JWT({
    email: googleEnv.serviceAccountEmail,
    key: googleEnv.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  try {
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    });
    const tab = metadata.data.sheets?.find((sheet) => sheet.properties?.sheetId === gid);
    const title = tab?.properties?.title;
    if (!title) throw new MemberSheetError("The configured member sheet tab was not found.");

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${escapeSheetTitle(title)}!A:AZ`,
    });
    const rows = response.data.values || [];
    if (!rows.length) throw new MemberSheetError("The member sheet is empty.");

    const headerRowIndex = rows.findIndex((row) => row.some((cell) => /e[\s-]*mail/i.test(String(cell))));
    let emailColumn = headerRowIndex >= 0
      ? rows[headerRowIndex].findIndex((cell) => /e[\s-]*mail/i.test(String(cell)))
      : -1;

    if (emailColumn < 0) {
      const widestRow = Math.max(...rows.map((row) => row.length), 0);
      let bestCount = 0;
      for (let column = 0; column < widestRow; column += 1) {
        const count = rows.filter((row) => EMAIL_PATTERN.test(normalizeEmail(row[column]))).length;
        if (count > bestCount) {
          bestCount = count;
          emailColumn = column;
        }
      }
    }

    if (emailColumn < 0) throw new MemberSheetError("No email column could be identified in the member sheet.");
    const emails = [...new Set(rows
      .slice(headerRowIndex >= 0 ? headerRowIndex + 1 : 0)
      .map((row) => normalizeEmail(row[emailColumn]))
      .filter((email) => EMAIL_PATTERN.test(email)))].sort();
    if (!emails.length) throw new MemberSheetError("No valid member emails were found in the configured sheet tab.");

    cache = { emails, expiresAt: Date.now() + CACHE_MS };
    return emails;
  } catch (error) {
    if (error instanceof MemberSheetError) throw error;
    const status = (error as { code?: number }).code;
    if (status === 403) {
      throw new MemberSheetError("The member sheet has not been shared with the website's Google service account.");
    }
    throw new MemberSheetError("The member list could not be read from Google Sheets.");
  }
}

export function isMemberEmail(email: string, emails: string[]) {
  return emails.includes(normalizeEmail(email));
}
