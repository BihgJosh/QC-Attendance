"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, RefreshCcw, Search, ShieldAlert, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Member = { email: string; mustChangePassword: boolean; lastLoginAt: string | null; passwordChangedAt: string | null; resetAt: string | null; isPrivilegedAdmin?: boolean };

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(value));
}

export function MemberPasswordManager() {
  const [members, setMembers] = useState<Member[]>([]); const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState("");
  const [search, setSearch] = useState(""); const [resetting, setResetting] = useState<string | null>(null); const [confirming, setConfirming] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { const response = await fetch("/api/admin/member-passwords", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setMembers(data.members); setWarning(data.warning || ""); }
    catch (error) { toast.error((error as Error).message || "Could not load member access."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => members.filter((member) => member.email.includes(search.trim().toLowerCase())), [members, search]);
  async function reset(email: string) {
    if (confirming !== email) { setConfirming(email); return; }
    setResetting(email);
    try { const response = await fetch("/api/admin/member-passwords", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); toast.success("Private password removed. The member will verify their email and create a new one."); setConfirming(null); await load(); }
    catch (error) { toast.error((error as Error).message || "Password reset failed."); }
    finally { setResetting(null); }
  }
  return <div className="space-y-6">
    <div className="overflow-hidden rounded-[2rem] bg-[linear-gradient(125deg,#07152f,#292054_55%,#651276)] p-6 text-white shadow-xl sm:p-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Access management</p><h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Member password resets</h2><p className="mt-2 max-w-2xl text-sm text-white/60">The team sheet controls who can sign in. A reset immediately signs the member out and requires a new private password.</p></div><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10"><KeyRound className="h-6 w-6 text-cyan-300" /></div></div>
    </div>
    <Card variant="glass"><CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Team access</CardTitle><CardDescription>{members.length} email{members.length === 1 ? "" : "s"} read from the official register</CardDescription></div><Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></CardHeader><CardContent>
      <label htmlFor="member-access-search" className="sr-only">Search member email</label>
      <div className="relative mb-5"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="member-access-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search email…" className="pl-10" /></div>
      {warning && <div role="status" className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">{warning} Privileged administrators remain available.</div>}
      {loading ? <div className="grid min-h-48 place-items-center" role="status"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="sr-only">Loading team access…</span></div> : filtered.length === 0 ? <div className="grid min-h-48 place-items-center text-center"><div><UserRound className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-medium">No team email found</p><p className="mt-1 text-sm text-muted-foreground">Try a different search.</p></div></div> : <div className="grid gap-3">{filtered.map((member) => <article key={member.email} className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/45 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{member.email}</p>{member.isPrivilegedAdmin && <Badge variant="default">Protected admin</Badge>}{member.mustChangePassword ? <Badge variant="secondary"><ShieldAlert className="mr-1 h-3 w-3" />Change pending</Badge> : <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" />Password set</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">Last sign-in: {formatDate(member.lastLoginAt)} · Changed: {formatDate(member.passwordChangedAt)}</p></div>
        <div className="flex shrink-0 gap-2">{confirming === member.email && <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>Cancel</Button>}<Button variant={confirming === member.email ? "destructive" : "outline"} size="sm" onClick={() => reset(member.email)} disabled={member.isPrivilegedAdmin || resetting === member.email}>{resetting === member.email ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}{member.isPrivilegedAdmin ? "Secure recovery only" : confirming === member.email ? "Confirm reset" : "Reset password"}</Button></div>
      </article>)}</div>}
    </CardContent></Card>
  </div>;
}
