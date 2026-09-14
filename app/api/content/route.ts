import { NextResponse } from "next/server";
import { isContentAdminAuthenticated } from "@/lib/auth";
import { getConfig, updateConfig } from "@/lib/google-sheets";
import { DEFAULT_HOMEPAGE_CONTENT, normalizeHomepageContent } from "@/lib/homepage-content";
import { readMemberSession } from "@/lib/member-auth";
import { resolveUserAccess } from "@/lib/member-store";
import { canViewMemberDetails } from "@/lib/member-permissions";

const CONTENT_CONFIG_KEY = "homepageContent";

export async function GET() {
  try {
    const config = await getConfig();
    const content = config[CONTENT_CONFIG_KEY] ? normalizeHomepageContent(JSON.parse(config[CONTENT_CONFIG_KEY])) : DEFAULT_HOMEPAGE_CONTENT;
    if (await isContentAdminAuthenticated()) return NextResponse.json(content, { headers: { "Cache-Control": "private, no-store" } });
    const session = await readMemberSession();
    if (!session) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    const access = await resolveUserAccess(session.email);
    if (canViewMemberDetails(access.role)) return NextResponse.json(content, { headers: { "Cache-Control": "private, no-store" } });
    const redacted = { ...content, postings: content.postings.map((posting) => ({ ...posting, rows: posting.rows.map((row) => ({ ...row, assignments: row.assignments.map((members) => members.map((member) => ({ ...member, email: "" }))) })) })) };
    return NextResponse.json(redacted, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Homepage content is unavailable." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}

export async function POST(request: Request) {
  if (!(await isContentAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const config = await getConfig();
    const currentContent = config[CONTENT_CONFIG_KEY]
      ? normalizeHomepageContent(JSON.parse(config[CONTENT_CONFIG_KEY]))
      : DEFAULT_HOMEPAGE_CONTENT;

    let content;
    if (body.section === "announcements") {
      content = normalizeHomepageContent({ ...currentContent, announcements: body.announcements });
    } else if (body.section === "postings") {
      const day = body.day === "Thursday" ? "Thursday" : "Sunday";
      const otherDays = currentContent.postings.filter((posting) => posting.day !== day);
      const selectedDay = Array.isArray(body.postings) ? body.postings : [];
      content = normalizeHomepageContent({ ...currentContent, postings: [...otherDays, ...selectedDay] });
    } else if (body.section === "uniform") {
      content = normalizeHomepageContent({
        ...currentContent,
        uniformItems: body.uniformItems,
        uniformNote: body.uniformNote,
        uniformImageUrl: body.uniformImageUrl,
      });
    } else {
      content = normalizeHomepageContent(body);
    }

    content = { ...content, updatedAt: new Date().toISOString() };
    config[CONTENT_CONFIG_KEY] = JSON.stringify(content);
    await updateConfig(config);
    return NextResponse.json({ success: true, content });
  } catch {
    return NextResponse.json({ error: "Failed to publish homepage content" }, { status: 500 });
  }
}
