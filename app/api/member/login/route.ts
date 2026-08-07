import { NextResponse } from "next/server";
import { authenticateMember, completeMemberSetup, getMemberPasswordStatus } from "@/lib/member-store";
import { setMemberSession } from "@/lib/member-auth";
import { isAdminEmail } from "@/lib/roles";
import { getTeamMemberByEmail, TeamDataError } from "@/lib/team-data-store";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const email = String(body.email || "").trim().toLowerCase();
    const action = String(body.action || "identify");
    if (!email) return NextResponse.json({ error: "Enter your team email." }, { status: 400 });
    if (!(await isAdminEmail(email))) {
      if (!(await getTeamMemberByEmail(email))) return NextResponse.json({ error: "This email is not registered with the QC team." }, { status: 401 });
    }
    if (action === "identify") {
      const status = await getMemberPasswordStatus(email);
      if (status.hasPrivatePassword) return NextResponse.json({ nextStep: "password" });
      return NextResponse.json({ nextStep: "setup" });
    }
    const rememberMe = body.rememberMe === true;
    if (action === "setup") {
      const session = await completeMemberSetup(email, String(body.password || ""), rememberMe);
      await setMemberSession(session.token, rememberMe);
      return NextResponse.json({ success: true });
    }
    if (action !== "login") return NextResponse.json({ error: "Invalid sign-in step." }, { status: 400 });
    const password = String(body.password || "");
    if (!password || password.length > 256) return NextResponse.json({ error: "Enter your private password." }, { status: 400 });
    const session = await authenticateMember(email, password, rememberMe);
    await setMemberSession(session.token, rememberMe);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TeamDataError) return NextResponse.json({ error: error.message }, { status: 503 });
    const status = (error as { status?: number }).status || 500;
    return NextResponse.json({ error: (error as Error).message || "Sign-in failed." }, { status });
  }
}
