"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, ImagePlus, Loader2, Megaphone, Plus, Save, Shirt, Table2, Trash2, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_HOMEPAGE_CONTENT, SERVICE_DAYS, type HomepageContent, type ServiceDay } from "@/lib/homepage-content";

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
    rows: ["1st Service", "2nd Service", "3rd Service", "4th Service"].map((label, index) => ({
      id: `${id}-row-${index + 1}`,
      label,
      assignments: [[]],
    })),
  };
}

export function ContentManager() {
  const [content, setContent] = useState<HomepageContent>(DEFAULT_HOMEPAGE_CONTENT);
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<"announcements" | "postings" | "uniform" | null>(null);
  const [openPanel, setOpenPanel] = useState<"announcements" | "postings" | "uniform">("announcements");
  const [postingDay, setPostingDay] = useState<ServiceDay>("Sunday");
  const [uploadingUniformImage, setUploadingUniformImage] = useState(false);

  useEffect(() => {
    fetch("/api/content")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(setContent)
      .catch(() => toast.error("Homepage content could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  const saveSection = async (section: "announcements" | "postings" | "uniform") => {
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This section could not be saved.");
    } finally {
      setSavingSection(null);
    }
  };

  const panels = [
    { id: "announcements" as const, label: "Announcements", icon: Megaphone, count: content.announcements.length },
    { id: "postings" as const, label: "Postings", icon: Users, count: content.postings.filter((posting) => posting.day === postingDay).length },
    { id: "uniform" as const, label: "Uniform", icon: Shirt, count: content.uniformItems.length },
  ];

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
                <SaveSectionButton label="Save announcements" saving={savingSection === "announcements"} disabled={savingSection !== null} onClick={() => saveSection("announcements")} />
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
                <select id="posting-service-day" value={postingDay} onChange={(event) => setPostingDay(event.target.value as ServiceDay)} className="h-11 min-w-48 rounded-xl border border-input bg-background px-4 text-sm font-semibold outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20">
                  {SERVICE_DAYS.map((day) => <option key={day} value={day}>{day} service</option>)}
                </select>
              </div>

              {content.postings.filter((posting) => posting.day === postingDay).map((posting) => (
                <PostingMatrixEditor key={posting.id} posting={posting} onChange={(nextPosting) => setContent({ ...content, postings: content.postings.map((item) => item.id === posting.id ? nextPosting : item) })} onDelete={() => setContent({ ...content, postings: content.postings.filter((item) => item.id !== posting.id) })} />
              ))}
              <div className="flex flex-col-reverse justify-between gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center">
                <Button type="button" variant="outline" onClick={() => setContent({ ...content, postings: [...content.postings, createNewPosting(postingDay)] })}><Plus className="mr-2 h-4 w-4" /> Add {postingDay} section</Button>
                <SaveSectionButton label={`Save ${postingDay} postings`} saving={savingSection === "postings"} disabled={savingSection !== null} onClick={() => saveSection("postings")} />
              </div>
            </div>
          )}

          {openPanel === "uniform" && (
            <div className="space-y-5">
              <div className="grid gap-4 rounded-2xl border border-primary/20 bg-primary/[0.05] p-4 lg:grid-cols-[16rem_1fr] lg:items-center">
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-border bg-background/70">
                  {content.uniformImageUrl ? <img src={content.uniformImageUrl} alt="Uniform upload preview" className="h-full w-full object-cover" /> : <ImagePlus className="h-10 w-10 text-muted-foreground" />}
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
                  <div key={`${index}-${item}`} className="flex items-end gap-2 rounded-2xl border border-border/70 bg-background/50 p-4">
                    <Field label={`Uniform item ${index + 1}`}><Input value={item} maxLength={150} onChange={(event) => setContent({ ...content, uniformItems: content.uniformItems.map((uniformItem, itemIndex) => itemIndex === index ? event.target.value : uniformItem) })} /></Field>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Delete uniform item ${index + 1}`} className="shrink-0 text-destructive" onClick={() => setContent({ ...content, uniformItems: content.uniformItems.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" onClick={() => setContent({ ...content, uniformItems: [...content.uniformItems, "New uniform item"] })}><Plus className="mr-2 h-4 w-4" /> Add uniform item</Button>
              <Field label="Additional uniform note"><Input value={content.uniformNote} maxLength={300} onChange={(event) => setContent({ ...content, uniformNote: event.target.value })} /></Field>
              <div className="flex justify-end border-t border-border/60 pt-4">
                <SaveSectionButton label="Save uniform" saving={savingSection === "uniform"} disabled={savingSection !== null} onClick={() => saveSection("uniform")} />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PostingMatrixEditor({ posting, onChange, onDelete }: { posting: HomepageContent["postings"][number]; onChange: (posting: HomepageContent["postings"][number]) => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(posting.id.endsWith("main-auditorium"));

  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    onChange({
      ...posting,
      rows: posting.rows.map((row, currentRow) => currentRow === rowIndex
        ? { ...row, assignments: row.assignments.map((names, currentColumn) => currentColumn === columnIndex ? value.split("\n") : names) }
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
                  <p className="mt-1 text-xs text-muted-foreground">Enter one member per line in the correct service and role.</p>
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
                            <textarea aria-label={`${posting.name}, ${row.label}, ${column}`} value={(row.assignments[columnIndex] || []).join("\n")} onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)} rows={2} maxLength={2000} placeholder="Member name" className="min-h-16 w-full resize-y rounded-lg border border-input bg-background/70 px-3 py-2 text-xs leading-5 outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20" />
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
