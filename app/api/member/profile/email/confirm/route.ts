import { NextResponse } from "next/server";
import { readMemberSession, setMemberSession } from "@/lib/member-auth";
import { confirmMemberEmailChange, MemberStoreError } from "@/lib/member-store";

export async function POST(request: Request) {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  try {
    const { code } = await request.json();
    const result = await confirmMemberEmailChange(session.token, String(code || ""));
    await setMemberSession(result.token);
    return NextResponse.json({ success: true, email: result.email });
  } catch (error) {
    const status = error instanceof MemberStoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "The email change could not be confirmed." }, { status });
  }
}
