import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";
import { isPrivilegedAdminEmail } from "@/lib/roles";
import { getTeamMemberByEmail } from "@/lib/team-data-store";

export async function GET() {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  const member = await getTeamMemberByEmail(session.email);
  if (!member && !isPrivilegedAdminEmail(session.email)) return NextResponse.json({ error: "This account is no longer on the QC team list." }, { status: 403 });
  return NextResponse.json({ email: session.email, name: member?.name || session.email, mustChangePassword: session.mustChangePassword });
}
