import path from 'node:path';
import { findClaudeCodeBinary } from '../../../src/main/claudeCodeBinary';

const RES = path.join('/Applications/Grader.app/Contents/Resources');
const unpacked = (pkg: string, file = 'claude'): string =>
  path.join(RES, 'app.asar.unpacked', 'node_modules', '@anthropic-ai', pkg, file);

describe('findClaudeCodeBinary', () => {
  it('returns null in development so the SDK resolves the binary itself', () => {
    const exists = jest.fn(() => true);
    expect(
      findClaudeCodeBinary({ isPackaged: false, resourcesPath: RES, platform: 'darwin', arch: 'arm64', exists }),
    ).toBeNull();
    expect(exists).not.toHaveBeenCalled();
  });

  it.each([
    ['darwin', 'arm64', 'claude-agent-sdk-darwin-arm64', 'claude'],
    ['darwin', 'x64', 'claude-agent-sdk-darwin-x64', 'claude'],
    ['win32', 'x64', 'claude-agent-sdk-win32-x64', 'claude.exe'],
    ['linux', 'x64', 'claude-agent-sdk-linux-x64', 'claude'],
  ] as const)('finds the unpacked binary for %s-%s', (platform, arch, pkg, file) => {
    const wanted = unpacked(pkg, file);
    expect(
      findClaudeCodeBinary({
        isPackaged: true, resourcesPath: RES, platform, arch, exists: (p) => p === wanted,
      }),
    ).toBe(wanted);
  });

  it('falls back to the musl build on Linux', () => {
    const wanted = unpacked('claude-agent-sdk-linux-arm64-musl');
    expect(
      findClaudeCodeBinary({
        isPackaged: true, resourcesPath: RES, platform: 'linux', arch: 'arm64', exists: (p) => p === wanted,
      }),
    ).toBe(wanted);
  });

  it('returns null when the packaged binary is missing', () => {
    expect(
      findClaudeCodeBinary({
        isPackaged: true, resourcesPath: RES, platform: 'darwin', arch: 'arm64', exists: () => false,
      }),
    ).toBeNull();
  });
});
