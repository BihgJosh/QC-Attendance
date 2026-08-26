const fs = require("node:fs");
const crypto = require("node:crypto");

function loadEnv(path) {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(fs.readFileSync(path, "utf8").split(/\r?\n/).flatMap((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) return [];
    const equals = line.indexOf("=");
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return [[line.slice(0, equals).trim(), value]];
  }));
}

function escapeHtml(value) {
  return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

function emailHtml(name) {
  return `<div style="margin:0;background:#f7f5fb;padding:32px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <div style="max-width:620px;margin:0 auto;overflow:hidden;border:1px solid #e2e8f0;border-radius:18px;background:#ffffff;box-shadow:0 12px 30px rgba(15,23,42,.08)">
      <div style="background-color:#39A9DB;background-image:linear-gradient(135deg,#39A9DB 0%,#8E14A8 100%);padding:30px 26px;color:#ffffff">
        <p style="margin:0 0 9px;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#ffffff">Quality Control Unit</p>
        <h1 style="margin:0;font-size:26px;line-height:1.25;color:#ffffff">Urgent profile update required</h1>
      </div>
      <div style="padding:28px 26px">
        <p style="margin:0 0 16px;font-size:16px">Hello <strong>${escapeHtml(name)}</strong>,</p>
        <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#334155">Please update your profile immediately with the date you joined the Quality Control Unit. This is a required team record and should be completed without delay.</p>
        <div style="margin:22px 0;padding:15px 16px;border-left:4px solid #39A9DB;border-radius:8px;background:#EAF9FF;color:#164e63;font-size:14px;line-height:1.6">Sign in, open <strong>My Profile</strong>, answer <strong>“When did you join Quality Control?”</strong>, and save your profile.</div>
        <p style="margin:0 0 24px"><a href="https://qcunit.vercel.app/member/profile" style="display:inline-block;border-radius:10px;background-color:#8E14A8;background-image:linear-gradient(135deg,#39A9DB 0%,#8E14A8 100%);padding:13px 20px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">Update My Profile Now</a></p>
        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.55">Please complete this important update as soon as possible.</p>
      </div>
      <div style="border-top:1px solid #e2e8f0;background:#f8fafc;padding:16px 26px;text-align:center;color:#64748b;font-size:12px">QC Unit · Excellence in every detail</div>
    </div>
  </div>`;
}

async function main() {
  const send = process.argv.includes("--send");
  const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
  const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_GATEWAY_SECRET", "BREVO_API_KEY", "BREVO_SENDER_EMAIL"];
  const missing = required.filter((name) => !env[name]);
  if (missing.length) throw new Error(`Missing configuration: ${missing.join(", ")}`);

  const teamResponse = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/qcu-team-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, "x-qcu-operation-secret": env.SUPABASE_GATEWAY_SECRET },
    body: JSON.stringify({ operation: "member.list" }),
  });
  const team = await teamResponse.json().catch(() => ({}));
  if (!teamResponse.ok) throw new Error(typeof team.error === "string" ? team.error : `Team directory returned ${teamResponse.status}.`);
  const allRecipients = [...new Map((team.members || []).flatMap((member) => {
    const email = String(member.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return [];
    return [[email, { email, name: String(member.name || "QC Team Member").trim() || "QC Team Member" }]];
  })).values()];
  const start = Number(process.argv.find((argument) => argument.startsWith("--start="))?.split("=")[1] || 0);
  const limit = Number(process.argv.find((argument) => argument.startsWith("--limit="))?.split("=")[1] || allRecipients.length);
  const recipients = allRecipients.slice(start, start + limit);
  console.log(`VALID_RECIPIENTS=${allRecipients.length}`);
  console.log(`SELECTED_RECIPIENTS=${recipients.length}`);
  if (!send) { console.log("DRY_RUN=true"); return; }

  const results = [];
  for (let offset = 0; offset < recipients.length; offset += 8) {
    const batch = await Promise.all(recipients.slice(offset, offset + 8).map(async (recipient) => {
      const idempotencyKey = `qc-join-date-${crypto.createHash("sha256").update(recipient.email).digest("hex").slice(0, 20)}`;
      try {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          signal: AbortSignal.timeout(10_000),
          headers: { "Content-Type": "application/json", "api-key": env.BREVO_API_KEY },
          body: JSON.stringify({ sender: { name: env.BREVO_SENDER_NAME || "QC Unit", email: env.BREVO_SENDER_EMAIL }, to: [{ email: recipient.email }], ...(env.BREVO_REPLY_TO_EMAIL ? { replyTo: { email: env.BREVO_REPLY_TO_EMAIL } } : {}), subject: "Action Required: Update your QC join date now", htmlContent: emailHtml(recipient.name), headers: { idempotencyKey } }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok || (response.status === 400 && data.code === "duplicate_parameter")) return { delivered: true };
        return { delivered: false, reason: typeof data.message === "string" ? data.message : `HTTP ${response.status}` };
      } catch (error) { return { delivered: false, reason: error instanceof Error ? error.message : "Unknown error" }; }
    }));
    results.push(...batch);
    console.log(`PROCESSED=${Math.min(offset + 8, recipients.length)}/${recipients.length}; DELIVERED=${batch.filter((result) => result.delivered).length}; FAILED=${batch.filter((result) => !result.delivered).length}`);
  }
  const delivered = results.filter((result) => result.delivered).length;
  const failures = results.filter((result) => !result.delivered);
  console.log(`DELIVERED=${delivered}`);
  console.log(`FAILED=${failures.length}`);
  if (failures.length) {
    console.log(`FAILURE_REASONS=${[...new Set(failures.map((result) => result.reason))].join(" | ")}`);
    process.exitCode = 1;
  }
}

main().catch((error) => { console.error(`Announcement failed: ${error.message}`); process.exitCode = 1; });
