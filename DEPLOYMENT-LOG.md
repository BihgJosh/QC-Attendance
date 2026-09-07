# Deployment log

Times are Africa/Lagos (WAT, UTC+01:00). Deployment confirmation is distinct from source commit time. This log starts with the verified release below; earlier deployment history has not yet been reconstructed here.

## 2026-09-07 — Latest-login-wins session hotfix

- Source commit: `5329e07` (`Allow latest member login to replace prior session`).
- Production: https://qcsoja.com
- Vercel deployment: unchanged; this was a Supabase authentication-function-only hotfix.
- Supabase Edge Function: `qcu-attendance` version 43, **ACTIVE**, JWT verification enabled.
- Live verification completed: **2026-09-07 20:19:50 WAT**.
- Database migrations: none required; the existing one-session-per-email constraint remains active.

### Changes

- Replaced the lockout behavior that rejected a valid login whenever an older session existed.
- A successful login now atomically replaces the account's previous session token.
- The newest device remains signed in and the older device is immediately invalidated, preserving the one-active-session security rule without trapping members outside their accounts.

### Verification

- Supabase confirmed `qcu-attendance` version 43 **ACTIVE**.
- A rolled-back synthetic database test created an initial session and replaced it using the production upsert path; the result was exactly 1 session row and `latest_token_won=true`.
- The synthetic credential and session were rolled back, so no test account or token was retained.
- A real member password was not used during verification.
- Unrelated local changes and artifacts were excluded.

## 2026-09-07 — Single-account sessions and visible posting identities

- Source commit: `e1e29a7` (`Enforce single member sessions and restore posting identities`).
- Production: https://qcsoja.com
- Deployment: `dpl_Ayyh4rQuxpnb4EktV6skpwwU4G5M`.
- Vercel status: **READY**; all production aliases confirmed.
- Platform-confirmed deployment time: **2026-09-07 18:20:07 WAT**.
- Live verification completed: **2026-09-07 18:22:24 WAT**.
- Supabase migration: `enforce_single_member_session`, applied and recorded.
- Supabase Edge Function: `qcu-attendance` version 42, **ACTIVE**, JWT verification enabled.

### Changes

- Enforced one server-side member session per email address with a unique database constraint, preventing simultaneous sign-in on another device.
- A valid second sign-in now returns HTTP 409 with instructions to sign out on the existing device or ask an administrator to reset access.
- Expired sessions are cleared before a replacement session is created; explicit logout and administrator password reset continue to revoke access.
- General-user posting cards now show each assigned member's profile picture and name on a branded cyan-to-violet surface.
- Fixed the privacy-safe name-key lookup that previously left general-user posting cards blank; email and phone remain hidden.

### Verification

- Local and Vercel production builds passed; all 60 routes generated or compiled.
- Live database verification returned 112 sessions, 0 duplicate email rows, 0 expired rows, and the unique-email index present.
- Migration cleanup preserved each account's newest session and revoked 877 older duplicate session rows; affected older device sessions must sign in again.
- Supabase confirmed `qcu-attendance` version 42 **ACTIVE**.
- Production homepage protection returned HTTP 307 to member login and `/api/posting-identities` returned HTTP 401 without a session.
- The UI detector found no blocking issue; only pre-existing off-ramp typography advisories remain in the posting component.
- A general-user authenticated production visual check was not performed because no general-user credential was used; the browser's older session was correctly invalidated during migration cleanup.
- Unrelated local changes, artifacts, and the older address migration were excluded.

## 2026-09-07 — Standard service-location reporting status

- Source commit: `163ef7c` (`Standardize service location reporting status`).
- Production: https://qcsoja.com
- Deployment: `dpl_ETgiwdBGrtxiySp3rRbtUfYTR26d`.
- Vercel status: **READY**; `qcsoja.com`, `www.qcsoja.com`, `qcunit.vercel.app`, and `qcu-bigh-devs.vercel.app` aliases confirmed.
- Platform-confirmed deployment time: **2026-09-07 18:07:27 WAT**.
- Live route verification completed: **2026-09-07 18:09:11 WAT**.
- Database/API migrations: none required.

### Changes

- Established one shared, fixed list of 17 Service Post reporting locations for the form, server validation, and Service Manager dashboard.
- The Worshipper Headcount table now keeps every expected location visible in operational order and labels each one **Reported** or **Not reported**.
- Added a completion summary showing reported locations and the number still awaiting reports.
- Missing locations display blank counts, while a submitted report with zero adults and zero children correctly counts as reported.
- Historical non-standard reported locations remain visible after the standard list so previously saved data is not hidden.

