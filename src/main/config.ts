import { app } from 'electron';
import { existsSync, mkdirSync } from 'node:fs';
import { findClaudeCodeBinary } from './claudeCodeBinary';
import { dirname, join } from 'node:path';
import { gradeflowSkillRoots } from './gradeflowPaths';
import { loadSettings } from './settings';

const ENV_VAR = 'GRDR_DB_PATH';
const CLI_PREFIX = '--db-path=';

function parseCliDbPath(): string | null {
  const arg = process.argv.find((a) => a.startsWith(CLI_PREFIX));
  if (!arg) return null;
  return arg.slice(CLI_PREFIX.length);
}

export function resolveDbPath(): string {
  const settings = loadSettings();
  if (settings.dbPath) {
    console.log(`[config] Using settings dbPath: ${settings.dbPath}`);
    return settings.dbPath;
  }

  const cliPath = parseCliDbPath();
  if (cliPath) {
    console.log(`[config] Using CLI --db-path: ${cliPath}`);
    return cliPath;
  }

  const envPath = process.env[ENV_VAR];
  if (envPath) {
    console.log(`[config] Using ${ENV_VAR}: ${envPath}`);
    return envPath;
  }

  const defaultPath = `${app.getPath('userData')}/grdr.db`;
  console.log(`[config] Using default path: ${defaultPath}`);
  return defaultPath;
}

/**
 * Where plugins live. Bundled ones ship with the app (next to it when packaged, in build/plugins in development);
 * the user's own go into the user data folder, which exists after this call so it can be opened.
 */
export function resolvePluginRoots(): { bundled: string; user: string } {
  const bundled = app.isPackaged
    ? join(process.resourcesPath, 'plugins')
    : join(app.getAppPath(), 'build', 'plugins');
  const user = join(app.getPath('userData'), 'plugins');
  mkdirSync(user, { recursive: true });
  return { bundled, user };
}

/** Where Gradeflow grading skills live; the user folder exists after this call so it can be opened. */
export function resolveGradeflowSkillRoots(): { bundled: string; user: string } {
  const roots = gradeflowSkillRoots({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
    userDataPath: app.getPath('userData'),
  });
  mkdirSync(roots.user, { recursive: true });
  return roots;
}

/** Path of the Claude Code binary for the Agent SDK when packaged, null in development (the SDK finds it itself). */
export function claudeCodeExecutablePath(): string | null {
  return findClaudeCodeBinary({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    platform: process.platform,
    arch: process.arch,
    exists: existsSync,
  });
}

export function ensureDbDirectory(dbPath: string): void {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
