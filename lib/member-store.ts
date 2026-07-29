import "server-only";

import { getEnv, getSupabaseEnv } from "@/lib/env";

type MemberOperation =
  | "member.authenticate"
  | "member.session"
  | "member.change-password"
  | "member.logout"
  | "member.list"
  | "member.reset"
  | "admin.list"
  | "admin.add"
  | "admin.remove";

export type MemberStatus = {
  email: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
  resetAt: string | null;
};

export class MemberStoreError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "MemberStoreError";
    this.status = status;
  }
}

const GATEWAY_TIMEOUT_MS = 10_000;
const GATEWAY_ATTEMPTS = 3;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

function gatewayConfiguration() {
  const { url, anonKey } = getSupabaseEnv();
  const gatewaySecret = getEnv("SUPABASE_GATEWAY_SECRET");

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("Supabase must use HTTPS.");
  } catch {
    throw new MemberStoreError("Member authentication is not configured correctly.", 503);
  }

  if (!anonKey || !gatewaySecret) {
    throw new MemberStoreError("Member authentication is not configured correctly.", 503);
  }

  return { endpoint: `${url.replace(/\/+$/, "")}/functions/v1/qcu-attendance`, anonKey, gatewaySecret };
}

function retryDelay(attempt: number) {
  return new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt));
}

async function callMemberGateway<T>(operation: MemberOperation, payload: Record<string, unknown> = {}) {
  const { endpoint, anonKey, gatewaySecret } = gatewayConfiguration();

  for (let attempt = 0; attempt < GATEWAY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "x-qcu-operation-secret": gatewaySecret,
        },
        body: JSON.stringify({ operation, ...payload }),
      });
      const data = await response.json().catch(() => ({})) as { error?: unknown };
      if (response.ok) return data as T;

      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === GATEWAY_ATTEMPTS - 1) {
        throw new MemberStoreError(
          typeof data.error === "string" ? data.error : "Member authentication is temporarily unavailable.",
          response.status >= 500 ? 503 : response.status,
        );
      }
    } catch (error) {
      if (error instanceof MemberStoreError) throw error;
      if (attempt === GATEWAY_ATTEMPTS - 1) {
        console.error(`[member-store] ${operation} gateway request failed after ${GATEWAY_ATTEMPTS} attempts`, error);
        throw new MemberStoreError("Member authentication is temporarily unavailable. Please try again.", 503);
      }
    }

    await retryDelay(attempt);
  }

  throw new MemberStoreError("Member authentication is temporarily unavailable. Please try again.", 503);
}

export function authenticateMember(email: string, password: string) {
  return callMemberGateway<{ token: string; mustChangePassword: boolean }>("member.authenticate", { email, password });
}

export function getMemberSession(token: string) {
  return callMemberGateway<{ email: string; mustChangePassword: boolean }>("member.session", { token });
}

export function changeMemberPassword(token: string, password: string) {
  return callMemberGateway<{ token: string; mustChangePassword: false }>("member.change-password", { token, password });
}

export function logoutMember(token: string) {
  return callMemberGateway<{ success: boolean }>("member.logout", { token });
}

export async function listMemberStatuses() {
  const data = await callMemberGateway<{ members: MemberStatus[] }>("member.list");
  return data.members;
}

export function resetMemberPassword(email: string) {
  return callMemberGateway<{ success: boolean }>("member.reset", { email });
}

export type AdminAccess = {
  email: string;
  createdAt: string | null;
  isProtected: boolean;
};

export async function listAdminAccess() {
  const data = await callMemberGateway<{ admins: AdminAccess[] }>("admin.list");
  return data.admins;
}

export function addAdminAccess(email: string) {
  return callMemberGateway<{ success: boolean; admin: AdminAccess }>("admin.add", { email });
}

export function removeAdminAccess(email: string) {
  return callMemberGateway<{ success: boolean }>("admin.remove", { email });
}
