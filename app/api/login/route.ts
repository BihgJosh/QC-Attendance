import { NextResponse } from "next/server";
import { setAdminSession } from "@/lib/auth";
import { verifySharedAdminAccess } from "@/lib/admin-login-security";

export async function POST(req: Request) {
  try {
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const verification = await verifySharedAdminAccess(req, String(password));
    if (verification.ok) {
      const sessionSet = await setAdminSession();

      if (!sessionSet) {
        return NextResponse.json({ error: "Admin password is not configured" }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: verification.error }, { status: verification.status });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
