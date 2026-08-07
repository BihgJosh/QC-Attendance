import { NextResponse } from "next/server";
import { randomInt, randomUUID } from "crypto";
import { authenticateMember, completeMemberSetup, getMemberPasswordStatus, requestMemberSetup } from "@/lib/member-store";
import { setMemberSession } from "@/lib/member-auth";
import { isAdminEmail } from "@/lib/roles";
import { getTeamMemberByEmail, TeamDataError } from "@/lib/team-data-store";
import { EmailConfigurationError, sendBrevoEmail } from "@/lib/brevo-email";

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
      const code = String(randomInt(100_000, 1_000_000));
      await requestMemberSetup(email, code);
      await sendBrevoEmail({
        to: email,
        subject: "Your QC private-password verification code",
        idempotencyKey: randomUUID(),
        html: `<div style="font-family:Arial,sans-serif;color:#0f172a"><h1 style="font-size:22px">Verify your QC account</h1><p>Use this one-time code to create your private password:</p><p style="font-size:32px;font-weight:800;letter-spacing:8px">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`,
      });
      return NextResponse.json({ nextStep: "setup" });
    }
    const rememberMe = body.rememberMe === true;
    if (action === "setup") {
      const session = await completeMemberSetup(email, String(body.code || ""), String(body.password || ""), rememberMe);
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
    if (error instanceof EmailConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
    if (error instanceof TeamDataError) return NextResponse.json({ error: error.message }, { status: 503 });
    const status = (error as { status?: number }).status || 500;
    return NextResponse.json({ error: (error as Error).message || "Sign-in failed." }, { status });
  }
}
