import { app } from 'electron';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const ENV_VAR = 'GRDR_DB_PATH';
const CLI_PREFIX = '--db-path=';

function parseCliDbPath(): string | null {
  const arg = process.argv.find((a) => a.startsWith(CLI_PREFIX));
  if (!arg) return null;
  return arg.slice(CLI_PREFIX.length);
}

export function resolveDbPath(): string {
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

export function ensureDbDirectory(dbPath: string): void {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
