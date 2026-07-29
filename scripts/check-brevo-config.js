const fs = require("node:fs");

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

async function brevo(path, apiKey) {
  const response = await fetch(`https://api.brevo.com/v3/${path}`, {
    headers: { "api-key": apiKey, accept: "application/json" },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof result.message === "string" ? result.message : `Brevo returned ${response.status}.`);
  return result;
}

async function main() {
  const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
  if (!env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) throw new Error("Brevo configuration is incomplete.");
  await brevo("account", env.BREVO_API_KEY);
  const result = await brevo("senders", env.BREVO_API_KEY);
  const sender = (result.senders || []).find((item) => String(item.email || "").toLowerCase() === env.BREVO_SENDER_EMAIL.toLowerCase());
  console.log(`BREVO_API_KEY_VALID=true`);
  console.log(`BREVO_SENDER_REGISTERED=${Boolean(sender)}`);
  console.log(`BREVO_SENDER_ACTIVE=${Boolean(sender?.active)}`);
}

main().catch((error) => {
  console.error(`Brevo configuration check failed: ${error.message}`);
  process.exitCode = 1;
});
