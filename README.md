# Siduravoda

This project now includes a local Node.js backend that mirrors the `base44` entities with MongoDB collections.

## Setup

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env`
3. Set `MONGODB_URI` to your MongoDB connection string
4. Start the API:
   `npm run server`
5. In another terminal, start the frontend:
   `npm run dev`

The frontend talks to the API through `VITE_API_BASE_URL` and defaults to `http://localhost:4000`.

## Authentication

Login uses the local API (not Base44):

- `POST /api/auth/login` — returns `{ token, user }`
- `GET /api/auth/me` — current user (requires `Authorization: Bearer <token>`)
- `POST /api/auth/logout`
- `POST /api/auth/invite` — admin only, creates user with temporary password
- `PATCH /api/auth/users/:id` — admin only, update role/permissions

On first start with an empty `User` collection, an admin is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`.

**Permission levels** (set in Admin Tools → הרשאות משתמשים):

| Level | Access |
|--------|--------|
| מנהל (`admin`) | Full app + user management |
| משתמש (`user`) | Assignments, students, reports, etc. |
| דיווח זמנים (`reporter`) | `/time-reporting` only |

The JWT is stored in `localStorage` as `auth_token` and sent on every API request.

## Backend

The Express server lives in `server/` and exposes:

- `GET /api/health`
- Auth routes under `/api/auth`
- `GET/POST/PATCH/DELETE /api/entities/:entityName` (authenticated; see middleware)
- `POST /api/entities/:entityName/filter`
- `POST /api/entities/:entityName/bulk`
- `POST /api/integrations/core/upload-file` (authenticated)

`GET /api/public/schedule` is public (for `/schedule`; no sign-in). `GET /api/entities/PublishedSchedule` is also readable without auth.

Uploaded PDFs are stored in the local `uploads/` directory and served back as static files.

## Weekly automatic backup

The server can generate a full data backup (students, workplaces, vehicles, assignments) as a ZIP of Excel files and email it to addresses configured in Admin Tools → גיבוי.

**Schedule (production):** A Render Cron Job calls `POST /api/admin/backup/run` every Sunday at 7:00 UTC (~9:00 Israel winter time). See `render.yaml`.

**Manual trigger (local or admin UI):**

```bash
curl -X POST -H "Authorization: Bearer $BACKUP_CRON_SECRET" http://localhost:4000/api/admin/backup/run
```

Admins can also use **שלח גיבוי עכשיו** in Backup Email Settings.

When a **new email address** is saved, the server sends the latest stored backup to that address only (verification).

**Required env vars:**

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM=גיבוי רגבים <backup@example.com>
BACKUP_CRON_SECRET=long-random-secret
```

Set `BACKUP_CRON_SECRET` on both the API web service and the Render cron job.

Backups are stored under `uploads/backups/`.

## Render deployment

This app is typically deployed as **two Render services**:

| Service | URL | Type |
|--------|-----|------|
| Frontend | `siduravoda.onrender.com` | Static Site (`dist/`) |
| API | `siduravoda-server.onrender.com` | Web Service (`npm start`) |

**Frontend (static site)** — required settings:

- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Rewrite rule: `/*` → `/index.html` (SPA fallback for `/schedule`, `/time-reporting`, etc.)

The rewrite is included via `public/_redirects` (copied into `dist/` on build) and `render.yaml`.

**Frontend build env:**

- `VITE_API_BASE_URL=https://siduravoda-server.onrender.com`

**API (web service)** — required settings:

- Build command: `npm install && npm run install-chrome && npm run build`
- Start command: `npm start`
- `PUPPETEER_CACHE_DIR=/opt/render/project/src/.cache/puppeteer` (so Chromium downloaded at build is found at runtime; see `render.yaml`)
- `CLIENT_ORIGIN=https://siduravoda.onrender.com` (no trailing slash)
- `MONGODB_URI`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, etc.

Admin Tools links use the **frontend** origin (`window.location.origin`), so SPA rewrites must be configured on the static site — not only on the API server.
