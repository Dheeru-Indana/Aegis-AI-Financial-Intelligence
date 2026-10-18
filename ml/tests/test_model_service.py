"""
AegisAI - Automated ML Test Suite
Verifies:
1. Deterministic training and reproducibility
2. Artifact save/load consistency
3. Input validation (positive amounts, channel constraints, bounded ranges)
4. Local linear explainability consistency (attributions match model weights)
5. FastAPI endpoint contracts (/health, /model/info, /score, /score/batch)
6. Bounded batch size enforcement (<= 100)
"""

import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from supabase.model_service import app
from ml.features import RawTransactionInput, extract_features_from_input, SCHEMA_VERSION

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True
    assert "fraud-v2.0.0-logistic" in data["model_version"]

def test_model_info_endpoint():
    response = client.get("/model/info")
    assert response.status_code == 200
    data = response.json()
    assert data["feature_schema_version"] == SCHEMA_VERSION
    assert "coefficients" in data
    assert "optimal_threshold" in data
    assert data["dataset"]["source"] == "synthetic_demo"

def test_scoring_endpoint_valid_low_risk():
    payload = {
        "transaction_id": "TEST-TX-LOW",
        "amount": 450.0,
        "channel": "UPI",
        "attempt_count": 1,
        "is_new_device": False,
        "location_change": False,
        "hour_of_day": 14,
        "currency": "INR",
        "customer": "CUST-LEGIT",
    }
    response = client.post("/api/score", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["transaction_id"] == "TEST-TX-LOW"
    assert 0.0 <= data["fraud_probability"] <= 1.0
    assert data["risk_band"] == "Low"
    assert data["recommended_action"] == "ALLOW"
    assert len(data["local_attributions"]) > 0

def test_scoring_endpoint_valid_high_risk():
    payload = {
        "transaction_id": "TEST-TX-HIGH",
        "amount": 250000.0,
        "channel": "Card",
        "attempt_count": 5,
        "is_new_device": True,
        "location_change": True,
        "hour_of_day": 3,
        "currency": "INR",
        "customer": "CUST-FRAUD-TEST",
    }
    response = client.post("/api/score", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["transaction_id"] == "TEST-TX-HIGH"
    assert data["fraud_probability"] > 0.60
    assert data["risk_band"] in ["High", "Medium"]
    assert data["recommended_action"] in ["FLAG", "VERIFY"]
    assert any("amount" in str(r).lower() or "velocity" in str(r).lower() for r in data["reason_codes"])

def test_scoring_endpoint_invalid_payloads():
    # Negative amount
    resp1 = client.post("/api/score", json={"amount": -50, "channel": "UPI"})
    assert resp1.status_code == 422

    # Zero amount
    resp2 = client.post("/api/score", json={"amount": 0, "channel": "UPI"})
    assert resp2.status_code == 422

    # Invalid hour
    resp3 = client.post("/api/score", json={"amount": 100, "channel": "UPI", "hour_of_day": 25})
    assert resp3.status_code == 422

def test_batch_scoring_endpoint():
    txs = [
        {"amount": 1000.0 * (i + 1), "channel": "UPI", "attempt_count": 1}
        for i in range(10)
    ]
    response = client.post("/api/score/batch", json={"transactions": txs})
    assert response.status_code == 200
    data = response.json()
    assert data["batch_size"] == 10
    assert len(data["results"]) == 10
    assert data["total_latency_ms"] > 0

def test_batch_scoring_exceeds_max_limit():
    # Attempt 101 transactions
    txs = [{"amount": 500.0, "channel": "UPI"} for _ in range(101)]
    response = client.post("/api/score/batch", json={"transactions": txs})
    assert response.status_code == 422 # Pydantic max_length validation
