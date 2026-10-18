"""
AegisAI - Reproducible ML Training & Validation Pipeline
Trains a compact, lightweight Logistic Regression Pipeline with:
1. ColumnTransformer preprocessing (StandardScaler for numerics, OneHotEncoder for channels)
2. Stratified train/val/test splits (60% train, 20% val, 20% test)
3. Class-weight balancing evaluation
4. Decision threshold optimization on validation set (targeting high PR-AUC/F1 without test set contamination)
5. Evaluation against Majority Class Baseline and Transparent Rule Baseline
6. Serialized joblib artifact (< 500KB) and JSON metadata report
"""

import os
import sys
import json
import hashlib
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Tuple

import numpy as np
import joblib
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
    confusion_matrix,
    brier_score_loss,
)

# Ensure current package can be imported
sys.path.insert(0, str(Path(__file__).parent.parent))
from ml.features import (
    RawTransactionInput,
    extract_features_from_input,
    NUMERIC_FEATURES,
    CATEGORICAL_FEATURES,
    SCHEMA_VERSION,
)
from ml.data_generator import generate_synthetic_transactions

ARTIFACTS_DIR = Path(__file__).parent / "artifacts"
MODEL_VERSION = "fraud-v2.0.0-logistic"

def build_feature_matrix(records: list) -> Tuple[list, np.ndarray]:
    """Extracts features and target array from transaction records."""
    feature_rows = []
    y = []

    for r in records:
        tx_input = RawTransactionInput(
            transaction_id=r.get("transaction_id"),
            amount=r["amount"],
            channel=r.get("channel", "UPI"),
            attempt_count=r.get("attempt_count", 1),
            is_new_device=r.get("is_new_device", False),
            location_change=r.get("location_change", False),
            hour_of_day=r.get("hour_of_day", 14),
            currency=r.get("currency", "INR"),
        )
        features = extract_features_from_input(tx_input)
        feature_rows.append(features)
        y.append(int(r["is_fraud"]))

    return feature_rows, np.array(y, dtype=int)

