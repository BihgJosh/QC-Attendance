import { NextResponse } from "next/server";
import { readMemberSession } from "@/lib/member-auth";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHASES = new Set(["stage", "transfer", "finalize"]);
const EVENTS = new Set(["failed", "completed"]);

function text(value: unknown, limit: number) {
  return String(value || "").replace(/([?&]token=)[^&\s)]+/gi, "$1[redacted]").replace(/\s+/g, " ").trim().slice(0, limit);
}

export async function POST(request: Request) {
  const session = await readMemberSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const requestId = text(body.requestId, 36);
    const phase = text(body.phase, 16);
    const event = text(body.event, 16);
    if (!UUID_V4.test(requestId) || !PHASES.has(phase) || !EVENTS.has(event)) return NextResponse.json({ error: "Invalid upload telemetry." }, { status: 400 });
    const status = Math.max(0, Math.min(599, Math.trunc(Number(body.status) || 0)));
    const progress = Math.max(0, Math.min(100, Math.trunc(Number(body.progress) || 0)));
    const size = Math.max(0, Math.min(15 * 1024 * 1024, Math.trunc(Number(body.size) || 0)));
    const record = {
      requestId,
      phase,
      event,
      status,
      progress,
      error: text(body.error, 240),
      mimeType: text(body.mimeType, 64),
      extension: text(body.extension, 12),
      size,
      userAgent: text(request.headers.get("user-agent"), 180),
    };
    if (event === "failed") console.error("[profile-image-client]", JSON.stringify(record));
    else console.info("[profile-image-client]", JSON.stringify(record));
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Invalid upload telemetry." }, { status: 400 });
  }
}
