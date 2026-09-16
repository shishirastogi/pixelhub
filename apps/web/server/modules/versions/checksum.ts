import { createHash } from "node:crypto";

/** Stable checksum of a version's file set: sha256 of sorted `path:sha256` lines. */
export function computeChecksum(files: { path: string; sha256: string }[]): string {
  const lines = files.map((file) => `${file.path}:${file.sha256}`).sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}
