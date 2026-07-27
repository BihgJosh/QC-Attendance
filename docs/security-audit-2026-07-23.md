# QC Attendance Security Audit

**Baseline date:** 23 July 2026  
**Project:** Quality Control Unit Church Attendance Platform  
**Assessment type:** Read-only source, architecture, build, and dependency review  
**Security score:** **43/100**  
**Production readiness:** Prototype / internal pilot

## Executive summary

The project has a coherent visual system, sensible server/client separation, strict TypeScript configuration, and a successful production build. Its primary weaknesses are trust-boundary and identity design issues rather than build stability.

The current server trusts GPS coordinates and device identifiers supplied by the browser. Both values can be fabricated. Member names are exposed through a public API, partial-name matching permits ambiguous identities, shared secrets can be brute-forced without throttling, and administrative HTML can potentially be stored by the service worker. The production dependency tree also contained seven known advisories at the time of review.

Before public or organization-wide deployment, the system should receive input validation, throttling, safer caching rules, security headers, private member lookup, dependency upgrades, and a stronger identity/session model.

## Assessment summary

| Area | Assessment |
| --- | --- |
| Visual/design maturity | 7/10 |
| Code and build health | 8/10 |
| Security | 43/100 |
| Architecture stage | Small internal application |
| Production build | Passed |
| TypeScript build validation | Passed |
| Routes generated | 20 |
| Changes made during audit | None |

## Architecture and design pattern

The application is a mobile-first Next.js attendance PWA with:

- Public attendance submission
- Administrator login and dashboard
- Google Sheets as its operational data store
- Browser geolocation and geofence calculation
- Browser-generated device identifiers
- PWA installation and offline caching
- Tailwind-based reusable components and Framer Motion animations

The code follows a straightforward layered structure:

```text
Next.js pages and components
          ↓
      API routes
          ↓
Authentication, geofence, time and environment services
          ↓
      Google Sheets
```

The visual language is consistent: brand blue-to-purple gradients, glassmorphic cards, light/dark themes, reusable form and dashboard components, responsive layouts, and reduced-motion support. This is a good foundation for a larger product shell, but Google Sheets and shared-password authentication will constrain reliability, security, reporting, and multi-user administration as the platform grows.

## Security findings

### 1. Client-controlled GPS can be forged — Critical

**Evidence:**

- `components/public/attendance-card.tsx:187`
- `app/api/attendance/route.ts:71`

The browser submits latitude and longitude, and the server treats those values as proof of physical location. A user can call the API directly with fabricated coordinates.

**Impact:** Anyone who obtains the shared attendance password can appear to be inside the geofence without being at the venue.

**Recommended remediation:**

- Treat browser GPS as a risk signal rather than definitive proof.
- Add short-lived, administrator-generated venue QR codes.
- Combine QR codes with authenticated member accounts, attendance windows, GPS accuracy, and anomaly checks.
- Submit and validate geolocation accuracy; reject implausible or highly inaccurate readings.

### 2. Device restriction is easy to bypass and subject to races — High

**Evidence:**

- `lib/device-id.ts:9`
- `app/api/attendance/route.ts:52`

The identifier is randomly generated and stored in `localStorage`. A user can delete or replace it. Two concurrent requests can also pass the duplicate check before either append completes.

**Recommended remediation:**

- Enforce attendance uniqueness by member, event/service, and date in a transactional database.
- Use authenticated member identity as the primary control.
- Retain device information only as a supplementary fraud signal.

### 3. Member directory is publicly exposed — High

**Evidence:** `app/api/whitelist/route.ts:4`

The public whitelist endpoint returns the complete member-name list without authentication.

**Impact:** Personal data is exposed and attackers gain the names needed for impersonation.

**Recommended remediation:**

- Remove public bulk directory access.
- Perform lookup on the server.
- Return only limited or masked matches after sufficient input.
- Throttle and log lookup requests.

### 4. Partial-name matching permits ambiguous identity — High

**Evidence:** `app/api/attendance/route.ts:38`

Every submitted word only needs to appear in a whitelisted name. A common first or last name can match another member.

**Recommended remediation:**

- Give each member a stable internal identifier.
- Require exact identity matching.
- Use individual member credentials, verified contact details, PINs, or administrator-issued member codes.

### 5. Authentication endpoints have no visible throttling — High

**Evidence:**

- `app/api/login/route.ts:4`
- `app/api/attendance/route.ts:9`

Admin login, attendance passwords, member lookup, and the admin override can be repeatedly attempted without rate limiting or lockout.

**Recommended remediation:**

- Add IP-, device-, and account-based rate limits.
- Use exponential backoff and temporary lockouts.
- Record failed authentication events.
- Add managed firewall or bot protection at the deployment edge.

### 6. Admin session design is too simple for a mature system — Medium/High

**Evidence:** `lib/auth.ts:9`

The session token is a deterministic SHA-256 hash derived from the shared administrator password. Cookie protections are configured, but the design has no individual administrator identity, random server-side session, revocation list, role model, or rotation.

