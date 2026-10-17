# AegisAI — Supabase Clean Reset & Reconstruction Guide

This directory contains the canonical SQL delivery bundle to reconstruct the AegisAI database cleanly in your Supabase project.

---

## 1. Root Cause Summary: Why Previous Migrations Failed

During our repository audit, three major root causes were identified in the previous migration setup:

1. **Missing `public.user_role` Enum:**  
   In the original partial setup, only five tables (`audit_logs`, `fraud_cases`, `profiles`, `risk_rules`, `transactions`) existed from an initial legacy schema (`20261015000000_initial_schema.sql`) where `profiles.role` was defined as `TEXT` with a check constraint.  
   When migration `20261016000000_notifications_and_feedback.sql` was executed on top of that state, it declared `recipient_role user_role` on `public.notification_events`. Because the enterprise schema that created `user_role` had not successfully run first, PostgreSQL threw `type "user_role" does not exist`.

2. **Column Inconsistency: `customer_reference` vs. `customer`:**  
   The initial migration created `public.transactions` with column `customer TEXT NOT NULL`, whereas the enterprise schema declared `customer_reference TEXT NOT NULL`. The frontend code and edge function had mixed assumptions (`transactionService.ts` queried `row.customer`, while `score-transaction` inserted `customer_reference`). Running queries or migrations expecting `customer_reference` failed with `column "customer_reference" does not exist`.

3. **Conflicting & Overlapping Migration Scripts:**  
   The `supabase/migrations/` directory contained competing scripts (`20261015000000_initial_schema.sql` vs. `20261015000001_enterprise_schema.sql`) with different table definitions, anonymous write policies, and schema structures.

---

## 2. SQL Bundle File Inventory

| File | Purpose | Destructive? | Safety Guarantee |
| :--- | :--- | :--- | :--- |
| **`00_preflight.sql`** | Read-only target database inspection, extension check, and existing object audit. | **NO (Read-Only)** | Safe to run anywhere. |
| **`01_reset_dev.sql`** | Selective drop of AegisAI application objects only. | **YES (Dev/Staging only)** | Protected by safety latch (`v_confirm_destructive_reset`). Never drops `auth.users`, storage, or `public` schema. |
| **`02_schema.sql`** | Complete, ordered canonical schema (enums, 13 tables, dual-compat columns, RLS, functions, triggers, realtime). | **NO** (Creates missing objects) | Enums and functions created before dependencies. Least-privilege RLS. |
| **`03_seed_demo.sql`** | Realistic synthetic seed data for models, cases, transactions, and audit logs. | **NO** | 100% synthetic data. Never promotes an administrator. |
| **`04_verify.sql`** | Read-only verification suite checking all 13 tables, RLS enablement, policy rules, and column compatibility. | **NO (Read-Only)** | Flags any missing table or unauthorized anonymous write policy. |

---

## 3. Step-by-Step Execution Order

Execute the scripts one by one in the **Supabase Dashboard -> SQL Editor**:

```
[00_preflight.sql]  ──>  [01_reset_dev.sql]  ──>  [02_schema.sql]  ──>  [03_seed_demo.sql]  ──>  [04_verify.sql]
  (Inspect DB)            (Reset App Schema)         (Build Schema)           (Seed Synthetic)         (Verify Health)
```

