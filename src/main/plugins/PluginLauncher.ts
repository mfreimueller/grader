import type { CourseService } from '../../application/CourseService';
import type { PluginCatalogService } from '../../application/PluginCatalogService';
import type { PluginManifest } from '../../domain/plugin/PluginManifest';
import { Result } from '../../domain/shared/Result';
import type { PluginWindowRegistry } from './PluginWindowRegistry';

export interface PluginWindowHandle {
  webContentsId: number;
  focus(): void;
  onClosed(listener: () => void): void;
}

export interface CreatePluginWindowOptions {
  manifest: PluginManifest;
  directory: string;
  /** The https origins the plugin may connect to: its manifest's list as far as the user accepted it. */
  grantedNetwork: string[];
  title: string;
}

export interface PluginLauncherDeps {
  catalog: Pick<PluginCatalogService, 'resolve'>;
  courseService: Pick<CourseService, 'findById'>;
  registry: PluginWindowRegistry<PluginWindowHandle>;
  /** Opens the actual BrowserWindow; kept outside so the launch rules can be tested without Electron. */
  createWindow(options: CreatePluginWindowOptions): PluginWindowHandle;
}

/** Opens a plugin for a course: one window per plugin and course, only for plugins that are enabled. */
export class PluginLauncher {
  constructor(private readonly deps: PluginLauncherDeps) {}

  async launch(pluginId: string, courseId: string): Promise<Result<void>> {
    const { catalog, courseService, registry, createWindow } = this.deps;

    const plugin = await catalog.resolve(pluginId);
    if (!plugin.ok) return Result.fail(plugin.error);
    const course = await courseService.findById(courseId);
    if (!course.ok) return Result.fail(course.error);

    const open = registry.findWindow(pluginId, courseId);
    if (open) {
      open.focus();
      return Result.ok(undefined as void);
    }

    const window = createWindow({
      manifest: plugin.value.manifest,
      directory: plugin.value.directory,
      grantedNetwork: plugin.value.grantedNetwork,
      title: `${plugin.value.manifest.name} – ${course.value.title}`,
    });
    registry.register(window.webContentsId, { manifest: plugin.value.manifest, courseId }, window);
    window.onClosed(() => registry.unregister(window.webContentsId));
    return Result.ok(undefined as void);
  }
}
