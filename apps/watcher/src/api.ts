import mime from "mime-types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export interface FileEvent {
  type: "created" | "modified" | "deleted" | "moved";
  path?: string;
  sha256?: string;
  size?: number;
  from?: string;
  to?: string;
}

export interface UploadTarget {
  path: string;
  sha256: string;
  storageKey: string;
  uploadUrl: string;
}

export interface IngestResponse {
  uploadUrls: UploadTarget[];
  processed: number;
}

export interface WatcherConfigResponse {
  projectId: string;
  projectSlug: string;
  branchId: string | null;
  ignoreRules: string[];
  manifest: Array<{ path: string; sha256: string | null }>;
}

export interface ExchangeResponse {
  watcherToken: string;
  projectId: string;
  projectSlug: string;
  serverConfig: { apiBase: string };
}

function errorFrom(data: unknown, status: number): ApiError {
  if (data && typeof data === "object" && "error" in data) {
    const error = (data as { error?: unknown }).error;
    if (error && typeof error === "object") {
      const message = (error as { message?: unknown }).message;
      const code = (error as { code?: unknown }).code;
      if (typeof message === "string") {
        return new ApiError(
          message,
          status,
          typeof code === "string" ? code : null,
        );
      }
    }
  }
  return new ApiError(`Request failed (${status})`, status, null);
}

async function request<T>(
  serverUrl: string,
  path: string,
  options: { method?: string; token?: string | null; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${serverUrl.replace(/\/$/, "")}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body !== undefined
        ? { "content-type": "application/json" }
        : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw errorFrom(data, response.status);
  return data as T;
}

export function exchangePairingCode(
  serverUrl: string,
  code: string,
  deviceName: string,
): Promise<ExchangeResponse> {
  return request<ExchangeResponse>(serverUrl, "/api/v1/watchers/exchange", {
    method: "POST",
    body: { code, deviceName },
  });
}

export function fetchWatcherConfig(
  serverUrl: string,
  token: string,
): Promise<WatcherConfigResponse> {
  return request<WatcherConfigResponse>(serverUrl, "/api/v1/watchers/config", {
    token,
  });
}

export function ingestEvents(
  serverUrl: string,
  token: string,
  projectId: string,
  events: FileEvent[],
  mode: "full" | "delta",
): Promise<IngestResponse> {
  return request<IngestResponse>(
    serverUrl,
    `/api/v1/projects/${projectId}/files/ingest`,
    { method: "POST", token, body: { events, mode } },
  );
}

export function contentTypeFor(filePath: string): string {
  return mime.lookup(filePath) || "application/octet-stream";
}

export async function uploadBlob(
  target: UploadTarget,
  absolutePath: string,
): Promise<void> {
  const { createReadStream, promises: fsPromises } = await import("node:fs");
  const { Readable } = await import("node:stream");

  const stat = await fsPromises.stat(absolutePath);
  const body = Readable.toWeb(
    createReadStream(absolutePath),
  ) as ReadableStream<Uint8Array>;

  const response = await fetch(target.uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": contentTypeFor(target.path),
      "content-length": String(stat.size),
    },
    body,
    duplex: "half",
  } as RequestInit);

  if (!response.ok) {
    throw new ApiError(
      `Blob upload failed (${response.status})`,
      response.status,
      null,
    );
  }
}
