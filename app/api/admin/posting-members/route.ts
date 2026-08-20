import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { listTeamMembers } from "@/lib/team-data-store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const members = await listTeamMembers();
    return NextResponse.json({
      members: members
        .filter((member) => member.name && member.email)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    console.error("[posting-members] Team directory lookup failed", cause instanceof Error ? cause.message : "Unknown error");
    return NextResponse.json({ error: "The team directory is temporarily unavailable." }, { status: 503 });
  }
}
