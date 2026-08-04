import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";
import { getOptionalEnv } from "@/lib/env";

export async function GET() {
  if (!(await readMemberSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const publicKey = getOptionalEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  if (!publicKey) return NextResponse.json({ error: "Notifications are not configured." }, { status: 503 });
  return NextResponse.json({ publicKey });
}
