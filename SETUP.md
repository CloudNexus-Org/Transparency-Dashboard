<!-- AI assisted development -->

# Client Project Transparency Dashboard — Setup

This repository contains a production-style full stack: **NestJS + PostgreSQL (Prisma)** and **React (Vite) + Tailwind CSS v4 + Recharts**, with Microsoft Planner (Graph), GitHub, JWT and Microsoft OAuth, RBAC, risk scoring, in-app notifications, optional OpenAI summaries, CSV/PDF export, and dark mode.

## Prerequisites

- Node.js 20+
- Docker (recommended) for PostgreSQL, or any PostgreSQL 16 instance
- (Optional) Microsoft Entra ID app registration for OAuth and Graph
- (Optional) GitHub personal access token (fine-scoped `repo` read)
- (Optional) OpenAI API key for richer weekly narratives

## 1. Database

From the repo root:

```bash
docker compose up -d
```

Default connection:

`postgresql://postgres:postgres@localhost:5432/transparency?schema=public`

## 2. Backend

```bash
cd backend
cp ../.env.example .env
# Edit .env — set JWT_SECRET, DATABASE_URL, DEMO_DATA=true for local UX without Graph/GitHub keys
npx prisma migrate deploy
npm run db:seed
npm run start:dev
```

API base URL: `http://localhost:3000/api`  
Health: `GET http://localhost:3000/api/health`

### Environment highlights

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signing key for JWT sessions |
| `DEMO_DATA` | When `true`, synthesizes Planner/GitHub-style data if live APIs are unavailable |
| `GRAPH_ACCESS_TOKEN` | Optional static Graph token (short-lived; dev only) |
| `GITHUB_TOKEN` | PAT for private repo reads |
| `MICROSOFT_*` | OAuth + optional client credentials for Graph |
| `ENABLE_ALERT_CRON` | Set `true` to run daily in-app alert checks |
| `OPENAI_API_KEY` | Optional; falls back to template summary if unset |

### Microsoft Planner (Graph)

1. Register an app in Entra ID; add redirect URI matching `MICROSOFT_REDIRECT_URI`.
2. Grant delegated permissions (e.g. `User.Read`, `Tasks.Read`, `Group.Read.All`) or use application permissions appropriate to your tenant policy.
3. For unattended sync, prefer **client credentials** (`MICROSOFT_CLIENT_ID` / `SECRET` / `TENANT_ID`) and ensure the app can read the target Planner plan.
4. Store each project’s Planner **plan ID** in `Project.plannerPlanId` (admin API or Prisma Studio).

### GitHub

Set `GITHUB_TOKEN` and per-project `githubOwner` / `githubRepo` (see seed sample).

## 3. Frontend

```bash
cd frontend
cp ../.env.example .env
# Set VITE_API_URL=http://localhost:3000/api for non-proxied builds
npm install
npm run dev
```

Vite dev server proxies `/api` to the backend automatically.

## 4. Sample users (after seed)

| Email | Password | Role |
|-------|----------|------|
| `admin@example.com` | `ChangeMeNow!` | Admin — all projects |
| `client@example.com` | `ChangeMeNow!` | Client — only **Alpha** project |

Change passwords before any real deployment.

## 5. API overview

- `POST /api/auth/login` — JWT login  
- `GET /api/auth/microsoft` — OAuth redirect  
- `GET /api/auth/me` — current user (Bearer JWT)  
- `GET /api/projects` — list (filtered for clients)  
- `GET /api/projects/:id/dashboard` — aggregated dashboard + weekly summary  
- `GET /api/projects/:id/risk-history` — historical risk snapshots (from cron)  
- `GET /api/projects/:id/export/csv` | `export/pdf`  
- `GET /api/notifications` — in-app alerts  
- `GET /api/users` — admin-only directory  

## 6. GitHub Pages (frontend only)

GitHub Pages serves **static files only**. The workflow [`.github/workflows/deploy-github-pages.yml`](.github/workflows/deploy-github-pages.yml) builds the Vite app and pushes `frontend/dist` to the **`gh-pages`** branch using [JamesIves/github-pages-deploy-action](https://github.com/JamesIves/github-pages-deploy-action). This avoids `actions/deploy-pages`, which returns **404** for many orgs until “GitHub Actions” Pages is fully enabled.

### Configure Pages (once)

1. Open **Settings → Pages**: `https://github.com/<owner>/<repo>/settings/pages`
2. **Build and deployment → Source:** choose **Deploy from a branch**
3. **Branch:** `gh-pages`, **Folder:** `/ (root)` → **Save**  
   (The first workflow run creates `gh-pages`; if the branch is missing, run the workflow once, then set this.)

### Rest of the setup

1. Add repository **secret** `VITE_API_URL` (public API base URL including `/api`, e.g. `https://your-api.railway.app/api`). CORS on the API must allow `https://<owner>.github.io`.
2. Push to `main` or run the workflow manually. Site URL:  
   `https://<owner>.github.io/<repository-name>/`  
   (`VITE_BASE` is set to `/<repository-name>/` in CI.)
3. Set backend `FRONTEND_URL` to that Pages URL for Microsoft OAuth.

**Org / plan limits:** Pages must be allowed for the repo; see [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

If `VITE_API_URL` is unset at build time, the SPA will not know where to call the API until you add the secret and re-run the workflow.

## 7. Tests

Backend unit tests: `cd backend && npm test`  
E2E (requires DB + `JWT_SECRET`): `cd backend && npm run test:e2e`

## 8. Production notes

- Run migrations with `prisma migrate deploy` in CI/CD.
- Use strong `JWT_SECRET`, TLS termination, and secret storage (Key Vault, etc.).
- Rotate `GRAPH_ACCESS_TOKEN` / PATs; prefer client credentials or on-behalf-of flows for Graph.
- Enable `ENABLE_ALERT_CRON=true` only in a single worker instance to avoid duplicate notifications.
