#!/usr/bin/env node
import { Command } from "commander";
import { runPair } from "./sync.js";
import { startWatching } from "./watcher.js";

const program = new Command();

program
  .name("pixelhub-watch")
  .description("Pair a project folder with PixelHub and keep it in sync.")
  .version("0.0.0");

program
  .command("pair")
  .description("Pair this folder using an 8-character code from the web UI")
  .option("-s, --server <url>", "PixelHub server URL")
  .option("-c, --code <code>", "pairing code (skip the prompt)")
  .option("-r, --root <path>", "folder to watch", process.cwd())
  .option("-n, --name <name>", "device name")
  .action(async (options) => {
    await runPair({
      serverUrl: options.server,
      code: options.code,
      root: options.root,
      deviceName: options.name,
    });
  });

program
  .command("start", { isDefault: true })
  .description("Watch the current folder and sync changes to PixelHub")
  .option("-r, --root <path>", "folder to watch", process.cwd())
  .action(async (options) => {
    await startWatching({ root: options.root });
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
