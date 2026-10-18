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
-- Metrics are the held-out test-split results recorded by ml/train.py in
-- ml/artifacts/active_model_metadata.json (synthetic data only).
INSERT INTO public.model_registry (
  id, name, version, algorithm, artifact_reference,
  training_dataset_reference, deployment_status, is_active,
  evaluation_summary, created_by
) VALUES
  (
    'fraud-v2.0.0-logistic',
    'AegisAI Logistic Fraud Classifier',
    'v2.0.0',
    'Logistic Regression (class_weight=balanced)',
    'ml/artifacts/fraud-v2.0.0-logistic.joblib',
    'Synthetic demo data (8,000 generated transactions, ml/data_generator.py)',
    'deployed',
    true,
    '{"precision": 0.9231, "recall": 0.9524, "f1": 0.9375, "fpr": 0.0033, "pr_auc": 0.99, "threshold": 0.83, "dataset": "synthetic_demo"}'::jsonb,
    'ml/train.py'
  ),
  (
    'rule-baseline-v1',
    'Transparent Rule Baseline',
    'v1.0.0',
    'Rule: amount >= 50,000 INR or >= 4 attempts',
    NULL,
    'Synthetic demo data (8,000 generated transactions, ml/data_generator.py)',
    'validated',
    false,
    '{"precision": 0.9608, "recall": 0.7778, "f1": 0.8596, "fpr": 0.0013, "pr_auc": 0.756, "dataset": "synthetic_demo"}'::jsonb,
    'ml/train.py'
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
    'fraud-v2.0.0-logistic',
    'synthetic-demo-test-split (caf8ae97c06a0ce1)',
    1600,
    63,
    0.9231,
    0.9524,
    0.9375,
    0.0033,
    0.9900,
    '{"tp": 60, "fp": 5, "tn": 1532, "fn": 3}'::jsonb,
    'Held-out synthetic test split at validated threshold 0.83. Not validated on real transactions.'
  ),
  (
    'rule-baseline-v1',
    'synthetic-demo-test-split (caf8ae97c06a0ce1)',
    1600,
    63,
    0.9608,
    0.7778,
    0.8596,
    0.0013,
    0.7560,
    '{"tp": 49, "fp": 2, "tn": 1535, "fn": 14}'::jsonb,
    'Same held-out synthetic test split; rule baseline from ml/train.py.'
  )
ON CONFLICT DO NOTHING;

