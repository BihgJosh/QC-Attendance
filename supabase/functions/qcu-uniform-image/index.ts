const SECRET_HASH = "e961e32016c41f358eac3f9e1546b93d78bae0b9b30a446ccceecea47533fa41";
const BUCKET = "uniform-assets";
const OBJECT = "current";
const MAX_BYTES = 3 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

function validSignature(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  return type === "image/webp" && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

async function storage(path: string, init: RequestInit) {
  const response = await fetch(`${supabaseUrl}/storage/v1/${path}`, {
    ...init,
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...(init.headers || {}) },
  });
  if (!response.ok && response.status !== 404) throw new Error("Image storage request failed.");
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const suppliedHash = await sha256(request.headers.get("x-qcu-operation-secret") || "");
    if (!safeEqual(suppliedHash, SECRET_HASH)) return json({ error: "Unauthorized." }, 401);
    const body = await request.json() as Record<string, unknown>;
    if (body.operation === "delete") {
      await storage(`object/${BUCKET}/${OBJECT}`, { method: "DELETE" });
      return json({ success: true });
    }
    if (body.operation !== "upload") return json({ error: "Unknown operation." }, 400);
    const contentType = String(body.contentType || "");
    const encoded = String(body.base64 || "");
    if (!TYPES.has(contentType)) return json({ error: "Use a JPG, PNG or WebP image." }, 415);
    if (!encoded || encoded.length > Math.ceil(MAX_BYTES / 3) * 4 + 4) return json({ error: "The image must be smaller than 3 MB." }, 413);
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    if (!bytes.length || bytes.length > MAX_BYTES || !validSignature(contentType, bytes)) return json({ error: "The uploaded image is invalid." }, 415);
    await storage(`object/${BUCKET}/${OBJECT}`, { method: "POST", headers: { "Content-Type": contentType, "x-upsert": "true", "cache-control": "3600" }, body: bytes });
    return json({ url: `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${OBJECT}?v=${Date.now()}` });
  } catch {
    return json({ error: "Uniform image storage is temporarily unavailable." }, 503);
  }
});
