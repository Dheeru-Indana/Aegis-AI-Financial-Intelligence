-- ==============================================================================
-- AegisAI Financial Intelligence - Synthetic Demo & Seed Dataset
-- File: supabase/setup/03_seed_demo.sql
-- Mode: OPTIONAL / RE-RUNNABLE (ON CONFLICT SAFE)
-- ==============================================================================
-- SECURITY & COMPLIANCE NOTICE:
-- 1. All records in this file are completely SYNTHETIC and fictitious.
-- 2. No real customer identities, actual bank accounts, or PII are used.
-- 3. This script NEVER creates or promotes an administrator account.
-- 4. To promote a user to administrator, follow the documented procedure in
--    supabase/migrations/bootstrap_admin.sql using the Supabase SQL Editor.
-- ==============================================================================

-- 1. MODEL REGISTRY
INSERT INTO public.model_registry (
  id, name, version, algorithm, artifact_reference,
  training_dataset_reference, deployment_status, is_active,
  evaluation_summary, created_by
) VALUES
  (
    'fraud-v1.8.2',
    'Fraud Risk Ensemble',
    'v1.8.2',
    'Random Forest Classifier',
    's3://aegis-models/prod/rf-v1.8.2.onnx',
    'ULB Credit Card Fraud (284,807 transactions)',
    'deployed',
    true,
    '{"precision": 0.948, "recall": 0.824, "f1": 0.881, "fpr": 0.0008, "latency_ms": 18}'::jsonb,
    'MLOps Team'
  ),
  (
    'lr-v0.1',
    'Baseline Risk Scorer',
    'v0.1.0',
    'Logistic Regression',
    's3://aegis-models/candidates/lr-v0.1.onnx',
    'ULB Credit Card Fraud (284,807 transactions)',
    'candidate',
    false,
    '{"precision": 0.882, "recall": 0.710, "f1": 0.787, "fpr": 0.0022, "latency_ms": 4}'::jsonb,
    'MLOps Team'
  )
ON CONFLICT (id) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  updated_at = timezone('utc'::text, now());

-- 2. MODEL EVALUATIONS
INSERT INTO public.model_evaluations (
  model_id, dataset_version, total_samples, fraud_samples,
  precision, recall, f1_score, fpr, pr_auc, confusion_matrix, notes
) VALUES
  (
    'fraud-v1.8.2',
    'ULB-2026-Q3-TEST',
    56962,
    98,
    0.9480,
    0.8240,
    0.8810,
    0.0008,
    0.8730,
    '{"tp": 81, "fp": 4, "tn": 56860, "fn": 17}'::jsonb,
    'Evaluated at default probability threshold 0.75'
  )
ON CONFLICT DO NOTHING;

-- 3. TRANSACTIONS
INSERT INTO public.transactions (
  id, external_transaction_id, customer_reference, amount, currency, channel,
  merchant_reference, timestamp, score, risk_level, decision, scoring_status,
  model_version, latency_ms, signals, explanation, case_id
) VALUES
  ('TXN-20481', 'EXT-98214', 'CUST-7A21', 184500.00, 'INR', 'UPI', 'MERCH-ELECTRONICS-09', now() - interval '2 minutes', 94, 'High', 'FLAG', 'SCORED', 'fraud-v1.8.2', 18, ARRAY['Velocity spike', 'Amount anomaly', 'New device'], 'Multiple operational signals crossed the configured review threshold.', 'CASE-0081'),
  ('TXN-20482', 'EXT-98215', 'CUST-19D4', 2450.00, 'INR', 'Card', 'MERCH-GROCERY-01', now() - interval '3 minutes', 18, 'Low', 'ALLOW', 'SCORED', 'fraud-v1.8.2', 16, ARRAY['Known device'], 'Observed features are consistent with the low-risk profile.', NULL),
  ('TXN-20483', 'EXT-98216', 'CUST-3F90', 38600.00, 'INR', 'Net banking', 'MERCH-JEWELRY-04', now() - interval '5 minutes', 71, 'Medium', 'VERIFY', 'SCORED', 'fraud-v1.8.2', 21, ARRAY['Unusual timing', 'Location change'], 'Elevated risk signals suggest step-up OTP verification.', 'CASE-0083'),
  ('TXN-20484', 'EXT-98217', 'CUST-0C62', 790.00, 'INR', 'UPI', 'MERCH-COFFEE-12', now() - interval '7 minutes', 9, 'Low', 'ALLOW', 'SCORED', 'fraud-v1.8.2', 14, ARRAY['Known device'], 'No configured risk rule was triggered.', NULL),
  ('TXN-20485', 'EXT-98218', 'CUST-8B13', 98200.00, 'INR', 'Card', 'MERCH-LUXURY-02', now() - interval '10 minutes', 86, 'High', 'FLAG', 'SCORED', 'fraud-v1.8.2', 19, ARRAY['Repeated attempts', 'Amount anomaly'], 'Repeated attempts and a high amount contributed to the elevated score.', 'CASE-0082'),
  ('TXN-20486', 'EXT-98219', 'CUST-1E44', 5200.00, 'INR', 'Wallet', 'MERCH-UTILITY-05', now() - interval '14 minutes', 43, 'Medium', 'VERIFY', 'SCORED', 'fraud-v1.8.2', 17, ARRAY['Device change'], 'One risk signal warrants lightweight verification step.', NULL),
  ('TXN-20487', 'EXT-98220', 'CUST-77A0', 1250.00, 'INR', 'UPI', 'MERCH-RETAIL-08', now() - interval '18 minutes', 12, 'Low', 'ALLOW', 'SCORED', 'fraud-v1.8.2', 15, ARRAY['Known device'], 'Low estimated risk based on available demo features.', NULL),
  ('TXN-20488', 'EXT-98221', 'CUST-6D02', 44600.00, 'INR', 'Net banking', 'MERCH-TRAVEL-03', now() - interval '25 minutes', 78, 'High', 'FLAG', 'SCORED', 'fraud-v1.8.2', 20, ARRAY['Velocity spike', 'Location change'], 'Multiple signals increased estimated risk.', 'CASE-0084')
