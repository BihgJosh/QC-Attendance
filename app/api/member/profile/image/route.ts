import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";
import { deleteMemberProfileImage, MemberStoreError, uploadMemberProfileImage } from "@/lib/member-store";
import sharp from "sharp";

export const runtime = "nodejs";

const MAX_STORED_IMAGE_BYTES = 400 * 1024;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif", "image/gif", "image/tiff", "image/bmp", "image/x-ms-bmp", "application/octet-stream"]);
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "avif", "gif", "tif", "tiff", "bmp"]);

async function optimizeImage(input: Buffer) {
  let output = await sharp(input, {
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
  try {
    const form = await request.formData();
    const image = form.get("image");
    const requestId = String(form.get("requestId") || "");
    if (!(image instanceof File)) return NextResponse.json({ error: "Choose a profile picture." }, { status: 400 });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return NextResponse.json({ error: "Restart this photo upload and try again." }, { status: 400 });
    const extension = image.name.toLowerCase().split(".").pop() || "";
    if (!ALLOWED_MIME_TYPES.has(image.type || "application/octet-stream") || (!image.type.startsWith("image/") && !ALLOWED_EXTENSIONS.has(extension))) return NextResponse.json({ error: "Choose a JPG, PNG, WebP, HEIC, HEIF, AVIF, GIF, TIFF or BMP photo." }, { status: 415 });
    if (!image.size || image.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Choose a profile picture smaller than 15 MB." }, { status: 413 });
    const input = Buffer.from(await image.arrayBuffer());
    const optimized = await optimizeImage(input).catch(() => null);
    if (!optimized) return NextResponse.json({ error: "This photo format could not be read. Try another image or export it as JPG." }, { status: 415 });
    return NextResponse.json(await uploadMemberProfileImage(session.token, optimized.toString("base64"), "image/webp", requestId));
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
