import { PluginWindowRegistry } from '../../../src/main/plugins/PluginWindowRegistry';
import type { PluginCaller } from '../../../src/application/PluginCaller';
import { PluginManifest } from '../../../src/domain/plugin/PluginManifest';

const aCaller = (id = 'at.example.tool', courseId = 'course-1'): PluginCaller => {
  const manifest = PluginManifest.create({
    id,
    name: 'Tool',
    version: '1.0.0',
    apiVersion: 1,
    entry: 'index.html',
    launch: ['course'],
    permissions: [],
    network: [],
  });
  if (!manifest.ok) throw manifest.error;
  return { manifest: manifest.value, courseId };
};

describe('PluginWindowRegistry', () => {
  let registry: PluginWindowRegistry<string>;

  beforeEach(() => {
    registry = new PluginWindowRegistry<string>();
  });

  describe('callerFor', () => {
    it('returns the caller registered for a web contents', () => {
      const caller = aCaller();
      registry.register(7, caller, 'window-7');

      expect(registry.callerFor(7)).toBe(caller);
    });

    it('returns undefined for a web contents that is not a plugin window, such as the main window', () => {
      registry.register(7, aCaller(), 'window-7');

      expect(registry.callerFor(1)).toBeUndefined();
    });

    it('keeps several windows apart', () => {
      registry.register(7, aCaller('at.example.tool', 'course-1'), 'a');
      registry.register(8, aCaller('at.example.other', 'course-2'), 'b');

      expect(registry.callerFor(7)?.courseId).toBe('course-1');
      expect(registry.callerFor(8)?.manifest.id.value).toBe('at.example.other');
    });

    it('returns undefined after the window was unregistered', () => {
      registry.register(7, aCaller(), 'window-7');

      registry.unregister(7);

      expect(registry.callerFor(7)).toBeUndefined();
    });
  });

  describe('findWindow', () => {
    it('finds the window of a plugin in a course', () => {
      registry.register(7, aCaller('at.example.tool', 'course-1'), 'window-7');

      expect(registry.findWindow('at.example.tool', 'course-1')).toBe('window-7');
    });

    it('does not find the plugin in another course or another plugin in the course', () => {
      registry.register(7, aCaller('at.example.tool', 'course-1'), 'window-7');

      expect(registry.findWindow('at.example.tool', 'course-2')).toBeUndefined();
      expect(registry.findWindow('at.example.other', 'course-1')).toBeUndefined();
    });

    it('does not find a window that was unregistered', () => {
      registry.register(7, aCaller(), 'window-7');
      registry.unregister(7);

      expect(registry.findWindow('at.example.tool', 'course-1')).toBeUndefined();
    });
  });

  describe('windowsOfCourse', () => {
    it('lists the windows open for a course', () => {
      registry.register(7, aCaller('at.example.tool', 'course-1'), 'a');
      registry.register(8, aCaller('at.example.other', 'course-1'), 'b');
      registry.register(9, aCaller('at.example.tool', 'course-2'), 'c');

      expect(registry.windowsOfCourse('course-1').sort()).toEqual(['a', 'b']);
      expect(registry.windowsOfCourse('course-3')).toEqual([]);
    });
  });

  it('unregistering an unknown web contents does nothing', () => {
    expect(() => registry.unregister(99)).not.toThrow();
  });
});
