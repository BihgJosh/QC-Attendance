import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";
import { deleteMemberProfileImage, deleteMemberProfileImageStage, MemberStoreError, readMemberProfileImageStage, uploadMemberProfileImage } from "@/lib/member-store";
import convertHeic from "heic-convert";
import sharp from "sharp";

export const runtime = "nodejs";

const MAX_STORED_IMAGE_BYTES = 400 * 1024;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

async function optimizeImage(input: Buffer, extension: string) {
  const source = extension === "heic" || extension === "heif"
    ? Buffer.from(await convertHeic({ buffer: input, format: "JPEG", quality: 0.9 }))
    : input;
  let output = await sharp(source, {
    animated: false,
    failOn: "error",
    limitInputPixels: 60_000_000,
    sequentialRead: true,
  })
    .rotate()
    .resize(512, 512, { fit: "cover", position: "centre", withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toBuffer();
  if (output.length <= MAX_STORED_IMAGE_BYTES) return output;
  output = await sharp(output).webp({ quality: 56, effort: 4 }).toBuffer();
  if (output.length <= MAX_STORED_IMAGE_BYTES) return output;
  output = await sharp(output).resize(384, 384, { fit: "inside", withoutEnlargement: true }).webp({ quality: 48, effort: 4 }).toBuffer();
  if (output.length <= MAX_STORED_IMAGE_BYTES) return output;
  throw new Error("The photo could not be reduced to a safe profile-picture size.");
}

export async function POST(request: Request) {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  let requestId = "";
  let objectPath = "";
  try {
    const body = await request.json() as Record<string, unknown>;
    requestId = String(body.requestId || "");
    objectPath = String(body.objectPath || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return NextResponse.json({ error: "Restart this photo upload and try again." }, { status: 400 });
    const staged = await readMemberProfileImageStage(session.token, { requestId, objectPath });
    const source = await fetch(staged.signedUrl, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
    if (!source.ok) throw new Error("The uploaded photo could not be opened for processing.");
    const declaredSize = Number(source.headers.get("content-length"));
    if (Number.isFinite(declaredSize) && declaredSize > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Choose a profile picture smaller than 15 MB." }, { status: 413 });
    const input = Buffer.from(await source.arrayBuffer());
    if (!input.length || input.length > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Choose a profile picture smaller than 15 MB." }, { status: 413 });
    const extension = objectPath.toLowerCase().split(".").pop() || "";
    const optimized = await optimizeImage(input, extension).catch(() => null);
    if (!optimized) return NextResponse.json({ error: "This photo format could not be read. Try another image or export it as JPG." }, { status: 415 });
    return NextResponse.json(await uploadMemberProfileImage(session.token, optimized.toString("base64"), "image/webp", requestId));
  } catch (error) {
    console.error("[profile-image] Staged photo processing failed", error);
    const status = error instanceof MemberStoreError ? error.status : 500;
    const message = error instanceof MemberStoreError ? error.message : "The profile picture could not be processed. Try again.";
    return NextResponse.json({ error: message }, { status });
  } finally {
    if (requestId && objectPath) await deleteMemberProfileImageStage(session.token, { requestId, objectPath }).catch((error) => console.error("[profile-image] Staging cleanup failed", error));
  }
}

export async function DELETE() {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  try { return NextResponse.json(await deleteMemberProfileImage(session.token)); }
  catch (error) {
    const status = error instanceof MemberStoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "The profile picture could not be removed." }, { status });
  }
}
