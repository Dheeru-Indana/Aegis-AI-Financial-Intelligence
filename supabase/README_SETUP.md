# AegisAI — Complete Database Setup & Integration Guide

This guide describes how to reset, reconstruct, and verify the AegisAI Supabase database, and how the application integrates with it.

---

## 1. Quick Start Execution Order

Open your **[Supabase Project Dashboard](https://supabase.com/dashboard) -> SQL Editor** and execute the scripts in this exact order:

```
[reset_dev.sql]  (Optional selective reset if needed)
       │
       ▼
[setup_all.sql]  (Complete authoritative schema, RLS, functions & seed)
       │
       ▼
[verify_setup.sql] (Read-only verification & security checks)
       │
       ▼
[bootstrap_admin.sql] (One-time elevation of your registered account)
```

---

## 2. Script Details

### 1. `supabase/reset_dev.sql`
- **Purpose:** Safely cleans out old partial application tables and enums before rebuilding.
- **Safety Latch:** Line 53 contains:
  ```sql
  v_confirm_destructive_reset BOOLEAN := FALSE;
  ```
  Set this to `TRUE` to confirm execution in a development project.
- **Deletions:** Only deletes AegisAI-owned tables (`profiles`, `transactions`, `fraud_cases`, etc.), functions, triggers, and enums in the `public` schema.
- **Safeguards:** NEVER touches `auth.users`, storage buckets, platform schemas, or `public` schema itself.

### 2. `supabase/setup_all.sql`
- **Purpose:** A single, self-contained, idempotent SQL script that sets up the entire application database.
- **Features:**
  - Creates the `public.user_role` enum (`administrator`, `fraud_analyst`, `investigator`, `auditor`) before any table references it.
  - Builds all 13 canonical tables with correct foreign keys and check constraints.
  - Employs stored generated columns (`customer` from `customer_reference`, `latency` from `latency_ms`, `impact` from `score_impact`) so legacy queries and enterprise inserts coexist seamlessly.
  - Automatic profile provisioning trigger (`on_auth_user_created`) on `auth.users` with safe default role (`fraud_analyst`).
  - Row Level Security (RLS) enabled on every table with zero anonymous write policies.
  - Immutability trigger on `audit_logs` preventing alteration or deletion.
  - Profile role protection trigger preventing client-side privilege self-elevation.
  - Supabase Realtime publication registration for live event streams.
  - Optional synthetic demo records (transactions, cases, risk rules, models) using `ON CONFLICT DO NOTHING / UPDATE`.

### 3. `supabase/verify_setup.sql`
- **Purpose:** Comprehensive read-only audit.
- **Expected Results:**
  - Check 1: 13 rows returned, all showing `exists = true`, `rls_enabled = true`, and `status = 'OK'`.
  - Check 2: Confirms `user_role` enum and all 4 roles.
  - Check 3: Confirms **0 rows** returned for anonymous write policies.
  - Check 5: Confirms `customer_reference`, `customer`, `latency_ms`, and `latency` all exist on `public.transactions`.

---

## 3. Provisioning the First Administrator

To prevent self-elevation vulnerabilities, all new user registrations default strictly to the `fraud_analyst` role. To promote your administrator:

1. Register an account in the AegisAI Login interface (e.g. `admin@yourdomain.com`).
2. Open [`supabase/migrations/bootstrap_admin.sql`](migrations/bootstrap_admin.sql) in the Supabase SQL Editor.
3. Replace `admin@aegisai.internal` with your registered email and click **Run**.
4. The user profile is promoted to `administrator` and an immutable audit event is recorded.

---

## 4. Frontend Status Indicators & Connection States

The application top bar and banner accurately reflect the connection state:

| Banner / Indicator | Meaning | Required Action |
| :--- | :--- | :--- |
| **`SUPABASE LIVE · RLS ENFORCED`** (Green) | Supabase credentials configured and database health check succeeded. | System is operational. |
| **`CONNECTION ERROR / RECONNECTING`** (Red) | Supabase credentials configured, but database query failed (e.g. invalid key or network issue). | Check `.env.local` credentials and verify database permissions. |
| **`SYNTHETIC DATA SIMULATION`** (Amber) | Unconfigured mode. Credentials missing or set to placeholders. | Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local`. |
