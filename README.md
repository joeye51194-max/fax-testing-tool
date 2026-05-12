# Fax Test Tool

A small Node/Express app for sending a standard test fax through a fax provider API and tracking delivery webhooks.

## What It Does

- Accepts a destination fax number in E.164 format.
- Sends a generated PDF test page through the configured fax provider.
- Receives fax provider webhooks at `/webhooks/fax-provider`.
- Shows a status timeline for the latest test.
- Runs in dry-run mode until provider environment variables are configured.

## Local Setup

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Set these in Railway or your deployment environment:

```text
TELNYX_API_KEY=
TELNYX_FAX_CONNECTION_ID=
TELNYX_FAX_FROM_NUMBER=
SITE_URL=https://your-public-domain.example
DRY_RUN=false
RATE_LIMIT_PER_DAY=10
```

`SITE_URL` must be publicly reachable by the fax provider because it fetches `/test-fax.pdf` and posts delivery events to
`/webhooks/fax-provider`.

## Notes

The MVP stores test records in memory. That is fine for local testing, but production should use a database or durable
store so webhook status survives restarts and multiple instances.
