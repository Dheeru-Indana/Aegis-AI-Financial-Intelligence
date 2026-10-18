# AegisAI — Production & Free-Tier Deployment Guide

This guide details zero-cost and production hosting options for both the React/Vite frontend and the Python FastAPI model microservice.

---

## 1. Architecture Overview for Deployment

```
[Vercel / Netlify / Cloudflare Pages]  ── (HTTPS) ──►  [React 19 SPA (Static Assets)]
                                                              │
                                                              ├─► Supabase Cloud (PostgreSQL + Auth + Realtime)
                                                              └─► Render.com / Railway.app (FastAPI ML Container)
```

---

## 2. Frontend Deployment (Vercel / Cloudflare Pages / Netlify)

### 2.1 Build Settings
- **Framework Preset:** Vite
- **Root Directory:** `./`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Node.js Version:** `18.x` or `20.x`

### 2.2 Environment Variables (Frontend)
Configure these in your hosting project settings:
```env
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_API_BASE_URL=https://<your-ml-service-host>.onrender.com
```

### 2.3 Single-Page App (SPA) Rewrites
For Vercel, ensure `vercel.json` exists in project root:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## 3. Python ML Model Service Deployment (Render / Railway)

The model microservice is packaged as a lightweight Docker container (<120MB) utilizing `Dockerfile.ml`.

### 3.1 Deploying via Docker (Render.com Free Web Service)
1. Link your GitHub repository to Render.
2. Select **Web Service** $\to$ **Docker**.
3. Set **Dockerfile Path:** `./Dockerfile.ml`.
4. Environment variables:
   - `PORT`: `8000`
5. Free-tier note: Free web services on Render spin down after 15 minutes of inactivity. When spinning up, cold-start takes ~30-45 seconds. AegisAI's client automatically falls back to `TrainedMLScorer` during model service cold starts, ensuring uninterrupted scoring.

### 3.2 Health Check Endpoint
- Health path: `/health` (Returns HTTP 200 `{"status": "healthy"}`)

---

## 4. Production Security & RLS Verification

Before opening to public traffic:
1. Ensure `bootstrap_admin.sql` has been executed in Supabase SQL editor.
2. Ensure row-level security (RLS) is enabled on all tables:
   ```sql
   ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.risk_rules ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
   ```
3. Never expose Supabase service-role key in frontend environment variables. Only use publishable anon key.
