import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createIgnoreMatcher, toPosix } from "./ignore.js";

const root = process.platform === "win32" ? "C:\\proj" : "/proj";

function join(...parts: string[]): string {
  return path.join(root, ...parts);
}

const tempDirs: string[] = [];

function makeRootWithIgnoreFile(contents: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pixelhub-ignore-"));
  tempDirs.push(dir);
  fs.writeFileSync(path.join(dir, ".pixelhubignore"), contents);
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("createIgnoreMatcher", () => {
  const isIgnored = createIgnoreMatcher(root, [
    ".git",
    "node_modules",
    ".pixelhub",
    "*.tmp",
    "~$*",
    ".DS_Store",
    "Thumbs.db",
  ]);

  it("ignores directories by name anywhere in the tree", () => {
    expect(isIgnored(join("node_modules"))).toBe(true);
    expect(isIgnored(join("node_modules", "pkg", "index.js"))).toBe(true);
    expect(isIgnored(join("src", "node_modules", "x.js"))).toBe(true);
    expect(isIgnored(join(".git", "HEAD"))).toBe(true);
    expect(isIgnored(join(".pixelhub", "config.json"))).toBe(true);
  });

  it("ignores glob rules against basenames and paths", () => {
    expect(isIgnored(join("a", "b.tmp"))).toBe(true);
    expect(isIgnored(join("draft.tmp"))).toBe(true);
    expect(isIgnored(join("~$deck.pptx"))).toBe(true);
    expect(isIgnored(join("nested", "Thumbs.db"))).toBe(true);
  });

  it("keeps normal project files", () => {
    expect(isIgnored(join("exports", "instagram_post_03.png"))).toBe(false);
    expect(isIgnored(join("brief.pdf"))).toBe(false);
    expect(isIgnored(join("src", "main.ts"))).toBe(false);
  });

  it("never ignores paths outside the root", () => {
    expect(isIgnored(path.resolve(root, "..", "elsewhere", "node_modules"))).toBe(
      false,
    );
  });

  it("honors .pixelhubignore lines and skips comments/negations", () => {
    const customRoot = makeRootWithIgnoreFile(
      ["# comment", "*.psd", "!keep.psd", "secret/"].join("\n"),
    );
    const matcher = createIgnoreMatcher(customRoot, []);
    expect(matcher(path.join(customRoot, "design.psd"))).toBe(true);
    expect(matcher(path.join(customRoot, "secret", "notes.txt"))).toBe(true);
    expect(matcher(path.join(customRoot, "exports", "post.png"))).toBe(false);
  });
});

describe("toPosix", () => {
  it("normalizes Windows separators", () => {
    expect(toPosix("exports\\social\\post.png")).toBe("exports/social/post.png");
    expect(toPosix("exports/social/post.png")).toBe("exports/social/post.png");
  });
});
