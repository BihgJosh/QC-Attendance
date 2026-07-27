import "server-only";

import { getEnv, getSupabaseEnv } from "@/lib/env";

export class UniformImageStoreError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "UniformImageStoreError";
    this.status = status;
  }
}

async function callUniformGateway<T>(operation: "uniform.image-upload" | "uniform.image-delete", payload: Record<string, unknown> = {}) {
  const { url, anonKey } = getSupabaseEnv();
  const gatewaySecret = getEnv("SUPABASE_GATEWAY_SECRET");
  if (!anonKey || !gatewaySecret) throw new UniformImageStoreError("Uniform image storage is not configured.", 503);

  const response = await fetch(`${url.replace(/\/+$/, "")}/functions/v1/qcu-uniform-image`, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "x-qcu-operation-secret": gatewaySecret,
    },
    body: JSON.stringify({ operation: operation === "uniform.image-upload" ? "upload" : "delete", ...payload }),
  });
  const data = await response.json().catch(() => ({})) as { error?: unknown };
  if (!response.ok) {
    throw new UniformImageStoreError(
      typeof data.error === "string" ? data.error : "Uniform image storage is unavailable.",
      response.status >= 500 ? 503 : response.status,
    );
  }
  return data as T;
}

export function uploadUniformImage(contentType: string, base64: string) {
  return callUniformGateway<{ url: string }>("uniform.image-upload", { contentType, base64 });
}

export function deleteUniformImage() {
  return callUniformGateway<{ success: boolean }>("uniform.image-delete");
}
