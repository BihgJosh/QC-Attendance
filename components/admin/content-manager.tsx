"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BellRing, ChevronDown, ChevronUp, ImagePlus, Loader2, Mail, Megaphone, Plus, RotateCcw, Save, Search, Shirt, Table2, Trash2, Upload, UserRound, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBlankDayPostings, DEFAULT_HOMEPAGE_CONTENT, SERVICE_DAYS, type HomepageContent, type PostingMember, type ServiceDay } from "@/lib/homepage-content";

type PostingDirectoryMember = { name: string; email: string };

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createNewPosting(day: ServiceDay) {
  const id = newId("posting");
  return {
    id: `${day.toLowerCase()}-${id}`,
    day,
    name: "New section",
    role: "Section responsibility",
    columns: ["Team"],
    rows: (day === "Sunday" ? ["1st Service", "2nd Service", "3rd Service", "4th Service"] : ["Thursday Service"]).map((label, index) => ({
      id: `${id}-row-${index + 1}`,
      label,
      assignments: [[]],
    })),
  };
}

function comparableName(value: string) {
  return value.toLowerCase().replace(/\b(?:bro|brother|sis|sister|mr|mrs|miss|ms|pst|pastor)\.?\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function linkLegacyMembers(content: HomepageContent, directory: PostingDirectoryMember[]): HomepageContent {
  return {
    ...content,
    postings: content.postings.map((posting) => ({
      ...posting,
      rows: posting.rows.map((row) => ({
        ...row,
        assignments: row.assignments.map((members) => members.map((member) => {
          if (member.email) return member;
          const target = comparableName(member.name);
          const targetTokens = target.split(" ").filter(Boolean);
          const matches = targetTokens.length ? directory.filter((candidate) => {
            const candidateName = comparableName(candidate.name);
            if (candidateName === target) return true;
            const candidateTokens = candidateName.split(" ");
            return targetTokens.every((token) => candidateTokens.includes(token));
          }) : [];
          return matches.length === 1 ? matches[0] : member;
        })),
      })),
    })),
  };
}

export function ContentManager() {
  const [content, setContent] = useState<HomepageContent>(DEFAULT_HOMEPAGE_CONTENT);
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<"announcements" | "postings" | "uniform" | null>(null);
  const [notifyingSection, setNotifyingSection] = useState<"announcements" | "postings" | "uniform" | null>(null);
  const [openPanel, setOpenPanel] = useState<"announcements" | "postings" | "uniform">("announcements");
  const [postingDay, setPostingDay] = useState<ServiceDay>("Sunday");
  const [uploadingUniformImage, setUploadingUniformImage] = useState(false);
  const [postingMembers, setPostingMembers] = useState<PostingDirectoryMember[]>([]);
  const [postingMembersLoading, setPostingMembersLoading] = useState(true);
  const [postingMembersError, setPostingMembersError] = useState("");
  const [confirmResetPostings, setConfirmResetPostings] = useState(false);

  useEffect(() => {
    const loadContent = fetch("/api/content").then(async (response) => {
      if (!response.ok) throw new Error("Homepage content could not be loaded.");
      return response.json() as Promise<HomepageContent>;
    });
    const loadMembers = fetch("/api/admin/posting-members", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Team directory unavailable.");
      return data.members as PostingDirectoryMember[];
    });

    Promise.allSettled([loadContent, loadMembers]).then(([contentResult, membersResult]) => {
      const members = membersResult.status === "fulfilled" ? membersResult.value : [];
      if (membersResult.status === "fulfilled") {
        setPostingMembers(members);
        setPostingMembersError("");
      } else {
        setPostingMembersError(membersResult.reason instanceof Error ? membersResult.reason.message : "Team directory unavailable.");
      }
      if (contentResult.status === "fulfilled") setContent(linkLegacyMembers(contentResult.value, members));
      else toast.error("Homepage content could not be loaded.");
    }).finally(() => {
      setLoading(false);
      setPostingMembersLoading(false);
    });
  }, []);

  const saveSection = async (section: "announcements" | "postings" | "uniform") => {
    if (section === "postings") {
      const unresolved = content.postings
        .filter((posting) => posting.day === postingDay)
        .flatMap((posting) => posting.rows.flatMap((row) => row.assignments.flat()))
        .filter((member) => !member.email);
      if (unresolved.length) {
        toast.error(`${unresolved.length} posting ${unresolved.length === 1 ? "entry is" : "entries are"} not linked to a team profile. Remove and reselect ${unresolved.length === 1 ? "it" : "them"} before saving.`);
        return false;
      }
    }
    setSavingSection(section);
    try {
      const sectionContent = section === "announcements"
        ? { section, announcements: content.announcements }
        : section === "postings"
          ? { section, day: postingDay, postings: content.postings.filter((posting) => posting.day === postingDay) }
          : { section, uniformItems: content.uniformItems, uniformNote: content.uniformNote, uniformImageUrl: content.uniformImageUrl };
      const response = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sectionContent),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Publishing failed");
      setContent(data.content);
      toast.success(`${section === "uniform" ? "Uniform" : section[0].toUpperCase() + section.slice(1)} saved to the homepage.`);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This section could not be saved.");
      return false;
    } finally {
      setSavingSection(null);
    }
  };

  const panels = [
    { id: "announcements" as const, label: "Announcements", icon: Megaphone, count: content.announcements.length },
    { id: "postings" as const, label: "Postings", icon: Users, count: content.postings.filter((posting) => posting.day === postingDay).length },
    { id: "uniform" as const, label: "Uniform", icon: Shirt, count: content.uniformItems.length },
  ];

  const notifySection = async (section: "announcements" | "postings" | "uniform") => {
    setNotifyingSection(section);
    try {
      if (!(await saveSection(section))) return;
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, day: postingDay }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Notification failed");
      toast.success(`Team notified on ${data.delivered} device${data.delivered === 1 ? "" : "s"}.`);
      if (data.failed > 0) toast.warning(`${data.failed} device notification${data.failed === 1 ? "" : "s"} could not be delivered.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The team could not be notified.");
    } finally {
      setNotifyingSection(null);
    }
  };

  const uploadImage = async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("Use a JPG, PNG or WebP image.");
    if (file.size > 3 * 1024 * 1024) return toast.error("The image must be smaller than 3 MB.");
    setUploadingUniformImage(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const response = await fetch("/api/admin/uniform-image", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      setContent((current) => ({ ...current, uniformImageUrl: data.url }));
      toast.success("Image uploaded. Save the uniform section to publish it.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The image could not be uploaded.");
    } finally {
      setUploadingUniformImage(false);
    }
  };

  const removeImage = async () => {
    setUploadingUniformImage(true);
    try {
      const response = await fetch("/api/admin/uniform-image", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Removal failed.");
      setContent((current) => ({ ...current, uniformImageUrl: "" }));
      toast.success("Image removed. Save the uniform section to update the homepage.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The image could not be removed.");
    } finally {
      setUploadingUniformImage(false);
    }
  };

  if (loading) {
    return <Card variant="glass"><CardContent className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></CardContent></Card>;
  }

  return (
    <Card variant="glass" id="homepage-content" className="overflow-hidden">
      <CardHeader className="border-b border-border/60 bg-gradient-to-r from-primary/[0.07] to-accent/[0.07]">
        <div>
            <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> Homepage publishing desk</CardTitle>
            <CardDescription className="mt-1">Edit each part of the homepage brief and save that section when it is ready.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid border-b border-slate-400/30 bg-[linear-gradient(110deg,rgba(15,23,42,0.08),rgba(14,165,233,0.07)_48%,rgba(126,34,206,0.08))] dark:border-white/10 dark:bg-[linear-gradient(110deg,rgba(2,12,32,0.72),rgba(26,20,69,0.68)_58%,rgba(74,20,96,0.64))] sm:grid-cols-3">
          {panels.map((panel) => {
            const Icon = panel.icon;
            const active = openPanel === panel.id;
            return (
              <button key={panel.id} type="button" onClick={() => setOpenPanel(panel.id)} className={`flex items-center justify-between border-b border-slate-400/30 px-5 py-4 text-left transition-colors last:border-b-0 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:border-b-0 sm:border-r sm:last:border-r-0 dark:border-white/10 ${active ? "bg-primary/20 text-primary shadow-[inset_0_-3px_0_hsl(var(--primary))] dark:bg-primary/25 dark:text-cyan-200" : "text-foreground/85 hover:bg-slate-900/[0.07] dark:text-white/75 dark:hover:bg-white/[0.07]"}`}>
                <span className="flex items-center gap-3"><Icon className="h-4 w-4" /><span className="text-sm font-semibold">{panel.label}</span></span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${active ? "border-primary/25 bg-background/90 text-primary dark:bg-slate-950/45 dark:text-cyan-200" : "border-slate-300/60 bg-background/75 text-foreground/65 dark:border-white/10 dark:bg-slate-950/35 dark:text-white/60"}`}>{panel.count}</span>
              </button>
            );
          })}
        </div>

        <div className="p-5 sm:p-6">
          {openPanel === "announcements" && (
            <div className="space-y-4">
              {content.announcements.map((announcement, index) => (
                <div key={announcement.id} className="grid gap-3 rounded-2xl border border-border/70 bg-background/50 p-4 md:grid-cols-[0.6fr_1fr_1.5fr_auto]">
                  <Field label="Label"><Input value={announcement.date} maxLength={60} onChange={(event) => setContent({ ...content, announcements: content.announcements.map((item, itemIndex) => itemIndex === index ? { ...item, date: event.target.value } : item) })} /></Field>
                  <Field label="Title"><Input value={announcement.title} maxLength={120} onChange={(event) => setContent({ ...content, announcements: content.announcements.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) })} /></Field>
                  <Field label="Announcement"><Input value={announcement.copy} maxLength={500} onChange={(event) => setContent({ ...content, announcements: content.announcements.map((item, itemIndex) => itemIndex === index ? { ...item, copy: event.target.value } : item) })} /></Field>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${announcement.title}`} className="self-end text-destructive" onClick={() => setContent({ ...content, announcements: content.announcements.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <div className="flex flex-col-reverse justify-between gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center">
                <Button type="button" variant="outline" onClick={() => setContent({ ...content, announcements: [...content.announcements, { id: newId("announcement"), date: "New notice", title: "Announcement title", copy: "Add the announcement details here.", accent: "primary" }] })}><Plus className="mr-2 h-4 w-4" /> Add announcement</Button>
                <SectionActions section="announcements" saveLabel="Save announcements" saving={savingSection === "announcements"} notifying={notifyingSection === "announcements"} disabled={savingSection !== null || notifyingSection !== null} onSave={() => saveSection("announcements")} onNotify={() => notifySection("announcements")} />
              </div>
            </div>
          )}

          {openPanel === "postings" && (
            <div className="space-y-4">
              <div className="flex flex-col justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] p-4 sm:flex-row sm:items-center">
                <div>
                  <Label htmlFor="posting-service-day" className="text-[10px] uppercase tracking-[0.16em] text-primary">Service day</Label>
                  <p className="mt-1 text-xs text-muted-foreground">Sunday and Thursday assignments are stored independently.</p>
                </div>
                <select id="posting-service-day" value={postingDay} onChange={(event) => { setPostingDay(event.target.value as ServiceDay); setConfirmResetPostings(false); }} className="h-11 min-w-48 rounded-xl border border-input bg-background px-4 text-sm font-semibold outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20">
                  {SERVICE_DAYS.map((day) => <option key={day} value={day}>{day} service</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/55 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold">Standard posting template</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Clear this {postingDay} draft and restore the standard locations, services and roles. Nothing changes on the homepage until you save.</p>
                </div>
                {confirmResetPostings ? (
                  <div className="flex shrink-0 flex-wrap gap-2" role="group" aria-label="Confirm posting reset">
                    <Button type="button" variant="ghost" onClick={() => setConfirmResetPostings(false)}>Cancel</Button>
                    <Button type="button" variant="destructive" onClick={() => {
                      setContent((current) => ({ ...current, postings: [...current.postings.filter((posting) => posting.day !== postingDay), ...createBlankDayPostings(postingDay)] }));
                      setConfirmResetPostings(false);
                      toast.success(`${postingDay} draft cleared. Add members, then save to publish it.`);
                    }}><RotateCcw className="mr-2 h-4 w-4" />Clear draft</Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" className="shrink-0 text-destructive hover:bg-destructive/5" onClick={() => setConfirmResetPostings(true)}><RotateCcw className="mr-2 h-4 w-4" />Clear & start new</Button>
                )}
              </div>

              {postingMembersError ? <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{postingMembersError} Name suggestions are unavailable; existing assignments remain safe.</p> : null}

              {content.postings.filter((posting) => posting.day === postingDay).map((posting) => (
                <PostingMatrixEditor key={posting.id} posting={posting} members={postingMembers} membersLoading={postingMembersLoading} onChange={(nextPosting) => setContent({ ...content, postings: content.postings.map((item) => item.id === posting.id ? nextPosting : item) })} onDelete={() => setContent({ ...content, postings: content.postings.filter((item) => item.id !== posting.id) })} />
              ))}
              <div className="flex flex-col-reverse justify-between gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center">
                <Button type="button" variant="outline" onClick={() => setContent({ ...content, postings: [...content.postings, createNewPosting(postingDay)] })}><Plus className="mr-2 h-4 w-4" /> Add {postingDay} section</Button>
                <SectionActions section="postings" saveLabel={`Save ${postingDay} postings`} saving={savingSection === "postings"} notifying={notifyingSection === "postings"} disabled={savingSection !== null || notifyingSection !== null} onSave={() => saveSection("postings")} onNotify={() => notifySection("postings")} />
              </div>
            </div>
          )}

          {openPanel === "uniform" && (
            <div className="space-y-5">
              <div className="grid gap-4 rounded-2xl border border-primary/20 bg-primary/[0.05] p-4 lg:grid-cols-[16rem_1fr] lg:items-center">
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-border bg-background/70">
                  {content.uniformImageUrl ? <img src={content.uniformImageUrl} alt="Uniform upload preview" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <ImagePlus className="h-10 w-10 text-muted-foreground" />}
                </div>
                <div>
                  <p className="font-semibold">Uniform reference picture</p>
                  <p className="mt-1 text-sm text-muted-foreground">Upload a clear JPG, PNG or WebP image up to 3 MB. Members will see it in the uniform section.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild type="button" variant="outline" disabled={uploadingUniformImage}>
                      <label className="cursor-pointer"><Upload className="mr-2 h-4 w-4" /> {uploadingUniformImage ? "Working…" : "Choose image"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploadingUniformImage} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); event.target.value = ""; }} /></label>
                    </Button>
                    {content.uniformImageUrl && <Button type="button" variant="ghost" className="text-destructive" disabled={uploadingUniformImage} onClick={() => void removeImage()}><Trash2 className="mr-2 h-4 w-4" /> Remove image</Button>}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {content.uniformItems.map((item, index) => (
                  <div key={index} className="flex items-end gap-2 rounded-2xl border border-border/70 bg-background/50 p-4">
                    <Field label={`Uniform item ${index + 1}`}><Input value={item} maxLength={150} onChange={(event) => { const value = event.target.value; setContent((current) => ({ ...current, uniformItems: current.uniformItems.map((uniformItem, itemIndex) => itemIndex === index ? value : uniformItem) })); }} /></Field>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Delete uniform item ${index + 1}`} className="shrink-0 text-destructive" onClick={() => setContent({ ...content, uniformItems: content.uniformItems.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" onClick={() => setContent({ ...content, uniformItems: [...content.uniformItems, "New uniform item"] })}><Plus className="mr-2 h-4 w-4" /> Add uniform item</Button>
              <Field label="Additional uniform note"><Input value={content.uniformNote} maxLength={300} onChange={(event) => setContent({ ...content, uniformNote: event.target.value })} /></Field>
              <div className="flex justify-end border-t border-border/60 pt-4">
                <SectionActions section="uniform" saveLabel="Save uniform" saving={savingSection === "uniform"} notifying={notifyingSection === "uniform"} disabled={savingSection !== null || notifyingSection !== null} onSave={() => saveSection("uniform")} onNotify={() => notifySection("uniform")} />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PostingMatrixEditor({ posting, members, membersLoading, onChange, onDelete }: { posting: HomepageContent["postings"][number]; members: PostingDirectoryMember[]; membersLoading: boolean; onChange: (posting: HomepageContent["postings"][number]) => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(posting.id.endsWith("main-auditorium"));

  const updateCell = (rowIndex: number, columnIndex: number, value: PostingMember[]) => {
    onChange({
      ...posting,
      rows: posting.rows.map((row, currentRow) => currentRow === rowIndex
        ? { ...row, assignments: row.assignments.map((assignedMembers, currentColumn) => currentColumn === columnIndex ? value : assignedMembers) }
        : row),
    });
  };

  const addColumn = () => onChange({
    ...posting,
    columns: [...posting.columns, `Position ${posting.columns.length + 1}`],
    rows: posting.rows.map((row) => ({ ...row, assignments: [...row.assignments, []] })),
  });

  const removeColumn = (columnIndex: number) => {
    if (posting.columns.length === 1) return;
    onChange({
      ...posting,
      columns: posting.columns.filter((_, index) => index !== columnIndex),
      rows: posting.rows.map((row) => ({ ...row, assignments: row.assignments.filter((_, index) => index !== columnIndex) })),
    });
  };

  const addRow = () => onChange({
    ...posting,
    rows: [...posting.rows, {
      id: newId(`${posting.id}-row`),
      label: `Service ${posting.rows.length + 1}`,
      assignments: posting.columns.map(() => []),
    }],
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/50 shadow-sm">
      <div className="grid items-end gap-3 bg-gradient-to-r from-slate-950/[0.03] to-primary/[0.06] p-4 md:grid-cols-[1fr_auto_auto]">
        <Field label="Posting location"><Input value={posting.name} maxLength={100} onChange={(event) => onChange({ ...posting, name: event.target.value })} /></Field>
        <div className="flex items-center justify-end gap-1 md:contents">
          <Button type="button" variant="ghost" size="icon" aria-label={expanded ? `Collapse ${posting.name}` : `Expand ${posting.name}`} onClick={() => setExpanded((value) => !value)}>{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
          <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${posting.name}`} className="text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-border/60 p-4">
              <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="flex items-center gap-2 text-sm font-bold"><Table2 className="h-4 w-4 text-primary" /> Service teamsheet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Search the official team list. Every selection carries the member&apos;s name and email to the homepage profile card.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus className="mr-1.5 h-3.5 w-3.5" /> Add service</Button>
                  <Button type="button" variant="outline" size="sm" onClick={addColumn}><Plus className="mr-1.5 h-3.5 w-3.5" /> Add role</Button>
                </div>
              </div>

              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:hidden">Swipe horizontally to view every role</p>
              <div className="overflow-x-auto rounded-xl border border-border/70">
                <table className="w-full min-w-[680px] border-collapse text-left">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      <th className="w-40 border-r border-white/10 px-3 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200">Service / Shift</th>
                      {posting.columns.map((column, columnIndex) => (
                        <th key={`${posting.id}-${columnIndex}`} className="min-w-48 border-r border-white/10 p-2 last:border-r-0">
                          <div className="flex items-center gap-1.5">
                            <Input aria-label={`${posting.name} role ${columnIndex + 1}`} value={column} maxLength={60} onChange={(event) => onChange({ ...posting, columns: posting.columns.map((item, index) => index === columnIndex ? event.target.value : item) })} className="h-9 border-white/15 bg-white/10 text-xs font-bold text-white placeholder:text-white/40" />
                            <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${column} role`} disabled={posting.columns.length === 1} onClick={() => removeColumn(columnIndex)} className="h-8 w-8 shrink-0 text-white/50 hover:bg-white/10 hover:text-white"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {posting.rows.map((row, rowIndex) => (
                      <tr key={row.id} className="border-t border-border/70 align-top even:bg-muted/25">
                        <th className="border-r border-border/70 p-2">
                          <div className="flex items-center gap-1.5">
                            <Input aria-label={`${posting.name} service row ${rowIndex + 1}`} value={row.label} maxLength={60} onChange={(event) => onChange({ ...posting, rows: posting.rows.map((item, index) => index === rowIndex ? { ...item, label: event.target.value } : item) })} className="h-10 text-xs font-semibold" />
                            <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${row.label}`} onClick={() => onChange({ ...posting, rows: posting.rows.filter((_, index) => index !== rowIndex) })} className="h-8 w-8 shrink-0 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </th>
                        {posting.columns.map((column, columnIndex) => (
                          <td key={`${row.id}-${columnIndex}`} className="border-r border-border/70 p-2 last:border-r-0">
                            <PostingAssignmentEditor
                              label={`${posting.name}, ${row.label}, ${column}`}
                              value={row.assignments[columnIndex] || []}
                              members={members}
                              loading={membersLoading}
                              onChange={(value) => updateCell(rowIndex, columnIndex, value)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function memberInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "QC";
}

function PostingAssignmentEditor({ label, value, members, loading, onChange }: { label: string; value: PostingMember[]; members: PostingDirectoryMember[]; loading: boolean; onChange: (value: PostingMember[]) => void }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedQuery = query.trim().toLowerCase();
  const selectedEmails = new Set(value.map((member) => member.email.toLowerCase()).filter(Boolean));
  const suggestions = members
    .filter((member) => !selectedEmails.has(member.email.toLowerCase()))
    .filter((member) => !normalizedQuery || `${member.name} ${member.email}`.toLowerCase().includes(normalizedQuery))
    .slice(0, 6);
  const listId = `posting-suggestions-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`;

  const addMember = (member: PostingDirectoryMember) => {
    onChange([...value, member]);
    setQuery("");
    setFocused(false);
    setActiveIndex(0);
  };

  return (
    <div className="min-w-56 space-y-2">
      {value.length ? (
        <ul className="space-y-2">
          {value.map((member, index) => (
            <li key={`${member.email || member.name}-${index}`} className="flex min-w-0 items-center gap-2 rounded-xl border border-border/70 bg-card p-2 shadow-sm">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cyan-100 text-xs font-black text-cyan-900 ring-1 ring-inset ring-cyan-200">{memberInitials(member.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-xs font-bold">{member.name}</span>
                {member.email ? <span className="mt-0.5 flex min-w-0 items-center gap-1 break-all text-xs text-muted-foreground"><Mail className="h-3 w-3 shrink-0" />{member.email}</span> : <span className="mt-0.5 block text-xs font-semibold text-amber-700 dark:text-amber-300">Profile not linked — remove and reselect</span>}
              </span>
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Remove ${member.name} from ${label}`} onClick={() => onChange(value.filter((_, memberIndex) => memberIndex !== index))}><X className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onFocus={() => { setFocused(true); setActiveIndex(0); }}
          onBlur={() => setFocused(false)}
          onChange={(event) => { setQuery(event.target.value); setFocused(true); setActiveIndex(0); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && suggestions.length) { event.preventDefault(); setFocused(true); setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1)); }
            if (event.key === "ArrowUp" && suggestions.length) { event.preventDefault(); setFocused(true); setActiveIndex((index) => Math.max(index - 1, 0)); }
            if (event.key === "Enter" && suggestions[activeIndex]) { event.preventDefault(); addMember(suggestions[activeIndex]); }
            if (event.key === "Escape") { setFocused(false); setQuery(""); setActiveIndex(0); }
          }}
          role="combobox"
          aria-label={`Add member to ${label}`}
          aria-controls={listId}
          aria-expanded={focused && !loading && suggestions.length > 0}
          aria-autocomplete="list"
          aria-activedescendant={focused && suggestions[activeIndex] ? `${listId}-option-${activeIndex}` : undefined}
          placeholder={loading ? "Loading team members…" : "Search name or email"}
          disabled={loading || !members.length}
          className="h-11 pl-9 text-xs"
        />
        {focused && !loading && suggestions.length > 0 ? (
          <div id={listId} role="listbox" aria-label={`Suggested members for ${label}`} className="mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-[0_2px_5px_rgba(15,23,42,.08),0_20px_42px_-24px_rgba(15,23,42,.4)]">
            {suggestions.map((member, index) => (
              <button key={member.email} id={`${listId}-option-${index}`} type="button" role="option" aria-selected={activeIndex === index} onMouseEnter={() => setActiveIndex(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => addMember(member)} className={`flex min-h-12 w-full items-center gap-2 rounded-lg px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${activeIndex === index ? "bg-muted" : "hover:bg-muted"}`}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-black text-primary">{memberInitials(member.name)}</span>
                <span className="min-w-0"><span className="block truncate text-xs font-bold">{member.name}</span><span className="block truncate text-xs text-muted-foreground">{member.email}</span></span>
              </button>
            ))}
          </div>
        ) : null}
        {focused && !loading && normalizedQuery && !suggestions.length ? <p className="mt-1 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">No unselected team member matches “{query.trim()}”.</p> : null}
      </div>
    </div>
  );
}

function LegacyPostingEditor({ posting, onChange, onDelete }: { posting: HomepageContent["postings"][number] & { members?: string[] }; onChange: (posting: HomepageContent["postings"][number]) => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/50">
      <div className="grid items-end gap-3 p-4 md:grid-cols-[1fr_auto_auto]">
        <Field label="Posting location"><Input value={posting.name} maxLength={100} onChange={(event) => onChange({ ...posting, name: event.target.value })} /></Field>
        <Button type="button" variant="ghost" size="icon" aria-label={expanded ? `Collapse ${posting.name}` : `Expand ${posting.name}`} onClick={() => setExpanded((value) => !value)}>{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
        <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${posting.name}`} className="text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-border/60 p-4">
              <Label htmlFor={`members-${posting.id}`} className="text-[10px] uppercase tracking-wide text-muted-foreground">Posted members — one name per line</Label>
              <textarea id={`members-${posting.id}`} value={(posting.members || []).join("\n")} onChange={(event) => onChange({ ...posting, members: event.target.value.split("\n") })} rows={4} maxLength={5000} placeholder="Member name\nMember name" className="mt-2 min-h-28 w-full resize-y rounded-xl border border-input bg-background/60 px-4 py-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="w-full space-y-1.5"><Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}

function SaveSectionButton({ label, saving, disabled, onClick }: { label: string; saving: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <Button type="button" variant="gradient" className="min-w-44" disabled={disabled} onClick={onClick}>
      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      {saving ? "Saving…" : label}
    </Button>
  );
}

function SectionActions({ section, saveLabel, saving, notifying, disabled, onSave, onNotify }: { section: string; saveLabel: string; saving: boolean; notifying: boolean; disabled: boolean; onSave: () => void; onNotify: () => void }) {
  return <div className="flex flex-col gap-2 sm:flex-row">
    <SaveSectionButton label={saveLabel} saving={saving} disabled={disabled} onClick={onSave} />
    <Button type="button" variant="outline" className="min-w-36 border-cyan-600/40 text-cyan-800 hover:bg-cyan-50 dark:text-cyan-200 dark:hover:bg-cyan-950/40" disabled={disabled} onClick={onNotify} aria-label={`Notify team about saved ${section}`}>
      {notifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}
      {notifying ? "Notifying…" : "Notify Team"}
    </Button>
  </div>;
}
