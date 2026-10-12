import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { exchangePairingCode } from "./api.js";
import { saveCredentials, saveLocalConfig } from "./config.js";

export interface PairOptions {
  serverUrl?: string;
  code?: string;
  root?: string;
  deviceName?: string;
}

function defaultServerUrl(): string {
  return "http://localhost:3000";
}

export async function runPair(options: PairOptions = {}): Promise<void> {
  const root = path.resolve(options.root ?? process.cwd());
  let serverUrl = options.serverUrl?.trim() ?? "";
  let code = options.code?.trim() ?? "";
  let deviceName = options.deviceName?.trim() ?? "";

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (!serverUrl) {
      const answer = await rl.question(
        `PixelHub server URL [${defaultServerUrl()}]: `,
      );
      serverUrl = answer.trim() || defaultServerUrl();
    }
    if (!code) {
      code = (await rl.question("Pairing code (from the web UI): ")).trim();
    }
    if (!deviceName) {
      const answer = await rl.question(`Device name [${os.hostname()}]: `);
      deviceName = answer.trim() || os.hostname();
    }
  } finally {
    rl.close();
  }

  if (!code) {
    console.error("A pairing code is required.");
    process.exitCode = 1;
    return;
  }

  const exchanged = await exchangePairingCode(
    serverUrl,
    code.toUpperCase(),
    deviceName,
  );

  saveCredentials({
    serverUrl,
    token: exchanged.watcherToken,
    projectId: exchanged.projectId,
    projectSlug: exchanged.projectSlug,
    deviceName,
  });
  saveLocalConfig(root, {
    serverUrl,
    projectId: exchanged.projectId,
    projectSlug: exchanged.projectSlug,
    root,
  });

  console.log(`Paired "${root}" with project "${exchanged.projectSlug}".`);
  console.log("Starting watcher… (Ctrl+C to stop)");

  const { startWatching } = await import("./watcher.js");
  await startWatching({ root });
}
