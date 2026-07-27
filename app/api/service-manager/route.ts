import { NextResponse } from "next/server";

const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycby9y-TP-NfdLurUyqW9hXg5WaHIyl-bW4kJoAOoUpW-ObemJLjmRV0RVS1kwtPJCx9iFg/exec";
const API_URL = process.env.QC_SUITE_API_URL || DEFAULT_API_URL;
const SERVICES = new Set(["1st Service", "2nd Service", "3rd Service", "4th Service", "Thursday Service"]);
const ACTIONS = new Set(["checkPassword", "getDashboard", "generateReport"]);

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const date = typeof body.date === "string" ? body.date : "";
    const service = typeof body.service === "string" ? body.service : "";

    if (!ACTIONS.has(action) || !token || token.length > 200) {
      return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
    }

    if (action !== "checkPassword" && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !SERVICES.has(service))) {
      return NextResponse.json({ ok: false, message: "Choose a valid date and service." }, { status: 400 });
    }

    const params = new URLSearchParams({ action, token });
    if (action !== "checkPassword") {
      params.set("date", date);
      params.set("service", service);
    }

    const response = await fetch(`${API_URL}?${params.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new Error(`QC suite responded with ${response.status}`);
    }

    const result = await response.json();
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Service manager proxy failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ ok: false, message: "The service reports are temporarily unavailable." }, { status: 502 });
  }
}
