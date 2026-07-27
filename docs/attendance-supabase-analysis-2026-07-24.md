# Attendance data and Supabase migration analysis

Date: 24 July 2026  
Project: Streams of Joy Quality Control Unit attendance website

## Outcome

Attendance storage is connected to Supabase. Google Sheets remains available for homepage content, but it is no longer the live attendance datastore.

Migrated and verified:

- 94 active whitelist members
- 58 historical attendance attempts
- 58 approved and 0 rejected historical attempts
- Global open/closed state
- Abuja church latitude, longitude, allowed geofence radius, and WAT label

## Data collected for every attendance attempt

| Application field | Supabase column | Purpose |
| --- | --- | --- |
| Date | `attendance_date`, `attendance_date_key` | Abuja service date and sortable database date |
| Service | `service` | Sunday, Thursday, or Other |
| Member name | `member_name` | Whitelisted person checking in |
| Time | `attendance_time` | Abuja check-in time (WAT, UTC+1) |
| Latitude | `latitude` | Device GPS latitude |
| Longitude | `longitude` | Device GPS longitude |
| Distance | `distance_meters` | Calculated distance from church |
| Status | `status` | Approved or Rejected |
| Reason | `reason` | Inside or outside geofence |
| Browser | `browser` | Browser family reported by the site |
| Device | `device` | Mobile or desktop classification |
| Device ID | `device_id` | Locally generated duplicate-check identifier |

Supabase also records an internal row ID, creation timestamp, whether an admin override was used, and an import fingerprint that makes the historical migration repeatable without duplicating rows.

## Supporting attendance data

`attendance_members` reproduces the whitelist with the original display name, normalized matching name, active state, and audit timestamps.

`attendance_settings` stores the singleton attendance switch, church coordinates, radius, and last update time.

## Security controls

- Row Level Security is enabled on all three attendance tables.
- `anon` and `authenticated` roles have no direct table grants or policies.
- Direct Data API access was tested and returned HTTP 401.
- Browser code never receives the Supabase service-role credential.
- The existing Next.js API remains the browser-facing validation boundary.
- The Supabase Edge Function validates a dedicated random 256-bit server gateway secret before using its server-only service role; member and admin passwords cannot call it directly.
- Attendance inputs are bounded and type-checked before geofence calculations or persistence.
- An indexed database constraint prevents simultaneous non-override approved check-ins from the same device on the same date.
- Admin overrides are retained explicitly so the existing workflow still works.
- Admin attendance reads and settings writes still require the signed admin session.

## Privacy considerations

Attendance records contain precise location and a persistent device identifier. Access should remain limited to administrators, exports should be handled as confidential data, and a written retention period should be adopted. Browser/device labels are approximate rather than authoritative hardware identities.

## Verification

- Production Next.js build passed.
- Desktop, tablet, mobile, admin posting, and Supabase attendance browser tests passed with zero console errors.
- Source validation found no invalid dates, services, names, coordinates, distances, or statuses.
- Supabase counts match the source sheet.
- Security and performance advisors returned informational notices only. The RLS-with-no-policy notices are expected for the intentional server-only tables; unused-index notices are expected immediately after creating a new database.
