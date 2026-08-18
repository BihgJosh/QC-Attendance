import "server-only";

import { getEnv, getSupabaseEnv } from "@/lib/env";

type MemberOperation =
  | "member.status"
  | "member.setup-complete"
  | "member.authenticate"
  | "member.session"
  | "member.change-password"
  | "member.logout"
  | "profile.get"
  | "profile.update"
  | "profile.email-change-request"
  | "profile.email-change-confirm"
  | "profile.image-upload"
  | "profile.image-delete"
  | "profile.identities"
  | "member.list"
  | "member.reset"
  | "admin.list"
  | "admin.add"
  | "admin.remove"
  | "roles.list"
  | "roles.resolve"
  | "roles.upsert"
  | "roles.remove"
  | "assignments.upsert"
  | "assignments.remove";

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

export async function authenticateMember(email: string, password: string, rememberMe = false) {
  const result = await callMemberGateway<{ token?: unknown; mustChangePassword?: unknown }>("member.authenticate", { email, password, rememberMe });
  if (typeof result.token !== "string" || result.token.length < 32 || result.token.length > 512 || typeof result.mustChangePassword !== "boolean") {
    throw new MemberStoreError("Member authentication returned an invalid session.", 503);
  }
  return { token: result.token, mustChangePassword: result.mustChangePassword };
}

export function getMemberPasswordStatus(email: string) {
  return callMemberGateway<{ hasPrivatePassword: boolean }>("member.status", { email });
}

export async function completeMemberSetup(email: string, password: string, rememberMe = false) {
  const result = await callMemberGateway<{ token?: unknown; mustChangePassword?: unknown }>("member.setup-complete", { email, password, rememberMe });
  if (typeof result.token !== "string" || result.token.length < 32 || result.token.length > 512) throw new MemberStoreError("Private password setup returned an invalid session.", 503);
  return { token: result.token, mustChangePassword: false as const };
}

export function getMemberSession(token: string) {
  return callMemberGateway<{ email: string; rememberMe?: boolean; mustChangePassword: boolean }>("member.session", { token });
}

export function changeMemberPassword(token: string, password: string) {
  return callMemberGateway<{ token: string; mustChangePassword: false }>("member.change-password", { token, password });
}

export function logoutMember(token: string) {
  return callMemberGateway<{ success: boolean }>("member.logout", { token });
}

export type MemberProfile = {
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  phone: string;
  birthMonth: number | null;
  birthDay: number | null;
  avatarUrl: string | null;
  role: AppRole;
  profileComplete: boolean;
};

export type MemberIdentity = { name: string; email: string; avatarUrl: string | null };
export type MemberIdentityReference = { name?: string; email?: string };

export async function getMemberProfile(token: string) {
  const data = await callMemberGateway<{ profile: MemberProfile }>("profile.get", { token });
  return data.profile;
}

export function updateMemberProfile(token: string, input: Pick<MemberProfile, "firstName" | "middleName" | "lastName" | "phone" | "birthMonth" | "birthDay">) {
  return callMemberGateway<{ success: boolean }>("profile.update", { token, ...input });
}

export function requestMemberEmailChange(token: string, newEmail: string) {
  return callMemberGateway<{ success: boolean; newEmail: string; verificationCode: string; requestedAt: string }>("profile.email-change-request", { token, newEmail });
}

export function confirmMemberEmailChange(token: string, code: string) {
  return callMemberGateway<{ success: boolean; email: string; token: string }>("profile.email-change-confirm", { token, code });
}

export function uploadMemberProfileImage(token: string, base64: string, mimeType: "image/webp" | "image/jpeg") {
  return callMemberGateway<{ success: boolean; avatarUrl: string }>("profile.image-upload", { token, base64, mimeType });
}

export function deleteMemberProfileImage(token: string) {
  return callMemberGateway<{ success: boolean }>("profile.image-delete", { token });
}

export async function resolveMemberIdentities(token: string, references: MemberIdentityReference[]) {
  const data = await callMemberGateway<{ identities: Record<string, MemberIdentity> }>("profile.identities", { token, references });
  return data.identities;
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

export type AppRole = "general_user" | "service_manager" | "hod" | "admin" | "super_admin";
export type RoleRecord = { email: string; role: AppRole; department: string | null; isActive: boolean; updatedAt: string };
export type ServiceAssignment = { id: string; serviceDate: string; service: string; managerEmail: string; accessStartsAt: string; accessEndsAt: string; status: string };

export async function listRoleManagerData() {
  return callMemberGateway<{ roles: RoleRecord[]; assignments: ServiceAssignment[] }>("roles.list");
}

export function resolveUserAccess(email: string) {
  return callMemberGateway<{ role: AppRole; department: string | null; assignments: ServiceAssignment[] }>("roles.resolve", { email });
}

export function upsertRole(input: { email: string; role: AppRole; department?: string }) {
  return callMemberGateway<{ success: boolean }>("roles.upsert", input);
}

export function removeRole(email: string) {
  return callMemberGateway<{ success: boolean }>("roles.remove", { email });
}

export function upsertServiceAssignment(input: { id?: string; serviceDate: string; service: string; managerEmail: string; accessStartsAt: string; accessEndsAt: string }) {
  return callMemberGateway<{ success: boolean }>("assignments.upsert", input);
}

export function removeServiceAssignment(id: string) {
  return callMemberGateway<{ success: boolean }>("assignments.remove", { id });
}
