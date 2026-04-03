import { afterEach, describe, expect, test } from "vitest";

import {
  DEFAULT_SIGNUP_RATE_LIMIT_MAX_ATTEMPTS,
  DEFAULT_SIGNUP_RATE_LIMIT_WINDOW_MS,
  DEV_SESSION_SECRET,
  isSelfServiceSignupEnabled,
  resolveAdminUsernames,
  resolveSignupRateLimitMaxAttempts,
  resolveSignupRateLimitWindowMs,
  resolveSessionSecret,
  validateProductionEnvironment
} from "@/lib/runtime-env";

afterEach(() => {
  delete (process.env as Record<string, string | undefined>).NODE_ENV;
  delete process.env.SESSION_SECRET;
  delete process.env.ATLAS_DB_PATH;
  delete process.env.ANALYSIS_JOB_STORE_DIR;
  delete process.env.ANALYSIS_LLM_PROVIDER;
  delete process.env.ANALYSIS_LLM_MODEL;
  delete process.env.LYAPI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.VECTORENGINE_API_KEY;
  delete process.env.ATLAS_SELF_SERVICE_SIGNUP_ENABLED;
  delete process.env.ATLAS_ADMIN_USERNAMES;
  delete process.env.ATLAS_SIGNUP_RATE_LIMIT_WINDOW_MS;
  delete process.env.ATLAS_SIGNUP_RATE_LIMIT_MAX_ATTEMPTS;
});

describe("runtime env", () => {
  test("falls back to the dev session secret outside production", () => {
    delete (process.env as Record<string, string | undefined>).NODE_ENV;
    delete process.env.SESSION_SECRET;

    expect(resolveSessionSecret()).toBe(DEV_SESSION_SECRET);
  });

  test("rejects the dev session secret in production", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.SESSION_SECRET;

    expect(() => resolveSessionSecret()).toThrow("missing SESSION_SECRET in production");
  });

  test("reports missing production deployment settings", () => {
    const result = validateProductionEnvironment({
      NODE_ENV: "production"
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "missing SESSION_SECRET",
        "missing ATLAS_DB_PATH",
        "missing ANALYSIS_JOB_STORE_DIR",
        "missing ANALYSIS_LLM_PROVIDER",
        "missing ANALYSIS_LLM_MODEL"
      ])
    );
  });

  test("accepts a complete single-pipeline lyapi production config", () => {
    const result = validateProductionEnvironment({
      NODE_ENV: "production",
      SESSION_SECRET: "prod-secret",
      ATLAS_DB_PATH: "/var/lib/atlas/atlas.db",
      ANALYSIS_JOB_STORE_DIR: "/var/lib/atlas/jobs",
      ANALYSIS_LLM_PROVIDER: "lyapi",
      ANALYSIS_LLM_MODEL: "gemini-3.1-pro-preview",
      LYAPI_API_KEY: "lyapi-key"
    });

    expect(result).toEqual({
      ok: true,
      errors: []
    });
  });

  test("resolves self-service signup config", () => {
    process.env.ATLAS_SELF_SERVICE_SIGNUP_ENABLED = "true";
    process.env.ATLAS_ADMIN_USERNAMES = "atlas01, atlas02";
    process.env.ATLAS_SIGNUP_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.ATLAS_SIGNUP_RATE_LIMIT_MAX_ATTEMPTS = "5";

    expect(isSelfServiceSignupEnabled()).toBe(true);
    expect(resolveAdminUsernames()).toEqual(["atlas01", "atlas02"]);
    expect(resolveSignupRateLimitWindowMs()).toBe(60000);
    expect(resolveSignupRateLimitMaxAttempts()).toBe(5);
  });

  test("falls back to default signup config", () => {
    expect(isSelfServiceSignupEnabled()).toBe(false);
    expect(resolveAdminUsernames()).toEqual([]);
    expect(resolveSignupRateLimitWindowMs()).toBe(DEFAULT_SIGNUP_RATE_LIMIT_WINDOW_MS);
    expect(resolveSignupRateLimitMaxAttempts()).toBe(DEFAULT_SIGNUP_RATE_LIMIT_MAX_ATTEMPTS);
  });
});
