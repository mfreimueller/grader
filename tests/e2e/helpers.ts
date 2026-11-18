/**
 * Shared setup of the end-to-end tests. They run the real app against a throwaway user data folder and
 * database, so they need `npm run build` and the Electron build of better-sqlite3:
 *   npx electron-rebuild -f -w better-sqlite3 && npm run build && npm run test:e2e
 */
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IpcApi } from '../../src/shared/types';

export const repoRoot = path.resolve(__dirname, '../..');

export type Api = { grdr: IpcApi };

export interface RunningGrader {
  app: ElectronApplication;
  main: Page;
  /** Closes the app and removes everything it wrote. */
  dispose(): Promise<void>;
}

export interface LaunchOptions {
  /** Plugin folders to put into the user's plugin folder: folder name -> source folder. */
  userPlugins?: Record<string, string>;
  /** Grading skills for the user's skill folder: folder name -> content of its SKILL.md. */
  userSkills?: Record<string, string>;
  /** Extra environment variables of the app, e.g. GRDR_GRADEFLOW_FAKE_RUNNER=1. */
  env?: Record<string, string>;
}

export async function launchGrader(options: LaunchOptions = {}): Promise<RunningGrader> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grdr-e2e-'));
  const userData = path.join(tmp, 'userData');
  fs.mkdirSync(path.join(userData, 'plugins'), { recursive: true });
  for (const [name, source] of Object.entries(options.userPlugins ?? {})) {
    fs.cpSync(source, path.join(userData, 'plugins', name), { recursive: true });
  }

  for (const [name, markdown] of Object.entries(options.userSkills ?? {})) {
    fs.mkdirSync(path.join(userData, 'gradeflow', 'skills', name), { recursive: true });
    fs.writeFileSync(path.join(userData, 'gradeflow', 'skills', name, 'SKILL.md'), markdown);
  }

  const app = await electron.launch({
    cwd: repoRoot,
    env: { ...(process.env as Record<string, string>), ...options.env },
    args: ['.', `--user-data-dir=${userData}`, `--db-path=${path.join(tmp, 'grdr.db')}`],
  });
  const main = await app.firstWindow();
  await main.waitForLoadState('domcontentloaded');

  return {
    app,
    main,
    dispose: async () => {
      await app.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    },
  };
}

export interface CreatedStudent {
  id: string;
  firstName: string;
  lastName: string;
}

export const DEFAULT_STUDENTS: [string, string][] = [
  ['Anna', 'Bauer'],
  ['Max', 'Muster'],
  ['Zoe', 'Zorn'],
];

/** A class 1A with the given students and a course "Mathematik" for it, made through the app's own api. */
export async function createCourse(
  main: Page,
  names: [string, string][] = DEFAULT_STUDENTS,
): Promise<{ courseId: string; students: CreatedStudent[] }> {
  return main.evaluate(async (people) => {
    const api = (window as unknown as Api).grdr;
    const must = <T>(result: { ok: boolean; value?: T }): T => {
      if (!result.ok) throw new Error('setup failed');
      return result.value as T;
    };
    const schoolClass = must(await api.class.create({ name: '1A', schoolYear: '2026/27' }));
    const students: { id: string; firstName: string; lastName: string }[] = [];
    for (const [firstName, lastName] of people) {
      const student = must(await api.student.create({ firstName, lastName, schoolClassId: schoolClass.id }));
      students.push({ id: student.id, firstName, lastName });
    }
    const course = must(await api.course.create({ title: 'Mathematik', schoolClassId: schoolClass.id }));
    return { courseId: course.id, students };
  }, names);
}

export const localDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
