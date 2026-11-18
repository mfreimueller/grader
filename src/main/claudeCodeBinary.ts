import path from 'node:path';

export interface ClaudeCodeBinaryLookup {
  isPackaged: boolean;
  resourcesPath: string;
  platform: NodeJS.Platform;
  arch: string;
  exists: (candidate: string) => boolean;
}

const SDK_SCOPE = '@anthropic-ai';

/**
 * Where the Claude Code binary of the Agent SDK lives in a packaged app: the SDK's per-platform package is
 * unpacked from the asar archive because a binary cannot be executed from inside it. In development the SDK
 * finds the binary itself, so this returns null; it also returns null when nothing is unpacked.
 */
export function findClaudeCodeBinary(lookup: ClaudeCodeBinaryLookup): string | null {
  if (!lookup.isPackaged) return null;
  const { platform, arch } = lookup;
  const packages =
    platform === 'linux'
      ? [`claude-agent-sdk-linux-${arch}`, `claude-agent-sdk-linux-${arch}-musl`]
      : [`claude-agent-sdk-${platform}-${arch}`];
  const file = platform === 'win32' ? 'claude.exe' : 'claude';
  for (const pkg of packages) {
    const candidate = path.join(
      lookup.resourcesPath, 'app.asar.unpacked', 'node_modules', SDK_SCOPE, pkg, file,
    );
    if (lookup.exists(candidate)) return candidate;
  }
  return null;
}
