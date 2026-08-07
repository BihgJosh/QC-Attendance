const fs = require("node:fs");

function loadEnv(path) {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(fs.readFileSync(path, "utf8").split(/\r?\n/).flatMap((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) return [];
    const index = line.indexOf("=");
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return [[line.slice(0, index).trim(), value.replace(/\\n/g, "\n")]];
  }));
}

async function main() {
  const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
  const call = async (operation, payload = {}) => {
    const response = await fetch(`${env.SUPABASE_URL}/functions/v1/qcu-attendance`, { method: "POST", headers: { "Content-Type": "application/json", apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, "x-qcu-operation-secret": env.SUPABASE_GATEWAY_SECRET }, body: JSON.stringify({ operation, ...payload }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${operation} failed (${response.status}): ${body.error || "unknown error"}`);
    return body;
  };
  const list = await call("member.list");
  const status = await call("member.status", { email: list.members[0]?.email || "nobody@example.com" });
  const protectedEmail = list.members[0]?.email;
  let existingCredentialProtected = false;
  if (protectedEmail) {
    const response = await fetch(`${env.SUPABASE_URL}/functions/v1/qcu-attendance`, { method: "POST", headers: { "Content-Type": "application/json", apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, "x-qcu-operation-secret": env.SUPABASE_GATEWAY_SECRET }, body: JSON.stringify({ operation: "member.setup-complete", email: protectedEmail, password: "OverwriteBlocked1", rememberMe: false }) });
    existingCredentialProtected = response.status === 409;
  }
  console.log(JSON.stringify({ memberListOk: Array.isArray(list.members), privateCredentialCount: list.members.length, memberStatusOk: typeof status.hasPrivatePassword === "boolean", existingCredentialProtected }));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
