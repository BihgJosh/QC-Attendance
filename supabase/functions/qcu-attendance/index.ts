const GATEWAY_SECRET_HASH = "e961e32016c41f358eac3f9e1546b93d78bae0b9b30a446ccceecea47533fa41";
const allowedOperations = new Set([
  "status.get", "status.update", "settings.get", "settings.update", "members.list",
  "attendance.device-check", "attendance.insert", "attendance.list", "migration.import",
  "member.status", "member.setup-complete", "member.authenticate", "member.session", "member.change-password", "member.logout",
  "profile.get", "profile.update", "profile.email-change-request", "profile.email-change-confirm", "profile.image-upload", "profile.image-delete", "profile.identities",
  "member.list", "member.reset", "admin.list", "admin.add", "admin.remove",
  "roles.list", "roles.resolve", "roles.upsert", "roles.remove", "assignments.upsert", "assignments.remove",
  "push.subscribe", "push.unsubscribe", "push.list", "push.deactivate",
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

async function storage(path: string, init: RequestInit = {}) {
  const response = await fetch(`${supabaseUrl}/storage/v1/${path}`, {
    ...init,
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...(init.headers || {}) },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload && typeof payload.message === "string" ? payload.message : "Profile photo storage is unavailable.") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload as Json;
}

async function signedAvatarUrl(path: unknown) {
  const objectPath = String(path || "");
  if (!objectPath) return null;
  const result = await storage(`object/sign/member-profile-photos/${encodeURIComponent(objectPath)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 3600 }),
  });
  const signed = String(result.signedURL || result.signedUrl || "");
  return signed ? `${supabaseUrl}/storage/v1${signed}` : null;
}

const PROTECTED_BOOTSTRAP_EMAILS = new Set(["joshuaagusa001@gmail.com"]);
const PASSWORD_ITERATIONS = 210_000;
const REMEMBERED_SESSION_DAYS = 180;

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
  const expiresAt = new Date(Date.now() + REMEMBERED_SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await rest("member_sessions", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ email, token_hash: tokenHash, expires_at: expiresAt, remember_me: true }),
  });
  return token;
}

async function resolveMemberSession(tokenValue: unknown) {
  const token = String(tokenValue || "");
  if (token.length < 32) return null;
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const sessions = await rest(`member_sessions?select=email,expires_at,remember_me&token_hash=eq.${encodeURIComponent(tokenHash)}&expires_at=gt.${encodeURIComponent(now)}&limit=1`) as Json[];
  if (!sessions[0]) return null;
  const email = String(sessions[0].email);
  const credentials = await rest(`member_credentials?select=email,must_change_password&email=eq.${encodeURIComponent(email)}&limit=1`) as Json[];
  if (!credentials[0]) return null;
  const rollingExpiry = sessions[0].remember_me !== true || new Date(String(sessions[0].expires_at)).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000
    ? new Date(Date.now() + REMEMBERED_SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    : undefined;
  await rest(`member_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_seen_at: now, remember_me: true, ...(rollingExpiry ? { expires_at: rollingExpiry } : {}) }),
  });
  return { email, tokenHash, rememberMe: true, mustChangePassword: Boolean(credentials[0].must_change_password) };
}

