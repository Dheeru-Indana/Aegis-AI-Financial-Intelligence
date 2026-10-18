import { describe, it, expect } from "vitest";
import {
  authorizeScoringProfile,
  validateScoringPayload,
} from "../../supabase/functions/_shared/scoringGuards.ts";

/**
 * Exercises the guard functions the score-transaction Edge Function calls before scoring.
 */
describe("Edge Function: score-transaction authorization", () => {
  it("rejects callers without a profile row", () => {
    expect(authorizeScoringProfile(null)).toMatchObject({ ok: false, status: 403 });
    expect(authorizeScoringProfile(undefined)).toMatchObject({ ok: false, status: 403 });
  });

  it("accepts only active administrators and fraud analysts", () => {
    expect(authorizeScoringProfile({ role: "administrator", status: "active" }).ok).toBe(true);
    expect(authorizeScoringProfile({ role: "fraud_analyst", status: "active" }).ok).toBe(true);

    for (const role of ["investigator", "auditor", "viewer"]) {
      expect(authorizeScoringProfile({ role, status: "active" })).toMatchObject({ ok: false, status: 403 });
    }
  });

  it("rejects suspended and inactive accounts even with a scoring role", () => {
    for (const status of ["suspended", "inactive"]) {
      expect(authorizeScoringProfile({ role: "administrator", status })).toMatchObject({
        ok: false,
        status: 403,
        error: "Access denied: account is not active",
      });
    }
  });
});

describe("Edge Function: score-transaction payload validation", () => {
  it("rejects non-positive, non-finite and missing amounts", () => {
    for (const amount of [-50, 0, Number.NaN, Number.POSITIVE_INFINITY, "500", undefined]) {
      expect(validateScoringPayload({ amount, customer: "CUST-1" })).toMatchObject({ ok: false, status: 400 });
    }
  });

  it("requires a non-blank customer reference", () => {
    expect(validateScoringPayload({ amount: 500, customer: "   " }).ok).toBe(false);
    expect(validateScoringPayload({ amount: 500 }).ok).toBe(false);
  });

  it("rejects unknown channels and out-of-range attempt counts", () => {
    expect(validateScoringPayload({ amount: 500, customer: "C", channel: "Crypto" }).ok).toBe(false);
    for (const attemptCount of [0, 51, 2.5, "3"]) {
      expect(validateScoringPayload({ amount: 500, customer: "C", attemptCount }).ok).toBe(false);
    }
  });

  it("rejects bodies that are not objects", () => {
    for (const body of [null, "amount=5", 42]) {
      expect(validateScoringPayload(body).ok).toBe(false);
    }
  });

  it("applies defaults and trims the customer reference", () => {
    expect(validateScoringPayload({ amount: 15000, customer: "  CUST-VALID " })).toEqual({
      ok: true,
      value: { amount: 15000, customer: "CUST-VALID", channel: "UPI", attemptCount: 1 },
    });
  });
});

describe("Database RLS: current_user_role() security invariant", () => {
  function evalCurrentUserRole(profile: { role: string; status: string } | null | undefined): string | null {
    if (!profile) return null;
    if (profile.status !== "active") return null;
    return profile.role;
  }

  it("locks out suspended and inactive accounts from staff-restricted SELECT policies", () => {
    // Current user role returns NULL for non-active accounts
    expect(evalCurrentUserRole(null)).toBeNull();
    expect(evalCurrentUserRole(undefined)).toBeNull();
    expect(evalCurrentUserRole({ role: "fraud_analyst", status: "suspended" })).toBeNull();
    expect(evalCurrentUserRole({ role: "fraud_analyst", status: "inactive" })).toBeNull();
    expect(evalCurrentUserRole({ role: "administrator", status: "suspended" })).toBeNull();

    // Only active accounts have current_user_role() IS NOT NULL
    expect(evalCurrentUserRole({ role: "fraud_analyst", status: "active" })).toBe("fraud_analyst");
    expect(evalCurrentUserRole({ role: "administrator", status: "active" })).toBe("administrator");
    expect(evalCurrentUserRole({ role: "investigator", status: "active" })).toBe("investigator");
  });
});

