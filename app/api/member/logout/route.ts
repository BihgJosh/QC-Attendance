import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearMemberSession, MEMBER_SESSION_COOKIE } from "@/lib/member-auth";
import { logoutMember } from "@/lib/member-store";

export async function POST() {
  const token = (await cookies()).get(MEMBER_SESSION_COOKIE)?.value;
  if (token) await logoutMember(token).catch(() => undefined);
  await clearMemberSession();
  return NextResponse.json({ success: true });
}
