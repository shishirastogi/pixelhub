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
  .action(async () => {
    await runPair();
  });

program
  .command("start", { isDefault: true })
  .description("Watch the current folder and sync changes to PixelHub")
  .action(async () => {
    await startWatching({ root: process.cwd() });
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
