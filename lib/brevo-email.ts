import "server-only";

import { getOptionalEnv } from "@/lib/env";

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

export async function sendBrevoEmail(input: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = getOptionalEnv("BREVO_API_KEY");
  const senderEmail = getOptionalEnv("BREVO_SENDER_EMAIL");
  const senderName = getOptionalEnv("BREVO_SENDER_NAME") || "QC Unit";
  const replyTo = getOptionalEnv("BREVO_REPLY_TO_EMAIL");
  if (!apiKey || !senderEmail) {
    throw new EmailConfigurationError("Email delivery is not configured. Add the Brevo API key and verified sender email.");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: input.to }],
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
      subject: input.subject,
      htmlContent: input.html,
    }),
  });
  const result = await response.json().catch(() => ({})) as { messageId?: unknown; message?: unknown };
  if (!response.ok || typeof result.messageId !== "string") {
    const detail = typeof result.message === "string" ? result.message : "Brevo rejected the email request.";
    throw new Error(detail);
  }
  return { messageId: result.messageId };
}
