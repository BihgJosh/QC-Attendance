import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { EmailConfigurationError, sendBrevoEmail } from "@/lib/brevo-email";
import { getOptionalEnv } from "@/lib/env";
import { getConfig } from "@/lib/google-sheets";
import { DEFAULT_HOMEPAGE_CONTENT, normalizeHomepageContent, type ServiceDay } from "@/lib/homepage-content";
import { listTeamMembers } from "@/lib/team-data-store";
import { postingContentRecipients, postingEmailHtml, postingEmailIdempotencyKey, teamPostingEmailHtml, teamPostingEmailIdempotencyKey } from "@/lib/posting-email";

const CONTENT_CONFIG_KEY = "homepageContent";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json().catch(() => null) as { day?: unknown; audience?: unknown } | null;
    if (body?.day !== "Sunday" && body?.day !== "Thursday") return NextResponse.json({ error: "Select Sunday or Thursday postings." }, { status: 400 });
    if (body.audience !== undefined && body.audience !== "posted" && body.audience !== "team") return NextResponse.json({ error: "Select posted members or the full team." }, { status: 400 });
    const day = body.day as ServiceDay;
    const audience = body.audience === "team" ? "team" : "posted";
    const config = await getConfig();
    const content = config[CONTENT_CONFIG_KEY] ? normalizeHomepageContent(JSON.parse(config[CONTENT_CONFIG_KEY])) : DEFAULT_HOMEPAGE_CONTENT;
    const recipients = audience === "team"
      ? [...new Map((await listTeamMembers()).flatMap((member) => {
          const email = member.email.trim().toLowerCase();
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? [[email, { name: member.name.trim() || email, email, assignments: [] }]] : [];
        })).values()]
      : postingContentRecipients(content, day);
    if (!recipients.length) return NextResponse.json({ error: audience === "team" ? "No valid team email addresses were found." : `No ${day} assignments with linked email addresses were found.` }, { status: 409 });

    if (!getOptionalEnv("BREVO_API_KEY") || !getOptionalEnv("BREVO_SENDER_EMAIL")) {
      throw new EmailConfigurationError("Email delivery is not configured. Add the Brevo API key and verified sender email.");
    }
    const postingsUrl = "https://qcunit.vercel.app/#postings";
    const completed: Array<{ delivered: boolean; email: string; reason?: string }> = [];
    for (let offset = 0; offset < recipients.length; offset += 8) {
      completed.push(...await Promise.all(recipients.slice(offset, offset + 8).map(async (recipient) => {
        try {
          await sendBrevoEmail({
            to: recipient.email,
            subject: audience === "team" ? `${day} QC postings are now available` : `Your ${day} QC posting is ready`,
            html: audience === "team" ? teamPostingEmailHtml({ recipientName: recipient.name, day, postingsUrl }) : postingEmailHtml({ recipient, day, postingsUrl }),
            idempotencyKey: audience === "team" ? teamPostingEmailIdempotencyKey({ email: recipient.email, day }) : postingEmailIdempotencyKey({ recipient, day }),
          });
          return { delivered: true, email: recipient.email };
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Unknown error";
          console.error("[posting-emails] Delivery failed", recipient.email, reason);
          return { delivered: false, email: recipient.email, reason };
        }
      })));
    }
    const delivered = completed.filter((result) => result.delivered).length;
    const failed = completed.length - delivered;
    if (!delivered) {
      const reasons = [...new Set(completed.map((result) => result.reason).filter(Boolean))];
      const detail = reasons.length === 1 ? ` ${reasons[0]}` : " Check the email configuration and try again.";
      return NextResponse.json({ error: `No posting emails could be delivered.${detail}`, delivered, failed }, { status: 502 });
    }
    return NextResponse.json({ success: true, delivered, failed, total: completed.length });
  } catch (error) {
    const message = error instanceof EmailConfigurationError ? error.message : "Posting emails could not be sent. Please try again.";
    console.error("[posting-emails] Send failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: message }, { status: error instanceof EmailConfigurationError ? 503 : 502 });
  }
}