### Step 1: Run `00_preflight.sql`
1. Open the [Supabase Dashboard](https://supabase.com/dashboard) and select your target development project.
2. Navigate to **SQL Editor** in the left sidebar.
3. Paste the contents of [`00_preflight.sql`](00_preflight.sql) into a query window and click **Run**.
4. Confirm:
   - `database_name` matches your development project (e.g. `postgres`).
   - Extensions `uuid-ossp` and `pgcrypto` are available.
   - Note which tables already exist.

---

### Step 2: Run `01_reset_dev.sql` (Destructive Reset)
> [!WARNING]
> **What this deletes:** All application tables (`profiles`, `transactions`, `fraud_cases`, `risk_rules`, `audit_logs`, `notification_events`, `user_feedback`, `model_registry`, etc.) and all records stored within them.  
> **What it NEVER deletes:** `auth.users`, registered authentication passwords, storage buckets, or the `public` schema itself.

1. Open [`01_reset_dev.sql`](01_reset_dev.sql).
2. Inside the script, locate the safety latch at line 26:
   ```sql
   v_confirm_destructive_reset BOOLEAN := FALSE;
   ```
3. Change `FALSE` to `TRUE`:
   ```sql
   v_confirm_destructive_reset BOOLEAN := TRUE;
   ```
4. Paste the script into the Supabase SQL Editor and click **Run**.
5. The output will show: `SUCCESS: Selective application reset complete.`

---

### Step 3: Run `02_schema.sql` (Build Canonical Schema)
1. Open [`02_schema.sql`](02_schema.sql).
2. Paste the entire script into a new tab in the Supabase SQL Editor and click **Run**.
3. This creates:
   - All 7 enum types (`public.user_role`, `public.decision_type`, etc.)
   - All 13 canonical tables with proper foreign keys and check constraints.
   - Dual-compatibility generated columns (`customer` alongside `customer_reference`, `latency` alongside `latency_ms`).
   - Strict Row-Level Security on every table.
   - Immutability trigger `tr_audit_tampering` protecting `public.audit_logs`.
   - Role protection trigger `tr_protect_profile_role` preventing self-elevation.
   - Supabase Realtime publication registration.

---

### Step 4: Run `03_seed_demo.sql` (Optional Demo Seed Data)
1. Open [`03_seed_demo.sql`](03_seed_demo.sql).
2. Paste into the Supabase SQL Editor and click **Run**.
3. Seeds synthetic transactions (`TXN-20481` through `TXN-20488`), fraud cases (`CASE-0081` through `CASE-0084`), risk rules (`R-01` through `R-04`), model versions, explanations, and audit logs.

---

### Step 5: Run `04_verify.sql` (Verification & Security Audit)
1. Open [`04_verify.sql`](04_verify.sql).
2. Paste into the Supabase SQL Editor and click **Run**.
3. Inspect each of the verification result tabs:
   - **Check 1 (Table Inventory & RLS):** All 13 tables must display `exists = true`, `rls_enabled = true`, and `status = OK`.
   - **Check 2 (Enums):** `user_role` must contain `administrator, fraud_analyst, investigator, auditor`.
   - **Check 3 (Security Audit):** Query must return **0 rows** (no anonymous write policies).
   - **Check 5 (Dual-Compatibility):** Confirms both `customer_reference` and `customer` exist on `public.transactions`.

---

## 4. Bootstrapping Your First Administrator

To prevent privilege escalation vulnerabilities, all public user registrations default strictly to the `fraud_analyst` role. To elevate the first user:

1. Register an account on your AegisAI login page (e.g., `admin@yourdomain.com`).
2. Open [`supabase/migrations/bootstrap_admin.sql`](../migrations/bootstrap_admin.sql).
3. Update line 24 with your registered email:
   ```sql
   v_email TEXT := 'admin@yourdomain.com';
   ```
4. Click **Run** in the Supabase SQL Editor.
5. The procedure updates `public.profiles.role = 'administrator'` and inserts an immutable audit log record.

---

## 5. Troubleshooting & Recovery

| Issue / Error | Cause | Recovery Action |
| :--- | :--- | :--- |
| `SAFETY STOP: Selective reset aborted` | Safety latch in `01_reset_dev.sql` is set to `FALSE`. | Edit line 26 of `01_reset_dev.sql` to `v_confirm_destructive_reset := TRUE;` and re-run. |
| `type "user_role" does not exist` | Script run out of order. | Run `02_schema.sql` which defines `user_role` before creating tables. |
| Query history shows errors | SQL Editor keeps a log of past queries. | Past red query logs in Supabase SQL Editor are execution history, NOT current database status. Run `04_verify.sql` to inspect actual database state. |
