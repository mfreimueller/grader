import { Result } from '../shared/Result';
import { ValidationError } from '../../shared/errors';
import { PluginId } from './PluginId';
import { parseNetworkOrigins } from './PluginNetworkOrigin';
import { PluginPermission, parsePluginPermission } from './PluginPermission';

/** The bridge API version this build of Grader implements. */
export const SUPPORTED_API_VERSION = 1;

export type PluginLaunchTarget = 'course';
const LAUNCH_TARGETS: readonly string[] = ['course'] satisfies PluginLaunchTarget[];

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const URL_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;

const DEFAULT_WINDOW = { width: 1000, height: 700 } as const;
const WIDTH_RANGE = { min: 400, max: 2400 } as const;
const HEIGHT_RANGE = { min: 300, max: 1600 } as const;

export interface PluginWindowSize {
  width: number;
  height: number;
}

/** Plain shape handed over by the infrastructure after the JSON file has been parsed. */
export interface PluginManifestInput {
  id: string;
  name: string;
  version: string;
  description?: string;
  apiVersion: number;
  entry: string;
  launch: string[];
  permissions: string[];
  network: string[];
  window?: PluginWindowSize;
}

interface PluginManifestProps {
  id: PluginId;
  name: string;
  version: string;
  description: string;
  entry: string;
  launch: PluginLaunchTarget[];
  permissions: PluginPermission[];
  network: string[];
  window: PluginWindowSize;
}

function clamp(value: number, range: { min: number; max: number }, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(range.max, Math.max(range.min, Math.round(value)));
}

function isSafeRelativePath(entry: string): boolean {
  if (entry.length === 0 || entry.startsWith('/') || entry.includes('\\')) return false;
  if (URL_SCHEME.test(entry)) return false;
  return entry.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

export class PluginManifest {
  private constructor(private readonly props: PluginManifestProps) {}

  static create(input: PluginManifestInput): Result<PluginManifest> {
    const id = PluginId.create(input.id);
    if (!id.ok) return Result.fail(id.error);

    const name = input.name.trim();
    if (name.length === 0) {
      return Result.fail(new ValidationError('Plugin name must not be empty'));
    }
    if (!SEMVER.test(input.version)) {
      return Result.fail(new ValidationError(`Plugin version must be semver, got "${input.version}"`));
    }
    if (input.apiVersion !== SUPPORTED_API_VERSION) {
      return Result.fail(
        new ValidationError(
          `Plugin needs API version ${input.apiVersion}, this Grader supports ${SUPPORTED_API_VERSION}`,
        ),
      );
    }
    if (!isSafeRelativePath(input.entry)) {
      return Result.fail(new ValidationError(`Plugin entry must be a relative path inside the plugin, got "${input.entry}"`));
    }
    if (input.launch.length === 0 || !input.launch.every((t) => LAUNCH_TARGETS.includes(t))) {
      return Result.fail(new ValidationError(`Plugin launch must list at least one of: ${LAUNCH_TARGETS.join(', ')}`));
    }
    const network = parseNetworkOrigins(input.network);
    if (!network.ok) return Result.fail(network.error);

    const permissions: PluginPermission[] = [];
    for (const raw of input.permissions) {
      const permission = parsePluginPermission(raw);
      if (!permission.ok) return Result.fail(permission.error);
      if (!permissions.includes(permission.value)) permissions.push(permission.value);
    }

    return Result.ok(
      new PluginManifest({
        id: id.value,
        name,
        version: input.version,
        description: input.description ?? '',
        entry: input.entry,
        launch: input.launch as PluginLaunchTarget[],
        permissions,
        network: network.value,
        window: {
          width: clamp(input.window?.width ?? DEFAULT_WINDOW.width, WIDTH_RANGE, DEFAULT_WINDOW.width),
          height: clamp(input.window?.height ?? DEFAULT_WINDOW.height, HEIGHT_RANGE, DEFAULT_WINDOW.height),
        },
      }),
    );
  }

  get id(): PluginId {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get version(): string {
    return this.props.version;
  }

  get description(): string {
    return this.props.description;
  }

  get entry(): string {
    return this.props.entry;
  }

  get launch(): readonly PluginLaunchTarget[] {
    return this.props.launch;
  }

  get permissions(): readonly PluginPermission[] {
    return this.props.permissions;
  }

  /** The https origins the plugin wants to connect to, normalised, e.g. `https://api.github.com`. */
  get network(): readonly string[] {
    return this.props.network;
  }

  get window(): PluginWindowSize {
    return this.props.window;
  }

  permits(permission: PluginPermission): boolean {
    return this.props.permissions.includes(permission);
  }
}
