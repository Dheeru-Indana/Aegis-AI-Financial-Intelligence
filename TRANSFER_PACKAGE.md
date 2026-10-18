# AegisAI — Antigravity Context & Project Handoff Package
**Project**: AegisAI — Enterprise Financial Intelligence & Fraud Detection  
**Target Environment**: React 19 + TypeScript + Vite + Supabase (PostgreSQL 15+ with Row-Level Security)  
**Handoff Date**: October 2026  
**Conversation / Session ID**: `a5c6a011-dc1f-42e4-91e4-8e1073b45991`

---

## 1. Executive Summary & Purpose

This document serves as the **authoritative context transfer package** for developers, DevOps engineers, and AI coding agents (such as Google Antigravity / Gemini) resuming work on this repository.

It captures the complete architectural journey, the database rebuild, the authentication and role-based access control (RBAC) implementation, pitfalls encountered with Supabase, and exact instructions on running and verifying the project.

---

## 2. Key Architecture & Repository Structure

```text
aegisai-frontend/
├── .env.example                     # Environment template with Supabase keys
├── .env.local                       # Local active environment variables (gitignored)
├── src/
│   ├── App.tsx                      # Root shell, health probe, workspace router, navigation
│   ├── lib/
│   │   ├── authContext.tsx          # Real Supabase Auth context (RBAC, session, profiles)
│   │   ├── supabase.ts              # Supabase JS client & truthful DB health check
│   │   ├── dataService.ts           # Unified data adapter (Supabase live vs synthetic mock)
│   │   ├── scoringEngine.ts         # Deterministic fraud scoring pipeline
│   │   └── types.ts                 # Full domain models (Transaction, Case, Rule, etc.)
│   ├── views/
│   │   ├── LoginPage.tsx            # Auth gateway (Sign in, multi-step signup, forgot password)
│   │   ├── AdminWorkspace.tsx       # Superuser console (User management, audit logs, drift)
│   │   ├── WorkspaceSelector.tsx    # Left-sidebar switcher between Risk Operations & Admin
│   │   ├── ProfileDropdown.tsx      # Top-right avatar menu (Role badge, sign out)
│   │   ├── Overview.tsx             # Executive KPI dashboard
│   │   ├── Transactions.tsx         # Live transaction stream & triage
│   │   ├── Cases.tsx                # Fraud case management
│   │   ├── ExplainableAI.tsx        # SHAP/feature contribution visualizations
│   │   ├── FraudRingExplorer.tsx    # Graph intelligence for mule accounts
│   │   ├── AnalystCopilot.tsx       # AI triage assistant
│   │   ├── Analytics.tsx            # Risk velocity & volume distributions
│   │   ├── CostSimulator.tsx        # Financial impact modeling
│   │   ├── ModelDriftRadar.tsx      # PSI / model drift metrics
│   │   ├── DisagreementRadar.tsx    # Multi-model divergence triage
│   │   ├── FeedbackLoop.tsx         # Ground-truth verified dataset curation
│   │   └── DigitalTwin.tsx          # Adversarial attack simulation
│   └── __tests__/
│       ├── authFlow.test.ts         # Automated auth, RBAC & registration tests
│       ├── edgeFunctionSecurity.test.ts
│       ├── modelScorers.test.ts
│       └── scoringEngine.test.ts
├── supabase/
│   ├── setup_all.sql                # Complete, authoritative schema, RLS, triggers & seed
│   ├── reset_dev.sql                # Development-only clean reset script (safety-latched)
│   ├── verify_setup.sql             # Read-only schema verification query
│   ├── README_SETUP.md              # Detailed Supabase setup documentation
│   └── migrations/
│       ├── bootstrap_admin.sql      # Superuser script to confirm email & grant 'administrator'
│       ├── 20261015000000_initial_schema.sql
│       ├── 20261015000001_enterprise_schema.sql
│       └── 20261016000000_notifications_and_feedback.sql
└── TRANSFER_PACKAGE.md              # This file
```

---

## 3. History of Problems Solved

### Problem A: Supabase Database Schema Incompleteness
- **Symptom**: Migrations previously failed with `type "user_role" does not exist` and `column "customer_reference" does not exist`. Only 5 out of 13 tables existed in Supabase.
- **Root Cause**: Fragmented migration files had circular dependencies between `profiles`, `transactions`, and `notification_events`.
- **Solution**: Created `supabase/setup_all.sql` — an idempotent, single-file deployment script containing:
  - All 7 custom PostgreSQL enums (`public.user_role`, `public.decision_type`, etc.)
  - All 13 canonical tables with dual-compatibility generated columns (`customer` alongside `customer_reference`, `latency` alongside `latency_ms`).
  - Row Level Security (RLS) on all 13 tables.
  - Realtime publication subscriptions on transactions, cases, activity, audit logs, and notifications.

### Problem B: Application Auto-Logged In to a Mock Account
- **Symptom**: Opening or refreshing the app automatically opened the dashboard as "Arjun Sharma (Fraud Analyst)" without any login prompt.
- **Root Cause**: `authContext.tsx` initialized `profile` to `defaultDemoProfile` whenever `isSupabaseConfigured` was false or evaluating, and `App.tsx` did not strictly gate on `!profile`.
- **Solution**:
  - `profile` and `user` now start strictly as `null` with `isLoading: true`.
  - On mount, `supabase.auth.getSession()` checks for an active session.
  - If no session exists, `<LoginPage />` is unconditionally rendered.
  - Client-side role switching dropdown was completely removed. Roles are read-only directly from `public.profiles.role`.

