import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { changeMemberPassword } from "@/lib/member-store";
import { MEMBER_SESSION_COOKIE, setMemberSession } from "@/lib/member-auth";

export async function POST(request: Request) {
  try {
    const token = (await cookies()).get(MEMBER_SESSION_COOKIE)?.value;
    if (!token) return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const { password } = body;
    const result = await changeMemberPassword(token, String(password || ""));
    await setMemberSession(result.token);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || "Password could not be changed." }, { status: (error as { status?: number }).status || 500 });
  }
}
