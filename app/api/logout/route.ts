import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearMemberSession, MEMBER_SESSION_COOKIE } from "@/lib/member-auth";
import { logoutMember } from "@/lib/member-store";

export async function POST() {
  const memberToken = (await cookies()).get(MEMBER_SESSION_COOKIE)?.value;
  if (memberToken) await logoutMember(memberToken).catch(() => undefined);
  await clearMemberSession();
  return NextResponse.json({ success: true });
}
