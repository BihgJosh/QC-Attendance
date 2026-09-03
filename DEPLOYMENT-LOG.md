# Deployment log

Times are Africa/Lagos (WAT, UTC+01:00). Deployment confirmation is distinct from source commit time. This log starts with the verified release below; earlier deployment history has not yet been reconstructed here.

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
