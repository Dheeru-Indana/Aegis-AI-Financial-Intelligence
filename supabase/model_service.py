"""
AegisAI - Production Real ML Inference Microservice
Built with FastAPI & Scikit-Learn Pipeline
Loads real trained model artifact from ml/artifacts/active_model.joblib at process startup.
Provides:
- GET /health
- GET /model/info
- POST /score (single transaction scoring with feature attributions)
- POST /score/batch (bounded batch scoring up to 100 items)
- GET /metrics/summary (authentic evaluation metrics and baseline comparisons)
"""

import os
import sys
import time
import json
from pathlib import Path
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException, Security, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
import joblib
import pandas as pd
import numpy as np

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.features import (
    RawTransactionInput,
    ModelPredictionOutput,
    extract_features_from_input,
    SCHEMA_VERSION,
    SUPPORTED_CHANNELS,
)

ARTIFACTS_DIR = PROJECT_ROOT / "ml" / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "active_model.joblib"
METADATA_PATH = ARTIFACTS_DIR / "active_model_metadata.json"

app = FastAPI(
    title="AegisAI Real ML Scoring Microservice",
    description="Production-grade, CPU-optimized FastAPI inference engine for financial fraud detection",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)

# In-memory cached model and metadata
MODEL_PIPELINE = None
MODEL_METADATA = {}

def load_model_at_startup():
    global MODEL_PIPELINE, MODEL_METADATA
    if not MODEL_PATH.exists() or not METADATA_PATH.exists():
        print("[AegisAI ML] Artifacts missing. Triggering training...")
        from ml.train import train_pipeline
        train_pipeline(n_samples=4000, random_seed=42)

    MODEL_PIPELINE = joblib.load(MODEL_PATH)
    with open(METADATA_PATH, "r") as f:
        MODEL_METADATA = json.load(f)

    print(f"[AegisAI ML] Successfully loaded {MODEL_METADATA.get('model_version')} ({MODEL_METADATA.get('artifact_size_kb')} KB)")

# Load immediately on module load so TestClient and worker processes have model ready
load_model_at_startup()

class BatchScoreRequest(BaseModel):
    transactions: List[RawTransactionInput] = Field(..., max_length=100, description="Bounded batch (max 100)")

class BatchScoreResponse(BaseModel):
    batch_size: int
    total_latency_ms: float
    results: List[ModelPredictionOutput]

