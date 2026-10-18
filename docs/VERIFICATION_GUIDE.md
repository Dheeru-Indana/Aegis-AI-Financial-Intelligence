# AegisAI — Step-by-Step System Verification Guide

This operational manual allows anyone (engineer, analyst, or auditor) to verify every component of AegisAI from local runtime to live Supabase synchronization and ML inference.

---

## 1. Prerequisites & Environment Setup

Verify the local environment has Node.js (v18+) and Python 3.10+:

```bash
# Verify versions
node -v
python3 --version
```

Verify your `.env.local` contains the required configuration:
```env
VITE_SUPABASE_URL=https://xigdorepotawochqpcrg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_API_BASE_URL=http://localhost:8000
```

---

## 2. Starting the Backend Model Microservice

1. Activate the Python virtual environment and run the FastAPI server:
```bash
# In project root
source ml_env/bin/activate
uvicorn supabase.model_service:app --host 0.0.0.0 --port 8000 --reload
```

2. Confirm model health via curl or browser:
```bash
curl http://localhost:8000/health
# Expected JSON output:
# {"status":"healthy","model_version":"fraud-v2.0.0-logistic","artifact_loaded":true}
```

3. Confirm model diagnostics:
```bash
curl http://localhost:8000/model/info
# Returns model architecture, training provenance, and feature weights
```

---

## 3. Starting the Frontend Application

1. In a separate terminal, launch the Vite dev server:
```bash
npm run dev
```
2. Navigate to `http://localhost:5173`.

---

## 4. Verifying Real Connection & Stream Status

1. Open **Live Transactions** (`/transactions`).
2. Observe the status badge on the top right:
   - **Realtime stream: Live (Green)**: Indicates active WebSocket subscription to Supabase `realtime_transactions`.
   - **Stream paused (Amber)**: When user clicks "Pause stream".
   - **Stream disconnected (Red)**: Shown honestly if network or credentials fail, without falsely pretending it is live.
3. Observe the caption indicator:
   - Displays `Synchronized with Supabase Realtime` or `Supabase connected (Realtime socket disconnected)`.

---

## 5. Verifying Real ML Scoring via Test Event Injection

1. On the **Live Transactions** page, click **Inject test event**.
2. Notice the instant toast notification:
   `Test event TXN-XXXXX (provenance: test) scored via live_ml (Score: XX)`
3. The event will appear with the explicit provenance tag `test`, preventing contamination of production metrics.
4. Click on the transaction row to inspect the linear feature attribution breakdown (SHAP-like attribution) in the side drawer.

---

## 6. Verifying the End-to-End CSV Ingestion Pipeline

1. In the Live Transactions view, click **Import CSV**.
2. Upload the provided test fixture: `src/__tests__/fixtures/sample_transactions.csv`.
3. In the preview modal:
   - Row 1, 2, 3: Valid transactions (Accepted).
   - Row 4: Negative amount (Rejected with validation error).
   - Row 5: Duplicate ID `TXN-90001` (Flagged as duplicate).
4. Click **Confirm & Ingest**:
   - Each valid row is scored using `fraud-v2.0.0-logistic`.
   - Records are persisted with `provenance: "imported"` and assigned a batch ID like `BATCH-2026-10-18-XXXXX`.
   - The transactions table and Overview KPIs update immediately.
5. In the **Provenance Filter** dropdown, select **Imported CSV Only**:
   - The view filters down strictly to transactions from the CSV import.
6. Click **Export**:
   - Download the filtered CSV. Formula injection prevention automatically quotes dangerous prefixes (`=`, `+`, `-`, `@`).

---

## 7. Administrator Role Restoration & Access Verification

If the administrator account (`admin@aegisai.com`) needs elevation in the remote Supabase project:
1. Open the Supabase SQL Editor.
2. Execute the verified script: `supabase/bootstrap_admin.sql`.
3. Sign in as `admin@aegisai.com` in the application.
4. Verify the top-left workspace switcher reveals **Admin Workspace** and navigation permits full administrative controls.

---

## 8. Running Automated Test Suites

Verify all test suites pass with zero regressions:

```bash
# 1. Run TypeScript unit and integration tests (20 tests)
npx vitest run

# 2. Run Python ML inference tests (7 tests)
PYTHONPATH=. ./ml_env/bin/pytest ml/tests/test_model_service.py

# 3. Compile production bundle
npm run build
```
All commands should exit with code 0.
