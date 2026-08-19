import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { fetchGoogleDocPostings } from "@/lib/google-doc-postings";
import type { ServiceDay } from "@/lib/homepage-content";

export const dynamic = "force-dynamic";

function googleStatus(cause: unknown) {
  if (!cause || typeof cause !== "object") return 0;
  if ("code" in cause) return Number(cause.code) || 0;
  if ("response" in cause && cause.response && typeof cause.response === "object" && "status" in cause.response) return Number(cause.response.status) || 0;
  return 0;
}

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const day: ServiceDay = new URL(request.url).searchParams.get("day") === "Thursday" ? "Thursday" : "Sunday";

  try {
    const result = await fetchGoogleDocPostings(day);
    if (!result.postings.length) {
      return NextResponse.json({ error: `No ${day} posting tables matched the supported document layout. Keep each section in a table with a service column, role headings and member assignments.` }, { status: 422 });
    }
    return NextResponse.json({
      ...result,
      fetchedAt: new Date().toISOString(),
      safeguard: "draft-only",
    });
  } catch (cause) {
    const status = googleStatus(cause);
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: "The postings document is private. Share it with the configured Google service-account email, then try again." }, { status: 424 });
    }
    if (status === 404) return NextResponse.json({ error: "The configured postings document could not be found." }, { status: 404 });
    console.error("[postings-import] Google Doc fetch failed", cause instanceof Error ? cause.message : "Unknown error");
    return NextResponse.json({ error: "The Google Doc could not be fetched. Your current homepage postings were not changed." }, { status: 502 });
  }
}
