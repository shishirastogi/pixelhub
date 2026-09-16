import type { z } from "zod";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiImageInput {
  /** data-url, or a reference resolved from object storage */
  dataUrl?: string;
  storageKey?: string;
  mimeType?: string;
}

export interface AiUsage {
  tokensIn: number;
  tokensOut: number;
}

export interface AiCompleteOptions<T> {
  model: string;
  system: string;
  messages: AiMessage[];
  /** If set, enforce JSON output, validate against the schema and retry on parse failure. */
  json?: z.ZodType<T>;
  vision?: AiImageInput[];
  maxTokens?: number;
}

export interface AiCompletion<T> {
  text: string;
  parsed?: T;
  usage: AiUsage;
}

/**
 * One interface so the model is swappable (OpenAI now, Anthropic later).
 * See docs/07-ai-workflows.md §1.
 */
export interface AiProvider {
  complete<T>(opts: AiCompleteOptions<T>): Promise<AiCompletion<T>>;
}
