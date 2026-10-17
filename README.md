# AegisAI — Enterprise Financial Intelligence & Fraud Detection Platform

AegisAI is a financial crime detection and investigation platform built with **React 18**, **TypeScript**, **Vite**, **Supabase PostgreSQL** with strict **Row Level Security (RLS)**, real-time transaction telemetry, and a lightweight machine learning fraud detection scoring engine.

---

## Architecture Overview

```
                                      ┌─────────────────────────────────┐
                                      │      Supabase PostgreSQL        │
                                      │  (RLS, Realtime, Triggers, RBs) │
                                      └──────────────┬──────────────────┘
                                                     │
                             Supabase Client / Realtime Websocket / REST
                                                     │
                                      ┌──────────────┴──────────────────┐
                                      │        AegisAI Shell            │
                                      │   (React + TypeScript + Vite)   │
                                      └──────────────┬──────────────────┘
                                                     │
 ┌─────────────────┬──────────────────┬──────────────┼──────────────────┬──────────────────┐
 │                 │                  │              │                  │                  │
Overview    Live Transactions   Fraud Cases    Explainable AI      Analytics       Risk Rules & Models
 │                 │                  │              │                  │                  │
 └─────────────────┼──────────────────┼──────────────┼──────────────────┼──────────────────┘
                   │                  │              │                  │
         ┌─────────┴─────────┐ ┌──────┴──────┐ ┌─────┴─────┐ ┌──────────┴──────────┐
         │ Attack Twin (F2)  │ │ Network (F3)│ │Copilot(F4)│ │Cost Simulator (F1)  │
         │ Disagreement (F6) │ │             │ │           │ │Drift Radar (F5)     │
         │                   │ │             │ │           │ │Feedback Loop (F7)   │
         │                   │ │             │ │           │ │System Guide (/guide)│
         └───────────────────┘ └─────────────┘ └───────────┘ └─────────────────────┘
```

---

## 7 Advanced AI Fraud Detection Modules

| Module | Route | Algorithmic Mechanism | Data Source & Provenance |
| :--- | :--- | :--- | :--- |
| **1. Cost-Sensitive Decision Simulator** | `/simulator` | Dynamic confusion matrix, expected financial loss curve across thresholds (40–90), configurable false-negative ($15k) and false-positive ($350) costs, and optimal threshold recommendation. | Fixed 1,000-sample labeled evaluation set. Mathematical loss curve. |
| **2. Fraud Attack Digital Twin** | `/digital-twin` | Sandboxed synthetic stress tester with streaming adversary vectors (`Carding`, `Account Takeover`, `Flash Crowd`), playback speed controls, and real-time defense triage metrics. | Deterministic synthetic stream isolated from production database. |
| **3. Fraud Ring Network Explorer** | `/rings` | Interactive SVG relationship visualizer linking accounts, emulated device fingerprints, stolen card BINs, and merchant targets with one-click case escalation. | Entity relationship graph mapping device fingerprint collisions. |
| **4. Evidence-Based Analyst Copilot** | `/copilot` | Context-aware investigation chat grounded strictly in transaction records, SHAP attributions, rule matches, and timeline records with prompt injection disclaimers. | Authenticated transaction explanations & investigation notes. |
| **5. Fraud & Model Drift Radar** | `/drift` | Population Stability Index (PSI) tracking and 7-day drift trend line charts alerting when feature distributions shift away from training baselines. | 7-day monitoring window comparing live sample mean against baseline. |
| **6. Model Disagreement Radar** | `/disagreements` | Multi-scorer consensus queue disclosing divergences between Random Forest v1.8.2, LightGBM v2.0-rc, and business rule evaluations with side-by-side inspection. | Multi-adapter consensus triage across independent scorer outputs. |
| **7. Human Feedback & Model Loop** | `/feedback` | Audited analyst disposition queue, conflict resolution, dataset candidate packaging, and retraining triggers for closed-loop continuous improvement. | Case resolutions & audited label provenance (`user_feedback` table). |

---

## Step-by-Step Supabase Database Setup

All migrations are version-controlled under `supabase/migrations/`.

### 1. Execute SQL Migrations in Supabase Dashboard
1. Log into your [Supabase Project Dashboard](https://supabase.com/dashboard).
2. Select your project and navigate to **SQL Editor** in the left sidebar.
3. Open and run the following files in order:
   - **Step 1**: [`supabase/migrations/20261015000001_enterprise_schema.sql`](supabase/migrations/20261015000001_enterprise_schema.sql)
     *(Creates 11 normalized tables, enums, RLS policies, immutability trigger `tr_audit_tampering`, and initial seed data).*
   - **Step 2**: [`supabase/migrations/20261016000000_notifications_and_feedback.sql`](supabase/migrations/20261016000000_notifications_and_feedback.sql)
     *(Creates `notification_events` and `user_feedback` tables with RLS and realtime subscriptions).*

### 2. Provisioning the First Administrator (One-Time Bootstrap)
Because public registration enforces a strict default role of `fraud_analyst`:
1. Register a user account on the AegisAI Login page (e.g. `admin@yourdomain.com`).
2. Open [`supabase/migrations/bootstrap_admin.sql`](supabase/migrations/bootstrap_admin.sql) in your Supabase SQL Editor.
3. Replace `admin@aegisai.internal` with your registered email and click **Run**.
4. The user is promoted to `administrator` and an immutable audit log entry is written to `audit_logs`.

---

## Local Setup & Configuration

### 1. Environment Configuration
Create a local `.env.local` file in the project root:
```bash
cp .env.example .env.local
```
Configure your Supabase Project Settings:
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_USE_MOCKS=false
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-publishable-key>
```
> **Security Note:** Never place `SUPABASE_SERVICE_ROLE_KEY` in frontend `.env` or client bundles. `.env.local` is strictly ignored by Git.

### 2. Start Application
```bash
npm install
npm run dev
```
Open `http://localhost:5173`.

---

## Lightweight ML Scoring Microservice (Optional Python FastAPI)

AegisAI includes both a browser-native deterministic inference engine (`src/services/modelScorers.ts`) and a companion lightweight Python FastAPI service for containerized or free-tier hosting (e.g., Render / Fly.io with < 60MB RAM footprint).

### Start the Python Scoring API:
```bash
pip install fastapi uvicorn numpy pydantic
python supabase/model_service.py
```
Health Endpoint: `http://localhost:8000/health`  
Scoring Endpoint: `POST http://localhost:8000/api/score`

---

## Testing & Quality Verification

### Run Automated Vitest Suite
```bash
npx vitest run
```
**11 automated tests passed**:
- `scoringEngine.test.ts`: Deterministic scoring math, risk thresholds, and rule matches.
- `edgeFunctionSecurity.test.ts`: JWT caller validation, database role verification (HTTP 401/403), input validation, and service-role isolation.
- `modelScorers.test.ts`: RuleBasedScorer constraints, TrainedMLScorer sigmoid log-odds calculation, and ensemble consensus.

### Validate TypeScript & Production Build
```bash
npm run build
```
Type checks pass with 0 errors (`tsc -b`) and Vite production bundle compiles cleanly.
