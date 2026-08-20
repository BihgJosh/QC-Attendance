import { NextResponse } from "next/server";
import { getConfig } from "@/lib/google-sheets";
import { DEFAULT_HOMEPAGE_CONTENT, normalizeHomepageContent, postingMemberKey } from "@/lib/homepage-content";
import { readMemberSession } from "@/lib/member-auth";
import { identityKey, identityMap } from "@/lib/report-identities";
import { isPrivilegedAdminEmail } from "@/lib/roles";
import { getTeamMemberByEmail, listTeamMembers, type TeamMember } from "@/lib/team-data-store";

const CONTENT_CONFIG_KEY = "homepageContent";

export const dynamic = "force-dynamic";

function comparableName(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(?:bro|brother|sis|sister|mr|mrs|miss|ms|pst|pastor)\.?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function uniquelyMatchedEmail(name: string, teamMembers: TeamMember[]) {
  const target = comparableName(name);
  if (!target) return "";
  const targetTokens = target.split(" ");
  const candidates = teamMembers.filter((member) => {
    const candidate = comparableName(member.name);
    if (!candidate) return false;
    if (candidate === target) return true;
    const candidateTokens = candidate.split(" ");
    return targetTokens.every((token) => candidateTokens.includes(token));
  });
  return candidates.length === 1 ? candidates[0].email : "";
}

export async function GET() {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ identities: {} }, { status: 401, headers: { "Cache-Control": "private, no-store" } });

  try {
    const [teamMember, teamMembers, config] = await Promise.all([
      getTeamMemberByEmail(session.email),
      listTeamMembers(),
      getConfig(),
    ]);
    if (!teamMember && !isPrivilegedAdminEmail(session.email)) {
      return NextResponse.json({ identities: {} }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
    }

    const content = config[CONTENT_CONFIG_KEY]
      ? normalizeHomepageContent(JSON.parse(config[CONTENT_CONFIG_KEY]))
      : DEFAULT_HOMEPAGE_CONTENT;
    const members = new Map<string, { name: string; email: string }>();
    for (const member of content.postings.flatMap((posting) => posting.rows.flatMap((row) => row.assignments.flat()))) {
      const key = postingMemberKey(member);
      if (key) members.set(key, member);
    }

    const references = [...members.entries()].slice(0, 100).map(([key, member]) => ({
      key,
      reference: { name: member.name, email: member.email || uniquelyMatchedEmail(member.name, teamMembers) },
    }));
    const resolved = await identityMap(session.token, references.map(({ reference }) => reference));
    const identities = Object.fromEntries(references.flatMap(({ key, reference }) => {
      const identity = resolved[identityKey(reference)];
      return identity ? [[key, identity]] : [];
    }));

    return NextResponse.json({ identities }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    console.error("[posting-identities] Identity lookup failed", cause instanceof Error ? cause.message : "Unknown error");
    return NextResponse.json({ identities: {} }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
