import { NextResponse } from "next/server";
import { getWhitelist } from "@/lib/attendance-store";

export async function GET() {
  try {
    const whitelist = await getWhitelist();
    return NextResponse.json({ names: whitelist });
  } catch (error) {
    console.error("Whitelist Error:", error);
    return NextResponse.json({ error: "Failed to fetch whitelist" }, { status: 500 });
  }
}