function validNewPassword(password: string) {
  return password.length >= 10 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
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
    if (operation === "member.status") {
      const email = normalizeEmail(body.email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
      const rows = await rest(`member_credentials?select=email&email=eq.${encodeURIComponent(email)}&limit=1`) as Json[];
      return json({ hasPrivatePassword: Boolean(rows[0]) });
    }
    if (operation === "member.setup-complete") {
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !validNewPassword(password)) return json({ error: "Use a private password of at least 10 characters with uppercase, lowercase and a number." }, 400);
      const existing = await rest(`member_credentials?select=email&email=eq.${encodeURIComponent(email)}&limit=1`) as Json[];
      if (existing[0]) return json({ error: "This account already has a private password. Sign in instead." }, 409);
      const now = new Date().toISOString();
      await rest("member_credentials?on_conflict=email", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ email, password_hash: await hashPassword(password), must_change_password: false, failed_attempts: 0, locked_until: null, password_changed_at: now, updated_at: now }) });
      const adminRows = await rest(`admin_access?select=email&email=eq.${encodeURIComponent(email)}&limit=1`) as Json[];
      const defaultRole = PROTECTED_BOOTSTRAP_EMAILS.has(email) ? "super_admin" : adminRows[0] ? "admin" : "general_user";
      await rest("user_roles?on_conflict=email", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ email, role: defaultRole, created_by: "member_setup", updated_at: now }) });
      await rest(`member_sessions?email=eq.${encodeURIComponent(email)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return json({ token: await createMemberSession(email), mustChangePassword: false });
    }
    if (operation === "member.authenticate") {
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 256) {
        return json({ error: "Invalid email or password." }, 401);
      }
      const rows = await rest(`member_credentials?select=email,password_hash,must_change_password,failed_attempts,locked_until&email=eq.${encodeURIComponent(email)}&limit=1`) as Json[];
      const credential = rows[0];
      if (!credential) return json({ error: "Private password setup is required for this account.", code: "ACCOUNT_SETUP_REQUIRED" }, 409);
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
      return json({ token: await createMemberSession(email), mustChangePassword: false });
    }
    if (operation === "member.session") {
      const session = await resolveMemberSession(body.token);
      if (!session) return json({ error: "Your session has expired." }, 401);
      return json({ email: session.email, rememberMe: session.rememberMe, mustChangePassword: session.mustChangePassword });
    }
    if (operation === "member.change-password") {
      const session = await resolveMemberSession(body.token);
      if (!session) return json({ error: "Your session has expired." }, 401);
      const password = String(body.password || "");
      if (!validNewPassword(password)) return json({ error: "Use at least 10 characters with uppercase, lowercase and a number." }, 400);
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
    if (operation === "profile.get") {
      const session = await resolveMemberSession(body.token);
      if (!session) return json({ error: "Your session has expired." }, 401);
      const [profiles, roles, teamRows] = await Promise.all([
        rest(`member_profiles?select=first_name,middle_name,last_name,phone,birth_month,birth_day,avatar_path&email=eq.${encodeURIComponent(session.email)}&limit=1`) as Promise<Json[]>,
        rest(`user_roles?select=role,is_active&email=eq.${encodeURIComponent(session.email)}&limit=1`) as Promise<Json[]>,
        rest(`Team%20Data?select=Surname,Other%20Names&normalized_email=eq.${encodeURIComponent(session.email)}&limit=1`) as Promise<Json[]>,
      ]);
      const profile = profiles[0] || {};
      const team = teamRows[0] || {};
      const otherNames = String(team["Other Names"] || "").trim().split(/\s+/).filter(Boolean);
      const fallbackFirstName = otherNames.shift() || "";
      const hasSavedProfile = Boolean(profiles[0]);
      return json({ profile: {
        email: session.email,
        firstName: String(hasSavedProfile ? profile.first_name || "" : fallbackFirstName),
        middleName: String(hasSavedProfile ? profile.middle_name || "" : otherNames.join(" ")),
        lastName: String(hasSavedProfile ? profile.last_name || "" : team.Surname || ""),
        phone: String(profile.phone || ""),
        birthMonth: profile.birth_month == null ? null : Number(profile.birth_month),
        birthDay: profile.birth_day == null ? null : Number(profile.birth_day),
        avatarUrl: await signedAvatarUrl(profile.avatar_path),
        role: roles[0]?.is_active === false ? "general_user" : String(roles[0]?.role || "general_user"),
      } });
    }
    if (operation === "profile.identities") {
      const session = await resolveMemberSession(body.token);
      if (!session) return json({ error: "Your session has expired." }, 401);
      const references = (Array.isArray(body.references) ? body.references : []).slice(0, 100).flatMap((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return [];
        const reference = value as Json;
        const email = normalizeEmail(reference.email);
        const name = String(reference.name || "").trim().replace(/\s+/g, " ").slice(0, 160);
        return email || name ? [{ email, name }] : [];
      });
      const [profiles, teamRows] = await Promise.all([
        rest("member_profiles?select=email,first_name,middle_name,last_name,avatar_path") as Promise<Json[]>,
        rest("Team%20Data?select=Email,Surname,Other%20Names") as Promise<Json[]>,
      ]);
      const profileByEmail = new Map(profiles.map((profile) => [normalizeEmail(profile.email), profile]));
      const teamByEmail = new Map<string, Json>();
      const teamByName = new Map<string, Json | null>();
      for (const team of teamRows) {
        const email = normalizeEmail(team.Email);
        const name = `${String(team["Other Names"] || "").trim()} ${String(team.Surname || "").trim()}`.trim().replace(/\s+/g, " ");
        if (email) teamByEmail.set(email, team);
        if (name) {
          const key = name.toLocaleLowerCase();
          teamByName.set(key, teamByName.has(key) ? null : team);
        }
      }
      const identities: Record<string, unknown> = {};
      await Promise.all(references.map(async (reference) => {
        const key = reference.email || reference.name.toLocaleLowerCase();
        const team = (reference.email ? teamByEmail.get(reference.email) : undefined) || teamByName.get(reference.name.toLocaleLowerCase()) || undefined;
        const email = reference.email || normalizeEmail(team?.Email);
        const profile = email ? profileByEmail.get(email) : undefined;
        const profileName = profile ? [profile.first_name, profile.middle_name, profile.last_name].map((part) => String(part || "").trim()).filter(Boolean).join(" ") : "";
        const teamName = team ? `${String(team["Other Names"] || "").trim()} ${String(team.Surname || "").trim()}`.trim().replace(/\s+/g, " ") : "";
        identities[key] = { name: profileName || teamName || reference.name || email || "Unknown member", email, avatarUrl: await signedAvatarUrl(profile?.avatar_path) };
      }));
      return json({ identities });
    }
    if (operation === "profile.update") {
      const session = await resolveMemberSession(body.token);
      if (!session) return json({ error: "Your session has expired." }, 401);
      const firstName = String(body.firstName || "").trim().replace(/\s+/g, " ");
      const middleName = String(body.middleName || "").trim().replace(/\s+/g, " ");
      const lastName = String(body.lastName || "").trim().replace(/\s+/g, " ");
      const phone = String(body.phone || "").trim().replace(/\s+/g, " ");
      const birthMonth = body.birthMonth == null || body.birthMonth === "" ? null : Number(body.birthMonth);
      const birthDay = body.birthDay == null || body.birthDay === "" ? null : Number(body.birthDay);
      if (!firstName || !lastName || firstName.length > 80 || middleName.length > 80 || lastName.length > 80) return json({ error: "Enter your first and last name using 80 characters or fewer." }, 400);
      if (phone && (!/^[+0-9()\-\s]{7,30}$/.test(phone))) return json({ error: "Enter a valid phone number." }, 400);
      if ((birthMonth == null) !== (birthDay == null)) return json({ error: "Choose both a birthday month and day, or leave both empty." }, 400);
      if (birthMonth != null && birthDay != null) {
        const birthday = new Date(Date.UTC(2000, birthMonth - 1, birthDay));
        if (birthday.getUTCMonth() !== birthMonth - 1 || birthday.getUTCDate() !== birthDay) return json({ error: "Choose a valid birthday." }, 400);
      }
      const now = new Date().toISOString();
      await rest("member_profiles?on_conflict=email", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ email: session.email, first_name: firstName, middle_name: middleName, last_name: lastName, phone, birth_month: birthMonth, birth_day: birthDay, updated_at: now }) });
      await rest(`Team%20Data?normalized_email=eq.${encodeURIComponent(session.email)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ Surname: lastName, "Other Names": [firstName, middleName].filter(Boolean).join(" ") }) });
      return json({ success: true });
    }
    if (operation === "profile.email-change-request") {
      const session = await resolveMemberSession(body.token);
      if (!session) return json({ error: "Your session has expired." }, 401);
      if (PROTECTED_BOOTSTRAP_EMAILS.has(session.email)) return json({ error: "The primary administrator email is managed in secure configuration and cannot be changed here." }, 403);
      const newEmail = normalizeEmail(body.newEmail);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail) || newEmail.length > 254) return json({ error: "Enter a valid new email address." }, 400);
      if (newEmail === session.email) return json({ error: "Enter a different email address." }, 400);
      const [credentials, teamRows] = await Promise.all([
        rest(`member_credentials?select=email&email=eq.${encodeURIComponent(newEmail)}&limit=1`) as Promise<Json[]>,
        rest(`Team%20Data?select=Email&normalized_email=eq.${encodeURIComponent(newEmail)}&limit=1`) as Promise<Json[]>,
      ]);
      if (credentials[0] || teamRows[0]) return json({ error: "That email address is already in use." }, 409);
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
      const now = new Date();
      await rest("member_email_change_challenges?on_conflict=email", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ email: session.email, new_email: newEmail, code_hash: await sha256(code), expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(), attempts: 0, requested_at: now.toISOString() }) });
      return json({ success: true, newEmail, verificationCode: code, requestedAt: now.toISOString() });
    }
    if (operation === "profile.email-change-confirm") {
      const session = await resolveMemberSession(body.token);
      if (!session) return json({ error: "Your session has expired." }, 401);
      const code = String(body.code || "").trim();
      const rows = await rest(`member_email_change_challenges?select=new_email,code_hash,expires_at,attempts&email=eq.${encodeURIComponent(session.email)}&limit=1`) as Json[];
      const challenge = rows[0];
      if (!challenge || Date.parse(String(challenge.expires_at)) <= Date.now()) return json({ error: "This verification code has expired. Request a new one." }, 410);
      if (Number(challenge.attempts) >= 5) return json({ error: "Too many incorrect attempts. Request a new code." }, 429);
      if (!/^\d{6}$/.test(code) || !safeEqual(await sha256(code), String(challenge.code_hash))) {
        await rest(`member_email_change_challenges?email=eq.${encodeURIComponent(session.email)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ attempts: Number(challenge.attempts) + 1 }) });
        return json({ error: "That verification code is incorrect." }, 400);
      }
      const newEmail = normalizeEmail(challenge.new_email);
      await rest("rpc/complete_member_email_change", { method: "POST", body: JSON.stringify({ old_email: session.email, replacement_email: newEmail }) });
      return json({ success: true, email: newEmail, token: await createMemberSession(newEmail) });
    }
    if (operation === "profile.image-upload") {
      const session = await resolveMemberSession(body.token);
      if (!session) return json({ error: "Your session has expired." }, 401);
      const base64 = String(body.base64 || "");
      const mimeType = body.mimeType === "image/jpeg" ? "image/jpeg" : "image/webp";
      let bytes: Uint8Array;
      try { bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0)); } catch { return json({ error: "The processed image is invalid." }, 400); }
      if (!bytes.length || bytes.length > 409600) return json({ error: "The processed profile picture must be 400 KB or smaller." }, 413);
      const isWebp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
      const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
      if ((mimeType === "image/webp" && !isWebp) || (mimeType === "image/jpeg" && !isJpeg)) return json({ error: "The processed image contents are invalid." }, 415);
      const extension = mimeType === "image/jpeg" ? "jpg" : "webp";
      const objectPath = `${await sha256(session.email)}.${extension}`;
      await storage(`object/member-profile-photos/${objectPath}`, { method: "POST", headers: { "Content-Type": mimeType, "x-upsert": "true" }, body: bytes });
      await rest("member_profiles?on_conflict=email", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ email: session.email, avatar_path: objectPath, updated_at: new Date().toISOString() }) });
      return json({ success: true, avatarUrl: await signedAvatarUrl(objectPath) });
    }
    if (operation === "profile.image-delete") {
      const session = await resolveMemberSession(body.token);
      if (!session) return json({ error: "Your session has expired." }, 401);
      const rows = await rest(`member_profiles?select=avatar_path&email=eq.${encodeURIComponent(session.email)}&limit=1`) as Json[];
      const objectPath = String(rows[0]?.avatar_path || "");
      if (objectPath) await storage("object/member-profile-photos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [objectPath] }) });
      await rest(`member_profiles?email=eq.${encodeURIComponent(session.email)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ avatar_path: null, updated_at: new Date().toISOString() }) });
      return json({ success: true });
    }
    if (operation === "member.list") {
      const rows = await rest("member_credentials?select=email,must_change_password,last_login_at,password_changed_at,reset_at&order=email.asc") as Json[];
      return json({ members: rows.map((row) => ({ email: String(row.email), mustChangePassword: Boolean(row.must_change_password), lastLoginAt: row.last_login_at || null, passwordChangedAt: row.password_changed_at || null, resetAt: row.reset_at || null })) });
    }
    if (operation === "member.reset") {
      const email = normalizeEmail(body.email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "A valid member email is required." }, 400);
      if (PROTECTED_BOOTSTRAP_EMAILS.has(email)) return json({ error: "Privileged administrator passwords require secure recovery." }, 403);
      await rest(`member_credentials?email=eq.${encodeURIComponent(email)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      await rest(`member_sessions?email=eq.${encodeURIComponent(email)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return json({ success: true });
    }
    if (operation === "admin.list") {
      const rows = await rest("admin_access?select=email,created_at&order=email.asc") as Json[];
      const indexed = new Map(rows.map((row) => [String(row.email), row]));
      for (const email of PROTECTED_BOOTSTRAP_EMAILS) {
        if (!indexed.has(email)) indexed.set(email, { email, created_at: null });
      }
      return json({
        admins: [...indexed.values()]
          .map((row) => ({
            email: String(row.email),
            createdAt: row.created_at || null,
            isProtected: PROTECTED_BOOTSTRAP_EMAILS.has(String(row.email)),
          }))
          .sort((left, right) => left.email.localeCompare(right.email)),
      });
    }
    if (operation === "admin.add") {
      const email = normalizeEmail(body.email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        return json({ error: "Enter a valid email address." }, 400);
      }
      const now = new Date().toISOString();
      await rest("admin_access?on_conflict=email", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({ email, created_at: now }),
      });
      await rest("user_roles?on_conflict=email", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ email, role: PROTECTED_BOOTSTRAP_EMAILS.has(email) ? "super_admin" : "admin", is_active: true, created_by: "admin_access", updated_at: now }) });
      return json({ success: true, admin: { email, createdAt: now, isProtected: PROTECTED_BOOTSTRAP_EMAILS.has(email) } });
    }
    if (operation === "admin.remove") {
      const email = normalizeEmail(body.email);
      if (PROTECTED_BOOTSTRAP_EMAILS.has(email)) return json({ error: "The primary administrator cannot be removed." }, 403);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
      await rest(`admin_access?email=eq.${encodeURIComponent(email)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      await rest(`user_roles?email=eq.${encodeURIComponent(email)}&role=eq.admin`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ role: "general_user", department: null, updated_at: new Date().toISOString() }) });
      await rest(`member_sessions?email=eq.${encodeURIComponent(email)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return json({ success: true });
    }
    if (operation === "roles.list") {
      const [roles, assignments] = await Promise.all([
        rest("user_roles?select=email,role,department,is_active,updated_at&order=email.asc") as Promise<Json[]>,
        rest("service_assignments?select=id,service_date,service,manager_email,access_starts_at,access_ends_at,status&order=service_date.desc,service.asc") as Promise<Json[]>,
      ]);
      return json({
        roles: roles.map((row) => ({ email: row.email, role: row.role, department: row.department || null, isActive: row.is_active !== false, updatedAt: row.updated_at })),
        assignments: assignments.map((row) => ({ id: row.id, serviceDate: row.service_date, service: row.service, managerEmail: row.manager_email, accessStartsAt: row.access_starts_at, accessEndsAt: row.access_ends_at, status: row.status })),
      });
    }
    if (operation === "roles.resolve") {
      const email = normalizeEmail(body.email);
      const rows = await rest(`user_roles?select=role,department,is_active&email=eq.${encodeURIComponent(email)}&is_active=eq.true&limit=1`) as Json[];
      const role = String(rows[0]?.role || "general_user");
      const now = new Date().toISOString();
      const assignments = role === "service_manager" ? await rest(`service_assignments?select=id,service_date,service,manager_email,access_starts_at,access_ends_at,status&manager_email=eq.${encodeURIComponent(email)}&access_starts_at=lte.${encodeURIComponent(now)}&access_ends_at=gte.${encodeURIComponent(now)}&status=in.(scheduled,active)&order=access_starts_at.asc`) as Json[] : [];
      return json({ role, department: rows[0]?.department || null, assignments: assignments.map((row) => ({ id: row.id, serviceDate: row.service_date, service: row.service, managerEmail: row.manager_email, accessStartsAt: row.access_starts_at, accessEndsAt: row.access_ends_at, status: row.status })) });
    }
    if (operation === "roles.upsert") {
      const email = normalizeEmail(body.email);
      const role = String(body.role || "");
      const department = String(body.department || "").trim() || null;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !["general_user", "service_manager", "hod", "admin", "super_admin"].includes(role)) return json({ error: "Choose a valid user and role." }, 400);
      await rest("user_roles?on_conflict=email", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ email, role, department, is_active: true, updated_at: new Date().toISOString() }) });
      return json({ success: true });
    }
    if (operation === "roles.remove") {
      const email = normalizeEmail(body.email);
      if (PROTECTED_BOOTSTRAP_EMAILS.has(email)) return json({ error: "The Super Admin role cannot be removed." }, 403);
      await rest(`user_roles?email=eq.${encodeURIComponent(email)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return json({ success: true });
    }
    if (operation === "assignments.upsert") {
      const managerEmail = normalizeEmail(body.managerEmail);
      const serviceDate = String(body.serviceDate || "");
      const service = String(body.service || "").trim();
      const accessStartsAt = String(body.accessStartsAt || "");
      const accessEndsAt = String(body.accessEndsAt || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate) || !service || !managerEmail || !Date.parse(accessStartsAt) || !Date.parse(accessEndsAt) || Date.parse(accessEndsAt) <= Date.parse(accessStartsAt)) return json({ error: "Complete the service assignment and access window." }, 400);
      const row = { service_date: serviceDate, service, manager_email: managerEmail, access_starts_at: accessStartsAt, access_ends_at: accessEndsAt, status: "scheduled", updated_at: new Date().toISOString() };
      const id = String(body.id || "");
      if (id) await rest(`service_assignments?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });
      else await rest("service_assignments?on_conflict=service_date,service,manager_email", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) });
      return json({ success: true });
    }
    if (operation === "assignments.remove") {
      const id = String(body.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Invalid assignment." }, 400);
      await rest(`service_assignments?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return json({ success: true });
    }
    if (operation === "push.subscribe") {
      const endpoint = String(body.endpoint || "").trim();
      const p256dh = String(body.p256dh || "").trim();
      const auth = String(body.auth || "").trim();
      const memberEmail = normalizeEmail(body.memberEmail) || null;
      const userAgent = String(body.userAgent || "Unknown").trim().slice(0, 500) || "Unknown";
      if (!endpoint.startsWith("https://") || endpoint.length > 4096 || p256dh.length < 20 || p256dh.length > 512 || auth.length < 8 || auth.length > 256) {
        return json({ error: "Invalid push subscription." }, 400);
      }
      if (!memberEmail) return json({ error: "A member email is required." }, 400);
      const existing = await rest(`push_subscriptions?select=member_email&endpoint=eq.${encodeURIComponent(endpoint)}&limit=1`) as Json[];
      if (existing[0] && normalizeEmail(existing[0].member_email) !== memberEmail) return json({ error: "This device is already linked to another member. Sign out on that account first." }, 409);
      if (!existing[0]) {
        const owned = await rest(`push_subscriptions?select=id&member_email=eq.${encodeURIComponent(memberEmail)}&is_active=eq.true&limit=4`) as Json[];
        if (owned.length >= 3) return json({ error: "This account already has notifications enabled on three devices." }, 409);
      }
      const now = new Date().toISOString();
      await rest("push_subscriptions?on_conflict=endpoint", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ endpoint, p256dh, auth, member_email: memberEmail, user_agent: userAgent, is_active: true, updated_at: now, last_seen_at: now }),
      });
      return json({ success: true });
    }
    if (operation === "push.unsubscribe") {
      const endpoint = String(body.endpoint || "").trim();
      const memberEmail = normalizeEmail(body.memberEmail);
      if (!endpoint.startsWith("https://") || endpoint.length > 4096) return json({ error: "Invalid push subscription." }, 400);
      if (!memberEmail) return json({ error: "A member email is required." }, 400);
      await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}&member_email=eq.${encodeURIComponent(memberEmail)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return json({ success: true });
    }
    if (operation === "push.list") {
      const rows: Json[] = [];
      for (let offset = 0; ; offset += 1000) {
        const page = await rest(`push_subscriptions?select=endpoint,p256dh,auth&is_active=eq.true&order=id.asc&offset=${offset}&limit=1000`) as Json[];
        rows.push(...page);
        if (page.length < 1000) break;
      }
      return json({ subscriptions: rows.map((row) => ({ endpoint: String(row.endpoint), p256dh: String(row.p256dh), auth: String(row.auth) })) });
    }
    if (operation === "push.deactivate") {
      const endpoints = Array.isArray(body.endpoints) ? body.endpoints.map((value) => String(value || "").trim()).filter((value) => value.startsWith("https://") && value.length <= 4096).slice(0, 1000) : [];
      for (const endpoint of endpoints) {
        await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ is_active: false, updated_at: new Date().toISOString() }),
        });
      }
      return json({ success: true, deactivated: endpoints.length });
    }
    return json({ error: "Unknown operation." }, 400);
  } catch (error) {
    const typed = error as Error & { status?: number; code?: string };
    const duplicate = typed.code === "23505";
    return json({ error: duplicate ? "This device already has an approved attendance for this date." : typed.message, code: duplicate ? "device_already_signed" : typed.code }, duplicate ? 409 : typed.status || 500);
  }
});
