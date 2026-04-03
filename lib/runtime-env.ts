export const DEFAULT_SESSION_COOKIE_NAME = "atlas_session";
export const DEV_SESSION_SECRET = "dev-session-secret";
export const DEFAULT_SIGNUP_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const DEFAULT_SIGNUP_RATE_LIMIT_MAX_ATTEMPTS = 3;

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

function parseBooleanFlag(value: string | undefined, fallback: boolean) {
  if (!value?.trim()) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveProviderKeyRequirement(providerName: string | null | undefined) {
  const normalized = providerName?.trim().toLowerCase();

  if (!normalized || normalized === "mock" || normalized === "default") {
    return null;
  }

  if (normalized === "lyapi") {
    return {
      envNames: ["LYAPI_API_KEY", "OPENAI_API_KEY"],
      message: "missing LYAPI_API_KEY or OPENAI_API_KEY for ANALYSIS_LLM_PROVIDER=lyapi"
    };
  }

  if (normalized === "vectorengine") {
    return {
      envNames: ["VECTORENGINE_API_KEY"],
      message: "missing VECTORENGINE_API_KEY for ANALYSIS_LLM_PROVIDER=vectorengine"
    };
  }

  if (normalized === "gemini") {
    return {
      envNames: ["GEMINI_API_KEY", "OPENAI_API_KEY"],
      message: "missing GEMINI_API_KEY or OPENAI_API_KEY for ANALYSIS_LLM_PROVIDER=gemini"
    };
  }

  if (normalized === "openai") {
    return {
      envNames: ["OPENAI_API_KEY"],
      message: "missing OPENAI_API_KEY for ANALYSIS_LLM_PROVIDER=openai"
    };
  }

  return null;
}

export function isProductionEnvironment(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv?.trim().toLowerCase() === "production";
}

export function resolveSessionCookieName(env = process.env) {
  return env.SESSION_COOKIE_NAME?.trim() || DEFAULT_SESSION_COOKIE_NAME;
}

export function resolveSessionSecret(env = process.env) {
  const configuredSecret = env.SESSION_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  if (isProductionEnvironment(env.NODE_ENV)) {
    throw new Error("missing SESSION_SECRET in production");
  }

  return DEV_SESSION_SECRET;
}

export function isSelfServiceSignupEnabled(env = process.env) {
  return parseBooleanFlag(env.ATLAS_SELF_SERVICE_SIGNUP_ENABLED, false);
}

export function resolveAdminUsernames(env = process.env) {
  return (env.ATLAS_ADMIN_USERNAMES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function resolveSignupRateLimitWindowMs(env = process.env) {
  return parsePositiveInteger(env.ATLAS_SIGNUP_RATE_LIMIT_WINDOW_MS, DEFAULT_SIGNUP_RATE_LIMIT_WINDOW_MS);
}

export function resolveSignupRateLimitMaxAttempts(env = process.env) {
  return parsePositiveInteger(env.ATLAS_SIGNUP_RATE_LIMIT_MAX_ATTEMPTS, DEFAULT_SIGNUP_RATE_LIMIT_MAX_ATTEMPTS);
}

export function validateProductionEnvironment(env = process.env) {
  if (!isProductionEnvironment(env.NODE_ENV)) {
    return { ok: true, errors: [] as string[] };
  }

  const errors: string[] = [];

  if (!hasValue(env.SESSION_SECRET)) {
    errors.push("missing SESSION_SECRET");
  }

  if (!hasValue(env.ATLAS_DB_PATH)) {
    errors.push("missing ATLAS_DB_PATH");
  }

  if (!hasValue(env.ANALYSIS_JOB_STORE_DIR)) {
    errors.push("missing ANALYSIS_JOB_STORE_DIR");
  }

  if (!hasValue(env.ANALYSIS_LLM_PROVIDER)) {
    errors.push("missing ANALYSIS_LLM_PROVIDER");
  }

  if (!hasValue(env.ANALYSIS_LLM_MODEL)) {
    errors.push("missing ANALYSIS_LLM_MODEL");
  }

  const providerRequirement = resolveProviderKeyRequirement(env.ANALYSIS_LLM_PROVIDER);
  if (providerRequirement && !providerRequirement.envNames.some((envName) => hasValue(env[envName]))) {
    errors.push(providerRequirement.message);
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