def evaluate_predictions(y_true: np.ndarray, y_proba: np.ndarray, threshold: float = 0.5) -> Dict[str, Any]:
    """Calculates comprehensive fraud evaluation metrics."""
    y_pred = (y_proba >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()

    precision = float(precision_score(y_true, y_pred, zero_division=0))
    recall = float(recall_score(y_true, y_pred, zero_division=0))
    f1 = float(f1_score(y_true, y_pred, zero_division=0))

    try:
        roc_auc = float(roc_auc_score(y_true, y_proba))
    except Exception:
        roc_auc = 0.5

    try:
        pr_auc = float(average_precision_score(y_true, y_proba))
    except Exception:
        pr_auc = 0.0

    brier = float(brier_score_loss(y_true, y_proba))

    return {
        "threshold": round(threshold, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "roc_auc": round(roc_auc, 4),
        "pr_auc": round(pr_auc, 4),
        "brier_score": round(brier, 4),
        "confusion_matrix": {
            "true_negatives": int(tn),
            "false_positives": int(fp),
            "false_negatives": int(fn),
            "true_positives": int(tp),
        },
    }

def train_pipeline(n_samples: int = 8000, random_seed: int = 42) -> Dict[str, Any]:
    """Executes end-to-end training and evaluation."""
    start_time = time.perf_counter()
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    print(f"[{datetime.now(timezone.utc).isoformat()}] Generating {n_samples} synthetic training records...")
    raw_data = generate_synthetic_transactions(n_samples=n_samples, fraud_rate=0.038, seed=random_seed)

    # Compute dataset fingerprint
    raw_json_str = json.dumps(raw_data, sort_keys=True)
    dataset_fingerprint = hashlib.sha256(raw_json_str.encode()).hexdigest()[:16]

    features_list, y = build_feature_matrix(raw_data)
    total_samples = len(y)
    total_fraud = int(np.sum(y))
    print(f"Dataset summary: {total_samples} samples, {total_fraud} fraud ({total_fraud/total_samples:.2%})")

    # 1. Stratified 60/20/20 Split
    X_train_raw, X_temp_raw, y_train, y_temp = train_test_split(
        features_list, y, test_size=0.40, stratify=y, random_state=random_seed
    )
    X_val_raw, X_test_raw, y_val, y_test = train_test_split(
        X_temp_raw, y_temp, test_size=0.50, stratify=y_temp, random_state=random_seed
    )

    print(f"Split sizes: Train={len(y_train)}, Val={len(y_val)}, Test={len(y_test)}")

    # Convert feature dicts to matrix format acceptable by ColumnTransformer
    def to_structured_dict(raw_list):
        return {
            "amount_norm": [r["amount_norm"] for r in raw_list],
            "velocity_norm": [r["velocity_norm"] for r in raw_list],
            "is_new_device": [r["is_new_device"] for r in raw_list],
            "location_change": [r["location_change"] for r in raw_list],
            "night_hour_flag": [r["night_hour_flag"] for r in raw_list],
            "channel": [r["channel"] for r in raw_list],
        }

    import pandas as pd
    df_train = pd.DataFrame(to_structured_dict(X_train_raw))
    df_val = pd.DataFrame(to_structured_dict(X_val_raw))
    df_test = pd.DataFrame(to_structured_dict(X_test_raw))

    # Preprocessing Pipeline
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERIC_FEATURES),
            ("cat", OneHotEncoder(drop="first", handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
        ]
    )

    # Estimator: Logistic Regression with balanced class weights for imbalanced fraud
    classifier = LogisticRegression(
        class_weight="balanced",
        C=1.0,
        max_iter=1000,
        random_state=random_seed,
        solver="lbfgs"
    )

    pipeline = Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("classifier", classifier),
    ])

    # Fit ONLY on training data
    print("Fitting model pipeline on training set...")
    pipeline.fit(df_train, y_train)

    # 2. Threshold Selection on Validation Set
    val_probas = pipeline.predict_proba(df_val)[:, 1]
    best_threshold = 0.5
    best_f1 = -1.0

    for candidate_th in np.linspace(0.20, 0.85, 66):
        cand_metrics = evaluate_predictions(y_val, val_probas, threshold=candidate_th)
        if cand_metrics["f1"] > best_f1:
            best_f1 = cand_metrics["f1"]
            best_threshold = float(candidate_th)

    print(f"Validation threshold selected: {best_threshold:.4f} (Val F1: {best_f1:.4f})")

    # 3. Final Evaluation on Held-Out Test Set (Unbiased)
    test_probas = pipeline.predict_proba(df_test)[:, 1]
    test_metrics = evaluate_predictions(y_test, test_probas, threshold=best_threshold)
    print(f"Held-out Test Performance: PR-AUC={test_metrics['pr_auc']}, ROC-AUC={test_metrics['roc_auc']}, F1={test_metrics['f1']}, Recall={test_metrics['recall']}")

    # 4. Baseline Comparisons on Test Set
    # Majority class baseline (predicts 0 for everything)
    majority_proba = np.zeros_like(y_test, dtype=float)
    majority_metrics = evaluate_predictions(y_test, majority_proba, threshold=0.5)

    # Rule baseline: amount > 2.0 (50k) AND velocity > 1.0 (>= 2 attempts)
    rule_proba = np.zeros_like(y_test, dtype=float)
    for i, r in enumerate(X_test_raw):
        if r["amount_norm"] >= 2.0 or r["velocity_norm"] >= 3.0:
            rule_proba[i] = 0.85
        else:
            rule_proba[i] = 0.05
    rule_metrics = evaluate_predictions(y_test, rule_proba, threshold=0.5)

    # 5. Extract Learned Coefficients for Local Explainability
    fitted_preprocessor = pipeline.named_steps["preprocessor"]
    fitted_classifier = pipeline.named_steps["classifier"]

    # Get feature names after one-hot encoding
    cat_encoder = fitted_preprocessor.named_transformers_["cat"]
    encoded_cat_names = list(cat_encoder.get_feature_names_out(CATEGORICAL_FEATURES))
    feature_names = NUMERIC_FEATURES + encoded_cat_names

    coefficients = {
        name: round(float(coef), 4)
        for name, coef in zip(feature_names, fitted_classifier.coef_[0])
    }
    intercept = round(float(fitted_classifier.intercept_[0]), 4)

    # Full-precision parameters so the TypeScript scorers (browser + Edge Function) can
    # reproduce pipeline.predict_proba exactly. The classifier sees *standardized* numerics,
    # so the coefficients are meaningless without the scaler's mean and scale.
    num_scaler = fitted_preprocessor.named_transformers_["num"]
    inference_parameters = {
        "numeric_features": NUMERIC_FEATURES,
        "numeric_means": [float(v) for v in num_scaler.mean_],
        "numeric_scales": [float(v) for v in num_scaler.scale_],
        "channel_categories": [str(c) for c in cat_encoder.categories_[0]],
        "encoded_features": feature_names,
        "coefficients": [float(c) for c in fitted_classifier.coef_[0]],
        "intercept": float(fitted_classifier.intercept_[0]),
    }

    # Golden cases: pipeline outputs for fixed inputs, used by the TypeScript parity test
    parity_cases = []
    for amount in [450.0, 4800.0, 26000.0, 61000.0, 135000.0]:
        for channel in ["UPI", "Card", "Net banking", "Wallet"]:
            for attempts, new_device, loc_change, hour in [(1, False, False, 14), (4, True, True, 2)]:
                tx_input = RawTransactionInput(
                    amount=amount,
                    channel=channel,
                    attempt_count=attempts,
                    is_new_device=new_device,
                    location_change=loc_change,
                    hour_of_day=hour,
                )
                row = pd.DataFrame([extract_features_from_input(tx_input)])
                parity_cases.append({
                    "input": {
                        "amount": amount,
                        "channel": channel,
                        "attempt_count": attempts,
                        "is_new_device": new_device,
                        "location_change": loc_change,
                        "hour_of_day": hour,
                    },
                    "fraud_probability": float(pipeline.predict_proba(row)[0, 1]),
                })

    # 6. Save Model Artifact and Metadata
    artifact_path = ARTIFACTS_DIR / f"{MODEL_VERSION}.joblib"
    joblib.dump(pipeline, artifact_path)
    artifact_size_bytes = os.path.getsize(artifact_path)
    artifact_hash = hashlib.sha256(open(artifact_path, "rb").read()).hexdigest()

    training_duration_s = round(time.perf_counter() - start_time, 2)

    metadata = {
        "model_name": "AegisAI Logistic Fraud Classifier",
        "model_version": MODEL_VERSION,
        "algorithm": "LogisticRegression(class_weight='balanced', solver='lbfgs')",
        "feature_schema_version": SCHEMA_VERSION,
        "features": feature_names,
        "intercept": intercept,
        "coefficients": coefficients,
        "optimal_threshold": round(best_threshold, 4),
        "probability_calibration": "uncalibrated: class_weight='balanced' inflates probabilities relative to the training fraud rate; treat as a ranking score with the validated threshold",
        "inference_parameters": inference_parameters,
        "training_timestamp": datetime.now(timezone.utc).isoformat(),
        "training_duration_seconds": training_duration_s,
        "artifact_file": artifact_path.name,
        "artifact_size_kb": round(artifact_size_bytes / 1024, 2),
        "artifact_sha256": artifact_hash,
        "dataset": {
            "source": "synthetic_demo",
            "provenance_note": "Trained on deterministic synthetic transaction distribution for development & evaluation. Real-world validation pending.",
            "fingerprint": dataset_fingerprint,
            "total_samples": total_samples,
            "class_distribution": {
                "legitimate": int(total_samples - total_fraud),
                "fraud": int(total_fraud),
                "fraud_rate": round(total_fraud / total_samples, 4),
            },
            "split_counts": {
                "train": len(y_train),
                "validation": len(y_val),
                "test": len(y_test),
            },
        },
        "evaluation_metrics": {
            "held_out_test_set": test_metrics,
            "validation_set_best": evaluate_predictions(y_val, val_probas, threshold=best_threshold),
            "baselines_comparison": {
                "majority_class_baseline": majority_metrics,
                "transparent_rule_baseline": rule_metrics,
                "logistic_regression_pipeline": test_metrics,
            },
        },
        "status": "ready_for_serving",
    }

    metadata_path = ARTIFACTS_DIR / f"{MODEL_VERSION}_metadata.json"
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    # Also update 'latest' pointers for zero-downtime microservice loading
    joblib.dump(pipeline, ARTIFACTS_DIR / "active_model.joblib")
    with open(ARTIFACTS_DIR / "active_model_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"Artifact saved: {artifact_path} ({metadata['artifact_size_kb']} KB)")
    with open(ARTIFACTS_DIR / "parity_cases.json", "w") as f:
        json.dump({"model_version": MODEL_VERSION, "cases": parity_cases}, f, indent=2)

    print(f"Metadata saved: {metadata_path}")
    return metadata

if __name__ == "__main__":
    train_pipeline(n_samples=8000, random_seed=42)
