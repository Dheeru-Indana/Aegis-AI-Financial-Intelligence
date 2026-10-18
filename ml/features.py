"""
AegisAI - Canonical Feature Schema & Feature Builder
Provides consistent feature extraction, validation, and serialization across
training, testing, real-time FastAPI inference, and Supabase Edge Function payloads.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
import numpy as np

SCHEMA_VERSION = "2.0.0"

SUPPORTED_CHANNELS = ["UPI", "Card", "Net banking", "Wallet"]

class RawTransactionInput(BaseModel):
    transaction_id: Optional[str] = Field(None, description="Optional caller transaction identifier")
    amount: float = Field(..., gt=0, description="Transaction amount in base currency")
    channel: str = Field("UPI", description="Payment instrument (UPI, Card, Net banking, Wallet)")
    attempt_count: int = Field(1, ge=1, le=50, description="Velocity count of attempts in sliding window")
    is_new_device: bool = Field(False, description="Whether device fingerprint is unrecognised")
    location_change: bool = Field(False, description="Whether transaction geographic location deviated")
    hour_of_day: int = Field(14, ge=0, le=23, description="Hour of transaction initiation (0-23)")
    currency: str = Field("INR", description="Transaction currency")
    customer: Optional[str] = Field(None, description="Customer reference identifier")

class ModelPredictionOutput(BaseModel):
    transaction_id: Optional[str]
    fraud_probability: float
    risk_score: int
    risk_band: str
    recommended_action: str
    reason_codes: List[str]
    model_name: str
    model_version: str
    model_status: str
    feature_schema_version: str
    inference_latency_ms: float
    scored_at: str
    data_mode: str
    warnings: List[str]
    local_attributions: List[Dict[str, Any]]

# Explicit list of numerical and categorical feature names used by the Scikit-Learn Pipeline
NUMERIC_FEATURES = [
    "amount_norm",      # Scaled amount (clipped for outliers)
    "velocity_norm",    # Scaled attempt velocity (attempts - 1)
    "is_new_device",    # 1.0 or 0.0
    "location_change",  # 1.0 or 0.0
    "night_hour_flag",  # 1.0 if between 23:00 and 05:00, else 0.0
]

CATEGORICAL_FEATURES = [
    "channel"
]

ALL_ORDERED_COLUMNS = NUMERIC_FEATURES + CATEGORICAL_FEATURES

def extract_features_from_input(tx: RawTransactionInput) -> Dict[str, Any]:
    """
    Deterministically transforms a RawTransactionInput into the canonical feature row.
    Guarantees no target leakage and strict numerical bounds.
    """
    # 1. Amount normalization (scaling factor calibrated to median retail transaction ~25,000 INR)
    # Capped at 10.0 to prevent severe leverage points without losing large-value signals
    amount_norm = float(min(10.0, max(0.01, tx.amount / 25000.0)))

    # 2. Velocity normalization (scaled: 0 attempts = 0, 4 attempts = 3.0, capped at 10.0)
    velocity_norm = float(min(10.0, max(0.0, float(tx.attempt_count - 1))))

    # 3. Binary flags
    device_flag = 1.0 if tx.is_new_device else 0.0
    loc_flag = 1.0 if tx.location_change else 0.0

    # 4. Temporal feature: high-risk night window (11 PM to 5 AM)
    night_flag = 1.0 if (tx.hour_of_day >= 23 or tx.hour_of_day < 5) else 0.0

    # 5. Channel validation & fallback
    channel = tx.channel if tx.channel in SUPPORTED_CHANNELS else "UPI"

    return {
        "amount_norm": amount_norm,
        "velocity_norm": velocity_norm,
        "is_new_device": device_flag,
        "location_change": loc_flag,
        "night_hour_flag": night_flag,
        "channel": channel,
    }
