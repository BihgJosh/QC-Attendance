import "server-only";

import { createHash } from "node:crypto";
import type { HomepageContent, Posting, PostingMember, ServiceDay } from "@/lib/homepage-content";

export type PostingEmailAssignment = { location: string; service: string; position: string };
export type PostingEmailRecipient = PostingMember & { assignments: PostingEmailAssignment[] };

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] || character);
}

export function collectPostingEmailRecipients(postings: Posting[], day: ServiceDay) {
  const recipients = new Map<string, PostingEmailRecipient>();
  for (const posting of postings.filter((item) => item.day === day)) {
    for (const row of posting.rows) {
      row.assignments.forEach((members, columnIndex) => {
        for (const member of members) {
          const email = member.email.trim().toLowerCase();
          if (!email) continue;
          const recipient = recipients.get(email) || { name: member.name.trim() || email, email, assignments: [] };
          const assignment = {
            location: posting.name.trim(),
            service: row.label.trim(),
            position: posting.columns[columnIndex]?.trim() || posting.role.trim(),
          };
          if (!recipient.assignments.some((item) => item.location === assignment.location && item.service === assignment.service && item.position === assignment.position)) recipient.assignments.push(assignment);
          recipients.set(email, recipient);
        }
      });
    }
  }
  return [...recipients.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function postingEmailHtml(input: { recipient: PostingEmailRecipient; day: ServiceDay; postingsUrl: string }) {
  const rows = input.recipient.assignments.map((assignment) => `<tr><td style="padding:12px;border-bottom:1px solid #e2e8f0"><strong>${escapeHtml(assignment.location)}</strong></td><td style="padding:12px;border-bottom:1px solid #e2e8f0">${escapeHtml(assignment.service)}</td><td style="padding:12px;border-bottom:1px solid #e2e8f0">${escapeHtml(assignment.position)}</td></tr>`).join("");
  return `<div style="margin:0;background:#f7f5fb;padding:32px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <div style="max-width:620px;margin:0 auto;overflow:hidden;border:1px solid #e2e8f0;border-radius:18px;background:#ffffff;box-shadow:0 12px 30px rgba(15,23,42,.08)">
      <div style="background-color:#39A9DB;background-image:linear-gradient(135deg,#39A9DB 0%,#8E14A8 100%);padding:30px 26px;color:#ffffff">
        <p style="margin:0 0 9px;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#ffffff">Quality Control Unit</p>
        <h1 style="margin:0;font-size:26px;line-height:1.25;color:#ffffff">Your ${input.day} posting is ready</h1>
      </div>
      <div style="padding:28px 26px">
        <p style="margin:0 0 16px;font-size:16px">Hello <strong>${escapeHtml(input.recipient.name)}</strong>,</p>
        <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#334155">You have been posted for the upcoming <strong>${input.day} service</strong>. Your assignment details are below.</p>
        <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #dbeafe;border-radius:12px;font-size:14px">
          <thead><tr style="background:#EAF9FF;text-align:left;color:#164e63"><th style="padding:12px">Location</th><th style="padding:12px">Service</th><th style="padding:12px">Position</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin:22px 0;padding:15px 16px;border-left:4px solid #39A9DB;border-radius:8px;background:#EAF9FF;color:#164e63;font-size:14px;line-height:1.6">Please arrive early, confirm your post with your team lead, and remain available until handover.</div>
        <p style="margin:0 0 24px"><a href="${escapeHtml(input.postingsUrl)}" style="display:inline-block;border-radius:10px;background-color:#8E14A8;background-image:linear-gradient(135deg,#39A9DB 0%,#8E14A8 100%);padding:13px 20px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">View full postings</a></p>
        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.55">If you believe this assignment is incorrect, please contact your QC team lead.</p>
      </div>
      <div style="border-top:1px solid #e2e8f0;background:#f8fafc;padding:16px 26px;text-align:center;color:#64748b;font-size:12px">QC Unit · Excellence in every detail</div>
    </div>
  </div>`;
}

function lagosWeekKey(date = new Date()) {
  const localDate = new Date(date.toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
  const day = localDate.getDay() || 7;
  localDate.setDate(localDate.getDate() + 4 - day);
  const yearStart = new Date(localDate.getFullYear(), 0, 1);
  const week = Math.ceil((((localDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${localDate.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function postingEmailIdempotencyKey(input: { recipient: PostingEmailRecipient; day: ServiceDay }) {
  const digest = createHash("sha256").update(JSON.stringify({ week: lagosWeekKey(), day: input.day, email: input.recipient.email, assignments: input.recipient.assignments })).digest("hex").slice(0, 32);
  return `posting-${digest}`;
}

export function postingContentRecipients(content: HomepageContent, day: ServiceDay) {
  return collectPostingEmailRecipients(content.postings, day);
}