### Verification

- Local and Vercel production builds passed; all 60 routes generated or compiled.
- TypeScript passed and Git whitespace checks found no errors.
- The UI detector found no blocking issue; its remaining warnings include pre-existing dashboard color and typography patterns.
- Vercel confirmed the deployment **READY** and all production aliases.
- Production `/service-tools` returned the expected HTTP 307 redirect to member login for an unauthenticated request.
- The authenticated browser fixture could not be completed because its old test session is no longer accepted by the current signed-session guard; no live Service Manager credential was used.
- No service report, headcount, attendance record, or notification was created during verification.
- Unrelated local changes and artifacts were excluded from the deployment snapshot.

## 2026-09-07 — Privacy policy and cookie consent

- Source commit: `5562cd0` (`Add privacy policy and cookie consent`).
- Production: https://qcsoja.com
- Deployment: `dpl_8wpp1BodfRXCUUT26vxfx8zdLgJH`.
- Vercel status: **READY**; all production aliases confirmed.
- Live verification completed: **2026-09-07 17:35:01 WAT**.
- Database/API migrations: none required.

### Changes

- Added a public Privacy Policy describing processed data, role-based access, service providers, retention, safeguards, data-subject rights, cookies and device storage.
- Added an explicit credential agreement prohibiting credential disclosure, lending accounts and giving another person authenticated platform access.
- Made acceptance mandatory on member login and enforced it again in the login API.
- Added a global necessary-cookie/device-storage consent banner and stated that the platform does not use advertising or analytics cookies.
- Added a persistent Privacy Policy link to the homepage footer.

### Verification

- Local and Vercel production builds passed; all 60 routes generated or compiled.
- Production Privacy Policy returned and exposed the full agreement through accessible headings and lists.
- Production member login displayed the required unchecked agreement and kept Sign in disabled until acceptance.
- A direct login request without acceptance returned HTTP 400 with the expected policy error.
- Production cookie banner displayed its explanation, Accept and continue action, and Privacy Policy link.
- Impeccable warnings introduced by the new privacy surface were corrected; remaining advisories belong to pre-existing homepage typography.
- Unrelated local changes and artifacts were excluded from the deployment snapshot.

## 2026-09-07 — Sunday-only attendance audit

- Source commit: `773e639` (`Limit attendance audit to live Sundays`).
- Production: https://qcsoja.com
- Deployment: `dpl_5p8sToFThhYJtLnPE9Jcx3PAas6k`.
- Vercel status: **READY**, `qcsoja.com` production alias confirmed.
- Live verification completed: **2026-09-07 16:56:46 WAT**.
- Database/API migrations: none required.

### Changes

- Attendance Audit now includes only records whose service is Sunday and whose calendar date is Sunday.
- The audit begins with the first live Sunday, 19 July 2026.
- Removed date-range and service filters so preview counts and generated Google Sheets always use the same fixed Sunday-only scope.
- Mislabeled Sunday records saved on other weekdays are excluded.

### Verification

- Local and Vercel production builds passed; all 59 routes generated or compiled.
- Authenticated production audit returned HTTP 200 with 8 Sunday columns and 470 approved check-ins, from 19 July through 6 September 2026.
- All 8 returned columns passed service, calendar-day, and launch-boundary checks; invalid columns: 0.
- Impeccable reported one pre-existing 11px typography advisory and no blocking UI finding.
- No attendance records or Google Sheets were modified during verification.
- Unrelated local changes and artifacts were excluded from the release snapshot.

## 2026-09-07 — Role privacy and replace-in-place attendance override

- Source commit: `2a9815e` (`Enforce member privacy and attendance overrides`).
- Production: https://qcsoja.com
- Deployment: `dpl_F3GX9dsbLo4RDNAEVopN1u8y9v4c`.
- Vercel status: **READY**; `qcsoja.com`, `www.qcsoja.com`, and `qcunit.vercel.app` aliases confirmed.
- Live verification completed: **2026-09-07 16:12:43 WAT**.
- Supabase Edge Function: `qcu-attendance` version 41, **ACTIVE**, JWT verification enabled.
- Database migrations: none required.

### Changes

