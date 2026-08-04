import "server-only";

import { getEnv, getSupabaseEnv } from "@/lib/env";

export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushOperation = "push.subscribe" | "push.unsubscribe" | "push.list" | "push.deactivate";

async function callPushGateway<T>(operation: PushOperation, payload: Record<string, unknown> = {}) {
  const { url, anonKey } = getSupabaseEnv();
  const response = await fetch(`${url}/functions/v1/qcu-attendance`, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "x-qcu-operation-secret": getEnv("SUPABASE_GATEWAY_SECRET"),
    },
    body: JSON.stringify({ operation, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Notification storage is unavailable.");
  return data as T;
}

export function savePushSubscription(input: StoredPushSubscription & { memberEmail: string; userAgent: string }) {
  return callPushGateway<{ success: boolean }>("push.subscribe", input);
}

export function deletePushSubscription(endpoint: string, memberEmail: string) {
  return callPushGateway<{ success: boolean }>("push.unsubscribe", { endpoint, memberEmail });
}

export async function listPushSubscriptions() {
  const data = await callPushGateway<{ subscriptions: StoredPushSubscription[] }>("push.list");
  if (!Array.isArray(data.subscriptions)) throw new Error("Notification storage returned an invalid subscription list.");
  return data.subscriptions.filter((item): item is StoredPushSubscription => Boolean(item && typeof item.endpoint === "string" && item.endpoint.startsWith("https://") && typeof item.p256dh === "string" && typeof item.auth === "string"));
}

export function deactivatePushSubscriptions(endpoints: string[]) {
  if (!endpoints.length) return Promise.resolve({ success: true, deactivated: 0 });
  return callPushGateway<{ success: boolean; deactivated: number }>("push.deactivate", { endpoints });
}
