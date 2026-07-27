import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { listMemberStatuses, resetMemberPassword } from "@/lib/member-store";
import { getPrivilegedAdminEmails, isPrivilegedAdminEmail } from "@/lib/roles";
import { getTeamMemberByEmail, listTeamMembers, TeamDataError } from "@/lib/team-data-store";

async function requireAdmin() {
  return isAdminAuthenticated();
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const statuses = await listMemberStatuses();
    let warning: string | undefined;
    let emails = getPrivilegedAdminEmails();
    try {
      emails = [...new Set([...emails, ...(await listTeamMembers()).map((member) => member.email)])].sort();
    } catch (error) {
      if (!(error instanceof TeamDataError)) throw error;
      warning = error.message;
    }
    const indexed = new Map(statuses.map((member) => [member.email, member]));
    return NextResponse.json({ warning, members: emails.map((email) => ({ ...(indexed.get(email) || { email, mustChangePassword: true, lastLoginAt: null, passwordChangedAt: null, resetAt: null }), isPrivilegedAdmin: isPrivilegedAdminEmail(email) })) });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: error instanceof TeamDataError ? 503 : 500 });
  }
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const email = String(body.email || "").trim().toLowerCase();
    if (!isPrivilegedAdminEmail(email)) {
      if (!(await getTeamMemberByEmail(email))) return NextResponse.json({ error: "Only members currently listed in Team Data can be reset." }, { status: 400 });
    }
    await resetMemberPassword(email);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: error instanceof TeamDataError ? 503 : 500 });
  }
}