- Administrators and Super Admins can select a Team Data member and sign attendance using the administrator's device and location; the selected member does not need a phone.
- Phone numbers and email addresses are returned and displayed only to Service Managers, HODs, Admins, and Super Admins. General users receive redacted contact data and see only profile pictures or a neutral placeholder.
- Emergency polling, on-page alerts, and emergency push delivery are restricted to Service Managers, HODs, Admins, and Super Admins.
- Attendance replacement is authorized only for Service Managers, Admins, and Super Admins. It replaces the prior approved record instead of adding another active record, and documents the actor and replaced member in the new record's reason.
- Attendance remains subject to the open window and geofence during an override.

### Verification

- Local and Vercel production builds passed; all 59 routes generated or compiled.
- Impeccable UI scan reported only pre-existing typography advisories and no blocking finding in the changed flows.
- Production access checks returned HTTP 401 for unauthenticated attendance-member selection, emergency polling, posting identities, and homepage content APIs.
- Vercel confirmed deployment **READY** and all production aliases.
- Supabase confirmed `qcu-attendance` version 41 **ACTIVE**.
- No attendance record or emergency notification was created during verification.
- Authenticated role behavior and a real replacement were not exercised in production because no member credentials were used and destructive test attendance was avoided.
- Unrelated local changes and artifacts were excluded from the release snapshot.

## 2026-09-07 — Combined member login and session-duration policy

- Source commit: `41824a6` (`Streamline member login and session duration`).
- Production: https://qcsoja.com
- Deployment: `dpl_B5rD3VLU2KFuY8wozuW8tXtGtf4E`.
- Vercel status: **READY**, `qcsoja.com` production alias confirmed.
- Live verification completed: **2026-09-07 15:36:06 WAT**.
- Supabase Edge Function: `qcu-attendance` version 40, **ACTIVE**.
- Database migrations: none required.

### Changes

- Combined email and password on the initial member login screen; returning members now sign in with one submission.
- Kept first-time private-password confirmation on the same screen and only reveal it when the account needs setup.
- Removed the inaccurate 180-day login-duration message.
- Set normal browser sessions to 24 hours and installed PWA sessions to 30 days, with bounded renewal during active use.
- Preserved the correct session type through password and verified-email changes, and capped legacy 180-day sessions at 30 days on their next successful validation.

### Verification

- TypeScript, diff checks, local production build and Vercel production build passed; all 58 static pages generated.
- UI detector returned no findings for the login surface.
- Local and production visual checks confirmed the email and password fields appear together and the 180-day message is absent.
- Production `/member/login` and `/api/status` returned HTTP 200.
- Supabase reported `qcu-attendance` version 40 as **ACTIVE**.
- Authenticated session-expiry headers were not exercised because no member credentials were used during deployment verification; the compiled cookie and gateway duration paths were statically verified.
- Unrelated local changes, migrations, and artifacts were excluded from the deployment snapshot.

## 2026-09-04 — Page-only loading screen

- Source commit: `4b0a0e7` (`Limit loader to page transitions`).
- Production: https://qcsoja.com
- Deployment: `dpl_5cw1AoV9fwrwbodUMPVXaYQSkG2z`.
- Vercel status: **READY**, `qcsoja.com` production alias confirmed.
- Live verification completed: **2026-09-04 20:35:36 WAT**.
- Database/API migrations: none required.

### Changes

- Removed the global browser-request interceptor and its full-screen overlay.
- Retained the branded Next.js route loader only for genuine new-page loading.
- Background requests, form submissions, refresh buttons, and same-page updates no longer trigger the loading screen.

### Verification

- TypeScript, diff checks, local production build and Vercel production build passed; all 58 static pages generated.
- Source scan confirmed the global request loader and overlay styles are absent while `app/loading.tsx` remains.
- Production `/api/status` returned HTTP 200.
- Unrelated local changes and artifacts were excluded from the deployment snapshot.

## 2026-09-04 — Admin login protection and emergency replay prevention

- Source commit: `555f647` (`Harden admin login and emergency alerts`).
- Production: https://qcsoja.com
- Deployment: `dpl_HcoXX9xpXpEfLGdBnz316uuhYKdX`.
- Vercel status: **READY**, `qcsoja.com` production alias confirmed.
- Live verification completed: **2026-09-04 10:08:44 WAT**.
- Supabase migration: `admin_login_protection`, applied successfully.
- Supabase Edge Function: `qcu-attendance` version 39, **ACTIVE**.

### Changes

