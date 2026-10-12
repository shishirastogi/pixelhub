import fs from "node:fs";
import path from "node:path";
import picomatch from "picomatch";

export function toPosix(value: string): string {
  return value.replace(/\\/g, "/");
}

function readPixelhubIgnore(root: string): string[] {
  try {
    const raw = fs.readFileSync(path.join(root, ".pixelhubignore"), "utf8");
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(
        (line) =>
          line.length > 0 && !line.startsWith("#") && !line.startsWith("!"),
      );
  } catch {
    return [];
  }
}

/**
 * gitignore-ish matcher for the watcher. A path is ignored when it or any of
 * its ancestor segments matches a server-provided ignore rule or a line in
 * `.pixelhubignore`.
 */
export function createIgnoreMatcher(
  root: string,
  serverRules: string[],
): (absolutePath: string) => boolean {
  const rules = [
    ...new Set(
      [...serverRules, ...readPixelhubIgnore(root)]
        .map((rule) => rule.replace(/^\/+|\/+$/g, ""))
        .filter((rule) => rule.length > 0),
    ),
  ];
  const matchers = rules.map((rule) => ({
    rule,
    isMatch: picomatch(rule, {
      dot: true,
      nocase: process.platform === "win32",
    }),
  }));

  return function isIgnored(absolutePath: string): boolean {
    const relative = toPosix(path.relative(root, absolutePath));
    if (!relative || relative.startsWith("..")) return false;

    const segments = relative.split("/");
    for (let i = 0; i < segments.length; i += 1) {
      const partial = segments.slice(0, i + 1).join("/");
      const segment = segments[i]!;
      for (const matcher of matchers) {
        if (matcher.rule === partial || matcher.rule === segment) return true;
        if (matcher.isMatch(partial) || matcher.isMatch(segment)) return true;
      }
    }
    return false;
  };
}
