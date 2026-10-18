import { describe, it, expect } from "vitest";
import metadata from "../../ml/artifacts/active_model_metadata.json";
import parity from "../../ml/artifacts/parity_cases.json";
import {
  MODEL_PARAMETERS,
  MODEL_VERSION,
  FLAG_THRESHOLD,
  extractFeatures,
  scoreWithModel,
} from "../../supabase/functions/_shared/fraudModel.ts";

describe("TypeScript fraud model parity with the trained scikit-learn pipeline", () => {
  it("uses exactly the parameters exported by ml/train.py", () => {
    const exported = metadata.inference_parameters;
    expect(MODEL_VERSION).toBe(metadata.model_version);
    expect(FLAG_THRESHOLD).toBe(metadata.optimal_threshold);
    expect(MODEL_PARAMETERS.numericFeatures).toEqual(exported.numeric_features);
    expect(MODEL_PARAMETERS.numericMeans).toEqual(exported.numeric_means);
    expect(MODEL_PARAMETERS.numericScales).toEqual(exported.numeric_scales);
    expect(MODEL_PARAMETERS.channelCategories).toEqual(exported.channel_categories);
    expect(MODEL_PARAMETERS.encodedFeatures).toEqual(exported.encoded_features);
    expect(MODEL_PARAMETERS.coefficients).toEqual(exported.coefficients);
    expect(MODEL_PARAMETERS.intercept).toBe(exported.intercept);
  });

  it("reproduces pipeline.predict_proba for every golden case", () => {
    expect(parity.model_version).toBe(MODEL_VERSION);
    expect(parity.cases.length).toBeGreaterThan(0);

    for (const { input, fraud_probability } of parity.cases) {
      const result = scoreWithModel({
        amount: input.amount,
        channel: input.channel,
        attemptCount: input.attempt_count,
        isNewDevice: input.is_new_device,
        locationChange: input.location_change,
        hourOfDay: input.hour_of_day,
      });
      expect(result.probability).toBeCloseTo(fraud_probability, 9);
    }
  });

  it("applies the channel effect learned by the model", () => {
    const base = { amount: 26000, attemptCount: 1, hourOfDay: 14 };
    const card = scoreWithModel({ ...base, channel: "Card" }).probability;
    const upi = scoreWithModel({ ...base, channel: "UPI" }).probability;
    // UPI has a strongly negative coefficient relative to the Card reference
    expect(upi).toBeLessThan(card);
  });

  it("matches the night-hour window in ml/features.py (23:00-04:59)", () => {
    const night = (hourOfDay: number) => extractFeatures({ amount: 1000, hourOfDay }).numeric[4];
    expect([23, 0, 4].map(night)).toEqual([1, 1, 1]);
    expect([5, 14, 22].map(night)).toEqual([0, 0, 0]);
  });

  it("falls back to UPI for unsupported channels, like the Python feature builder", () => {
    expect(extractFeatures({ amount: 1000, channel: "Crypto" }).channel).toBe("UPI");
  });
});
