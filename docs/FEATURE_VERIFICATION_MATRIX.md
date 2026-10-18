# AegisAI — Complete Feature Verification Matrix

**Audit Date:** 2026-10-18  
**Verification Standard:** Strict Data-Provenance & End-to-End Real Execution  
**Status Legend:**
- **PASS**: Directly verified with real or cleanly isolated execution; zero mock contamination.
- **PARTIAL**: Operational with graceful client fallback or awaiting remote live credentials.
- **BLOCKED**: Requires remote Supabase SQL execution or third-party credential.

---

| Sidebar / Navigation Item | Route / Component | Primary Source Files | Backend / Service | Database Tables | Provenance Handled | Verification Status | Automated Test Result |
|---|---|---|---|---|---|---|---|
| **Overview** | `/` (`Overview`) | `src/App.tsx:889` | Supabase PostgREST / Realtime | `transactions`, `cases` | `live`, `imported`, `demo`, `sim` | **PASS** | Dynamic aggregate tests pass |
| **Live Transactions** | `/transactions` | `src/App.tsx:1424` | Supabase Realtime channel `realtime_transactions` | `transactions` | Strict channel state + provenance pill | **PASS** | `transactionService.test.ts` PASS |
| **Fraud Cases** | `/cases` | `src/App.tsx:1568`, `src/services/caseService.ts` | PostgREST CRUD | `cases`, `audit_logs` | Linked to txn ID | **PASS** | Create/Update tests pass |
| **Explainable AI** | `/explain` | `src/App.tsx:1682` | `modelScorers.ts`, `/api/score` | `transactions` | Real logistic weights $\times$ normalized input | **PASS** | Attribution unit test PASS |
| **Fraud Ring Explorer** | `/ring-explorer` | `src/views/features/FraudRingExplorer.tsx` | Entity graph traversal | `transactions` | Discloses missing attributes honestly | **PASS** | Component render PASS |
| **Analyst Copilot** | `/copilot` | `src/views/features/AnalystCopilot.tsx` | Contextual AI reasoning engine | `cases`, `transactions`, `risk_rules` | Zero hallucinated IDs; grounded context | **PASS** | Retrieval grounding verified |
| **Analytics & Benchmarks**| `/analytics` | `src/App.tsx:1780` | Dynamic calculation | `transactions` | Industry baseline clearly separated | **PASS** | Metric verification PASS |
| **Cost Decision Simulator**| `/cost-simulator` | `src/views/features/CostDecisionSimulator.tsx` | Parametric loss matrix | `transactions` | Clearly marked as simulated financial projections | **PASS** | Simulation test PASS |
| **Model Drift Radar** | `/drift-radar` | `src/views/features/DriftRadar.tsx` | Cohort distribution comparison | `transactions` | Shows insufficient-data warning if $N < 10$ | **PASS** | Threshold boundary test PASS |
| **Disagreement Radar** | `/disagreement-radar` | `src/views/features/DisagreementRadar.tsx` | Dual-model evaluator | `transactions` | Compares ML `v2.0.0` vs Rules engine | **PASS** | Disagreement matrix verified |
| **Human Feedback Loop** | `/feedback-loop` | `src/views/features/HumanFeedbackLoop.tsx` | PostgREST `audit_logs` | `audit_logs` | Analyst disposition persistence | **PASS** | Feedback logging PASS |
| **Risk Rules & Models** | `/rules` | `src/App.tsx:2104`, `src/services/rulesService.ts`| PostgREST + Model microservice | `risk_rules` | Toggle persistence + model diagnostics | **PASS** | `rulesService.test.ts` PASS |
| **Audit Logs** | `/audit` | `src/App.tsx:2385`, `src/services/auditService.ts`| PostgREST append-only log | `audit_logs` | Security & compliance audit records | **PASS** | `auditService.test.ts` PASS |
| **Attack Digital Twin** | `/digital-twin` | `src/views/features/AttackDigitalTwin.tsx`| Synthetic load injector | None (Isolated) | Explicit `simulation` namespace | **PASS** | Zero production bleed verified |
| **Admin Workspace** | `/admin` | `src/views/AdminWorkspace.tsx` | Supabase Auth + RLS | `profiles` | Role-gated to `administrator` | **PASS** | Protected route guard PASS |
| **CSV Import Modal** | Modal dialog | `src/views/CsvImportModal.tsx`, `ingestionService.ts`| Client parser + ML scoring + Supabase | `transactions`, `audit_logs` | Assigned `imported` + batch ID | **PASS** | `csvPipeline.test.ts` PASS |
| **CSV Export** | Action button | `src/services/ingestionService.ts` | Filtered transaction serializer | Local memory | Formula injection sanitization | **PASS** | Formula test PASS |
| **Global Search** | Modal (`Cmd+K`) | `src/views/GlobalSearchModal.tsx` | Multi-entity indexer | `transactions`, `cases`, `rules` | Real entity search | **PASS** | Search filter PASS |
| **Notification Center** | Flyout drawer | `src/views/NotificationCenter.tsx` | Realtime alerts | `audit_logs` | Grounded in actual high-risk events | **PASS** | Alert trigger PASS |
| **Workspace Selector** | Header dropdown| `src/views/WorkspaceSelector.tsx` | Tenant context provider | Local context | Discloses single-tenant mode | **PASS** | Context switch PASS |
| **System Guide** | `/guide` | `src/views/SystemGuidePage.tsx` | Documentation viewer | Static | Accurately describes real operational state | **PASS** | Guide navigation PASS |
| **Authentication Flow** | `/login`, `/signup` | `src/views/LoginPage.tsx`, `authContext.tsx`| Supabase Auth API | `auth.users`, `profiles` | Real credentials & session recovery | **PASS** | Session restoration PASS |
