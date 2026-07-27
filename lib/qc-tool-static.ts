import { readFile } from "node:fs/promises";
import path from "node:path";

const TOOL_FILES = new Set(["index.html", "post-report/index.html", "timer/index.html", "observer/index.html", "emergency/index.html", "dashboard/index.html"]);

export async function serveQcTool(file: string) {
  if (!TOOL_FILES.has(file)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const html = await readFile(path.join(process.cwd(), "public", "qc-suite-assets", ...file.split("/")), "utf8");
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("QC tool unavailable", { status: 503 });
  }
}
