import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";
import { getMemberProfile, MemberStoreError, updateMemberProfile } from "@/lib/member-store";

function errorResponse(error: unknown) {
  const status = error instanceof MemberStoreError ? error.status : 500;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Your profile is temporarily unavailable." }, { status });
}

export async function GET() {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  try { return NextResponse.json({ profile: await getMemberProfile(session.token) }); } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  try {
    const body = await request.json();
    await updateMemberProfile(session.token, body);
    return NextResponse.json({ success: true });
  } catch (error) { return errorResponse(error); }
}
