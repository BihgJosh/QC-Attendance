import type { BirthdayNoticeEntry } from "./birthday-types";

export type BirthdayTeamRecord = {
  normalized_email: string;
  Surname: string | null;
  "Other Names": string | null;
  Birthday: string | null;
};
export type BirthdayProfileRecord = {
  email: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  birth_month: number | null;
  birth_day: number | null;
};

const DAY_MS = 86_400_000;
const clean = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ");
const emailKey = (value: unknown) => clean(value).toLowerCase();

function validMonthDay(month: number, day: number) {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(Date.UTC(2000, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? { month, day } : null;
}

// Team Data was imported from Google Sheets formatted as M/D. Do not guess D/M.
export function parseTeamBirthday(value: unknown) {
  const text = clean(value);
  const slash = /^(\d{1,2})\/(\d{1,2})(?:\/\d{4})?$/.exec(text);
  if (slash) return validMonthDay(Number(slash[1]), Number(slash[2]));
  const iso = /^(?:\d{4}-|--)(\d{2})-(\d{2})$/.exec(text);
  return iso ? validMonthDay(Number(iso[1]), Number(iso[2])) : null;
}

export function buildBirthdayNotices(team: BirthdayTeamRecord[], profiles: BirthdayProfileRecord[], now = new Date()): BirthdayNoticeEntry[] {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => Number(parts.find((value) => value.type === type)?.value);
  const year = part("year");
  const today = Date.UTC(year, part("month") - 1, part("day"));
  const profileByEmail = new Map(profiles.map((profile) => [emailKey(profile.email), profile]));
  const members = new Map<string, BirthdayNoticeEntry>();

  for (const row of team) {
    const email = emailKey(row.normalized_email);
    const profile = email ? profileByEmail.get(email) : undefined;
    const profileHasFullName = clean(profile?.first_name) && clean(profile?.last_name);
    const name = profileHasFullName
      ? [profile?.first_name, profile?.middle_name, profile?.last_name].map(clean).filter(Boolean).join(" ")
      : [row["Other Names"], row.Surname].map(clean).filter(Boolean).join(" ");
    if (!name) continue;
    const birthday = (profile && validMonthDay(Number(profile.birth_month), Number(profile.birth_day))) || parseTeamBirthday(row.Birthday);
    if (!birthday) continue;
    // Identity is the email, never just a shared first name or surname.
    const identity = email || `${name.toLowerCase()}|${birthday.month}-${birthday.day}`;
    if (members.has(identity)) continue;
    // February 29 stays February 29, rather than rolling into March 1.
    let occurrenceYear = year;
    let occurrence: number;
    do {
      occurrence = Date.UTC(occurrenceYear++, birthday.month - 1, birthday.day);
    } while (occurrence < today || new Date(occurrence).getUTCMonth() !== birthday.month - 1);
    const daysUntil = Math.round((occurrence - today) / DAY_MS);
    const dateLabel = daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(occurrence));
    members.set(identity, { name, dateLabel, daysUntil, isToday: daysUntil === 0 });
  }
  const sorted = [...members.values()].sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name));
  return [...sorted.filter((entry) => entry.isToday), ...sorted.filter((entry) => !entry.isToday).slice(0, 5)];
}