ON CONFLICT (id) DO UPDATE SET
  amount = EXCLUDED.amount,
  score = EXCLUDED.score,
  decision = EXCLUDED.decision,
  case_id = EXCLUDED.case_id,
  updated_at = timezone('utc'::text, now());

-- 4. TRANSACTION EXPLANATIONS
INSERT INTO public.transaction_explanations (
  transaction_id, model_version, explanation_method,
  feature_attributions, summary_text, decision_trace
) VALUES
  (
    'TXN-20481',
    'fraud-v1.8.2',
    'SHAP Feature Attribution',
    '[{"name":"V14","value":0.31},{"name":"V12","value":0.24},{"name":"V10","value":0.18},{"name":"V4","value":-0.12},{"name":"V17","value":-0.08}]'::jsonb,
    'High amount and velocity spike along with PCA component V14 deviation triggered an automated FLAG decision.',
    '[{"stage":"01","title":"Transaction received","detail":"Event accepted at gateway"},
      {"stage":"02","title":"Feature preparation","detail":"PCA features & velocity metrics calculated"},
      {"stage":"03","title":"ML risk scoring","detail":"Estimated raw score: 94/100"},
      {"stage":"04","title":"Rule evaluation","detail":"Triggered: High Transaction Amount, Velocity Spike"},
      {"stage":"05","title":"Final decision","detail":"FLAG"}]'::jsonb
  )
ON CONFLICT DO NOTHING;

-- 5. FRAUD CASES
INSERT INTO public.fraud_cases (
  id, case_reference, transaction_id, title, description, score,
  priority, status, analyst, assigned_analyst_name, notes, opened_at, updated_at
) VALUES
  ('CASE-0081', 'AEGIS-2026-0081', 'TXN-20481', 'Flagged High-Value UPI Transfer', 'Velocity spike and amount anomaly observed in short window.', 94, 'High', 'Open', 'Arjun Sharma', 'Arjun Sharma', '[{"text":"Velocity spike and amount anomaly require review.","at":"11:19","author":"System"}]'::jsonb, now() - interval '2 minutes', now()),
  ('CASE-0082', 'AEGIS-2026-0082', 'TXN-20485', 'Rapid Card Attempts Anomaly', 'Repeated transaction attempts exceeding threshold on luxury merchant.', 86, 'High', 'In review', 'R. Iyer', 'R. Iyer', '[{"text":"Reviewing repeated attempts across the session.","at":"11:17","author":"R. Iyer"}]'::jsonb, now() - interval '10 minutes', now()),
  ('CASE-0083', 'AEGIS-2026-0083', 'TXN-20483', 'Step-up Verification Escalation', 'Unusual login timing from new IP address.', 71, 'Medium', 'Open', 'Unassigned', 'Unassigned', '[]'::jsonb, now() - interval '20 minutes', now()),
  ('CASE-0084', 'AEGIS-2026-0084', 'TXN-20488', 'Cross-State Net Banking Transfer', 'Location discrepancy confirmed legitimate by cardholder.', 63, 'Medium', 'Resolved', 'Arjun Sharma', 'Arjun Sharma', '[{"text":"Customer verification completed.","at":"11:05","author":"Arjun Sharma"}]'::jsonb, now() - interval '45 minutes', now())
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  notes = EXCLUDED.notes,
  updated_at = timezone('utc'::text, now());

-- 6. CASE ACTIVITY
INSERT INTO public.case_activity (case_id, actor_name, activity_type, message)
VALUES
  ('CASE-0081', 'System Scorer', 'alert', 'Case auto-opened due to risk score 94 exceeding threshold 75.'),
  ('CASE-0081', 'Arjun Sharma', 'note', 'Customer contacted for out-of-band verification. Awaiting callback.'),
  ('CASE-0082', 'R. Iyer', 'assignment', 'Case assigned to Senior Investigator R. Iyer.'),
  ('CASE-0084', 'Arjun Sharma', 'status_change', 'Case marked Resolved after customer phone verification.')
