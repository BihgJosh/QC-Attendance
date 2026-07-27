const fs = require("node:fs");

function loadEnv(path) {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(fs.readFileSync(path, "utf8").split(/\r?\n/).flatMap((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) return [];
    const [key, ...rest] = line.split("=");
    let value = rest.join("=").trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return [[key.trim(), value.replace(/\\n/g, "\n")]];
  }));
}

async function main() {
  const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
  const response = await fetch(`${env.SUPABASE_URL}/functions/v1/qcu-team-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, "x-qcu-operation-secret": env.SUPABASE_GATEWAY_SECRET },
    body: JSON.stringify({ operation: "member.list" }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Gateway returned ${response.status}.`);
  const invalid = data.members.filter((member) => !member.email || !member.name);
  if (data.members.length === 0 || invalid.length > 0) throw new Error("Team member mappings are incomplete.");
  console.log(JSON.stringify({ members: data.members.length, completeMappings: data.members.length - invalid.length }));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
