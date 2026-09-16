import { OpenAiProvider, type AiProvider } from "@pixelhub/ai";

let cached: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (cached) return cached;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured — AI features are unavailable");
  }
  cached = new OpenAiProvider({ apiKey });
  return cached;
}

/** Volume jobs use the cheap model; vision/narrative uses the stronger one (docs/07 §1). */
export function defaultModel(): string {
  return process.env.OPENAI_MODEL_DEFAULT ?? "gpt-4o-mini";
}

export function visionModel(): string {
  return process.env.OPENAI_MODEL_VISION ?? "gpt-4o";
}
