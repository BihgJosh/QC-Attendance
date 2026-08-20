"use client";

import { ChevronDown, Mail, MapPin } from "lucide-react";
import { IdentityAvatar } from "@/components/member/member-identity";
import { postingMemberKey, type Posting, type PostingMember, type ServiceDay } from "@/lib/homepage-content";
import type { MemberIdentity } from "@/lib/member-store";

const SUNDAY_SERVICES = [
  { token: "1st", label: "First Service" },
  { token: "2nd", label: "Second Service" },
  { token: "3rd", label: "Third Service" },
  { token: "4th", label: "Fourth Service" },
];

function servicesForDay(day: ServiceDay) {
  return day === "Sunday" ? SUNDAY_SERVICES : [{ token: "thursday", label: "Thursday Service" }];
}

function appliesToService(rowLabel: string, token: string) {
  const normalized = rowLabel.toLowerCase();
  return token === "thursday" ? normalized.includes("thursday") : normalized.includes(token);
}

function MemberPass({ member, identity, loading }: { member: PostingMember; identity?: MemberIdentity; loading: boolean }) {
  const displayName = identity?.name || member.name;
  const email = identity?.email || member.email;

  return (
    <li className="relative min-w-0 overflow-hidden rounded-2xl bg-white p-3 text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,.08),0_12px_28px_-22px_rgba(15,23,42,.7)]">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-cyan-500" />
      <div className="flex min-w-0 items-center gap-3 pl-1">
        <IdentityAvatar identity={identity} name={displayName} size="md" />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-extrabold tracking-tight">{displayName}</p>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-600">
            <Mail className="h-3 w-3 shrink-0 text-cyan-700" />
            <span className="break-all">{email || (loading ? "Loading profile…" : "Email unavailable")}</span>
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">QC</span>
      </div>
    </li>
  );
}

export function PostingBoard({ postings, day, identities, identitiesLoading }: {
  postings: Posting[];
  day: ServiceDay;
  identities: Record<string, MemberIdentity>;
  identitiesLoading: boolean;
}) {
  return (
    <div className="relative mt-8 space-y-3">
      {servicesForDay(day).map((service, serviceIndex) => {
        const locations = postings.flatMap((posting) => {
          const rows = posting.rows.filter((row) => appliesToService(row.label, service.token));
          const assignmentCount = rows.reduce((total, row) => total + row.assignments.reduce((rowTotal, names) => rowTotal + names.length, 0), 0);
          return assignmentCount ? [{ posting, rows, assignmentCount }] : [];
        });
        const totalAssignments = locations.reduce((total, location) => total + location.assignmentCount, 0);

        return (
          <details key={service.token} open={serviceIndex === 0} className="group overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-inset ring-white/10">
            <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 px-4 py-3 transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300 sm:px-5 [&::-webkit-details-marker]:hidden">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300 text-sm font-black text-cyan-950">{serviceIndex + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{service.label}</span>
                <span className="mt-0.5 block text-xs text-white/55">{totalAssignments ? `${totalAssignments} ${totalAssignments === 1 ? "assignment" : "assignments"} across ${locations.length} ${locations.length === 1 ? "location" : "locations"}` : "Awaiting assignments"}</span>
              </span>
              <ChevronDown className="h-5 w-5 shrink-0 text-cyan-200 transition-transform duration-200 group-open:rotate-180" />
            </summary>

            <div className="border-t border-white/10 p-3 sm:p-5">
              {locations.length ? (
                <div className="space-y-5">
                  {locations.map(({ posting, rows }) => (
                    <section key={posting.id} aria-labelledby={`${service.token}-${posting.id}`}>
                      <div className="mb-3 flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                        <div>
                          <h3 id={`${service.token}-${posting.id}`} className="text-sm font-bold">{posting.name}</h3>
                          <p className="mt-0.5 text-xs text-white/50">{posting.role}</p>
                        </div>
                      </div>
                      <div className="space-y-4 pl-0 sm:pl-6">
                        {rows.map((row) => (
                          <div key={row.id} className="space-y-3">
                            {rows.length > 1 || row.label.toLowerCase().includes("&") ? <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/65">Applies to {row.label}</p> : null}
                            <div className="grid gap-3 lg:grid-cols-2">
                              {posting.columns.map((column, columnIndex) => {
                                const members = row.assignments[columnIndex] || [];
                                if (!members.length) return null;
                                return (
                                  <div key={`${row.id}-${column}`} className="min-w-0">
                                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200">{column}</p>
                                    <ul className="grid gap-2">
                                      {members.map((member, memberIndex) => (
                                        <MemberPass key={`${postingMemberKey(member)}-${memberIndex}`} member={member} identity={identities[postingMemberKey(member)]} loading={identitiesLoading} />
                                      ))}
                                    </ul>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-white/[0.04] px-4 py-5 text-sm text-white/55">No members have been assigned to this service yet.</p>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
