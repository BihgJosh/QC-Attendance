import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { clearMemberSession, MEMBER_SESSION_COOKIE } from "@/lib/member-auth";
import { logoutMember } from "@/lib/member-store";

export async function POST() {
  const memberToken = (await cookies()).get(MEMBER_SESSION_COOKIE)?.value;
  if (memberToken) await logoutMember(memberToken).catch(() => undefined);
  await clearMemberSession();
  await clearAdminSession();
  return NextResponse.json({ success: true });
}
