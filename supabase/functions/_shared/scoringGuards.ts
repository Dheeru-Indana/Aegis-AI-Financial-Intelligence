/**
 * Authorization and payload checks for the score-transaction Edge Function.
 * Kept dependency-free so the same code is exercised by the vitest suite.
 */

export const SCORING_ROLES = ["administrator", "fraud_analyst"];
export const SCORING_CHANNELS = ["UPI", "Card", "Net banking", "Wallet"] as const;

export type GuardResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

export interface ProfileRow {
  role: string;
  status: string;
}

export function authorizeScoringProfile(profile: ProfileRow | null | undefined): GuardResult<ProfileRow> {
  if (!profile) {
    return { ok: false, status: 403, error: "Access denied: user profile not found" };
  }
  if (profile.status !== "active") {
    return { ok: false, status: 403, error: "Access denied: account is not active" };
  }
  if (!SCORING_ROLES.includes(profile.role)) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden: insufficient permissions. Requires administrator or fraud_analyst role.",
    };
  }
  return { ok: true, value: profile };
}

export interface ScoringPayload {
  amount: number;
  customer: string;
  channel: (typeof SCORING_CHANNELS)[number];
  attemptCount: number;
}

export function validateScoringPayload(body: unknown): GuardResult<ScoringPayload> {
  const invalid = (error: string): GuardResult<ScoringPayload> => ({ ok: false, status: 400, error });
  if (!body || typeof body !== "object") return invalid("Invalid JSON request body");

  const { amount, customer, channel = "UPI", attemptCount = 1 } = body as Record<string, unknown>;

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return invalid("Validation error: amount must be a positive number");
  }
  if (typeof customer !== "string" || customer.trim().length === 0) {
    return invalid("Validation error: customer reference is required");
  }
  if (typeof channel !== "string" || !(SCORING_CHANNELS as readonly string[]).includes(channel)) {
    return invalid("Validation error: channel must be UPI, Card, Net banking, or Wallet");
  }
  // Same bounds as RawTransactionInput.attempt_count in ml/features.py
  if (typeof attemptCount !== "number" || !Number.isInteger(attemptCount) || attemptCount < 1 || attemptCount > 50) {
    return invalid("Validation error: attemptCount must be an integer between 1 and 50");
  }

  return {
    ok: true,
    value: { amount, customer: customer.trim(), channel: channel as ScoringPayload["channel"], attemptCount },
  };
}
