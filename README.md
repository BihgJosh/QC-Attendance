# Quality Control Unit Church Attendance Platform

A geofenced attendance platform built for church departments to prevent fraudulent check-ins.

## Tech Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- Framer Motion
- Google Sheets API

## Environment Setup

Create `.env.local` in the project root for local development:

```env
ADMIN_PASSWORD=QCADMIN2026
SHARED_PASSWORD=QCSOJA
CHURCH_LATITUDE=0.000
CHURCH_LONGITUDE=0.000
GEOFENCE_RADIUS=100
GOOGLE_SHEET_ID=your_google_spreadsheet_id_here
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account-email@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=verified-sender@yourdomain.com
BREVO_SENDER_NAME=QC Unit
BREVO_REPLY_TO_EMAIL=reply-to@yourdomain.com
```

`ADMIN_PASSWORD` is only checked on the backend. It is never sent to the browser.

`SHARED_PASSWORD` is the member attendance password checked by the attendance API.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Admin login is available at `http://localhost:3000/admin/login`.

## Google Sheets Setup

Create a Google Sheet with three tabs named exactly:

- `Config`
- `Whitelist`
- `Attendance`

In `Config`, add:

- `A1: churchLat`, `B1: 0.000`
- `A2: churchLng`, `B2: 0.000`
- `A3: allowedRadius`, `B3: 100`
- `A4: isOpen`, `B4: false`

Passwords are read from environment variables, not from Google Sheets.

In `Whitelist`, put `Name` in `A1`, then list member names below it.

In `Attendance`, add this header row:

```text
Date | Service | Member Name | Time | Latitude | Longitude | Distance | Status | Reason | Browser | Device | Device ID
```

The `Device ID` column is used to prevent the same device from signing in twice in one day. Each browser generates a unique persistent ID stored in `localStorage`.

## Google Cloud Credentials

1. Go to Google Cloud Console.
2. Enable the Google Sheets API.
3. Create a Service Account.
4. Create a JSON key for the Service Account.
5. Use the JSON `client_email` as `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
6. Use the JSON `private_key` as `GOOGLE_PRIVATE_KEY`.
7. Share the Google Sheet with the Service Account email and give it Editor access.
8. Copy the spreadsheet ID into `GOOGLE_SHEET_ID`.

## Deploy on Vercel

1. Push the repo to GitHub.
2. Import the repo in Vercel.
3. Add these Environment Variables in Vercel Project Settings:

```env
ADMIN_PASSWORD=
SHARED_PASSWORD=
CHURCH_LATITUDE=
CHURCH_LONGITUDE=
GEOFENCE_RADIUS=
GOOGLE_SHEET_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=QC Unit
BREVO_REPLY_TO_EMAIL=
```

4. Deploy.

If any required environment variable is missing, the app logs a clear console error instead of exposing secrets or returning HTML from API routes.
