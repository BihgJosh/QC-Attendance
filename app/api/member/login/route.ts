import { NextResponse } from "next/server";
import { authenticateMember } from "@/lib/member-store";
import { getMemberEmails, isMemberEmail, MemberSheetError } from "@/lib/member-sheet";
import { setMemberSession } from "@/lib/member-auth";
import { isPrivilegedAdminEmail } from "@/lib/roles";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password || password.length > 256) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
    if (!isPrivilegedAdminEmail(email)) {
      const members = await getMemberEmails();
      if (!isMemberEmail(email, members)) return NextResponse.json({ error: "This email is not registered with the QC team." }, { status: 401 });
    }
    const session = await authenticateMember(email, password);
    await setMemberSession(session.token);
    return NextResponse.json({ mustChangePassword: session.mustChangePassword });
  } catch (error) {
    if (error instanceof MemberSheetError) return NextResponse.json({ error: error.message }, { status: 503 });
    const status = (error as { status?: number }).status || 500;
    return NextResponse.json({ error: (error as Error).message || "Sign-in failed." }, { status });
  }
}
