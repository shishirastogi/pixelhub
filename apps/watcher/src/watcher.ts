import path from "node:path";
import chokidar from "chokidar";
import {
  ApiError,
  fetchWatcherConfig,
  ingestEvents,
  type FileEvent,
  type WatcherConfigResponse,
} from "./api.js";
import { loadCredentials, loadLocalConfig } from "./config.js";
import { createIgnoreMatcher, toPosix } from "./ignore.js";
import { hashFile, scanFolder, type LocalFile } from "./scan.js";
import { uploadTargets } from "./transfer.js";

export interface WatchOptions {
  /** Absolute path to the project folder being watched. */
  root: string;
}

const FLUSH_INTERVAL_MS = 2000;
const HEARTBEAT_MS = 60_000;
const EVENT_BATCH_SIZE = 5000;

export interface PendingEvent {
  type: "created" | "modified" | "deleted";
  path: string;
  sha256?: string;
  size?: number;
}

export function toFileEvents(events: PendingEvent[]): FileEvent[] {
  const deleted = events.filter(
    (event) => event.type === "deleted" && event.sha256,
  );
  const created = events.filter((event) => event.type === "created");
  const usedCreated = new Set<string>();
  const usedDeleted = new Set<string>();
  const moved: FileEvent[] = [];

  for (const gone of deleted) {
    const match = created.find(
      (candidate) =>
        candidate.sha256 === gone.sha256 && !usedCreated.has(candidate.path),
    );
    if (!match) continue;
    usedCreated.add(match.path);
    usedDeleted.add(gone.path);
    moved.push({
      type: "moved",
      from: gone.path,
      to: match.path,
      sha256: gone.sha256,
    });
  }

  const rest: FileEvent[] = events
    .filter(
      (event) => !usedCreated.has(event.path) && !usedDeleted.has(event.path),
    )
    .map((event) => ({
      type: event.type,
      path: event.path,
      sha256: event.sha256,
      size: event.size,
    }));

  return [...rest, ...moved];
}

async function sendEvents(
  serverUrl: string,
  token: string,
  projectId: string,
  root: string,
  events: FileEvent[],
): Promise<number> {
  let uploaded = 0;
  for (let i = 0; i < events.length; i += EVENT_BATCH_SIZE) {
    const batch = events.slice(i, i + EVENT_BATCH_SIZE);
    const result = await ingestEvents(
      serverUrl,
      token,
      projectId,
      batch,
      "delta",
    );
    if (result.uploadUrls.length > 0) {
      uploaded += await uploadTargets(root, result.uploadUrls);
    }
  }
  return uploaded;
}

async function reconcile(
  serverUrl: string,
  token: string,
  projectId: string,
  root: string,
  manifest: WatcherConfigResponse["manifest"],
  localFiles: LocalFile[],
): Promise<void> {
  const serverByPath = new Map(
    manifest.map((entry) => [entry.path, entry.sha256]),
  );
  const events: FileEvent[] = [];
  let inSync = 0;

  for (const file of localFiles) {
    const serverHash = serverByPath.get(file.path);
    if (serverHash === file.sha256) {
      inSync += 1;
      continue;
    }
    events.push({
      type: serverHash === undefined ? "created" : "modified",
      path: file.path,
      sha256: file.sha256,
      size: file.size,
    });
  }

  const localPaths = new Set(localFiles.map((file) => file.path));
  for (const entry of manifest) {
    if (!localPaths.has(entry.path)) {
      events.push({ type: "deleted", path: entry.path });
    }
  }

  console.log(
    `Initial scan: ${localFiles.length} file${localFiles.length === 1 ? "" : "s"} (${inSync} already in sync).`,
  );

  if (events.length === 0) return;

  console.log(
    `Syncing ${events.length} change${events.length === 1 ? "" : "s"}…`,
  );
  const uploaded = await sendEvents(serverUrl, token, projectId, root, events);
  if (uploaded > 0) {
    console.log(`Uploaded ${uploaded} blob${uploaded === 1 ? "" : "s"}.`);
  }
}

