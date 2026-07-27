import { serveQcTool } from "@/lib/qc-tool-static";

export function GET() {
  return serveQcTool("timer/index.html");
}
