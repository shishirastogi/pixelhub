import fs from "node:fs";
import path from "node:path";
import Conf from "conf";

export interface StoredCredentials {
  serverUrl: string;
  token: string;
  projectId: string;
  projectSlug: string;
  deviceName: string;
}

export interface LocalConfig {
  serverUrl: string;
  projectId: string;
  projectSlug: string;
  root: string;
}

const credentialsStore = new Conf<{
  projects?: Record<string, StoredCredentials>;
}>({
  projectName: "pixelhub",
  configName: "credentials",
});

export function configDir(root: string): string {
  return path.join(root, ".pixelhub");
}

export function localConfigPath(root: string): string {
  return path.join(configDir(root), "config.json");
}

export function loadLocalConfig(root: string): LocalConfig | null {
  try {
    const raw = fs.readFileSync(localConfigPath(root), "utf8");
    const parsed = JSON.parse(raw) as LocalConfig;
    if (!parsed.projectId || !parsed.serverUrl) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocalConfig(root: string, config: LocalConfig): void {
  const dir = configDir(root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    localConfigPath(root),
    `${JSON.stringify(config, null, 2)}\n`,
  );
}

export function loadCredentials(projectId: string): StoredCredentials | null {
  const projects = credentialsStore.get("projects") ?? {};
  return projects[projectId] ?? null;
}

export function saveCredentials(credentials: StoredCredentials): void {
  const projects = credentialsStore.get("projects") ?? {};
  projects[credentials.projectId] = credentials;
  credentialsStore.set("projects", projects);
}
