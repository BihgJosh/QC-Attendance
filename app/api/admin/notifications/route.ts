import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getConfig } from "@/lib/google-sheets";
import { DEFAULT_HOMEPAGE_CONTENT, normalizeHomepageContent } from "@/lib/homepage-content";
import { notifyTeam } from "@/lib/web-push";

const CONTENT_CONFIG_KEY = "homepageContent";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const section = body?.section;
    if (!new Set(["announcements", "postings", "uniform"]).has(String(section))) {
      return NextResponse.json({ error: "Select a valid notification section." }, { status: 400 });
    }
    const config = await getConfig();
    const content = config[CONTENT_CONFIG_KEY] ? normalizeHomepageContent(JSON.parse(config[CONTENT_CONFIG_KEY])) : DEFAULT_HOMEPAGE_CONTENT;
    let notification;
    if (section === "announcements") {
      notification = { title: "QC announcements updated", body: "A new team announcement is available. Tap to read it.", url: "/#announcements", tag: "qc-announcement" };
    } else if (section === "postings") {
      const day = body?.day === "Thursday" ? "Thursday" : "Sunday";
      notification = { title: `${day} postings updated`, body: "Your latest QC assignment is ready. Tap to review your posting.", url: `/#postings`, tag: `qc-postings-${day.toLowerCase()}` };
    } else {
      notification = { title: "QC uniform updated", body: content.uniformNote || "The latest uniform guidance is ready. Tap to review it.", url: "/#uniform", tag: "qc-uniform" };
    }
    const result = await notifyTeam(notification);
    if (result.total === 0) return NextResponse.json({ error: "No team devices have enabled notifications yet." }, { status: 409 });
    if (result.delivered === 0) return NextResponse.json({ error: "No subscribed device accepted the notification. Please try again shortly.", ...result }, { status: 502 });
    return NextResponse.json({ success: true, ...result });
  } catch (cause) {
    console.error("[notifications] Team notification failed", cause instanceof Error ? cause.message : "Unknown error");
    return NextResponse.json({ error: "The team notification could not be sent. Please try again." }, { status: 502 });
  }
}
