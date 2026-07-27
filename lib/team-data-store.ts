import "server-only";

import { getEnv, getSupabaseEnv } from "@/lib/env";

export type TeamMember = { email: string; name: string };

export class TeamDataError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "TeamDataError";
    this.status = status;
  }
}

async function callTeamGateway<T>(operation: "member.get" | "member.list", payload: Record<string, unknown> = {}) {
  const { url, anonKey } = getSupabaseEnv();
  const response = await fetch(`${url.replace(/\/+$/, "")}/functions/v1/qcu-team-data`, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "x-qcu-operation-secret": getEnv("SUPABASE_GATEWAY_SECRET"),
    },
    body: JSON.stringify({ operation, ...payload }),
  });
  const data = await response.json().catch(() => ({})) as { error?: unknown };
  if (!response.ok) {
    throw new TeamDataError(typeof data.error === "string" ? data.error : "Team data is temporarily unavailable.", response.status);
  }
  return data as T;
}

export async function getTeamMemberByEmail(email: string) {
  const data = await callTeamGateway<{ member: TeamMember | null }>("member.get", { email });
  return data.member;
}

export async function listTeamMembers() {
  const data = await callTeamGateway<{ members: TeamMember[] }>("member.list");
  return data.members;
}
