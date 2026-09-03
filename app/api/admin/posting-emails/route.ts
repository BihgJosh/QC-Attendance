import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { EmailConfigurationError, sendBrevoEmail } from "@/lib/brevo-email";
import { getOptionalEnv } from "@/lib/env";
import { getConfig } from "@/lib/google-sheets";
import { DEFAULT_HOMEPAGE_CONTENT, normalizeHomepageContent, type ServiceDay } from "@/lib/homepage-content";
import { postingContentRecipients, postingEmailHtml, postingEmailIdempotencyKey } from "@/lib/posting-email";
import { getSiteUrl } from "@/lib/site-url";

const CONTENT_CONFIG_KEY = "homepageContent";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json().catch(() => null) as { day?: unknown } | null;
    if (body?.day !== "Sunday" && body?.day !== "Thursday") return NextResponse.json({ error: "Select Sunday or Thursday postings." }, { status: 400 });
    const day = body.day as ServiceDay;
    const config = await getConfig();
    const content = config[CONTENT_CONFIG_KEY] ? normalizeHomepageContent(JSON.parse(config[CONTENT_CONFIG_KEY])) : DEFAULT_HOMEPAGE_CONTENT;
    const recipients = postingContentRecipients(content, day);
    if (!recipients.length) return NextResponse.json({ error: `No ${day} assignments with linked email addresses were found.` }, { status: 409 });

    if (!getOptionalEnv("BREVO_API_KEY") || !getOptionalEnv("BREVO_SENDER_EMAIL")) {
      throw new EmailConfigurationError("Email delivery is not configured. Add the Brevo API key and verified sender email.");
    }
    const postingsUrl = `${getSiteUrl()}/#postings`;
    const completed: Array<{ delivered: boolean; email: string; reason?: string }> = [];
    for (let offset = 0; offset < recipients.length; offset += 8) {
      completed.push(...await Promise.all(recipients.slice(offset, offset + 8).map(async (recipient) => {
        try {
          await sendBrevoEmail({ to: recipient.email, subject: `Your ${day} QC posting is ready`, html: postingEmailHtml({ recipient, day, postingsUrl }), idempotencyKey: postingEmailIdempotencyKey({ recipient, day }) });
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
