import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";
import { deleteMemberProfileImage, MemberStoreError, uploadMemberProfileImage } from "@/lib/member-store";

const MAX_IMAGE_BYTES = 400 * 1024;

export async function POST(request: Request) {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  try {
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File)) return NextResponse.json({ error: "Choose a profile picture." }, { status: 400 });
    if (image.type !== "image/webp" && image.type !== "image/jpeg") return NextResponse.json({ error: "The processed profile picture must be JPG or WebP." }, { status: 415 });
    const mimeType = image.type;
    if (!image.size || image.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "The processed profile picture must be 400 KB or smaller." }, { status: 413 });
    const bytes = new Uint8Array(await image.arrayBuffer());
    const isWebp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
    if ((mimeType === "image/webp" && !isWebp) || (mimeType === "image/jpeg" && !isJpeg)) return NextResponse.json({ error: "The image contents are invalid." }, { status: 415 });
    return NextResponse.json(await uploadMemberProfileImage(session.token, Buffer.from(bytes).toString("base64"), mimeType));
  } catch (error) {
    const status = error instanceof MemberStoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "The profile picture could not be uploaded." }, { status });
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
