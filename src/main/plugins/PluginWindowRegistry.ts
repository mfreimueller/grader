import type { PluginCaller } from '../../application/PluginCaller';

interface Entry<W> {
  caller: PluginCaller;
  window: W;
}

/**
 * The open plugin windows, by the id of their web contents. A bridge call is attributed to the plugin and
 * course registered for the sender; the plugin never tells Grader who it is. The window type is generic so the
 * registry can be tested without Electron.
 */
export class PluginWindowRegistry<W> {
  private readonly entries = new Map<number, Entry<W>>();

  register(webContentsId: number, caller: PluginCaller, window: W): void {
    this.entries.set(webContentsId, { caller, window });
  }

  unregister(webContentsId: number): void {
    this.entries.delete(webContentsId);
  }

  /** Undefined for any sender that is not a plugin window, the main window included. */
  callerFor(webContentsId: number): PluginCaller | undefined {
    return this.entries.get(webContentsId)?.caller;
  }

  findWindow(pluginId: string, courseId: string): W | undefined {
    for (const { caller, window } of this.entries.values()) {
      if (caller.manifest.id.value === pluginId && caller.courseId === courseId) return window;
    }
    return undefined;
  }

  windowsOfCourse(courseId: string): W[] {
    return [...this.entries.values()].filter(({ caller }) => caller.courseId === courseId).map(({ window }) => window);
  }
}