ON CONFLICT DO NOTHING;

-- 7. RISK RULES
INSERT INTO public.risk_rules (
  id, name, description, feature, operator, threshold,
  severity, score_impact, enabled, version, modified, created_by, modified_by
) VALUES
  ('R-01', 'High Transaction Amount', 'Flag unusually large single transactions', 'amount', '>', 100000, 'High', 25, true, 1, 'Today, 10:42', 'Risk Team', 'Arjun Sharma'),
  ('R-02', 'Repeated Transaction Attempts', 'Detect repeated attempts in a 5-minute sliding window', 'attempt_count', '>=', 4, 'High', 30, true, 1, 'Today, 09:18', 'Risk Team', 'System'),
  ('R-03', 'Unusual Transaction Timing', 'Flag transactions originating in low-velocity night hours', 'hour_of_day', 'outside', 6, 'Medium', 12, true, 1, 'Yesterday', 'Risk Team', 'Arjun Sharma'),
  ('R-04', 'Multiple Risk Signals', 'Escalate transaction if 3 or more concurrent risk signals are raised', 'risk_signal_count', '>=', 3, 'Medium', 18, false, 1, 'Oct 12', 'Risk Team', 'R. Iyer')
ON CONFLICT (id) DO UPDATE SET
  threshold = EXCLUDED.threshold,
  score_impact = EXCLUDED.score_impact,
  enabled = EXCLUDED.enabled,
  modified = EXCLUDED.modified,
  updated_at = timezone('utc'::text, now());

-- 8. IMMUTABLE AUDIT LOGS
INSERT INTO public.audit_logs (
  id, timestamp, actor, role, action, resource_type,
  resource_id, result, details, metadata
) VALUES
  ('AUD-91A2', now() - interval '2 minutes', 'risk-engine', 'System', 'Transaction scored', 'Transaction', 'TXN-20481', 'Review', 'Risk score 94; decision FLAG; model fraud-v1.8.2.', '{"score": 94, "decision": "FLAG"}'::jsonb),
  ('AUD-91A1', now() - interval '5 minutes', 'Arjun Sharma', 'Analyst', 'Fraud case opened', 'Case', 'CASE-0081', 'Success', 'Case created for high-risk transaction.', '{"case_id": "CASE-0081"}'::jsonb),
  ('AUD-91A0', now() - interval '1 hour', 'Arjun Sharma', 'Analyst', 'Risk rule updated', 'Risk rule', 'R-01', 'Success', 'High Transaction Amount threshold reviewed.', '{"threshold": 100000}'::jsonb),
  ('AUD-919F', now() - interval '2 hours', 'model-service', 'System', 'Model evaluated', 'Model', 'fraud-v1.8.2', 'Success', 'Evaluation run on test dataset completed.', '{"f1": 0.881}'::jsonb),
  ('AUD-919E', now() - interval '3 hours', 'R. Iyer', 'Analyst', 'Analyst note added', 'Case', 'CASE-0082', 'Success', 'Added investigation note regarding repeated attempts.', '{"author": "R. Iyer"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 9. NOTIFICATION EVENTS
INSERT INTO public.notification_events (
  recipient_id, recipient_role, title, message, severity, link_ref, read, created_at
) VALUES
  (NULL, 'fraud_analyst', 'High-Risk Spike Detected', 'Transaction TXN-20481 flagged with risk score 94/100 (Velocity Anomaly).', 'high', 'TXN-20481', false, now() - interval '10 minutes'),
  (NULL, 'fraud_analyst', 'Model Disagreement Alert', 'High score divergence detected between Random Forest v1.8.2 and LightGBM on TXN-20485.', 'medium', 'TXN-20485', false, now() - interval '35 minutes'),
  (NULL, 'administrator', 'Population Drift Warning', 'Aggregate PSI reached 0.28 on Amount & Velocity features exceeding tolerance.', 'high', NULL, false, now() - interval '2 hours'),
  (NULL, 'investigator', 'Case Assignment', 'Fraud Case CASE-0084 assigned for investigation.', 'info', 'CASE-0084', true, now() - interval '4 hours')
ON CONFLICT DO NOTHING;

-- 10. USER FEEDBACK / VERIFIED LABELS
INSERT INTO public.user_feedback (
  case_id, transaction_id, customer_reference, amount, initial_score,
  analyst_outcome, analyst_name, provenance, status, verified_at
) VALUES
  ('CASE-0084', 'TXN-20488', 'CUST-6D02', 44600.00, 78, 'False Positive', 'Arjun Sharma', 'manual_triage', 'Queued for Retraining', now() - interval '45 minutes'),
  ('CASE-0081', 'TXN-20481', 'CUST-7A21', 184500.00, 94, 'Confirmed Fraud', 'Arjun Sharma', 'manual_triage', 'Queued for Retraining', now() - interval '2 minutes')
ON CONFLICT DO NOTHING;
