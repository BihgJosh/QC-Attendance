export type ServiceDay = "Sunday" | "Thursday";
export const SERVICE_DAYS: ServiceDay[] = ["Sunday", "Thursday"];

export interface Announcement {
  id: string;
  date: string;
  title: string;
  copy: string;
  accent: "primary" | "accent" | "success";
}

export interface PostingRow {
  id: string;
  label: string;
  assignments: PostingMember[][];
}

export interface PostingMember {
  name: string;
  email: string;
}

export interface Posting {
  id: string;
  day: ServiceDay;
  name: string;
  role: string;
  columns: string[];
  rows: PostingRow[];
  /** Legacy field retained only so older flat assignments can be migrated safely. */
  members?: string[];
}

export interface HomepageContent {
  version?: number;
  announcements: Announcement[];
  postings: Posting[];
  uniformItems: string[];
  uniformNote: string;
  uniformImageUrl: string;
  updatedAt?: string;
}

export function postingMemberKey(member: Pick<PostingMember, "name" | "email">) {
  return member.email.trim().toLowerCase() || member.name.trim().replace(/\s+/g, " ").toLowerCase();
}

const sundayRows = ["1st Service", "2nd Service", "3rd Service", "4th Service"];
const thursdayRows = ["Thursday Service"];

function createPosting(day: ServiceDay, baseId: string, name: string, role: string, columns: string[], rowLabels: string[]): Posting {
  const id = `${day.toLowerCase()}-${baseId}`;
  return {
    id,
    day,
    name,
    role,
    columns,
    rows: rowLabels.map((label, index) => ({
      id: `${id}-row-${index + 1}`,
      label,
      assignments: columns.map(() => []),
    })),
  };
}

export function createBlankDayPostings(day: ServiceDay): Posting[] {
  const rows = day === "Sunday" ? sundayRows : thursdayRows;
  return [
    createPosting(day, "service-managers", "Service managers", "Service leadership & coordination", ["Manager"], day === "Sunday" ? ["1st & 2nd", "3rd & 4th"] : rows),
    createPosting(day, "children-section", "Children section", "Safety & order", ["Entrance", "Exit"], rows),
    createPosting(day, "overflow", "Overflow tent", "Flow & support", ["Row 1", "Row 2", "Row 3", "Row 4"], rows),
    createPosting(day, "outside", "Outside", "Exterior flow & access", ["Position 1", "Position 2", "Position 3"], rows),
    createPosting(day, "observation", "Observation", "Quality monitoring", ["Observer"], rows),
    createPosting(day, "timers", "QC timer", "Service timing & coordination", ["Timer"], day === "Sunday" ? ["1st & 2nd", "3rd & 4th"] : rows),
  ];
}

export const DEFAULT_HOMEPAGE_CONTENT: HomepageContent = {
  version: 6,
  announcements: [
    { id: "briefing", date: "This Sunday", title: "Pre-service briefing", copy: "All QC members are expected at the main auditorium 45 minutes before the first service.", accent: "primary" },
    { id: "assigned-post", date: "Unit notice", title: "Stay at your assigned post", copy: "Confirm your post with your team lead before service and remain available until handover.", accent: "accent" },
    { id: "excellence", date: "Reminder", title: "Excellence in every detail", copy: "Arrive prepared, dress correctly and escalate every concern through the proper channel.", accent: "success" },
  ],
  postings: [...createBlankDayPostings("Sunday"), ...createBlankDayPostings("Thursday")],
  uniformItems: ["Crisp white long-sleeve shirt", "Black tailored trousers", "Plain black covered shoes", "QC identification tag"],
  uniformNote: "Team leads may communicate special uniform instructions for specific services.",
  uniformImageUrl: "",
};

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function cleanEmail(value: unknown) {
  if (!isString(value)) return "";
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 254) : "";
}

export function parsePostingMember(value: unknown): PostingMember | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const member = value as Partial<PostingMember>;
    const email = cleanEmail(member.email);
    const name = isString(member.name) ? member.name.trim().replace(/\s+/g, " ").slice(0, 100) : "";
    return name || email ? { name: name || email, email } : null;
  }
  if (!isString(value)) return null;
  const name = value.trim().replace(/\s+/g, " ").slice(0, 100);
  return name ? { name, email: "" } : null;
}

function cleanMembers(value: unknown): PostingMember[] {
  return Array.isArray(value)
    ? value.map(parsePostingMember).filter((member): member is PostingMember => Boolean(member)).slice(0, 20)
    : [];
}

