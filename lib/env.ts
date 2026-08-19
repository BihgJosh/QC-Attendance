const missingWarnings = new Set<string>();

function warnMissing(name: string) {
  if (missingWarnings.has(name)) return;
  missingWarnings.add(name);
  console.error(`[env] Missing ${name}. Add it to .env.local or your Vercel environment variables.`);
}

export function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    warnMissing(name);
    return "";
  }
  return value;
}

export function getOptionalEnv(name: string) {
  return process.env[name] || "";
}

export function getGoogleEnv() {
  return {
    sheetId: getEnv("GOOGLE_SHEET_ID"),
    postingsDocumentId: getOptionalEnv("GOOGLE_POSTINGS_DOCUMENT_ID") || "15WPtZZeKYKCvZDDycKyw5aHJFQZcVltMoQme2p4N-iQ",
    serviceAccountEmail: getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    privateKey: getEnv("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n"),
  };
}

export function getSupabaseEnv() {
  return {
    url: getEnv("SUPABASE_URL"),
    anonKey: getEnv("SUPABASE_ANON_KEY"),
  };
}

export function getAttendanceEnvConfig() {
  return {
    adminPassword: getEnv("ADMIN_PASSWORD"),
    sharedPassword: getEnv("SHARED_PASSWORD"),
    churchLat: getOptionalEnv("CHURCH_LATITUDE"),
    churchLng: getOptionalEnv("CHURCH_LONGITUDE"),
    allowedRadius: getOptionalEnv("GEOFENCE_RADIUS"),
  };
}

export function getLocationEnvConfig() {
  return {
    churchLat: getOptionalEnv("CHURCH_LATITUDE"),
    churchLng: getOptionalEnv("CHURCH_LONGITUDE"),
    allowedRadius: getOptionalEnv("GEOFENCE_RADIUS"),
  };
}
