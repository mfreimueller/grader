import fs from 'node:fs/promises';
import path from 'node:path';
import { parseNetworkOrigin } from '../../domain/plugin/PluginNetworkOrigin';

/** Plugins are served as `grdr-plugin://<plugin id>/<path>`: one origin per plugin, no file:// access. */
export const PLUGIN_SCHEME = 'grdr-plugin';

/** Only origins in their normalised form get into a policy or an allow check; anything else is dropped. */
function validOrigins(origins: readonly string[]): string[] {
  return origins.filter((origin) => {
    const parsed = parseNetworkOrigin(origin);
    return parsed.ok && parsed.value === origin;
  });
}

/**
 * The policy of one plugin: it loads files of its own origin and may connect to its own origin and to the
 * `grantedNetwork` origins, the https hosts the user accepted. Everything else is sealed off.
 */
export function pluginCsp(grantedNetwork: readonly string[]): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    ["connect-src 'self'", ...validOrigins(grantedNetwork)].join(' '),
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function pluginUrl(pluginId: string, relativePath: string): string {
  const encoded = relativePath.split('/').map(encodeURIComponent).join('/');
  return `${PLUGIN_SCHEME}://${pluginId}/${encoded}`;
}

/**
 * Maps a request url to a file inside the plugin folder `root`, or null. Null for another plugin's host, for
 * anything that is not a regular file, and for anything that leaves the folder, also through a symlink or
 * an escaped path separator: the check is on the resolved real path.
 */
export async function resolvePluginFile(root: string, requestUrl: string, pluginId: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null; // not a url at all
  }
  if (url.protocol !== `${PLUGIN_SCHEME}:` || url.hostname !== pluginId) return null;

  let relativePath: string;
  try {
    relativePath = decodeURIComponent(url.pathname);
  } catch {
    return null; // malformed escape such as %E0%A4%A
  }

  try {
    const realRoot = await fs.realpath(root);
    const file = await fs.realpath(path.join(realRoot, relativePath));
    if (!file.startsWith(realRoot + path.sep)) return null;
    return (await fs.stat(file)).isFile() ? file : null;
  } catch {
    // Missing file, NUL byte in the path, no permission: the plugin simply gets a 404.
    return null;
  }
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null; // not a url at all
  }
}

/** A page or file of the plugin itself. The only place a plugin window may navigate to. */
export function isOwnPluginUrl(requestUrl: string, pluginId: string): boolean {
  const url = parseUrl(requestUrl);
  return url !== null && url.protocol === `${PLUGIN_SCHEME}:` && url.hostname === pluginId;
}

/**
 * The requests a plugin window may make: its own files, inline data, the developer tools and https requests
 * to exactly the granted origins (scheme, host and port all match).
 */
export function isAllowedPluginRequest(requestUrl: string, pluginId: string, grantedNetwork: readonly string[] = []): boolean {
  if (isOwnPluginUrl(requestUrl, pluginId)) return true;
  const url = parseUrl(requestUrl);
  if (url === null) return false;
  if (url.protocol === 'data:' || url.protocol === 'devtools:') return true;
  return url.protocol === 'https:' && validOrigins(grantedNetwork).includes(url.origin);
}
