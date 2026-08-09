import "server-only";

import { getEnv, getSupabaseEnv } from "@/lib/env";

type ServiceReportOperation =
  | "report.insert"
  | "timer.insert"
  | "observer.insert"
  | "emergency.insert"
  | "emergency.list"
  | "emergency.update"
  | "manager.dashboard"
  | "manager.daily-report"
  | "document.find"
  | "document.insert"
  | "activity.insert"
  | "email.insert";

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export async function callServiceReportGateway<T>(
  operation: ServiceReportOperation,
  payload: Record<string, unknown>,
) {
  const { url, anonKey } = getSupabaseEnv();
  const gatewaySecret = getEnv("SUPABASE_GATEWAY_SECRET");
  const endpoint = `${url.replace(/\/+$/, "")}/functions/v1/qcu-service-reports`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(attempt === 0 ? 8_000 : 12_000),
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "x-qcu-operation-secret": gatewaySecret,
        },
        body: JSON.stringify(operation === "manager.dashboard" || operation === "manager.daily-report" || operation === "document.find" || operation === "emergency.list" || operation === "emergency.update"
          ? { operation, ...payload }
          : { operation, row: payload }),
      });
      const data = await response.json().catch(() => ({})) as { error?: unknown };
      if (response.ok) return data as T;
      lastError = new Error(typeof data.error === "string" ? data.error : `Report storage failed (${response.status}).`);
      if (!RETRYABLE_STATUS_CODES.has(response.status)) break;
    } catch (error) {
      lastError = error;
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw lastError instanceof Error ? lastError : new Error("Report storage did not respond.");
}
