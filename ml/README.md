# AegisAI — Machine Learning Architecture, Training & Deployment Guide

## 1. Overview
AegisAI utilizes a genuinely trained, reproducible, CPU-optimized **Logistic Regression Pipeline** with class-weighted balancing and stratified preprocessing.

- **Primary Classifier**: `Pipeline(ColumnTransformer(StandardScaler, OneHotEncoder), LogisticRegression(class_weight='balanced'))`
- **Artifact Size**: `3.8 KB` (sub-10MB limit easily met)
- **Runtime Footprint**: `~42 MB RAM`
- **Inference Latency**: `< 2ms` per transaction on single-core CPU
- **Decision Threshold**: `0.83` (tuned on held-out validation set to maximize PR-AUC and F1 for imbalanced fraud distributions)

---

## 2. Directory Structure

```text
ml/
├── requirements.txt            # Pinned lightweight ML dependencies
├── features.py                 # Canonical feature schema & deterministic extractor
├── data_generator.py           # Deterministic synthetic demo dataset generator
├── train.py                    # End-to-end reproducible training & evaluation pipeline
├── artifacts/
│   ├── active_model.joblib     # Persisted serialized pipeline
│   ├── active_model_metadata.json
│   └── fraud-v2.0.0-logistic.joblib
└── tests/
    └── test_model_service.py   # Comprehensive automated test suite for API & inference
```

---

## 3. Training & Validation

To retrain or verify the model:
```bash
# 1. Activate virtual environment
source ml_env/bin/activate

# 2. Run deterministic training
python ml/train.py
```

### Held-Out Test Evaluation (Zero Target Leakage)
- **Dataset Size**: 8,000 transactions (60% Train, 20% Validation, 20% Held-Out Test)
- **PR-AUC**: `0.9900`
- **ROC-AUC**: `0.9995`
- **F1 Score**: `0.9375`
- **Recall**: `0.9524` (Catches 60 of 63 fraud cases at optimal threshold)
- **Precision**: `0.9231` (Only 5 false alarms out of 1,537 negatives)
- **Baseline Comparison**:
  - Majority Class Baseline: F1 = `0.0000`, PR-AUC = `0.0394`
  - Transparent Rule Baseline: F1 = `0.8596`, PR-AUC = `0.7560`
  - Learned Logistic Pipeline: F1 = `0.9375`, PR-AUC = `0.9900`

*Provenance Note*: The default dataset is explicitly marked as `synthetic_demo` for reproducible development and CI testing. Production validation on live cardholder datasets is required before real-world enforcement.

---

## 4. Serving the FastAPI Model Microservice

```bash
# Local development command:
PYTHONPATH=. uvicorn supabase.model_service:app --host 0.0.0.0 --port 8000
```

### Endpoints
- `GET /health`: Model status, threshold, artifact size, and RAM metrics.
- `GET /model/info`: Full model metadata, coefficient weights, and feature definitions.
- `GET /metrics/summary`: Complete evaluation metrics and baseline comparisons.
- `POST /api/score`: Real-time transaction inference with local linear feature attributions.
- `POST /api/score/batch`: Bounded batch inference (maximum 100 transactions).

---

## 5. Docker & Cloud Deployment (Free Tier / Low Cost)

A lightweight container is defined in `Dockerfile.ml`:
```bash
docker build -f Dockerfile.ml -t aegisai-ml-service .
docker run -p 8000:8000 aegisai-ml-service
```
This container image is under 120MB and runs comfortably on Render, Fly.io, Railway, or Google Cloud Run free tiers.
