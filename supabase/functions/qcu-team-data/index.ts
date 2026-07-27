const SECRET_HASH = "e961e32016c41f358eac3f9e1546b93d78bae0b9b30a446ccceecea47533fa41";
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

type Json = Record<string, unknown>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

async function rest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload && typeof payload.message === "string" ? payload.message : "Team data request failed.");
  return payload;
}

function profile(row: Json | undefined) {
  if (!row) return null;
  const surname = String(row.Surname || "").trim();
  const otherNames = String(row["Other Names"] || "").trim();
  return {
    email: String(row.Email || "").trim().toLowerCase(),
    name: [surname, otherNames].filter(Boolean).join(" "),
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const suppliedHash = await sha256(request.headers.get("x-qcu-operation-secret") || "");
    if (!safeEqual(suppliedHash, SECRET_HASH)) return json({ error: "Unauthorized." }, 401);
    const body = await request.json() as Json;
    const operation = String(body.operation || "");

    if (operation === "member.get") {
      const email = String(body.email || "").trim().toLowerCase();
      const rows = await rest(`Team%20Data?select=Surname,Other%20Names,Email&normalized_email=eq.${encodeURIComponent(email)}&limit=1`) as Json[];
      return json({ member: profile(rows[0]) });
    }
    if (operation === "member.list") {
      const rows = await rest("Team%20Data?select=Surname,Other%20Names,Email&order=Surname.asc") as Json[];
      return json({ members: rows.map(profile).filter(Boolean) });
    }
    if (operation === "team.import") {
      const members = Array.isArray(body.members) ? body.members.slice(0, 500) : [];
      if (!members.length) return json({ error: "No team rows supplied." }, 400);
      await rest("Team%20Data?on_conflict=normalized_email", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(members),
      });
      return json({ success: true, imported: members.length });
    }
    return json({ error: "Unknown operation." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Team data is temporarily unavailable." }, 500);
  }
});
