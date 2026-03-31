import { accessSync, constants, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

function hasValue(value) {
  return Boolean(value && value.trim());
}

function isProductionEnvironment(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv?.trim().toLowerCase() === "production";
}

function validateProductionEnvironment(env = process.env) {
  if (!isProductionEnvironment(env.NODE_ENV)) {
    return { ok: true, errors: [] };
  }

  const errors = [];

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

  const provider = env.ANALYSIS_LLM_PROVIDER?.trim().toLowerCase();
  if (provider === "lyapi" && !hasValue(env.LYAPI_API_KEY) && !hasValue(env.OPENAI_API_KEY)) {
    errors.push("missing LYAPI_API_KEY or OPENAI_API_KEY for ANALYSIS_LLM_PROVIDER=lyapi");
  }

  if (provider === "vectorengine" && !hasValue(env.VECTORENGINE_API_KEY)) {
    errors.push("missing VECTORENGINE_API_KEY for ANALYSIS_LLM_PROVIDER=vectorengine");
  }

  if (provider === "gemini" && !hasValue(env.GEMINI_API_KEY) && !hasValue(env.OPENAI_API_KEY)) {
    errors.push("missing GEMINI_API_KEY or OPENAI_API_KEY for ANALYSIS_LLM_PROVIDER=gemini");
  }

  if (provider === "openai" && !hasValue(env.OPENAI_API_KEY)) {
    errors.push("missing OPENAI_API_KEY for ANALYSIS_LLM_PROVIDER=openai");
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function ensureWritablePath(path, label) {
  const normalizedPath = resolve(path);
  const writableTarget = label === "ATLAS_DB_PATH" ? dirname(normalizedPath) : normalizedPath;
  mkdirSync(writableTarget, { recursive: true });
  accessSync(writableTarget, constants.W_OK);
}

function run() {
  const validation = validateProductionEnvironment(process.env);
  if (!validation.ok) {
    for (const error of validation.errors) {
      process.stderr.write(`${error}\n`);
    }
    process.exit(1);
  }

  if (!isProductionEnvironment(process.env.NODE_ENV)) {
    process.stdout.write("Preflight skipped outside production\n");
    return;
  }

  ensureWritablePath(process.env.ATLAS_DB_PATH, "ATLAS_DB_PATH");
  ensureWritablePath(process.env.ANALYSIS_JOB_STORE_DIR, "ANALYSIS_JOB_STORE_DIR");

  process.stdout.write("Production preflight passed\n");
}

run();
