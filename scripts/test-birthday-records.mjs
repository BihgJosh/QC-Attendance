import assert from "node:assert/strict";
import { buildBirthdayNotices, parseTeamBirthday } from "../lib/birthday-records.ts";

const now = new Date("2026-08-29T23:30:00Z"); // Already August 30 in Nigeria.
const member = (email, first, last, birthday) => ({ normalized_email: email, "Other Names": first, Surname: last, Birthday: birthday });
const profile = { email: "one@example.com", first_name: "Joshua", middle_name: "David", last_name: "Agusa", birth_month: 8, birth_day: 30 };
const team = [
  member("one@example.com", "Old", "Name", "1/1"),
  member(" ONE@EXAMPLE.COM ", "OLD", "NAME", "1/1"),
  member("two@example.com", "Joshua", "Ade", "8/30"),
  member("next@example.com", "Vivian Chigozirim", "Itelima", "9/2"),
  member("NEXT@example.com", "VIVIAN CHIGOZIRIM", "ITELIMA", "9/2"),
  member("new@example.com", "Frank", "Etuk", "9/26"),
  member("missing@example.com", "Missing", "Birthday", null),
];
const entries = buildBirthdayNotices(team, [profile], now);
assert.deepEqual(entries.filter(x => x.isToday).map(x => x.name), ["Joshua Ade", "Joshua David Agusa"]);
assert.equal(entries.filter(x => x.name.includes("Itelima")).length, 1);
assert.equal(entries.find(x => x.name === "Frank Etuk").dateLabel, "26 September");
assert.equal(entries.some(x => x.name === "Missing Birthday"), false);
assert.deepEqual(parseTeamBirthday("2/9"), { month: 2, day: 9 });
assert.deepEqual(parseTeamBirthday("6/9"), { month: 6, day: 9 });
assert.deepEqual(parseTeamBirthday("--05-18"), { month: 5, day: 18 });
for (const invalid of ["2/30", "13/2", "garbage", null]) assert.equal(parseTeamBirthday(invalid), null);
assert.equal(buildBirthdayNotices([], [profile], now).length, 0, "Profiles outside the team cannot appear");
const manyToday = Array.from({ length: 9 }, (_, i) => member(`${i}@example.com`, `Person ${i}`, "Today", "8/30"));
assert.equal(buildBirthdayNotices(manyToday, [], now).length, 9, "Never truncate today's celebrants");
assert.equal(buildBirthdayNotices([member("leap@example.com", "Leap", "Member", "2/29")], [], new Date("2026-02-28T12:00Z"))[0].dateLabel, "29 February");
assert.equal(buildBirthdayNotices([member("year@example.com", "New", "Year", "1/1")], [], new Date("2026-12-31T12:00Z"))[0].dateLabel, "Tomorrow");
console.log("Birthday checks passed: full names, identity deduplication, new members, profile precedence, M/D parsing, Lagos rollover, leap dates, and all celebrants.");
