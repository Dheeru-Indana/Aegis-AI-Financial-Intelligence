-- ====================================================================
-- AegisAI - Correct the seeded model registry
-- File: supabase/migrations/20261018000100_correct_model_registry.sql
-- ====================================================================
--
-- Earlier seeds registered a "Random Forest v1.8.2" and "lr-v0.1" trained on the ULB
-- credit card dataset, with evaluation metrics. Neither model exists in this repository.
-- The only trained model is ml/artifacts/fraud-v2.0.0-logistic.joblib, trained on
-- synthetic data by ml/train.py.
--
-- This migration registers the real model and its held-out test metrics (copied from
-- ml/artifacts/active_model_metadata.json), and retires the fictional rows instead of
-- deleting them. Idempotent: safe to run more than once.
-- ====================================================================

INSERT INTO public.model_registry (
  id, name, version, algorithm, artifact_reference, training_dataset_reference,
  deployment_status, is_active, evaluation_summary, created_by
) VALUES
  ('fraud-v2.0.0-logistic', 'AegisAI Logistic Fraud Classifier', 'v2.0.0', 'Logistic Regression (class_weight=balanced)', 'ml/artifacts/fraud-v2.0.0-logistic.joblib', 'Synthetic demo data (8,000 generated transactions, ml/data_generator.py)', 'deployed', true, '{"precision": 0.9231, "recall": 0.9524, "f1": 0.9375, "fpr": 0.0033, "pr_auc": 0.99, "threshold": 0.83, "dataset": "synthetic_demo"}'::jsonb, 'ml/train.py'),
  ('rule-baseline-v1', 'Transparent Rule Baseline', 'v1.0.0', 'Rule: amount >= 50,000 INR or >= 4 attempts', NULL, 'Synthetic demo data (8,000 generated transactions, ml/data_generator.py)', 'validated', false, '{"precision": 0.9608, "recall": 0.7778, "f1": 0.8596, "fpr": 0.0013, "pr_auc": 0.756, "dataset": "synthetic_demo"}'::jsonb, 'ml/train.py')
ON CONFLICT (id) DO UPDATE SET
  algorithm = EXCLUDED.algorithm,
  training_dataset_reference = EXCLUDED.training_dataset_reference,
  deployment_status = EXCLUDED.deployment_status,
  is_active = EXCLUDED.is_active,
  evaluation_summary = EXCLUDED.evaluation_summary,
  updated_at = timezone('utc'::text, now());

INSERT INTO public.model_evaluations (
  model_id, dataset_version, total_samples, fraud_samples,
  precision, recall, f1_score, fpr, pr_auc, confusion_matrix, notes
)
SELECT v.* FROM (VALUES
  ('fraud-v2.0.0-logistic', 'synthetic-demo-test-split (caf8ae97c06a0ce1)', 1600, 63, 0.9231, 0.9524, 0.9375, 0.0033, 0.9900, '{"tp": 60, "fp": 5, "tn": 1532, "fn": 3}'::jsonb, 'Held-out synthetic test split at validated threshold 0.83. Not validated on real transactions.'),
  ('rule-baseline-v1', 'synthetic-demo-test-split (caf8ae97c06a0ce1)', 1600, 63, 0.9608, 0.7778, 0.8596, 0.0013, 0.7560, '{"tp": 49, "fp": 2, "tn": 1535, "fn": 14}'::jsonb, 'Same held-out synthetic test split; rule baseline from ml/train.py.')
) AS v(model_id, dataset_version, total_samples, fraud_samples, precision, recall, f1_score, fpr, pr_auc, confusion_matrix, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.model_evaluations e
  WHERE e.model_id = v.model_id AND e.dataset_version = v.dataset_version
);

UPDATE public.model_registry
SET deployment_status = 'retired',
    is_active = false,
    evaluation_summary = '{"note": "Fictional seed entry: no such model or evaluation exists in this repository."}'::jsonb,
    updated_at = timezone('utc'::text, now())
WHERE id IN ('fraud-v1.8.2', 'lr-v0.1');

-- The seeded demo transactions were hand-written, not produced by a model
UPDATE public.transactions
SET model_version = 'demo-seed'
WHERE id IN ('TXN-20481', 'TXN-20482', 'TXN-20483', 'TXN-20484', 'TXN-20485', 'TXN-20486', 'TXN-20487', 'TXN-20488')
  AND model_version = 'fraud-v1.8.2';
