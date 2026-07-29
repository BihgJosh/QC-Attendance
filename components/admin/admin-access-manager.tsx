"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2, MailPlus, RefreshCcw, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AdminAccess = { email: string; createdAt: string | null; isProtected: boolean };

function formatDate(value: string | null) {
  if (!value) return "Primary administrator";
  return `Added ${new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" }).format(new Date(value))}`;
}

export function AdminAccessManager() {
  const [admins, setAdmins] = useState<AdminAccess[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/access", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAdmins(data.admins);
    } catch (error) {
      toast.error((error as Error).message || "Could not load administrators.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(`${email.trim().toLowerCase()} now has admin access.`);
      setEmail("");
      await load();
    } catch (error) {
      toast.error((error as Error).message || "Could not add admin access.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(emailToRemove: string) {
    if (confirming !== emailToRemove) {
      setConfirming(emailToRemove);
      return;
    }
    setRemoving(emailToRemove);
    try {
      const response = await fetch("/api/admin/access", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToRemove }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(`${emailToRemove} no longer has admin access.`);
      setConfirming(null);
      await load();
    } catch (error) {
      toast.error((error as Error).message || "Could not remove admin access.");
    } finally {
      setRemoving(null);
    }
  }

  return <div className="space-y-6">
    <div className="overflow-hidden rounded-[2rem] bg-[linear-gradient(125deg,#07152f,#24315f_52%,#146079)] p-6 text-white shadow-xl sm:p-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Admin permissions</p><h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Admin access</h2><p className="mt-2 max-w-2xl text-sm text-white/60">Allow trusted member emails to open the admin dashboard. Removing an email signs that administrator out immediately.</p></div>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10"><UserCog className="h-6 w-6 text-cyan-300" /></div>
      </div>
    </div>

    <Card variant="glass">
      <CardHeader><CardTitle>Add an administrator</CardTitle><CardDescription>They will use member sign-in and must replace the temporary password with a private one.</CardDescription></CardHeader>
      <CardContent><form onSubmit={add} className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1 space-y-2"><Label htmlFor="admin-email">Email address</Label><Input id="admin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" required /></div><Button type="submit" variant="gradient" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailPlus className="mr-2 h-4 w-4" />}Add admin</Button></form></CardContent>
    </Card>

    <Card variant="glass">
      <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Administrators</CardTitle><CardDescription>{admins.length} email{admins.length === 1 ? "" : "s"} can access the dashboard</CardDescription></div><Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></CardHeader>
      <CardContent>{loading ? <div className="grid min-h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : <div className="grid gap-3">{admins.map((admin) => <article key={admin.email} className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/45 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{admin.email}</p>{admin.isProtected && <Badge variant="default"><ShieldCheck className="mr-1 h-3 w-3" />Protected</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{formatDate(admin.createdAt)}</p></div><div className="flex shrink-0 gap-2">{confirming === admin.email && <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>Cancel</Button>}<Button variant={confirming === admin.email ? "destructive" : "outline"} size="sm" disabled={admin.isProtected || removing === admin.email} onClick={() => remove(admin.email)}>{removing === admin.email ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}{admin.isProtected ? "Primary admin" : confirming === admin.email ? "Confirm removal" : "Remove"}</Button></div></article>)}</div>}</CardContent>
    </Card>
  </div>;
}
