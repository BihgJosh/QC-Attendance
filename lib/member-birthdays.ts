import "server-only";
import { listTeamBirthdayRecords } from "@/lib/team-data-store";
import { buildBirthdayNotices } from "@/lib/birthday-records";

export async function getUpcomingBirthdays(now = new Date()) {
  const { team, profiles } = await listTeamBirthdayRecords();
  return buildBirthdayNotices(team, profiles, now);
}
