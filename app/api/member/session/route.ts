import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";
import { getMemberEmails, isMemberEmail } from "@/lib/member-sheet";
import { isPrivilegedAdminEmail } from "@/lib/roles";

export async function GET() {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  if (!isPrivilegedAdminEmail(session.email)) {
    const emails = await getMemberEmails();
    if (!isMemberEmail(session.email, emails)) return NextResponse.json({ error: "This account is no longer on the QC team list." }, { status: 403 });
  }
  return NextResponse.json({ email: session.email, mustChangePassword: session.mustChangePassword });
}