-- 3. TRANSACTIONS
INSERT INTO public.transactions (
  id, external_transaction_id, customer_reference, amount, currency, channel,
  merchant_reference, timestamp, score, risk_level, decision, scoring_status,
  model_version, latency_ms, signals, explanation, case_id
) VALUES
  ('TXN-20481', 'EXT-98214', 'CUST-7A21', 184500.00, 'INR', 'UPI', 'MERCH-ELECTRONICS-09', now() - interval '2 minutes', 94, 'High', 'FLAG', 'SCORED', 'demo-seed', 18, ARRAY['Velocity spike', 'Amount anomaly', 'New device'], 'Multiple operational signals crossed the configured review threshold.', 'CASE-0081'),
  ('TXN-20482', 'EXT-98215', 'CUST-19D4', 2450.00, 'INR', 'Card', 'MERCH-GROCERY-01', now() - interval '3 minutes', 18, 'Low', 'ALLOW', 'SCORED', 'demo-seed', 16, ARRAY['Known device'], 'Observed features are consistent with the low-risk profile.', NULL),
  ('TXN-20483', 'EXT-98216', 'CUST-3F90', 38600.00, 'INR', 'Net banking', 'MERCH-JEWELRY-04', now() - interval '5 minutes', 71, 'Medium', 'VERIFY', 'SCORED', 'demo-seed', 21, ARRAY['Unusual timing', 'Location change'], 'Elevated risk signals suggest step-up OTP verification.', 'CASE-0083'),
  ('TXN-20484', 'EXT-98217', 'CUST-0C62', 790.00, 'INR', 'UPI', 'MERCH-COFFEE-12', now() - interval '7 minutes', 9, 'Low', 'ALLOW', 'SCORED', 'demo-seed', 14, ARRAY['Known device'], 'No configured risk rule was triggered.', NULL),
  ('TXN-20485', 'EXT-98218', 'CUST-8B13', 98200.00, 'INR', 'Card', 'MERCH-LUXURY-02', now() - interval '10 minutes', 86, 'High', 'FLAG', 'SCORED', 'demo-seed', 19, ARRAY['Repeated attempts', 'Amount anomaly'], 'Repeated attempts and a high amount contributed to the elevated score.', 'CASE-0082'),
  ('TXN-20486', 'EXT-98219', 'CUST-1E44', 5200.00, 'INR', 'Wallet', 'MERCH-UTILITY-05', now() - interval '14 minutes', 43, 'Medium', 'VERIFY', 'SCORED', 'demo-seed', 17, ARRAY['Device change'], 'One risk signal warrants lightweight verification step.', NULL),
  ('TXN-20487', 'EXT-98220', 'CUST-77A0', 1250.00, 'INR', 'UPI', 'MERCH-RETAIL-08', now() - interval '18 minutes', 12, 'Low', 'ALLOW', 'SCORED', 'demo-seed', 15, ARRAY['Known device'], 'Low estimated risk based on available demo features.', NULL),
  ('TXN-20488', 'EXT-98221', 'CUST-6D02', 44600.00, 'INR', 'Net banking', 'MERCH-TRAVEL-03', now() - interval '25 minutes', 78, 'High', 'FLAG', 'SCORED', 'demo-seed', 20, ARRAY['Velocity spike', 'Location change'], 'Multiple signals increased estimated risk.', 'CASE-0084')
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
    'fraud-v2.0.0-logistic',
    'Logistic regression log-odds contributions (w * x)',
    '[{"name":"amount_norm","value":37.24},{"name":"velocity_norm","value":6.48},{"name":"is_new_device","value":2.96},{"name":"channel_UPI","value":-1.75},{"name":"location_change","value":-0.25}]'::jsonb,
    'Amount (184,500 INR, far above the training average), 4 attempts and a new device dominate the log-odds; the UPI channel lowers them. Features reconstructed from the seed signals.',
    '[{"stage":"01","title":"Transaction received","detail":"Event accepted at gateway"},
      {"stage":"02","title":"Feature preparation","detail":"Amount, velocity, device, location and time features calculated"},
      {"stage":"03","title":"ML risk scoring","detail":"fraud-v2.0.0-logistic score: 1.000"},
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
  ('AUD-91A2', now() - interval '2 minutes', 'risk-engine', 'System', 'Transaction scored', 'Transaction', 'TXN-20481', 'Review', 'Risk score 94; decision FLAG; demo seed record.', '{"score": 94, "decision": "FLAG"}'::jsonb),
  ('AUD-91A1', now() - interval '5 minutes', 'Arjun Sharma', 'Analyst', 'Fraud case opened', 'Case', 'CASE-0081', 'Success', 'Case created for high-risk transaction.', '{"case_id": "CASE-0081"}'::jsonb),
  ('AUD-91A0', now() - interval '1 hour', 'Arjun Sharma', 'Analyst', 'Risk rule updated', 'Risk rule', 'R-01', 'Success', 'High Transaction Amount threshold reviewed.', '{"threshold": 100000}'::jsonb),
  ('AUD-919F', now() - interval '2 hours', 'model-service', 'System', 'Model evaluated', 'Model', 'fraud-v2.0.0-logistic', 'Success', 'Held-out synthetic test split evaluation completed.', '{"f1": 0.9375}'::jsonb),
  ('AUD-919E', now() - interval '3 hours', 'R. Iyer', 'Analyst', 'Analyst note added', 'Case', 'CASE-0082', 'Success', 'Added investigation note regarding repeated attempts.', '{"author": "R. Iyer"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 9. NOTIFICATION EVENTS
INSERT INTO public.notification_events (
  recipient_id, recipient_role, title, message, severity, link_ref, read, created_at
) VALUES
  (NULL, 'fraud_analyst', 'High-Risk Spike Detected', 'Transaction TXN-20481 flagged with risk score 94/100 (Velocity Anomaly).', 'high', 'TXN-20481', false, now() - interval '10 minutes'),
  (NULL, 'fraud_analyst', 'Model Disagreement Alert', 'Score divergence detected between fraud-v2.0.0-logistic and rule engine on TXN-20485.', 'medium', 'TXN-20485', false, now() - interval '35 minutes'),
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
