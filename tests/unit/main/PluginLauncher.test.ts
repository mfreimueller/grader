import { PluginCatalogService } from '../../../src/application/PluginCatalogService';
import { CourseService } from '../../../src/application/CourseService';
import { PluginCaller } from '../../../src/application/PluginCaller';
import { PluginManifest } from '../../../src/domain/plugin/PluginManifest';
import { Result } from '../../../src/domain/shared/Result';
import { PluginLauncher, PluginWindowHandle } from '../../../src/main/plugins/PluginLauncher';
import { PluginWindowRegistry } from '../../../src/main/plugins/PluginWindowRegistry';
import { NotFoundError, ValidationError } from '../../../src/shared/errors';

const aManifest = (): PluginManifest => {
  const manifest = PluginManifest.create({
    id: 'at.example.tool',
    name: 'Glücksrad',
    version: '1.0.0',
    apiVersion: 1,
    entry: 'index.html',
    launch: ['course'],
    permissions: ['course:read'],
    network: [],
  });
  if (!manifest.ok) throw manifest.error;
  return manifest.value;
};

class FakeWindow implements PluginWindowHandle {
  focused = 0;
  closeListeners: (() => void)[] = [];
  constructor(readonly webContentsId: number) {}
  focus(): void {
    this.focused += 1;
  }
  onClosed(listener: () => void): void {
    this.closeListeners.push(listener);
  }
  close(): void {
    this.closeListeners.forEach((l) => l());
  }
}

describe('PluginLauncher', () => {
  let catalog: Pick<PluginCatalogService, 'resolve'>;
  let courseService: Pick<CourseService, 'findById'>;
  let registry: PluginWindowRegistry<PluginWindowHandle>;
  let created: FakeWindow[];
  let createOptions: Parameters<ConstructorParameters<typeof PluginLauncher>[0]['createWindow']>[0][];
  let launcher: PluginLauncher;
  const courses = new Map([
    ['course-1', 'Mathematik'],
    ['course-2', 'Physik'],
  ]);

  beforeEach(() => {
    created = [];
    createOptions = [];
    registry = new PluginWindowRegistry<PluginWindowHandle>();
    catalog = {
      resolve: (id) =>
        Promise.resolve(
          id === 'at.example.tool'
            ? Result.ok({ manifest: aManifest(), directory: '/plugins/tool', grantedNetwork: ['https://api.github.com'] })
            : Result.fail(new ValidationError(`Plugin ${id} is not enabled`)),
        ),
    };
    courseService = {
      findById: (id) =>
        Promise.resolve(
          courses.has(id)
            ? Result.ok({ id, title: courses.get(id) ?? '' } as never)
            : Result.fail(new NotFoundError('Course', id)),
        ),
    };
    launcher = new PluginLauncher({
      catalog,
      courseService,
      registry,
      createWindow: (options) => {
        createOptions.push(options);
        const window = new FakeWindow(100 + created.length);
        created.push(window);
        return window;
      },
    });
  });

  it('opens a window for an enabled plugin and a course', async () => {
    const result = await launcher.launch('at.example.tool', 'course-1');

    expect(result.ok).toBe(true);
    expect(created).toHaveLength(1);
    expect(createOptions[0]).toMatchObject({
      directory: '/plugins/tool',
      grantedNetwork: ['https://api.github.com'],
      title: 'Glücksrad – Mathematik',
    });
    expect(createOptions[0]?.manifest.id.value).toBe('at.example.tool');
  });

  it('registers the plugin and the course for the window, which is where the bridge takes its identity from', async () => {
    await launcher.launch('at.example.tool', 'course-1');

    const caller: PluginCaller | undefined = registry.callerFor(100);
    expect(caller?.courseId).toBe('course-1');
    expect(caller?.manifest.id.value).toBe('at.example.tool');
  });

  it('focuses the window that is already open instead of opening another', async () => {
    await launcher.launch('at.example.tool', 'course-1');

    const again = await launcher.launch('at.example.tool', 'course-1');

    expect(again.ok).toBe(true);
    expect(created).toHaveLength(1);
    expect(created[0]?.focused).toBe(1);
  });

  it('opens a separate window for another course', async () => {
    await launcher.launch('at.example.tool', 'course-1');
    await launcher.launch('at.example.tool', 'course-2');

    expect(created).toHaveLength(2);
    expect(registry.callerFor(101)?.courseId).toBe('course-2');
  });

  it('forgets the window when it is closed, so the next launch opens a new one', async () => {
    await launcher.launch('at.example.tool', 'course-1');

    created[0]?.close();

    expect(registry.callerFor(100)).toBeUndefined();
    await launcher.launch('at.example.tool', 'course-1');
    expect(created).toHaveLength(2);
  });

  it('fails without opening a window when the plugin may not run', async () => {
    const result = await launcher.launch('at.example.off', 'course-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
    expect(created).toHaveLength(0);
  });

  it('fails without opening a window when the course does not exist', async () => {
    const result = await launcher.launch('at.example.tool', 'gone');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(created).toHaveLength(0);
  });
});
