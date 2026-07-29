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
  idempotencyKey: string;
}) {
  const apiKey = getOptionalEnv("BREVO_API_KEY");
  const senderEmail = getOptionalEnv("BREVO_SENDER_EMAIL");
  const senderName = getOptionalEnv("BREVO_SENDER_NAME") || "QC Unit";
  const replyTo = getOptionalEnv("BREVO_REPLY_TO_EMAIL");
  if (!apiKey || !senderEmail) {
    throw new EmailConfigurationError("Email delivery is not configured. Add the Brevo API key and verified sender email.");
  }

  const requestBody = JSON.stringify({
    sender: { name: senderName, email: senderEmail },
    to: [{ email: input.to }],
    ...(replyTo ? { replyTo: { email: replyTo } } : {}),
    subject: input.subject,
    htmlContent: input.html,
    headers: { idempotencyKey: input.idempotencyKey },
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(7_000),
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: requestBody,
      });
      const result = await response.json().catch(() => ({})) as {
        code?: unknown;
        messageId?: unknown;
        message?: unknown;
      };
      if (response.ok && typeof result.messageId === "string") {
        return { messageId: result.messageId };
      }
      if (response.status === 400 && result.code === "duplicate_parameter") {
        return { messageId: `idempotent:${input.idempotencyKey}` };
      }
      if ((response.status === 429 || response.status >= 500) && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }
      const detail = typeof result.message === "string" ? result.message : `Brevo rejected the email request (${response.status}).`;
      throw new Error(detail);
    } catch (error) {
      if (attempt === 0 && (error instanceof TypeError || (error instanceof Error && error.name === "TimeoutError"))) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Email delivery did not complete.");
}
