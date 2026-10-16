import { Result } from '../shared/Result';
import { ValidationError } from '../../shared/errors';

/** How many hosts one plugin may ask to talk to. */
export const MAX_NETWORK_ORIGINS = 10;

const ORIGIN = /^https:\/\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)(?::(\d{1,5}))?$/;
const DEFAULT_HTTPS_PORT = 443;
const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain'];

/**
 * A network origin a plugin may connect to: `https://<host>[:port]`, nothing else. No path, no wildcard, no
 * http, no IP literal, no localhost. The result is normalised (lower case, default port dropped).
 */
export function parseNetworkOrigin(raw: string): Result<string> {
  const refuse = (): Result<string> =>
    Result.fail(
      new ValidationError(
        `Plugin network origin "${raw}" is not allowed: use https://<host>[:port] without path, wildcard, IP address or localhost`,
      ),
    );

  const match = ORIGIN.exec(raw.trim().toLowerCase());
  if (!match) return refuse();
  const host = match[1] ?? '';
  const labels = host.split('.');
  const topLevel = labels[labels.length - 1] ?? '';

  // An all-numeric last label is an IPv4 address (or looks enough like one to refuse).
  if (/^\d+$/.test(topLevel)) return refuse();
  if (host === 'localhost' || LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) return refuse();

  if (match[2] === undefined) return Result.ok(`https://${host}`);
  const port = Number(match[2]);
  if (port < 1 || port > 65535) return refuse();
  return Result.ok(port === DEFAULT_HTTPS_PORT ? `https://${host}` : `https://${host}:${port}`);
}

/** Validates, normalises and deduplicates the `network` list of a manifest. */
export function parseNetworkOrigins(raw: readonly string[]): Result<string[]> {
  const origins: string[] = [];
  for (const entry of raw) {
    const origin = parseNetworkOrigin(entry);
    if (!origin.ok) return Result.fail(origin.error);
    if (!origins.includes(origin.value)) origins.push(origin.value);
  }
  if (origins.length > MAX_NETWORK_ORIGINS) {
    return Result.fail(new ValidationError(`Plugin network may list at most ${MAX_NETWORK_ORIGINS} origins`));
  }
  return Result.ok(origins);
}
