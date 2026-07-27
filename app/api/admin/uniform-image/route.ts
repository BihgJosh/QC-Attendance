import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { deleteUniformImage, UniformImageStoreError, uploadUniformImage } from "@/lib/uniform-image-store";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function hasValidSignature(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  return type === "image/webp"
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
    if (!ALLOWED_IMAGE_TYPES.has(image.type)) return NextResponse.json({ error: "Use a JPG, PNG or WebP image." }, { status: 415 });
    if (image.size === 0 || image.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "The image must be smaller than 3 MB." }, { status: 413 });

    const bytes = new Uint8Array(await image.arrayBuffer());
    if (!hasValidSignature(image.type, bytes)) return NextResponse.json({ error: "The file contents do not match its image type." }, { status: 415 });
    const base64 = Buffer.from(bytes).toString("base64");
    return NextResponse.json(await uploadUniformImage(image.type, base64));
  } catch (error) {
    const status = error instanceof UniformImageStoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "The image could not be uploaded." }, { status });
  }
}

export async function DELETE() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await deleteUniformImage());
  } catch (error) {
    const status = error instanceof UniformImageStoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "The image could not be removed." }, { status });
  }
}
