const GATEWAY_SECRET_HASH = "e961e32016c41f358eac3f9e1546b93d78bae0b9b30a446ccceecea47533fa41";
const allowedOperations = new Set([
  "status.get", "status.update", "settings.get", "settings.update", "members.list",
  "attendance.device-check", "attendance.insert", "attendance.list", "migration.import",
  "member.authenticate", "member.session", "member.change-password", "member.logout",
  "member.list", "member.reset",
]);

type Json = Record<string, unknown>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
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

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function rest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload.message === "string" ? payload.message : "Database request failed.";
    const error = new Error(message) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = payload && typeof payload.code === "string" ? payload.code : undefined;
    throw error;
  }
  return payload;
}

const DEFAULT_MEMBER_PASSWORD = Deno.env.get("MEMBER_DEFAULT_PASSWORD") || "QCSOJA";
const PROTECTED_BOOTSTRAP_EMAILS = new Set(["joshuaagusa001@gmail.com"]);
const PASSWORD_ITERATIONS = 210_000;
const SESSION_DAYS = 7;

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  return `pbkdf2_sha256$${PASSWORD_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(derived)}`;
}

async function verifyPassword(password: string, stored: string) {
  const [algorithm, iterationsText, saltText, expectedText] = stored.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterationsText || !saltText || !expectedText) return false;
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return false;
  const actual = await derivePassword(password, base64UrlToBytes(saltText), iterations);
  return safeEqual(bytesToBase64Url(actual), expectedText);
}

async function createMemberSession(email: string) {
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await rest("member_sessions", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ email, token_hash: tokenHash, expires_at: expiresAt }),
  });
  return token;
}

