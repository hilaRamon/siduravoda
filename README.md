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

## Backend

The Express server lives in `server/` and exposes:

- `GET /api/health`
- `GET/POST/PATCH/DELETE /api/entities/:entityName`
- `POST /api/entities/:entityName/filter`
- `POST /api/entities/:entityName/bulk`
- `POST /api/integrations/core/upload-file`

Uploaded PDFs are stored in the local `uploads/` directory and served back as static files.
