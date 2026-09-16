import OpenAI from "openai";
import type { z } from "zod";
import type {
  AiCompleteOptions,
  AiCompletion,
  AiMessage,
  AiProvider,
} from "./provider";

export interface OpenAiProviderOptions {
  apiKey: string;
  baseURL?: string;
}

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

function tryParse<T>(
  schema: z.ZodType<T>,
  text: string,
): { ok: true; data: T } | { ok: false; error: string } {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "invalid JSON" };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: JSON.stringify(result.error.flatten()) };
  }
  return { ok: true, data: result.data };
}

function buildMessages(
  opts: AiCompleteOptions<unknown>,
): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: opts.system }];

  opts.messages.forEach((message: AiMessage, index) => {
    const isLastUser =
      index === opts.messages.length - 1 && message.role === "user";

    if (isLastUser && opts.vision && opts.vision.length > 0) {
      const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
        { type: "text", text: message.content },
      ];
      for (const image of opts.vision) {
        if (image.dataUrl) {
          parts.push({ type: "image_url", image_url: { url: image.dataUrl } });
        }
      }
      messages.push({ role: "user", content: parts });
    } else {
      messages.push({ role: message.role, content: message.content });
    }
  });

  return messages;
}

/** OpenAI implementation of the swappable AiProvider (docs/07-ai-workflows.md §1). */
export class OpenAiProvider implements AiProvider {
  private readonly client: OpenAI;

  constructor(options: OpenAiProviderOptions) {
    this.client = new OpenAI({ apiKey: options.apiKey, baseURL: options.baseURL });
  }

  async complete<T>(opts: AiCompleteOptions<T>): Promise<AiCompletion<T>> {
    const messages = buildMessages(opts);

    const attempt = async (extra?: string) => {
      const convo = extra
        ? [...messages, { role: "user" as const, content: extra }]
        : messages;

      const completion = await this.client.chat.completions.create({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 2000,
        messages: convo,
        ...(opts.json
          ? { response_format: { type: "json_object" as const } }
          : {}),
      });

      return {
        text: completion.choices[0]?.message?.content ?? "",
        usage: {
          tokensIn: completion.usage?.prompt_tokens ?? 0,
          tokensOut: completion.usage?.completion_tokens ?? 0,
        },
      };
    };

    const first = await attempt();
    let usage = first.usage;

    if (!opts.json) {
      return { text: first.text, usage };
    }

    const parsed = tryParse(opts.json, first.text);
    if (parsed.ok) {
      return { text: first.text, parsed: parsed.data, usage };
    }

    const retry = await attempt(
      `Your previous output was not valid JSON for the required schema (${parsed.error}). Return ONLY valid JSON matching the schema, with no prose or markdown fences.`,
    );
    usage = {
      tokensIn: usage.tokensIn + retry.usage.tokensIn,
      tokensOut: usage.tokensOut + retry.usage.tokensOut,
    };

    const reparsed = tryParse(opts.json, retry.text);
    if (!reparsed.ok) {
      throw new Error(`AI output failed schema validation after retry: ${reparsed.error}`);
    }
    return { text: retry.text, parsed: reparsed.data, usage };
  }
}
