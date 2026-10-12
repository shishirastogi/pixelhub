import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { toPosix } from "./ignore.js";

export interface LocalFile {
  path: string;
  sha256: string;
  size: number;
}

export async function hashFile(
  absolutePath: string,
): Promise<{ sha256: string; size: number }> {
  const stat = await fs.stat(absolutePath);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(absolutePath)) {
    hash.update(chunk as Buffer);
  }
  return { sha256: hash.digest("hex"), size: stat.size };
}

export async function scanFolder(
  root: string,
  isIgnored: (absolutePath: string) => boolean,
): Promise<LocalFile[]> {
  const files: LocalFile[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      if (isIgnored(absolute)) continue;
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        const { sha256, size } = await hashFile(absolute);
        files.push({
          path: toPosix(path.relative(root, absolute)),
          sha256,
          size,
        });
      } catch {
        // Locked/unreadable file — skip rather than fail the whole scan.
      }
    }
  }

  await walk(root);
  return files;
}
