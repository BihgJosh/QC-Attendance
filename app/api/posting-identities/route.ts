import { NextResponse } from "next/server";
import { getConfig } from "@/lib/google-sheets";
import { DEFAULT_HOMEPAGE_CONTENT, normalizeHomepageContent, postingMemberKey } from "@/lib/homepage-content";
import { readMemberSession } from "@/lib/member-auth";
import { identityMap } from "@/lib/report-identities";
import { isPrivilegedAdminEmail } from "@/lib/roles";
import { getTeamMemberByEmail } from "@/lib/team-data-store";

const CONTENT_CONFIG_KEY = "homepageContent";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ identities: {} }, { status: 401, headers: { "Cache-Control": "private, no-store" } });

  try {
    const teamMember = await getTeamMemberByEmail(session.email);
    if (!teamMember && !isPrivilegedAdminEmail(session.email)) {
      return NextResponse.json({ identities: {} }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
    }
    const config = await getConfig();
    const content = config[CONTENT_CONFIG_KEY] ? normalizeHomepageContent(JSON.parse(config[CONTENT_CONFIG_KEY])) : DEFAULT_HOMEPAGE_CONTENT;
    const indexed = new Map<string, { name: string; email: string }>();
    for (const member of content.postings.flatMap((posting) => posting.rows.flatMap((row) => row.assignments.flat()))) {
      const key = postingMemberKey(member);
      if (key) indexed.set(key, member);
    }
    const identities = await identityMap(session.token, [...indexed.values()].slice(0, 100));
    return NextResponse.json({ identities }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    console.error("[posting-identities] Identity lookup failed", cause instanceof Error ? cause.message : "Unknown error");
    return NextResponse.json({ identities: {} }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