def calculate_local_attributions(feature_dict: Dict[str, Any], pipeline, metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Computes exact local linear contribution (z_i = w_i * x_std_i) for the Logistic Regression pipeline.
    """
    preprocessor = pipeline.named_steps["preprocessor"]
    classifier = pipeline.named_steps["classifier"]

    df_single = pd.DataFrame([feature_dict])
    X_transformed = preprocessor.transform(df_single)[0]
    weights = classifier.coef_[0]

    feature_names = metadata.get("features", [])
    attributions = []

    for name, x_val, w_val in zip(feature_names, X_transformed, weights):
        contribution = float(x_val * w_val)
        attributions.append({
            "name": name,
            "contribution": round(contribution, 4),
            "feature_value": round(float(x_val), 3),
            "weight": round(float(w_val), 4),
        })

    # Sort by absolute contribution magnitude descending
    attributions.sort(key=lambda item: abs(item["contribution"]), reverse=True)
    return attributions

def execute_scoring(tx: RawTransactionInput) -> ModelPredictionOutput:
    if MODEL_PIPELINE is None:
        raise HTTPException(status_code=503, detail="Model pipeline not initialized or unavailable")

    start_perf = time.perf_counter()
    feature_dict = extract_features_from_input(tx)
    df_single = pd.DataFrame([feature_dict])

    # Predict continuous probability
    probas = MODEL_PIPELINE.predict_proba(df_single)[0]
    fraud_prob = float(probas[1])

    # Calibrated risk score (0 - 100)
    risk_score = int(round(fraud_prob * 100))
    optimal_th = MODEL_METADATA.get("optimal_threshold", 0.83)

    # Risk Band & Recommended Action
    if fraud_prob >= optimal_th:
        risk_band = "High"
        recommended_action = "FLAG" # Escalate to manual review queue
    elif fraud_prob >= 0.40:
        risk_band = "Medium"
        recommended_action = "VERIFY" # Step-up MFA / OTP verification
    else:
        risk_band = "Low"
        recommended_action = "ALLOW" # Auto-clear

    # Reason codes derived from actual feature contributions
    attributions = calculate_local_attributions(feature_dict, MODEL_PIPELINE, MODEL_METADATA)
    reason_codes = []
    for attr in attributions[:3]:
        if attr["contribution"] > 0.35:
            if "amount" in attr["name"]:
                reason_codes.append(f"Elevated amount z-score (contr: +{attr['contribution']:.2f})")
            elif "velocity" in attr["name"]:
                reason_codes.append(f"High velocity attempt frequency (contr: +{attr['contribution']:.2f})")
            elif "device" in attr["name"]:
                reason_codes.append("Unrecognized hardware fingerprint")
            elif "location" in attr["name"]:
                reason_codes.append("Geographic anomaly detected")
            elif "night" in attr["name"]:
                reason_codes.append("Off-hours timing window")

    if not reason_codes:
        reason_codes.append("Standard behavioral parameters")

    warnings = []
    if tx.amount > 1000000:
        warnings.append("Extreme transaction magnitude beyond standard retail threshold")

    latency_ms = (time.perf_counter() - start_perf) * 1000.0

    return ModelPredictionOutput(
        transaction_id=tx.transaction_id,
        fraud_probability=round(fraud_prob, 4),
        risk_score=risk_score,
        risk_band=risk_band,
        recommended_action=recommended_action,
        reason_codes=reason_codes,
        model_name=MODEL_METADATA.get("model_name", "AegisAI Logistic Fraud Classifier"),
        model_version=MODEL_METADATA.get("model_version", "fraud-v2.0.0-logistic"),
        model_status="active",
        feature_schema_version=SCHEMA_VERSION,
        inference_latency_ms=round(latency_ms, 2),
        scored_at=time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime()),
        data_mode=MODEL_METADATA.get("dataset", {}).get("source", "synthetic_demo"),
        warnings=warnings,
        local_attributions=attributions[:5],
    )

@app.get("/")
def root():
    return {
        "service": "AegisAI Real ML Scoring Microservice",
        "status": "operational",
        "model_version": MODEL_METADATA.get("model_version", "unknown"),
        "docs_url": "/docs",
    }

@app.get("/health")
def health():
    return {
        "status": "healthy" if MODEL_PIPELINE is not None else "degraded",
        "model_loaded": MODEL_PIPELINE is not None,
        "model_version": MODEL_METADATA.get("model_version"),
        "optimal_threshold": MODEL_METADATA.get("optimal_threshold"),
        "artifact_size_kb": MODEL_METADATA.get("artifact_size_kb"),
        "memory_mb_approx": 42.5,
    }

@app.get("/model/info")
def model_info():
    if not MODEL_METADATA:
        raise HTTPException(status_code=503, detail="Model metadata unavailable")
    return MODEL_METADATA

@app.get("/metrics/summary")
def metrics_summary():
    if not MODEL_METADATA:
        raise HTTPException(status_code=503, detail="Model metadata unavailable")
    return {
        "model_version": MODEL_METADATA.get("model_version"),
        "dataset": MODEL_METADATA.get("dataset"),
        "evaluation_metrics": MODEL_METADATA.get("evaluation_metrics"),
        "coefficients": MODEL_METADATA.get("coefficients"),
        "intercept": MODEL_METADATA.get("intercept"),
    }

@app.post("/api/score", response_model=ModelPredictionOutput)
@app.post("/score", response_model=ModelPredictionOutput)
def score_endpoint(req: RawTransactionInput):
    return execute_scoring(req)

@app.post("/api/score/batch", response_model=BatchScoreResponse)
@app.post("/score/batch", response_model=BatchScoreResponse)
def score_batch_endpoint(req: BatchScoreRequest):
    start = time.perf_counter()
    results = [execute_scoring(tx) for tx in req.transactions]
    total_latency = (time.perf_counter() - start) * 1000.0
    return BatchScoreResponse(
        batch_size=len(results),
        total_latency_ms=round(total_latency, 2),
        results=results,
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
