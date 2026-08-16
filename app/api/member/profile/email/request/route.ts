import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";
import { sendBrevoEmail } from "@/lib/brevo-email";
import { MemberStoreError, requestMemberEmailChange } from "@/lib/member-store";

export async function POST(request: Request) {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  try {
    const { email } = await request.json();
    const challenge = await requestMemberEmailChange(session.token, String(email || ""));
    await sendBrevoEmail({
      to: challenge.newEmail,
      subject: "Confirm your new QC profile email",
      idempotencyKey: `profile-email-${session.email}-${challenge.requestedAt}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h1 style="font-size:24px">Confirm your new email</h1><p>Enter this code on your QC profile. It expires in 15 minutes.</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#146c94">${challenge.verificationCode}</p><p>If you did not request this change, keep using your current email and ignore this message.</p></div>`,
    });
    return NextResponse.json({ success: true, email: challenge.newEmail });
  } catch (error) {
    const status = error instanceof MemberStoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "The verification email could not be sent." }, { status });
  }
}
