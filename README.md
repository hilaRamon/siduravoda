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

`GET /api/entities/PublishedSchedule` is public (for `/schedule`).

Uploaded PDFs are stored in the local `uploads/` directory and served back as static files.