**Positive controls:** The cookie is `HttpOnly`, `SameSite=Strict`, production-secure, and password comparisons use `timingSafeEqual`.

**Recommended remediation:**

- Replace the shared administrator account with individual accounts.
- Use Argon2id password hashing or a proven authentication provider.
- Use random, revocable sessions with shorter expiration.
- Add MFA and role-based authorization.

### 7. Sensitive admin HTML may be cached offline — Medium/High

**Evidence:** `public/sw.js:50`

The service worker caches successful HTML navigations without explicitly excluding administrative pages. On a shared device, authenticated dashboard HTML could remain in browser storage.

**Recommended remediation:**

- Exclude `/admin`, login pages, and other sensitive routes from service-worker caching.
- Cache only an explicit allowlist of public pages and static assets.
- Return `Cache-Control: no-store` for authenticated pages and sensitive responses.

### 8. Server-side request validation is incomplete — Medium

**Evidence:**

- `app/api/attendance/route.ts:11`
- `app/api/settings/route.ts:31`

Request bodies are parsed without a strict schema. Coordinates, radius, names, identifiers, and settings lack comprehensive type, range, length, finite-number, and unexpected-field validation.

**Recommended remediation:**

- Add Zod or an equivalent schema validator to every endpoint.
- Reject oversized payloads and unknown fields.
- Validate coordinate ranges and finite numeric values.
- Constrain the length and format of all strings and identifiers.

### 9. Application security headers are missing — Medium

**Evidence:** `next.config.mjs:2`

No application-level Content Security Policy or supporting headers are configured.

**Recommended remediation:**

- Add a Content Security Policy.
- Add `X-Content-Type-Options: nosniff`.
- Add an appropriate `Referrer-Policy`.
- Restrict browser capabilities with `Permissions-Policy`.
- Enable HSTS in production.
- Prevent framing using CSP `frame-ancestors`.

### 10. Production dependency advisories — High

The dependency audit reported:

- 3 high-severity advisories
- 4 moderate-severity advisories
- 7 production advisories in total

The direct Next.js dependency was `16.2.10`, which was affected by advisories resolved in later versions. The Google APIs dependency chain also contained moderate advisories and may require a tested major-version upgrade.

**Recommended remediation:**

- Upgrade Next.js to at least `16.2.11`, then use the newest compatible stable patch available at implementation time.
- Test and upgrade `googleapis` and its transitive dependency chain.
- Run the build, regression tests, and dependency audit after upgrades.

## Existing positive controls

- Administrative API routes check authentication.
- Admin cookies use `HttpOnly`, `SameSite=Strict`, and `Secure` in production.
- Secret comparison uses `timingSafeEqual`.
- Secrets are loaded from server-side environment variables.
- Google Sheets writes use `RAW`, reducing spreadsheet formula-injection risk.
- API responses generally avoid returning raw exception details.
- TypeScript strict mode is enabled.
- Reduced-motion styling is included.
- API calls are excluded from service-worker caching.
- The optimized production build and TypeScript checks passed.

## Remediation roadmap

### Phase 1 — Immediate security baseline

1. Upgrade vulnerable dependencies.
2. Add request schemas, limits, rate limiting, security headers, and audit logging.
3. Stop exposing the complete whitelist.
4. Prevent administrative and sensitive-page caching.
5. Replace partial-name matching with exact identity resolution.
6. Add CSRF/origin validation to state-changing administrative endpoints.

### Phase 2 — Identity and data foundation

1. Move members, attendance, sessions, roles, and audit records to PostgreSQL.
2. Retain Google Sheets as an export/reporting integration rather than the source of truth.
3. Add individual member and administrator accounts.
4. Add MFA and role-based permissions for privileged users.
5. Enforce uniqueness and other integrity rules transactionally.

### Phase 3 — Mature product capabilities

- Member profiles and directory management
- Attendance history and correction workflow
- Service and event scheduling
- Reports, charts, filters, and exports
- Multi-department or multi-branch support
- Administrator activity logs
- Notifications and attendance reminders
- Public support, privacy, and help pages

### Phase 4 — Attendance assurance

- Rotating venue QR codes
- Short, configurable check-in windows
- GPS accuracy and anomaly checks
- Optional administrator approval
- Fraud alerts for repeated devices, impossible movement, and unusual attendance patterns

## Verification record

The following checks were completed during the audit:

- Full source and configuration review
- Authentication and API trust-boundary review
- PWA/service-worker review
- Production dependency audit
- Optimized Next.js production build
- TypeScript compilation
- Route generation

The production build passed successfully. No project files were modified during the original audit.

## Reassessment guidance

Recalculate the score after Phase 1 and again after Phase 2. The next review should include automated endpoint tests, authentication abuse tests, service-worker cache inspection, access-control tests, dependency scanning, and—if the application has been deployed—deployment-header and TLS verification.
