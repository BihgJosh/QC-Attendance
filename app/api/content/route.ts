import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getConfig, updateConfig } from "@/lib/google-sheets";
import { DEFAULT_HOMEPAGE_CONTENT, normalizeHomepageContent } from "@/lib/homepage-content";

const CONTENT_CONFIG_KEY = "homepageContent";

export async function GET() {
  try {
    const config = await getConfig();
    if (!config[CONTENT_CONFIG_KEY]) {
      return NextResponse.json(DEFAULT_HOMEPAGE_CONTENT);
    }
    return NextResponse.json(normalizeHomepageContent(JSON.parse(config[CONTENT_CONFIG_KEY])));
  } catch {
    return NextResponse.json(DEFAULT_HOMEPAGE_CONTENT);
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
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
