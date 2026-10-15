# AegisAI — Real-Time Financial Intelligence

A responsive seven-page React + Vite + TypeScript frontend for a financial fraud-operations demo. All records and operational metrics are fictional and labeled as demo data.

## Run locally
1. Install Node.js 20+.
2. Extract the project and run `npm install`.
3. Copy `.env.example` to `.env` and keep `VITE_USE_MOCKS=true` for the demo.
4. Run `npm run dev` and open the local URL printed by Vite.
5. Run `npm run build` to type-check and build the production bundle.

## Pages
Overview, Live Transactions, Fraud Cases, Explainable AI, Analytics & Benchmarks, Risk Rules & Models, and Audit Logs.

## Backend boundary
`src/services/apiClient.ts` centralizes the base URL and mock-mode selection. Typed service modules provide mock-first interfaces and sample REST endpoint paths. The API contract is proposed, not assumed to exist. Set `VITE_USE_MOCKS=false` only when the corresponding FastAPI endpoints are implemented. The UI never embeds credentials or Supabase service-role keys.

## Demo caveats
- The event stream is simulated and can be paused/resumed; it is not a live backend stream.
- KPI, model, latency, attribution and benchmark values are illustrative unless labeled as ULB dataset reference statistics.
- PCA features are shown without invented human interpretations.
- Mock case/rule actions update client-side state only. No deployment or backend persistence is implied.
