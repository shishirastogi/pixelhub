import { apiFetch } from "@/lib/api";

export interface AiJobState<T = unknown> {
  id: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  resultJson?: T | null;
  error?: string | null;
}

/** Poll an AiJob until it reaches a terminal state. For use in client components. */
export async function pollAiJob<T>(
  jobId: string,
  options?: { intervalMs?: number; maxAttempts?: number },
): Promise<AiJobState<T>> {
  const intervalMs = options?.intervalMs ?? 1500;
  const maxAttempts = options?.maxAttempts ?? 40;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const job = await apiFetch<AiJobState<T>>(`/ai-jobs/${jobId}`);
    if (job.status === "SUCCEEDED" || job.status === "FAILED" || job.status === "CANCELLED") {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return apiFetch<AiJobState<T>>(`/ai-jobs/${jobId}`);
}

export function isTerminalJobState(status: AiJobState["status"]): boolean {
  return status === "SUCCEEDED" || status === "FAILED" || status === "CANCELLED";
}