function cleanImageUrl(value: unknown) {
  if (!isString(value) || value.length > 1_000) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function cleanMatrixPostings(items: unknown[], fallbackDay: ServiceDay, prefixIds: boolean): Posting[] {
  return items.slice(0, 24).flatMap((item, postingIndex) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Partial<Posting>;
    if (!isString(raw.name)) return [];
    const day: ServiceDay = raw.day === "Thursday" ? "Thursday" : fallbackDay;
    const columns = Array.isArray(raw.columns)
      ? raw.columns.filter(isString).map((column) => column.trim().slice(0, 60)).filter(Boolean).slice(0, 8)
      : [];
    if (!columns.length) return [];
    const sourceId = isString(raw.id) ? raw.id.slice(0, 80) : `posting-${postingIndex}`;
    const id = prefixIds && !sourceId.startsWith(`${day.toLowerCase()}-`) ? `${day.toLowerCase()}-${sourceId}` : sourceId;
    const rows = Array.isArray(raw.rows)
      ? raw.rows.slice(0, 12).flatMap((row, rowIndex) => {
          if (!row || typeof row !== "object" || !isString(row.label)) return [];
          const rawAssignments = Array.isArray(row.assignments) ? row.assignments : [];
          return [{
            id: isString(row.id) ? `${id}-row-${rowIndex + 1}` : `${id}-row-${rowIndex + 1}`,
            label: row.label.trim().slice(0, 60),
            assignments: columns.map((_, columnIndex) => cleanMembers(rawAssignments[columnIndex])),
          }];
        })
      : [];
    return [{
      id,
      day,
      name: raw.name.trim().slice(0, 100),
      role: isString(raw.role) ? raw.role.trim().slice(0, 120) : "Assigned section",
      columns,
      rows,
    }];
  });
}

function migrateLegacyPostings(candidate: Partial<HomepageContent>): Posting[] {
  const legacy = Array.isArray(candidate.postings) ? candidate.postings as unknown as Array<Record<string, unknown>> : [];
  const aliases: Record<string, string[]> = {
    "service-managers": ["service-managers", "main-auditorium", "auditorium"], overflow: ["overflow"], outside: ["outside", "main-entrance"],
    "children-section": ["children-section"], observation: ["observation"], timers: ["timers"],
  };
  const sunday = createBlankDayPostings("Sunday").map((template) => {
    const baseId = template.id.replace("sunday-", "");
    const oldPosting = legacy.find((posting) => aliases[baseId]?.includes(String(posting.id)));
    const oldNames = cleanMembers(oldPosting?.members).filter((member) => member.name.toLowerCase() !== "awaiting assignment");
    if (!oldNames.length) return template;
    return {
      ...template,
      rows: template.rows.map((row, rowIndex) => ({ ...row, assignments: row.assignments.map((names, columnIndex) => rowIndex === 0 && columnIndex === 0 ? oldNames : names) })),
    };
  });
  return [...sunday, ...createBlankDayPostings("Thursday")];
}

export function normalizeHomepageContent(value: unknown): HomepageContent {
  if (!value || typeof value !== "object") return DEFAULT_HOMEPAGE_CONTENT;
  const candidate = value as Partial<HomepageContent>;

  const announcements = Array.isArray(candidate.announcements)
    ? candidate.announcements.slice(0, 8).flatMap((item, index) => {
        if (!item || typeof item !== "object") return [];
        const announcement = item as Partial<Announcement>;
        if (!isString(announcement.title) || !isString(announcement.copy)) return [];
        return [{
          id: isString(announcement.id) ? announcement.id.slice(0, 80) : `announcement-${index}`,
          date: isString(announcement.date) ? announcement.date.slice(0, 60) : "Notice",
          title: announcement.title.trim().slice(0, 120),
          copy: announcement.copy.trim().slice(0, 500),
          accent: ["primary", "accent", "success"].includes(announcement.accent || "") ? announcement.accent as Announcement["accent"] : "primary",
        }];
      })
    : [];

  let postings: Posting[];
  if (Array.isArray(candidate.postings) && (candidate.version === 4 || candidate.version === 5 || candidate.version === 6)) {
    postings = cleanMatrixPostings(candidate.postings, "Sunday", false);
  } else if (Array.isArray(candidate.postings) && candidate.version === 3) {
    postings = [...cleanMatrixPostings(candidate.postings, "Sunday", true), ...createBlankDayPostings("Thursday")];
  } else {
    postings = migrateLegacyPostings(candidate);
  }

  const uniformItems = Array.isArray(candidate.uniformItems)
    ? candidate.uniformItems.filter(isString).map((item) => item.trim().slice(0, 150)).filter(Boolean).slice(0, 12)
    : [];

  return {
    version: 6,
    announcements: Array.isArray(candidate.announcements) ? announcements : DEFAULT_HOMEPAGE_CONTENT.announcements,
    postings: Array.isArray(candidate.postings) ? postings : DEFAULT_HOMEPAGE_CONTENT.postings,
    uniformItems: Array.isArray(candidate.uniformItems) ? uniformItems : DEFAULT_HOMEPAGE_CONTENT.uniformItems,
    uniformNote: isString(candidate.uniformNote) && candidate.uniformNote.trim() ? candidate.uniformNote.trim().slice(0, 300) : DEFAULT_HOMEPAGE_CONTENT.uniformNote,
    uniformImageUrl: cleanImageUrl(candidate.uniformImageUrl),
    updatedAt: isString(candidate.updatedAt) ? candidate.updatedAt : undefined,
  };
}
