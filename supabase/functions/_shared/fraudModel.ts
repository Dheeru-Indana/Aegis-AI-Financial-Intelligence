/**
 * AegisAI fraud model (fraud-v2.0.0-logistic): dependency-free TypeScript port.
 *
 * Reproduces the scikit-learn Pipeline from ml/train.py exactly: StandardScaler on the
 * numeric features, one-hot channel with "Card" as the dropped reference, then logistic
 * regression. It is imported by both the browser (src/services) and the score-transaction
 * Edge Function, so it must not import anything.
 *
 * Parameters are copied from ml/artifacts/active_model_metadata.json -> inference_parameters.
 * src/__tests__/fraudModelParity.test.ts fails if they drift from that artifact or from the
 * pipeline's own predictions (ml/artifacts/parity_cases.json). Re-run `python ml/train.py`
 * and update this block whenever the model is retrained.
 */

export const MODEL_VERSION = "fraud-v2.0.0-logistic";

/** F1-optimal decision threshold selected on the validation split. */
export const FLAG_THRESHOLD = 0.83;
/** Step-up verification band, matching supabase/model_service.py. */
export const VERIFY_THRESHOLD = 0.4;

export const MODEL_PARAMETERS = {
  numericFeatures: ["amount_norm", "velocity_norm", "is_new_device", "location_change", "night_hour_flag"],
  numericMeans: [0.25917005691666667, 0.23666666666666666, 0.104375, 0.0725, 0.017916666666666668],
  numericScales: [0.8039324548694513, 0.68604340646606, 0.30574639715784063, 0.2593139988508141, 0.13264863256823353],
  channelCategories: ["Card", "Net banking", "UPI", "Wallet"],
  encodedFeatures: [
    "amount_norm",
    "velocity_norm",
    "is_new_device",
    "location_change",
    "night_hour_flag",
    "channel_Net banking",
    "channel_UPI",
    "channel_Wallet",
  ],
  coefficients: [
    4.204480484040564, 1.6090470639890824, 1.0110877387115778, 0.8870418515828737, 0.5888639210576471,
    -1.4766561093346784, -1.7514449298848855, -0.37096273317926237,
  ],
  intercept: -4.980077393444688,
};

export const SUPPORTED_CHANNELS = ["UPI", "Card", "Net banking", "Wallet"];

export type ModelDecision = "ALLOW" | "VERIFY" | "FLAG";
export type RiskBand = "Low" | "Medium" | "High";

export interface RawTransactionFeatures {
  amount: number;
  channel?: string;
  attemptCount?: number;
  isNewDevice?: boolean;
  locationChange?: boolean;
  hourOfDay?: number;
}

export interface FeatureContribution {
  name: string;
  /** Log-odds contribution w_i * x_i on the encoded input (same definition as model_service.py). */
  contribution: number;
}

export interface ModelScore {
  probability: number;
  /** round(probability * 100), as the FastAPI service reports risk_score. */
  riskScore: number;
  decision: ModelDecision;
  riskBand: RiskBand;
  logit: number;
  /** All encoded features, largest absolute contribution first. */
  contributions: FeatureContribution[];
}

/** Mirrors extract_features_from_input in ml/features.py. */
export function extractFeatures(tx: RawTransactionFeatures): { numeric: number[]; channel: string } {
  const hour = tx.hourOfDay ?? 14;
  return {
    numeric: [
      Math.min(10, Math.max(0.01, tx.amount / 25000)),
      Math.min(10, Math.max(0, (tx.attemptCount ?? 1) - 1)),
      tx.isNewDevice ? 1 : 0,
      tx.locationChange ? 1 : 0,
      hour >= 23 || hour < 5 ? 1 : 0,
    ],
    channel: tx.channel && SUPPORTED_CHANNELS.includes(tx.channel) ? tx.channel : "UPI",
  };
}

/** The vector the fitted ColumnTransformer hands to the classifier. */
export function encodeFeatures(tx: RawTransactionFeatures): number[] {
  const { numeric, channel } = extractFeatures(tx);
  const { numericMeans, numericScales, channelCategories } = MODEL_PARAMETERS;
  const scaled = numeric.map((x, i) => (x - numericMeans[i]) / numericScales[i]);
  // drop="first" removes the first category ("Card"), which becomes the all-zeros reference
  const oneHot = channelCategories.slice(1).map((c) => (c === channel ? 1 : 0));
  return [...scaled, ...oneHot];
}

export function decisionForProbability(probability: number): ModelDecision {
  if (probability >= FLAG_THRESHOLD) return "FLAG";
  if (probability >= VERIFY_THRESHOLD) return "VERIFY";
  return "ALLOW";
}

export function riskBandForDecision(decision: ModelDecision): RiskBand {
  return decision === "FLAG" ? "High" : decision === "VERIFY" ? "Medium" : "Low";
}

export function scoreWithModel(tx: RawTransactionFeatures): ModelScore {
  const x = encodeFeatures(tx);
  const { coefficients, intercept, encodedFeatures } = MODEL_PARAMETERS;

  const contributions = x.map((value, i) => ({ name: encodedFeatures[i], contribution: coefficients[i] * value }));
  const logit = contributions.reduce((sum, c) => sum + c.contribution, intercept);
  const probability = 1 / (1 + Math.exp(-logit));
  const decision = decisionForProbability(probability);

  return {
    probability,
    riskScore: Math.round(probability * 100),
    decision,
    riskBand: riskBandForDecision(decision),
    logit,
    contributions: contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)),
  };
}