export async function startWatching({ root }: WatchOptions): Promise<void> {
  const absoluteRoot = path.resolve(root);
  const local = loadLocalConfig(absoluteRoot);
  if (!local) {
    console.error(
      `No local config found in ${absoluteRoot}. Run \`pixelhub-watch pair\` in this folder first.`,
    );
    process.exitCode = 1;
    return;
  }

  const credentials = loadCredentials(local.projectId);
  if (!credentials) {
    console.error(
      "Missing credentials for this project. Run `pixelhub-watch pair` again.",
    );
    process.exitCode = 1;
    return;
  }

  const { serverUrl, token } = credentials;
  const { projectId } = local;
  const config = await fetchWatcherConfig(serverUrl, token);
  const isIgnored = createIgnoreMatcher(absoluteRoot, config.ignoreRules);

  console.log(`Watching ${absoluteRoot}`);
  console.log(`Project: ${config.projectSlug} · server ${serverUrl}`);

  const localFiles = await scanFolder(absoluteRoot, isIgnored);
  const hashes = new Map(localFiles.map((file) => [file.path, file.sha256]));
  await reconcile(
    serverUrl,
    token,
    projectId,
    absoluteRoot,
    config.manifest,
    localFiles,
  );

  const pending = new Map<string, PendingEvent>();

  async function onFile(absolutePath: string): Promise<void> {
    if (isIgnored(absolutePath)) return;
    const relative = toPosix(path.relative(absoluteRoot, absolutePath));
    try {
      const { sha256, size } = await hashFile(absolutePath);
      const previous = hashes.get(relative);
      if (previous === sha256) return;
      hashes.set(relative, sha256);
      pending.set(relative, {
        type: previous === undefined ? "created" : "modified",
        path: relative,
        sha256,
        size,
      });
    } catch {
      // File vanished between the event and hashing — skip.
    }
  }

  function onUnlink(absolutePath: string): void {
    if (isIgnored(absolutePath)) return;
    const relative = toPosix(path.relative(absoluteRoot, absolutePath));
    const previous = hashes.get(relative);
    hashes.delete(relative);
    pending.set(relative, {
      type: "deleted",
      path: relative,
      sha256: previous,
    });
  }

  const watcher = chokidar.watch(absoluteRoot, {
    ignored: (candidate) => isIgnored(candidate),
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 750, pollInterval: 100 },
    persistent: true,
  });
  watcher.on("add", (file) => void onFile(file));
  watcher.on("change", (file) => void onFile(file));
  watcher.on("unlink", (file) => onUnlink(file));
  watcher.on("error", (error) => {
    console.error(
      `Watcher error: ${error instanceof Error ? error.message : String(error)}`,
    );
  });

  let flushing = false;

  async function flush(): Promise<void> {
    if (flushing || pending.size === 0) return;
    flushing = true;
    const collected = Array.from(pending.values());
    pending.clear();
    try {
      const events = toFileEvents(collected);
      if (events.length > 0) {
        const uploaded = await sendEvents(
          serverUrl,
          token,
          projectId,
          absoluteRoot,
          events,
        );
        console.log(
          `Synced ${events.length} change${events.length === 1 ? "" : "s"}${uploaded > 0 ? ` (${uploaded} uploaded)` : ""}.`,
        );
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        console.error(
          "This device was revoked or its token is invalid — run `pixelhub-watch pair` again.",
        );
        await shutdown(1);
        return;
      }
      for (const event of collected) {
        if (!pending.has(event.path)) pending.set(event.path, event);
      }
      console.error(
        `Sync failed (will retry): ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      flushing = false;
    }
  }

  const flushTimer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  const heartbeat = setInterval(() => {
    void fetchWatcherConfig(serverUrl, token).catch((error) => {
      if (error instanceof ApiError && error.status === 401) {
        console.error(
          "This device was revoked or its token is invalid — run `pixelhub-watch pair` again.",
        );
        void shutdown(1);
      }
    });
  }, HEARTBEAT_MS);

  let shuttingDown = false;

  async function shutdown(code = 0): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(flushTimer);
    clearInterval(heartbeat);
    await flush();
    await watcher.close();
    console.log("Stopped.");
    process.exit(code);
  }

  process.on("SIGINT", () => void shutdown(0));
  process.on("SIGTERM", () => void shutdown(0));

  console.log("Everything is in sync. Watching for changes…");
  await new Promise<never>(() => {});
}
