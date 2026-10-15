import { OpenAiProvider, type AiProvider } from "@pixelhub/ai";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

const globalForAi = globalThis as unknown as {
  runtimeAiConfig?: {
    groqApiKey?: string;
    groqModel?: string;
    openAiApiKey?: string;
  };
};

export function setRuntimeAiConfig(config: {
  groqApiKey?: string;
  groqModel?: string;
  openAiApiKey?: string;
}) {
  globalForAi.runtimeAiConfig = {
    ...globalForAi.runtimeAiConfig,
    ...config,
  };
  if (config.groqApiKey !== undefined) {
    process.env.GROQ_API_KEY = config.groqApiKey;
  }
  if (config.groqModel !== undefined) {
    process.env.GROQ_MODEL_DEFAULT = config.groqModel;
  }
  if (config.openAiApiKey !== undefined) {
    process.env.OPENAI_API_KEY = config.openAiApiKey;
  }
}

export function getActiveAiConfig() {
  const rt = globalForAi.runtimeAiConfig;
  const groqKey = (rt?.groqApiKey ?? process.env.GROQ_API_KEY ?? "").trim();
  const openAiKey = (rt?.openAiApiKey ?? process.env.OPENAI_API_KEY ?? "").trim();

  // Also allow if the user placed a Groq gsk_... key inside OPENAI_API_KEY
  if (groqKey || openAiKey.startsWith("gsk_")) {
    const apiKey = groqKey || openAiKey;
    const model =
      (rt?.groqModel ?? process.env.GROQ_MODEL_DEFAULT ?? "").trim() ||
      "qwen/qwen3.8-27b";
    return {
      provider: "groq" as const,
      apiKey,
      baseURL: GROQ_BASE_URL,
      defaultModel: model,
      visionModel:
        process.env.GROQ_MODEL_VISION?.trim() || "qwen/qwen3.8-27b",
      configured: true,
    };
  }

  if (openAiKey) {
    return {
      provider: "openai" as const,
      apiKey: openAiKey,
      baseURL: undefined,
      defaultModel: process.env.OPENAI_MODEL_DEFAULT ?? "gpt-4o-mini",
      visionModel: process.env.OPENAI_MODEL_VISION ?? "gpt-4o",
      configured: true,
    };
  }

  return {
    provider: "groq" as const,
    apiKey: "",
    baseURL: GROQ_BASE_URL,
    defaultModel: "qwen/qwen3.8-27b",
    visionModel: "qwen/qwen3.8-27b",
    configured: false,
  };
}

export function hasOpenAiKey(): boolean {
  return getActiveAiConfig().configured;
}

export function getAiProvider(): AiProvider {
  const cfg = getActiveAiConfig();
  if (!cfg.configured || !cfg.apiKey) {
    throw new Error(
      "GROQ_API_KEY (or OPENAI_API_KEY) is not configured — AI provider is unavailable",
    );
  }
  return new OpenAiProvider({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
  });
}

export function defaultModel(): string {
  return getActiveAiConfig().defaultModel;
}

export function visionModel(): string {
  const cfg = getActiveAiConfig();
  return cfg.provider === "groq" ? cfg.defaultModel : cfg.visionModel;
}