- Added durable per-client administrator login throttling: five failed attempts trigger a 15-minute lockout.
- Added a wider shared-credential guard that locks after 25 failures in 15 minutes to limit distributed guessing.
- Replaced the password-derived administrator cookie with a signed, expiring session that uses an independent production secret; changing the password still invalidates existing sessions.
- Applied the same protected verifier to the administrator login aliases and attendance override path.
- Prevented duplicate emergency submissions from broadcasting repeat notifications; the database insert result is authoritative and the notification topic is stable per submission ID.
- MFA was intentionally postponed at the user's direction.

### Verification

- TypeScript, diff checks, local production build and Vercel production build passed; all 58 static pages generated.
- Database lockout reached the expected locked state after five controlled failures; the temporary test row was removed and confirmed absent.
- Anonymous and authenticated roles cannot execute the lockout functions; `service_role` can.
- Production administrator login returned HTTP 200, issued an administrator cookie, and accessed `/api/admin/settings` successfully.
- Production `/api/status` returned HTTP 200.
- No emergency notification was sent during verification.
- Unrelated local changes and artifacts were excluded from the deployment snapshot.

## 2026-09-03 — qcsoja.com domain migration

- Source commit: `573ffae` (`Configure qcsoja.com as production domain`).
- Production: https://qcsoja.com
- Deployment: `dpl_8J7tt5xSfY4DZ6hXDdjyZ2ZZ4Zdi`.
- Vercel status: **READY**, `qcsoja.com` production alias confirmed.
- Live verification completed: **2026-09-03 15:22:43 WAT**.
- Database/API migrations: none required.

### Changes

- Attached `qcsoja.com`, `www.qcsoja.com`, and the legacy `qcunit.vercel.app` address to the QCU Vercel project.
- Configured Namecheap authoritative DNS with Vercel's recommended apex A records `216.198.79.1` and `64.29.17.1` and retained the existing Vercel `www` CNAME.
- Removed the conflicting parking A record and Namecheap URL redirect; disabled Namecheap's HTTPS proxy on Vercel DNS records.
- Preserved Namecheap email forwarding and SPF configuration.
- Set `www.qcsoja.com` and `qcunit.vercel.app` to permanent HTTP 308 redirects to `qcsoja.com`, preserving request paths.
- Added `NEXT_PUBLIC_SITE_URL=https://qcsoja.com` to Vercel Production and Preview environments.
- Centralized active site URL usage and moved posting/profile email links, canonical metadata, and Open Graph metadata to `qcsoja.com`.

### Verification

- Namecheap authoritative DNS returned both recommended Vercel apex A records and the Vercel `www` CNAME.
- Vercel domain verification returned `configured-correctly`, with no issues or conflicts.
- Local and Vercel production builds passed; all 58 static pages generated.
- `https://qcsoja.com/` and `/api/status` returned HTTP 200 over HTTPS.
- `www.qcsoja.com/member/profile` and `qcunit.vercel.app/member/profile` returned HTTP 308 to the equivalent `qcsoja.com` path.
- Production HTML contains the `https://qcsoja.com` canonical metadata.
- Historical deployment URLs and the separate `qc-soja-suite.vercel.app` integration were not rewritten.
- Unrelated local changes and artifacts were excluded from the release archive.

## 2026-09-03 — Branded 404 and request loading states

- Source commit: `b650eeb` (`Add branded 404 and request loading states`).
- Production: https://qcunit.vercel.app
- Deployment: `dpl_HMWrFVHSa1fpettgDVXhSfme4Egi`.
- Vercel status: **READY**, production alias confirmed.
- Live verification completed: **2026-09-03 12:52:47 WAT**.
- Database/API migrations: none required.

### Changes

- Added a responsive custom 404 page using the QC logo, black/navy canvas, cyan-to-purple 404 treatment, flight path and clear recovery actions.
- Added a shared logo-based loading animation for route transitions and browser requests.
- Delayed the request overlay by 220 ms to avoid flashing on fast requests and kept it visible briefly enough to be perceived when shown.
- Added reduced-motion behavior and accessible live status/dialog labels.

### Verification

- TypeScript check passed.
- Local and Vercel production builds passed; all 58 static pages generated.
- Mobile (390 × 844) and desktop (1440 × 1000) 404 renders confirmed the approved layout and actions.
- Production `/api/status` returned HTTP 200.
- Production unknown-route check returned HTTP 404 and contained the branded heading, logo and Return home action.
- Impeccable reported only intentional design advisories for the approved gradient display treatment and route-specific dark palette; no blocking structural or accessibility finding.
- Unrelated local changes and artifacts were excluded from the release archive.

