# Render Deployment Guide — Pokenetes API

This guide walks through provisioning **two separate Render Web Services** (Test and Production) for the Pokenetes backend, wiring environment secrets, and connecting GitHub Actions deploy hooks.

---

## Prerequisites

- A [GitHub](https://github.com) repository with `main` and `dev` branches pushed
- Two [Supabase](https://supabase.com) projects (Test and Production)
- A [Render](https://render.com) account linked to your GitHub account

---

## 1. Service Provisioning

Create **two independent Web Services** on Render, each tied to a different branch and Supabase instance.

### 1.1 Test Web Service (`dev` branch)

1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Web Service**.
3. Connect your GitHub account if not already connected.
4. Select the **Pokenetes** repository.
5. Configure the service:

   | Setting | Value |
   |---|---|
   | **Name** | `pokenetes-api-test` (or your preferred name) |
   | **Region** | Choose closest to your users |
   | **Branch** | `dev` |
   | **Root Directory** | *(leave blank)* |
   | **Runtime** | `Node` |
   | **Build Command** | `npm install --include=dev && npm run build` |
   | **Start Command** | `npm start` |
   | **Instance Type** | Free or Starter |

6. Click **Create Web Service**.

### 1.2 Production Web Service (`main` branch)

Repeat the steps above with these differences:

   | Setting | Value |
   |---|---|
   | **Name** | `pokenetes-api-prod` |
   | **Branch** | `main` |
   | **Build Command** | `npm install --include=dev && npm run build` |
   | **Start Command** | `npm start` |

---

## 2. Environment & Build Configuration

After each service is created, open **Environment** in the Render service settings and add the following variables.

### 2.1 Test Service Environment Variables

Use credentials from your **Test Supabase** project (`.env.test`):

| Key | Value |
|---|---|
| `PORT` | `3000` |
| `NODE_ENV` | `test` |
| `SUPABASE_URL` | `https://guawxxfmllfyxmodaqxo.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | *(your test publishable key)* |
| `SUPABASE_SECRET_KEY` | *(your test secret key)* |
| `SUPABASE_JWKS_URL` | `https://guawxxfmllfyxmodaqxo.supabase.co/auth/v1/.well-known/jwks.json` |
| `DATABASE_URL` | *(optional — Supabase → Settings → Database → Connection string)* |

### 2.2 Production Service Environment Variables

Use credentials from your **Production Supabase** project (`.env.prod`):

| Key | Value |
|---|---|
| `PORT` | `3000` |
| `NODE_ENV` | `production` |
| `SUPABASE_URL` | `https://yzzjwbwdrvpzvnbchakm.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | *(your prod publishable key)* |
| `SUPABASE_SECRET_KEY` | *(your prod secret key)* |
| `SUPABASE_JWKS_URL` | `https://yzzjwbwdrvpzvnbchakm.supabase.co/auth/v1/.well-known/jwks.json` |
| `DATABASE_URL` | *(optional — enables automatic DDL migrations on startup)* |

> **Note:** Mark `SUPABASE_SECRET_KEY` and `DATABASE_URL` as **Secret** in Render.

### 2.3 Build & Start Commands

Confirm these settings under **Settings → Build & Deploy**:

- **Build Command:** `npm install --include=dev && npm run build`
- **Start Command:** `npm start`

`--include=dev` ensures TypeScript is available during the Render build even when `NODE_ENV=production`.

---

## 3. Automated Deploy Hooks

Deploy hooks let GitHub Actions trigger a Render redeploy after CI quality gates pass.

### 3.1 Copy Deploy Hook URLs from Render

**Test service:**

1. Open your Test Web Service in Render.
2. Go to **Settings → Deploy Hook**.
3. Click **Create Deploy Hook** (if none exists).
4. Copy the generated URL (format: `https://api.render.com/deploy/srv-XXXXX?key=YYYYY`).

**Production service:**

1. Open your Production Web Service.
2. Repeat the same steps and copy its Deploy Hook URL.

### 3.2 Store Deploy Hooks as GitHub Secrets

1. Go to your GitHub repository → **Settings → Secrets and variables → Actions**.
2. Click **New repository secret** and add:

   | Secret Name | Value |
   |---|---|
   | `RENDER_TEST_DEPLOY_HOOK` | Test service Deploy Hook URL |
   | `RENDER_PROD_DEPLOY_HOOK` | Production service Deploy Hook URL |

### 3.3 How CI Triggers Deployments

| Branch | Workflow | Coverage Gate | Deploy Secret |
|---|---|---|---|
| `dev` | `test-pipeline.yml` | ≥ 60% | `RENDER_TEST_DEPLOY_HOOK` |
| `main` | `prod-pipeline.yml` | ≥ 85% | `RENDER_PROD_DEPLOY_HOOK` |

On push to `dev` or `main`, GitHub Actions will:

1. Install dependencies
2. Build the project
3. Run tests
4. Verify coverage threshold
5. `curl -X POST` the Render Deploy Hook (only on push, not PR)

---

## 4. Database Setup (Supabase)

Before the first deploy, ensure the three required tables exist. You can either:

**Option A — Automatic (recommended):** Set `DATABASE_URL` in Render environment variables. The app runs migrations on startup via `src/db/migrate.ts`.

**Option B — Manual:** Run the DDL scripts in Supabase SQL Editor (see `src/db/schemas/`).

---

## 5. Verify Deployment

After the first successful deploy:

```bash
# Health check
curl https://<your-render-url>/health

# Create a Pokemon (POST)
curl -X POST https://<your-render-url>/pokemon \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Pikachu","tipo":"Electrico","nivel":5}'

# Query records (QUERY method — RFC 9324)
curl -X QUERY https://<your-render-url>/query \
  -H "Content-Type: application/json" \
  -d '{"entity":"pokemon","limit":10}'
```

---

## 6. Branch Strategy Summary

```
main  ──→ Production Render Service  ──→ Production Supabase
dev   ──→ Test Render Service        ──→ Test Supabase
```

- Feature work merges into `dev` first (runs test pipeline, deploys to test).
- Stable releases merge `dev` → `main` (runs production pipeline, deploys to prod).

---

## Troubleshooting

| Issue | Solution |
|---|---|
| Build fails on Render | Ensure Build Command includes `npm run build` |
| 500 on POST routes | Verify Supabase tables exist and secrets are correct |
| Deploy hook not firing | Confirm GitHub secrets match Render Deploy Hook URLs |
| Coverage gate fails in CI | Run `npm run test:coverage` locally and add tests |
