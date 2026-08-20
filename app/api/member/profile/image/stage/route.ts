import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";
import { createMemberProfileImageStage, MemberStoreError } from "@/lib/member-store";

export async function POST(request: Request) {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    return NextResponse.json(await createMemberProfileImageStage(session.token, {
      requestId: String(body.requestId || ""),
      mimeType: String(body.mimeType || ""),
      extension: String(body.extension || ""),
      size: Number(body.size),
    }));
  } catch (error) {
    console.error("[profile-image-stage] Could not create staging upload", error);
    const status = error instanceof MemberStoreError ? error.status : 500;
    const message = error instanceof MemberStoreError ? error.message : "The profile picture upload could not start. Try again.";
    return NextResponse.json({ error: message }, { status });
  }
}
