"""
AegisAI - Synthetic Demo Data Generator
Produces deterministic, reproducible synthetic transaction datasets for smoke testing,
local training, CI/CD validation, and zero-external-download setups.

IMPORTANT: All datasets created here are explicitly stamped as synthetic_demo.
They represent synthetic domain hypotheses and are NEVER represented as authentic financial records.
"""

import json
import random
from typing import List, Dict, Any, Tuple
import numpy as np

def generate_synthetic_transactions(
    n_samples: int = 5000,
    fraud_rate: float = 0.035, # 3.5% imbalanced fraud prevalence
    seed: int = 42
) -> List[Dict[str, Any]]:
    """
    Generates a deterministic synthetic dataset of financial transactions.
    """
    random.seed(seed)
    np.random.seed(seed)

    channels = ["UPI", "Card", "Net banking", "Wallet"]
    channel_weights = [0.55, 0.25, 0.12, 0.08]

    records = []

    for i in range(n_samples):
        is_fraud = 1 if (random.random() < fraud_rate) else 0

        # Normal distributions conditioned on class
        if is_fraud:
            # Fraudulent behavior hypothesis: higher amounts, higher attempt velocity, novel devices, off-hours
            amount = round(float(np.random.exponential(scale=65000) + 12000), 2)
            attempt_count = int(np.random.choice([1, 2, 3, 4, 5, 6], p=[0.1, 0.15, 0.25, 0.25, 0.15, 0.1]))
            is_new_device = bool(random.random() < 0.72)
            location_change = bool(random.random() < 0.65)
            hour_of_day = int(np.random.choice(range(24), p=[
                0.08, 0.08, 0.08, 0.07, 0.06, 0.03, 0.02, 0.02,
                0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02,
                0.03, 0.03, 0.04, 0.04, 0.05, 0.06, 0.07, 0.08
            ]))
            channel = random.choices(channels, weights=[0.40, 0.35, 0.15, 0.10])[0]
        else:
            # Legitimate transactions: typical retail distribution, lower velocity, known devices
            amount = round(float(np.random.lognormal(mean=7.5, sigma=1.1) + 50), 2)
            attempt_count = int(np.random.choice([1, 2, 3], p=[0.88, 0.10, 0.02]))
            is_new_device = bool(random.random() < 0.08)
            location_change = bool(random.random() < 0.05)
            hour_of_day = int(random.randint(7, 22))
            channel = random.choices(channels, weights=channel_weights)[0]

        records.append({
            "transaction_id": f"SYN-{i+10001}",
            "amount": amount,
            "channel": channel,
            "attempt_count": attempt_count,
            "is_new_device": is_new_device,
            "location_change": location_change,
            "hour_of_day": hour_of_day,
            "currency": "INR",
            "is_fraud": is_fraud,
            "provenance": "synthetic_demo"
        })

    return records

if __name__ == "__main__":
    data = generate_synthetic_transactions(n_samples=6000, seed=42)
    fraud_count = sum(r["is_fraud"] for r in data)
    print(f"Generated {len(data)} synthetic records with {fraud_count} fraud instances ({fraud_count/len(data):.2%})")
