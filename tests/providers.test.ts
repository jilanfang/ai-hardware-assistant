import { afterEach, describe, expect, test } from "vitest";

import { resolveConfiguredProviders } from "@/lib/providers";

afterEach(() => {
  delete process.env.ANALYSIS_PIPELINE_MODE;
  delete process.env.ANALYSIS_LLM_PROVIDER;
  delete process.env.ANALYSIS_LLM_PROFILE;
  delete process.env.ANALYSIS_LLM_MODEL;
  delete process.env.ANALYSIS_LLM_BASE_URL;
  delete process.env.ANALYSIS_LLM_API_KEY;
  delete process.env.ANALYSIS_FAST_LLM_PROVIDER;
  delete process.env.ANALYSIS_FAST_LLM_MODEL;
  delete process.env.ANALYSIS_FAST_LLM_BASE_URL;
  delete process.env.ANALYSIS_FAST_LLM_API_KEY;
  delete process.env.ANALYSIS_REPORT_LLM_PROVIDER;
  delete process.env.ANALYSIS_REPORT_LLM_MODEL;
  delete process.env.ANALYSIS_REPORT_LLM_BASE_URL;
  delete process.env.ANALYSIS_REPORT_LLM_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_BASE_URL;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_BASE_URL;
  delete process.env.LYAPI_API_KEY;
  delete process.env.LYAPI_BASE_URL;
  delete process.env.VECTORENGINE_API_KEY;
  delete process.env.VECTORENGINE_BASE_URL;
});

describe("provider resolution", () => {
  test("resolves the real gemini provider with the default profile", () => {
    process.env.ANALYSIS_LLM_PROVIDER = "gemini";
    process.env.ANALYSIS_LLM_PROFILE = "default";
    process.env.GEMINI_API_KEY = "test-key";

    const resolved = resolveConfiguredProviders();

    expect(resolved.llmProviderName).toBe("gemini");
    expect(resolved.llmProvider).toBeTruthy();
    expect(resolved.llmModelName).toBe("gemini-3-flash-preview");
  });

  test("resolves the real openai-compatible provider with custom base url", () => {
    process.env.ANALYSIS_LLM_PROVIDER = "openai";
    process.env.ANALYSIS_LLM_MODEL = "qwen3-vl-32b-instruct";
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_BASE_URL = "https://lyapi.com";

    const resolved = resolveConfiguredProviders();

    expect(resolved.llmProviderName).toBe("openai");
    expect(resolved.llmProvider).toBeTruthy();
    expect(resolved.llmModelName).toBe("qwen3-vl-32b-instruct");
  });

  test("resolves the default model profile when explicit model is absent", () => {
    process.env.ANALYSIS_LLM_PROVIDER = "gemini";
    process.env.ANALYSIS_LLM_PROFILE = "default";
    process.env.GEMINI_API_KEY = "test-key";

    const resolved = resolveConfiguredProviders();

    expect(resolved.llmProviderName).toBe("gemini");
    expect(resolved.llmProvider).toBeTruthy();
    expect(resolved.llmModelName).toBe("gemini-3-flash-preview");
  });

  test("explicit model override wins over profile mapping", () => {
    process.env.ANALYSIS_LLM_PROVIDER = "openai";
    process.env.ANALYSIS_LLM_PROFILE = "premium";
    process.env.ANALYSIS_LLM_MODEL = "gpt-4o";
    process.env.OPENAI_API_KEY = "test-key";

    const resolved = resolveConfiguredProviders();

    expect(resolved.llmProviderName).toBe("openai");
    expect(resolved.llmProvider).toBeTruthy();
    expect(resolved.llmModelName).toBe("gpt-4o");
  });

  test("resolves lyapi relay provider as openai-compatible for gpt-4o", () => {
    process.env.ANALYSIS_LLM_PROVIDER = "lyapi";
    process.env.ANALYSIS_LLM_MODEL = "gpt-4o";
    process.env.LYAPI_API_KEY = "relay-key";

    const resolved = resolveConfiguredProviders();

    expect(resolved.llmProviderName).toBe("lyapi");
    expect(resolved.llmProvider).toBeTruthy();
    expect(resolved.llmModelName).toBe("gpt-4o");
    expect(resolved.llmProvider?.constructor.name).toBe("OpenAiLlmProvider");
  });

  test("resolves lyapi relay provider as gemini-native for gemini models", () => {
    process.env.ANALYSIS_LLM_PROVIDER = "lyapi";
    process.env.ANALYSIS_LLM_MODEL = "gemini-3-flash-preview";
    process.env.LYAPI_API_KEY = "relay-key";

    const resolved = resolveConfiguredProviders();

    expect(resolved.llmProviderName).toBe("lyapi");
    expect(resolved.llmProvider).toBeTruthy();
    expect(resolved.llmModelName).toBe("gemini-3-flash-preview");
    expect(resolved.llmProvider?.constructor.name).toBe("GeminiLlmProvider");
  });

  test("supports provider/model combinations per stage", () => {
    process.env.ANALYSIS_PIPELINE_MODE = "staged";
    process.env.ANALYSIS_LLM_PROVIDER = "lyapi";
    process.env.LYAPI_API_KEY = "lyapi-key";
    process.env.VECTORENGINE_API_KEY = "vector-key";
    process.env.ANALYSIS_FAST_LLM_PROVIDER = "vectorengine";
    process.env.ANALYSIS_FAST_LLM_MODEL = "gpt-4.1";
    process.env.ANALYSIS_REPORT_LLM_PROVIDER = "lyapi";
    process.env.ANALYSIS_REPORT_LLM_MODEL = "gemini-3.1-pro-preview";

    const resolved = resolveConfiguredProviders();

    expect(resolved.llmProviderName).toBe("composite");
    expect(resolved.analysisSuite).toBeTruthy();
    expect(resolved.llmModelName).toBe("gemini-3.1-pro-preview");
    expect(resolved.analysisSuite?.fastParameterProvider.constructor.name).toBe("OpenAiLlmProvider");
    expect(resolved.analysisSuite?.reportProvider.constructor.name).toBe("GeminiLlmProvider");
  });

  test("defaults to single pipeline mode even when stage env vars exist", () => {
    process.env.ANALYSIS_LLM_PROVIDER = "lyapi";
    process.env.ANALYSIS_LLM_MODEL = "gpt-4.1";
    process.env.LYAPI_API_KEY = "lyapi-key";
    process.env.ANALYSIS_FAST_LLM_PROVIDER = "vectorengine";
    process.env.ANALYSIS_FAST_LLM_MODEL = "gpt-4o";

    const resolved = resolveConfiguredProviders();

    expect(resolved.llmProviderName).toBe("lyapi");
    expect(resolved.llmModelName).toBe("gpt-4.1");
    expect(resolved.analysisSuite).toBeTruthy();
    expect(resolved.llmProvider?.constructor.name).toBe("OpenAiLlmProvider");
  });
});
