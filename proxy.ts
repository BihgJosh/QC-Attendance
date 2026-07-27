import { NextRequest, NextResponse } from "next/server";
import { getMemberSession } from "@/lib/member-store";
import { MEMBER_SESSION_COOKIE } from "@/lib/member-auth";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(MEMBER_SESSION_COOKIE)?.value;
  const login = new URL("/member/login", request.url);
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  if (!token) return NextResponse.redirect(login);
  try {
    const session = await getMemberSession(token);
    if (session.mustChangePassword) return NextResponse.redirect(new URL("/member/change-password", request.url));
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(login);
    response.cookies.delete(MEMBER_SESSION_COOKIE);
    return response;
  }
}

export const config = {
  matcher: ["/", "/attendance", "/service-tools/:path*", "/qc-tools/:path*"],
};