async function resolveMemberSession(tokenValue: unknown) {
  const token = String(tokenValue || "");
  if (token.length < 32) return null;
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const sessions = await rest(`member_sessions?select=email,expires_at&token_hash=eq.${encodeURIComponent(tokenHash)}&expires_at=gt.${encodeURIComponent(now)}&limit=1`) as Json[];
  if (!sessions[0]) return null;
  const email = String(sessions[0].email);
  const credentials = await rest(`member_credentials?select=email,must_change_password&email=eq.${encodeURIComponent(email)}&limit=1`) as Json[];
  if (!credentials[0]) return null;
  await rest(`member_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_seen_at: now }),
  });
  return { email, tokenHash, mustChangePassword: Boolean(credentials[0].must_change_password) };
}

function validNewPassword(password: string) {
  return password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && password !== DEFAULT_MEMBER_PASSWORD;
}

async function allRecords() {
  const records: Json[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const page = await rest(
      `attendance_records?select=attendance_date,service,member_name,attendance_time,latitude,longitude,distance_meters,status,reason,browser,device,device_id&order=id.asc&offset=${offset}&limit=${pageSize}`,
    ) as Json[];
    records.push(...page);
    if (page.length < pageSize) return records;
  }
}

function mapRecord(row: Json) {
  return {
    date: String(row.attendance_date || ""), service: String(row.service || ""),
    memberName: String(row.member_name || ""), time: String(row.attendance_time || ""),
    latitude: String(row.latitude ?? ""), longitude: String(row.longitude ?? ""),
    distance: String(row.distance_meters ?? ""), status: String(row.status || ""),
    reason: String(row.reason || ""), browser: String(row.browser || "Unknown"),
    device: String(row.device || "Unknown"), deviceId: String(row.device_id || ""),
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const body = await request.json() as Json;
    const operation = typeof body.operation === "string" ? body.operation : "";
    const suppliedHash = await sha256(request.headers.get("x-qcu-operation-secret") || "");
    const expectedHash = allowedOperations.has(operation) ? GATEWAY_SECRET_HASH : "";
    if (!expectedHash || !safeEqual(suppliedHash, expectedHash)) return json({ error: "Unauthorized." }, 401);

    if (operation === "status.get") {
      const rows = await rest("attendance_settings?select=is_open&id=eq.1&limit=1") as Json[];
      return json({ isOpen: Boolean(rows[0]?.is_open) });
    }
    if (operation === "status.update") {
      const isOpen = body.isOpen === true;
      await rest("attendance_settings?id=eq.1", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ is_open: isOpen, updated_at: new Date().toISOString() }) });
      return json({ success: true, isOpen });
    }
    if (operation === "settings.get") {
      const rows = await rest("attendance_settings?select=is_open,church_latitude,church_longitude,allowed_radius_meters,location_name,timezone_label&id=eq.1&limit=1") as Json[];
      const row = rows[0] || {};
      return json({ isOpen: Boolean(row.is_open), churchLat: String(row.church_latitude ?? ""), churchLng: String(row.church_longitude ?? ""), allowedRadius: String(row.allowed_radius_meters ?? ""), locationName: String(row.location_name || "Abuja"), timezoneLabel: String(row.timezone_label || "WAT") });
    }
    if (operation === "settings.update") {
      await rest("attendance_settings?id=eq.1", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ church_latitude: body.churchLat, church_longitude: body.churchLng, allowed_radius_meters: body.allowedRadius, updated_at: new Date().toISOString() }) });
      return json({ success: true });
    }
    if (operation === "members.list") {
      const rows = await rest("attendance_members?select=normalized_name&is_active=eq.true&order=normalized_name.asc") as Json[];
      return json({ names: rows.map((row) => String(row.normalized_name)) });
    }
    if (operation === "attendance.device-check") {
      const date = encodeURIComponent(String(body.date || ""));
      const deviceId = encodeURIComponent(String(body.deviceId || ""));
      const rows = await rest(`attendance_records?select=member_name&attendance_date=eq.${date}&device_id=eq.${deviceId}&status=eq.Approved&order=id.asc&limit=1`) as Json[];
      return json({ memberName: rows[0] ? String(rows[0].member_name) : null });
    }
    if (operation === "attendance.insert") {
      const record = body.record as Json;
      const dateParts = String(record.date || "").split("/");
      const dateKey = dateParts.length === 3
        ? `${dateParts[2]}-${dateParts[1].padStart(2, "0")}-${dateParts[0].padStart(2, "0")}`
        : String(record.date || "");
      await rest("attendance_records", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ attendance_date: record.date, attendance_date_key: dateKey, service: record.service, member_name: record.memberName, attendance_time: record.time, latitude: record.latitude, longitude: record.longitude, distance_meters: record.distance, status: record.status, reason: record.reason, browser: record.browser, device: record.device, device_id: record.deviceId, admin_override: body.adminOverride === true }) });
      return json({ success: true });
    }
    if (operation === "attendance.list") return json({ records: (await allRecords()).map(mapRecord) });
    if (operation === "migration.import") {
      const members = Array.isArray(body.members) ? body.members : [];
      const records = Array.isArray(body.records) ? body.records : [];
      if (members.length > 0) await rest("attendance_members?on_conflict=normalized_name", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(members) });
      if (body.settings && typeof body.settings === "object") await rest("attendance_settings?id=eq.1", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ...(body.settings as Json), updated_at: new Date().toISOString() }) });
      if (records.length > 0) await rest("attendance_records?on_conflict=source_fingerprint", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(records) });
      return json({ success: true, members: members.length, records: records.length });
    }
    if (operation === "member.authenticate") {
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 256) {
        return json({ error: "Invalid email or password." }, 401);
      }
      const rows = await rest(`member_credentials?select=email,password_hash,must_change_password,failed_attempts,locked_until&email=eq.${encodeURIComponent(email)}&limit=1`) as Json[];
      let credential = rows[0];
      if (!credential) {
        if (PROTECTED_BOOTSTRAP_EMAILS.has(email)) return json({ error: "This administrator account must be activated with its private temporary password." }, 401);
        if (!safeEqual(password, DEFAULT_MEMBER_PASSWORD)) return json({ error: "Invalid email or password." }, 401);
        const passwordHash = await hashPassword(DEFAULT_MEMBER_PASSWORD);
        await rest("member_credentials", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ email, password_hash: passwordHash, must_change_password: true }) });
        credential = { email, password_hash: passwordHash, must_change_password: true, failed_attempts: 0, locked_until: null };
      }
      const lockedUntil = credential.locked_until ? new Date(String(credential.locked_until)).getTime() : 0;
      if (lockedUntil > Date.now()) return json({ error: "Too many attempts. Try again in 15 minutes." }, 429);
      const valid = await verifyPassword(password, String(credential.password_hash || ""));
      if (!valid) {
        const failures = Number(credential.failed_attempts || 0) + 1;
        const lock = failures >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
        await rest(`member_credentials?email=eq.${encodeURIComponent(email)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ failed_attempts: lock ? 0 : failures, locked_until: lock, updated_at: new Date().toISOString() }) });
        return json({ error: lock ? "Too many attempts. Try again in 15 minutes." : "Invalid email or password." }, lock ? 429 : 401);
      }
      await rest(`member_credentials?email=eq.${encodeURIComponent(email)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
      return json({ token: await createMemberSession(email), mustChangePassword: Boolean(credential.must_change_password) });
    }
    if (operation === "member.session") {
      const session = await resolveMemberSession(body.token);
      if (!session) return json({ error: "Your session has expired." }, 401);
      return json({ email: session.email, mustChangePassword: session.mustChangePassword });
    }
    if (operation === "member.change-password") {
      const session = await resolveMemberSession(body.token);
      if (!session) return json({ error: "Your session has expired." }, 401);
      const password = String(body.password || "");
      if (!validNewPassword(password)) return json({ error: "Use at least 8 characters with uppercase, lowercase and a number." }, 400);
      const now = new Date().toISOString();
      await rest(`member_credentials?email=eq.${encodeURIComponent(session.email)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ password_hash: await hashPassword(password), must_change_password: false, password_changed_at: now, failed_attempts: 0, locked_until: null, updated_at: now }) });
      await rest(`member_sessions?email=eq.${encodeURIComponent(session.email)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return json({ token: await createMemberSession(session.email), mustChangePassword: false });
    }
    if (operation === "member.logout") {
      const token = String(body.token || "");
      if (token) await rest(`member_sessions?token_hash=eq.${encodeURIComponent(await sha256(token))}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return json({ success: true });
    }
    if (operation === "member.list") {
      const rows = await rest("member_credentials?select=email,must_change_password,last_login_at,password_changed_at,reset_at&order=email.asc") as Json[];
      return json({ members: rows.map((row) => ({ email: String(row.email), mustChangePassword: Boolean(row.must_change_password), lastLoginAt: row.last_login_at || null, passwordChangedAt: row.password_changed_at || null, resetAt: row.reset_at || null })) });
    }
    if (operation === "member.reset") {
      const email = normalizeEmail(body.email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "A valid member email is required." }, 400);
      if (PROTECTED_BOOTSTRAP_EMAILS.has(email)) return json({ error: "Privileged administrator passwords require secure recovery and cannot use the shared team password." }, 403);
      const now = new Date().toISOString();
      await rest("member_credentials?on_conflict=email", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ email, password_hash: await hashPassword(DEFAULT_MEMBER_PASSWORD), must_change_password: true, failed_attempts: 0, locked_until: null, reset_at: now, updated_at: now }) });
      await rest(`member_sessions?email=eq.${encodeURIComponent(email)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return json({ success: true });
    }
    return json({ error: "Unknown operation." }, 400);
  } catch (error) {
    const typed = error as Error & { status?: number; code?: string };
    const duplicate = typed.code === "23505";
    return json({ error: duplicate ? "This device already has an approved attendance for this date." : typed.message, code: duplicate ? "device_already_signed" : typed.code }, duplicate ? 409 : typed.status || 500);
  }
});