### Problem C: "Supabase .env not configured" Warning Banner
- **Symptom**: The login page showed a yellow alert warning that credentials were missing.
- **Root Cause**: Only `.env.example` existed in the repo. Vite only injects environment variables into `import.meta.env` if they are defined in `.env` or `.env.local`.
- **Solution**: Generated `.env.local` containing:
  ```env
  VITE_API_BASE_URL=http://localhost:8000
  VITE_USE_MOCKS=false
  VITE_SUPABASE_URL=https://xigdorepotawochqpcrg.supabase.co
  VITE_SUPABASE_ANON_KEY=sb_publishable_fM4mXQ0ZMWQaIGYqgBKqAg_VxsVJj9F
  ```

### Problem D: Email Verification & SMTP Rate Limits
- **Symptom**: Registering test accounts produced `email rate limit exceeded`, or required confirmation via emails that don't exist in real life.
- **Solution**:
  - In Supabase Dashboard -> **Authentication -> Providers -> Email**, toggle off **Confirm email** for instant sign-ups.
  - For already-registered accounts, `bootstrap_admin.sql` directly updates `auth.users.email_confirmed_at = now()`, instantly confirming the account without email tokens.

### Problem E: "Permission denied for table profiles" & Locked Admin Page
- **Symptom**: After logging in with the admin account, a top banner displayed `Error: permission denied for table profiles`, and "Admin Governance" in the left sidebar was locked.
- **Root Cause**:
  1. PostgreSQL table-level privileges (`GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated`) were missing, so the REST API could not query `public.profiles` even if RLS permitted it.
  2. The `tr_protect_profile_role` trigger prevented role changes unless `auth.uid()` was an admin. In the SQL Editor, `auth.uid()` is `NULL` (running as database superuser), which caused the trigger to block updates.
- **Solution**:
  - Updated `bootstrap_admin.sql` to include:
    ```sql
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
    GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;
    GRANT SELECT ON public.profiles TO anon;
    GRANT SELECT ON public.risk_rules TO anon;
    ```
  - Updated `check_profile_role_update()` trigger function so that superuser SQL Editor scripts (`auth.uid() IS NULL`) can safely update roles, while client-side API requests (`auth.uid() IS NOT NULL`) are strictly restricted.

---

## 4. How to Set Up the Project (Step-by-Step for New Developer)

### Step 1: Install Dependencies
```bash
git clone <repo-url>
cd aegisai-frontend
npm install
```

### Step 2: Configure Environment
Create `.env.local` in the project root:
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_USE_MOCKS=false
VITE_SUPABASE_URL=https://xigdorepotawochqpcrg.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_fM4mXQ0ZMWQaIGYqgBKqAg_VxsVJj9F
```

### Step 3: Run the Database Setup (If setting up a fresh Supabase instance)
1. Open your Supabase project -> **SQL Editor**.
2. Run `supabase/setup_all.sql`.
3. Run `supabase/verify_setup.sql` to confirm all 13 tables and RLS are active.

### Step 4: Start the Dev Server
```bash
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) in your browser.

---

## 5. How to Create & Log In as an Administrator

1. Open [http://localhost:5173/](http://localhost:5173/).
2. Click **"Register now"** and sign up with your email (e.g., `admin@aegisai.com`).
3. Open your Supabase project -> **SQL Editor**.
4. Open [supabase/migrations/bootstrap_admin.sql](file:///Users/dheeruindana/Documents/VS%20Code%20Projects/aegisai-frontend/supabase/migrations/bootstrap_admin.sql).
5. Ensure `v_email` matches your registered email:
   ```sql
   v_email TEXT := 'admin@aegisai.com';
   ```
6. Click **Run**.
7. Return to `http://localhost:5173/` and sign in.
8. Access the **Admin Governance Workspace** via:
   - The top-left **Workspace Selector** (click "Risk Operations" $\vee$ -> select "Admin Governance").
   - Or the top-right **Profile Avatar** -> click "Admin Monitoring Workspace".

---

## 6. Automated Test Suite & Code Verification

Run the full automated test suite anytime using Vitest:
```bash
npx vitest run
```
**Current test suite coverage (`src/__tests__/`)**:
- `authFlow.test.ts`: Unauthenticated session default, session restoration, RBAC validation, sign-out token invalidation, registration form validation.
- `edgeFunctionSecurity.test.ts`: Supabase Edge function contracts (HTTP 401/403, JWT verification, payload bounds).
- `modelScorers.test.ts`: ML model scoring interfaces.
- `scoringEngine.test.ts`: Risk score calculation and signal detection.

Verify full production TypeScript build:
```bash
npm run build
```
*(Runs `tsc -b && vite build` — current status: 0 errors, clean build).*

---

## 7. Instructions for Antigravity / Gemini Agents Resuming Work

If you are an AI coding assistant picking up this workspace:
1. **Preserve Database Contracts**: Do NOT modify the column definitions in `public.transactions` (`customer_reference` with `customer` alias, `latency_ms` with `latency` alias).
2. **Preserve Authentication Gating**: `App.tsx` must always check `if (showLoginPage || !profile) return <LoginPage ... />`. Never add fallback demo profiles that bypass authentication.
3. **Preserve Backend RBAC**: Admin access to `AdminWorkspace` must remain conditioned on `profile.role === 'administrator'`. Never reintroduce client-side role switchers.
4. **Environment Variables**: Always verify `.env.local` is present and loaded before debugging database connection issues.
