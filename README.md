# CommunityPortal

CommunityPortal is a React + Vite frontend scaffold with role-gated resident/admin modules and a lightweight sync API.

## Frontend development

```bash
npm install
npm run dev
```

## Build + lint validation

```bash
npm run build
npm run lint
```

## Local sync API (backend pattern starter)

This repository now includes a small API server based on the Community Covenant Platform sync flow.

```bash
npm run server
```

Server defaults:
- URL: `http://localhost:8787`
- State file: `.portal-api-state.json` in the repo root

Optional environment variables:
- `PORT` (default `8787`)
- `PORTAL_STATE_FILE` (custom path for persisted sync state)
- `ALLOWED_ORIGINS` (comma-separated CORS allowlist; empty allows all origins)

## Sync API endpoints

- `GET /api/portal/health`
- `GET /api/portal/summary`
- `GET /api/portal/export`
- `POST /api/portal/sync`
- `GET /api/portal/records/:scope`

`POST /api/portal/sync` accepts:
- `backup.payload.announcements`
- `backup.payload.documents`
- `backup.payload.comments`
- `mode`: `replace`, `merge`, or `missing`
- optional `scopes` booleans for `announcements`, `documents`, `comments`
