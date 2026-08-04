import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";
import { deletePushSubscription, savePushSubscription } from "@/lib/push-notification-store";

function subscriptionParts(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = record.keys && typeof record.keys === "object" && !Array.isArray(record.keys) ? record.keys as Record<string, unknown> : {};
  const endpoint = typeof record.endpoint === "string" ? record.endpoint.trim() : "";
  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh.trim() : "";
  const auth = typeof keys.auth === "string" ? keys.auth.trim() : "";
  const base64url = /^[A-Za-z0-9_-]+$/;
  if (!endpoint.startsWith("https://") || endpoint.length > 4096 || p256dh.length < 20 || p256dh.length > 512 || auth.length < 8 || auth.length > 256 || !base64url.test(p256dh) || !base64url.test(auth)) return null;
  return { endpoint, p256dh, auth };
}

export async function POST(request: Request) {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const subscription = subscriptionParts(body?.subscription);
  if (!subscription) return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
  await savePushSubscription({ ...subscription, memberEmail: session.email, userAgent: request.headers.get("user-agent") || "Unknown" });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint.startsWith("https://") || endpoint.length > 4096) return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
  await deletePushSubscription(endpoint, session.email);
  return NextResponse.json({ success: true });
}
