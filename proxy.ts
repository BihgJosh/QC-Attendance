import { NextRequest, NextResponse } from "next/server";
import { getMemberSession, MemberStoreError } from "@/lib/member-store";
import { MEMBER_SESSION_COOKIE, MEMBER_SESSION_MAX_AGE } from "@/lib/member-auth";
import { getTeamMemberByEmail } from "@/lib/team-data-store";
import { isPrivilegedAdminEmail } from "@/lib/roles";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(MEMBER_SESSION_COOKIE)?.value;
  const login = new URL("/member/login", request.url);
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  if (!token) return NextResponse.redirect(login);
  try {
    const session = await getMemberSession(token);
    if (session.mustChangePassword) return NextResponse.redirect(new URL("/member/change-password", request.url));
    if (!isPrivilegedAdminEmail(session.email) && !(await getTeamMemberByEmail(session.email))) {
      const response = NextResponse.redirect(login);
      response.cookies.delete(MEMBER_SESSION_COOKIE);
      return response;
    }
    const response = NextResponse.next();
    response.cookies.set(MEMBER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: MEMBER_SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    if (error instanceof MemberStoreError && error.status === 401) {
      const response = NextResponse.redirect(login);
      response.cookies.delete(MEMBER_SESSION_COOKIE);
      return response;
    }
    // A temporary gateway, database, or mobile-network failure must not destroy
    // an otherwise valid 180-day login. The destination can show its own
    // recoverable service error and the next request can validate the session.
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/", "/attendance", "/service-tools/:path*", "/qc-tools/:path*"],
};
