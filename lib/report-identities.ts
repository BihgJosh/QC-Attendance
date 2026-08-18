import "server-only";

import { MemberIdentity, MemberIdentityReference, resolveMemberIdentities } from "@/lib/member-store";

type Json = Record<string, unknown>;

export function identityKey(reference: MemberIdentityReference) {
  return String(reference.email || "").trim().toLowerCase() || String(reference.name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export async function identityMap(token: string, references: MemberIdentityReference[]): Promise<Record<string, MemberIdentity>> {
  const indexed = new Map<string, MemberIdentityReference>();
  for (const reference of references) {
    const key = identityKey(reference);
    if (key) indexed.set(key, reference);
  }
  const unique = [...indexed.values()];
  return unique.length ? resolveMemberIdentities(token, unique) : {};
}

function reference(value: unknown, nameKey: string, emailKey: string): MemberIdentityReference {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
  return { name: String(record[nameKey] || ""), email: String(record[emailKey] || "") };
}

export async function attachDashboardIdentities(token: string, data: Json) {
  const timer = data.timer && typeof data.timer === "object" && !Array.isArray(data.timer) ? data.timer as Json : null;
  const observer = data.observer && typeof data.observer === "object" && !Array.isArray(data.observer) ? data.observer as Json : null;
  const emergencies = Array.isArray(data.emergencies) ? data.emergencies.filter((item): item is Json => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
  const postReporters = Array.isArray(data.postReporters) ? data.postReporters.filter((item): item is Json => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
  const emergencyReference = (item: Json): MemberIdentityReference => ({ name: String(item.reportedBy || item.reported_by || ""), email: String(item.reporterEmail || item.reporter_email || "") });
  const refs = [
    ...(timer ? [reference(timer, "timerName", "reporterEmail")] : []),
    ...(observer ? [reference(observer, "observerName", "reporterEmail")] : []),
    ...emergencies.map(emergencyReference),
    ...postReporters.map((item) => reference(item, "name", "email")),
  ];
  const identities = await identityMap(token, refs);
  const attach = (item: Json, ref: MemberIdentityReference): Json & { identity?: MemberIdentity } => ({ ...item, identity: identities[identityKey(ref)] });
  return {
    ...data,
    timer: timer ? attach(timer, reference(timer, "timerName", "reporterEmail")) : null,
    observer: observer ? attach(observer, reference(observer, "observerName", "reporterEmail")) : null,
    emergencies: emergencies.map((item) => attach(item, emergencyReference(item))),
    postReporters: postReporters.map((item) => attach(item, reference(item, "name", "email"))),
  };
}