## 2026-09-03 — Attendance auto-close scheduler and wider service cards

- Source commit: `bccf192` (`Add scheduled attendance closing and widen report cards`).
- Production: https://qcunit.vercel.app
- Deployment: `dpl_76VBqVvooHQRCwr69Ysrc16HmgXC`.
- Vercel status: **READY**, production alias confirmed.
- Live verification completed: **2026-09-03 00:22:28 WAT**.
- Supabase migration: `add_attendance_auto_close`, applied successfully.
- Supabase Edge Function: `qcu-attendance` version 38, **ACTIVE**.

### Changes

- Service summary cards now use wider responsive columns, roomier padding and labels that wrap without colliding.
- Admins can optionally choose a WAT date/time when opening attendance; leaving it blank keeps manual closing.
- Scheduled closing is enforced by the Supabase attendance gateway and not only by the browser interface.
- Manual closing clears any pending schedule, and expired attendance attempts are rejected.

### Verification

- Local and Vercel production builds passed; all 58 static pages generated.
- Database column and inactive default (`is_open=false`, `closes_at=null`) verified after migration.
- Production `/api/status` returned HTTP 200 with the new `closesAt` field.
- Production admin login and protected Service Tools routing returned HTTP 200.
- No attendance window was opened and no attendance record was created during verification.

## 2026-08-30 — Reliable service reporting and manager access

- Source commit: `3ab78c7` (`Release reliable service reporting and manager access`).
- Production: https://qcunit.vercel.app
- Deployment: `dpl_6bcFp2gSdLZhLBXxsvzG5aFSLCt2`.
- Vercel status: **READY**, production alias confirmed.
- Live verification completed: **2026-08-30 08:47:09 WAT** (confirmation time, not an exact platform promotion timestamp).
- Delivery: direct Vercel CLI deployment of a clean archive of the commit; subsequently pushed to GitHub branch `codex/member-profile-release` after user approval, with remote commit verified as `3ab78c7`.

### Changes

- Permanent Service Managers can access dashboards, final reports and headcount generation without a date-assignment restriction; unauthorized roles remain denied.
- Service Post duplicate-area validation across form/API, authorized explicit overrides, and idempotent report inserts.
- Word-style final report layout, named service sections and emergency documentation.
- Headcount summary across services, including raw and adjusted totals; source failures prevent replacing an existing document with partial results.
- Separate final-report/headcount audit entries, unique events for fresh generations and stable keys for retries.
- Brevo idempotency-key normalization and accurate audit-failure messaging.
- Return-to-Service-Tools navigation after successful submission.

### Verification

- Local production build and Vercel production build passed; all 58 static pages generated.
- Final-report layout tests passed.
- Report authorization/audit regression tests passed, including permanent manager without assignments, unauthorized-role rejection, partial-headcount blocking and retry keys.
- Live 2026-08-23 report-source check: 4 services, 69 posts, 4 timers and 18 observers.
- Live 2026-08-30 final/headcount documents generated and read back at 08:40:34 WAT: 1 service, 9 posts, 70 saved report rows. Full/headcount audit records both confirmed Ready. Live service data can change after this snapshot.
- Existing Supabase report function matched the local source; duplicate-prevention index and migration were already applied. No additional database deployment was required.
- Post-deployment `/api/status`: HTTP 200.
- `/service-tools`: redirects unauthenticated visitors to a working member login page.
- Unauthenticated `/api/service-manager`: HTTP 401 as expected.
- No notification emails sent during verification.

### Remaining verification limits

- A real Service Manager's authenticated browser session has not been exercised end-to-end; role behavior was verified through automated route tests.
- Email delivery/inbox placement was not tested.
- Unrelated local artifacts, debug changes and the empty address migration were excluded.

### Generated documents

- [Final service report](https://docs.google.com/spreadsheets/d/1eZPJiAX4tCTX8huAAFCRrUSRr5na34VqmzXFCiqjGu0/edit?gid=1370238548#gid=1370238548)
- [Headcount document](https://docs.google.com/document/d/1_RWF0qv-cF0MoLz53OxaxHmeVt1ODbEsYtyMwzxTLE0/edit)

## Future release entries

For each deployment record the source commit, change summary, deployment ID, environment, platform-confirmed deployment time where available (otherwise clearly labelled verification time), migration status, test results and outstanding checks. Do not mark a release deployed based only on a local build or commit. This file is a release record, not an automatic monitoring service.
