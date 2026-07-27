import { serveQcTool } from "@/lib/qc-tool-static";

export function GET() {
  return serveQcTool("post-report/index.html");
}
