/**
 * Runs the real app with a throwaway user data folder and database, installs the echo plugin the way a user
 * would (copy into the plugin folder, enable it, launch it from a course) and checks what it could and could
 * not do. Needs `npm run build` first and the Electron build of better-sqlite3:
 *   npx electron-rebuild -f -w better-sqlite3 && npm run build && npm run test:e2e
 */
import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import { createCourse as createCourseFor, launchGrader, localDay, repoRoot, type Api, type RunningGrader } from './helpers';

const PLUGIN_ID = 'at.example.echo';
const PERMISSIONS = ['course:read', 'storage', 'assessment:impromptu', 'secrets'];
const NETWORK = ['https://granted.example.invalid'];

type Reply = { ok: boolean; value?: unknown; error?: { code: string; message: string } };

let grader: RunningGrader;
let app: ElectronApplication;
let main: Page;

test.beforeEach(async () => {
  grader = await launchGrader({ userPlugins: { echo: path.join(repoRoot, 'tests/fixtures/plugins/echo') } });
  ({ app, main } = grader);
});

test.afterEach(async () => {
  await grader.dispose();
});

async function createCourse(): Promise<{ courseId: string; studentIds: string[] }> {
  const { courseId, students } = await createCourseFor(main);
  return { courseId, studentIds: students.map((s) => s.id) };
}

test('a user plugin stays off until it is enabled with the permissions the user was shown', async () => {
  const listed = await main.evaluate(() => (window as unknown as Api).grdr.plugin.list());
  const echo = listed.find((p) => p.id === PLUGIN_ID);

  expect(echo).toMatchObject({ source: 'user', status: 'disabled', permissions: PERMISSIONS, network: NETWORK });
  // The Zufallsauswahl ships with Grader and is on; the user's own plugin is not.
  const launchableBefore = await main.evaluate(() => (window as unknown as Api).grdr.plugin.launchable());
  expect(launchableBefore.map((p) => p.id)).not.toContain(PLUGIN_ID);

  const { courseId } = await createCourse();
  const refused = await main.evaluate(
    ([id, course]) => (window as unknown as Api).grdr.plugin.launch(id as string, course as string),
    [PLUGIN_ID, courseId],
  );
  expect(refused.ok).toBe(false);
  expect(app.windows()).toHaveLength(1);

  const wrong = await main.evaluate((id) => (window as unknown as Api).grdr.plugin.setEnabled(id, true, ['storage']), PLUGIN_ID);
  expect(wrong.ok).toBe(false);

  // Accepting the permissions is not enough: the network origins must be accepted too.
  const withoutNetwork = await main.evaluate(
    ([id, accepted]) => (window as unknown as Api).grdr.plugin.setEnabled(id as string, true, accepted as string[]),
    [PLUGIN_ID, PERMISSIONS],
  );
  expect(withoutNetwork.ok).toBe(false);
  const otherNetwork = await main.evaluate(
    ([id, accepted]) =>
      (window as unknown as Api).grdr.plugin.setEnabled(id as string, true, accepted as string[], ['https://evil.example.net']),
    [PLUGIN_ID, PERMISSIONS],
  );
  expect(otherNetwork.ok).toBe(false);
  const stillOff = (await main.evaluate(() => (window as unknown as Api).grdr.plugin.launchable())).map((p) => p.id);
  expect(stillOff).not.toContain(PLUGIN_ID);
});

test('an enabled plugin runs sandboxed, uses the bridge and cannot reach beyond it', async () => {
  const { courseId, studentIds } = await createCourse();

  const enabled = await main.evaluate(
    ([id, accepted, network]) =>
      (window as unknown as Api).grdr.plugin.setEnabled(id as string, true, accepted as string[], network as string[]),
    [PLUGIN_ID, PERMISSIONS, NETWORK],
  );
  expect(enabled.ok).toBe(true);
  const launchableAfter = await main.evaluate(() => (window as unknown as Api).grdr.plugin.launchable());
  expect(launchableAfter.map((p) => p.id)).toContain(PLUGIN_ID);

  await main.evaluate(() => {
    const w = window as unknown as Api & { __changes: { courseId: string }[] };
    w.__changes = [];
    w.grdr.plugin.onDataChanged((change) => w.__changes.push(change));
  });

  const [pluginPage] = await Promise.all([
    app.waitForEvent('window'),
    main.evaluate(
      ([id, course]) => (window as unknown as Api).grdr.plugin.launch(id as string, course as string),
      [PLUGIN_ID, courseId],
    ),
  ]);
  await pluginPage.waitForSelector('body[data-done="true"]', { timeout: 20000 });
  const report = JSON.parse((await pluginPage.textContent('#report')) ?? '{}') as Record<string, Reply & { threw?: string }>;

  // The native window is named after plugin and course; the page's own <title> ("Echo") does not rename it.
  const windowTitles = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((w) => w.getTitle()));
  expect(windowTitles).toContain('Echo – Mathematik');
  expect(pluginPage.url()).toBe(`grdr-plugin://${PLUGIN_ID}/index.html`);

  // The plugin only sees window.grader.
  expect(report['globals']).toEqual({ grader: 'object', grdr: 'undefined', require: 'undefined', process: 'undefined', ipcRenderer: 'undefined' });

  // Context: the course, the class and the students of the course.
  const context = report['context']?.value as {
    plugin: { id: string };
    course: { id: string; title: string };
    students: { id: string }[];
    categories: { title: string; isMitarbeit: boolean }[];
    today: string;
  };
  expect(context.plugin.id).toBe(PLUGIN_ID);
  expect(context.course).toEqual({ id: courseId, title: 'Mathematik' });
  expect(context.students.map((s) => s.id).sort()).toEqual([...studentIds].sort());
  expect(context.categories).toEqual(expect.arrayContaining([expect.objectContaining({ title: 'Mitarbeit', isMitarbeit: true })]));
  expect(context.today).toBe(localDay(new Date()));

  // Storage.
  expect(report['kvMissing']).toEqual({ ok: true, value: null });
  expect(report['kvSet']?.ok).toBe(true);
  expect(report['kvGet']?.value).toEqual({ [context.students[0]?.id ?? 'x']: 2 });
  expect(report['kvGlobalGet']).toEqual({ ok: true, value: 'global' });
  expect(report['kvKeys']).toEqual({ ok: true, value: ['counts'] });
  expect(report['kvBadKey']?.error?.code).toBe('VALIDATION');
  expect(report['kvUndefined']?.error?.code).toBe('VALIDATION');
  expect(report['kvAfterDelete']).toEqual({ ok: true, value: null });

  // Assessments.
  const today = report['createToday']?.value as { sessionId: string; assessmentId: string };
  const past = report['createPast']?.value as { sessionId: string };
  expect(report['createToday']?.ok).toBe(true);
  expect(past.sessionId).not.toBe(today.sessionId);
  expect(report['createFuture']?.error?.code).toBe('VALIDATION');
  expect(report['createForeignStudent']?.error?.code).toBe('NOT_IN_COURSE');
  expect(report['createSmuggled']?.ok).toBe(true);
  expect(report['deletePast']?.ok).toBe(true);
  expect(report['deleteForeign']?.error?.code).toBe('PERMISSION_DENIED');

  // Secrets: round trip when the system can encrypt, a clear refusal (never plain text) when it cannot.
  expect(report['secretsMissing']).toEqual({ ok: true, value: null });
  expect(report['secretsBadKey']?.error?.code).toBe('VALIDATION');
  expect(report['secretsBadValue']?.error?.code).toBe('VALIDATION');
  if (report['secretsSet']?.ok) {
    expect(report['secretsGet']).toEqual({ ok: true, value: 'ghp_e2e_secret' });
  } else {
    expect(report['secretsSet']?.error?.code).toBe('VALIDATION');
    expect(report['secretsSet']?.error?.message).toMatch(/encrypted storage/);
    expect(report['secretsGet']).toEqual({ ok: true, value: null });
  }
  expect(report['secretsDelete']?.ok).toBe(true);
  expect(report['secretsAfterDelete']).toEqual({ ok: true, value: null });

  // The page was served with a policy that connects to its own origin and the granted one only.
  const csp = report['csp'] as unknown as string;
  expect(csp.split('; ')).toContain("connect-src 'self' https://granted.example.invalid");
  expect(csp).not.toContain('example.com');

  expect(report['fetchWeb']?.threw).toBeDefined();
  expect(report['fetchWebPost']?.threw).toBeDefined();
  expect(report['fetchOtherPlugin']?.threw).toBeDefined();
  expect(report['fetchFile']?.threw).toBeDefined();
  expect(report['fetchOwnManifest']).toBe(200);
  expect(report['fetchTraversal']).toBe(404);

  // What ended up in Grader: today's and the smuggled one in this course's session of today, none from the past.
  const sessions = await main.evaluate((course) => (window as unknown as Api).grdr.session.listByCourse(course), courseId);
  expect(sessions.map((s) => s.date.slice(0, 10)).sort()).toEqual(['2020-01-02', localDay(new Date())].sort());
  const todayAssessments = await main.evaluate((id) => (window as unknown as Api).grdr.assessment.listBySession(id), today.sessionId);
  expect(todayAssessments).toHaveLength(2);
  expect(todayAssessments.every((a) => a.isImpromptu && a.courseId === courseId && a.title === 'Mitarbeit')).toBe(true);
  const pastAssessments = await main.evaluate((id) => (window as unknown as Api).grdr.assessment.listBySession(id), past.sessionId);
  expect(pastAssessments).toEqual([]);

  // The Grader window hears about every successful write to the course (three creations, one deletion).
  const changes = await main.evaluate(() => (window as unknown as { __changes: { courseId: string }[] }).__changes);
  expect(changes).toHaveLength(4);
  expect(changes.every((c) => c.courseId === courseId)).toBe(true);

  // A second launch focuses the window instead of opening another one.
  await main.evaluate(
    ([id, course]) => (window as unknown as Api).grdr.plugin.launch(id as string, course as string),
    [PLUGIN_ID, courseId],
  );
  expect(app.windows()).toHaveLength(2);
});

test('the settings list the plugins and ask for consent before a user plugin is switched on', async () => {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.send('show-settings'));

  const row = main.getByTestId('plugin-row').filter({ hasText: 'Echo' });
  await expect(row).toContainText('Eigenes Plugin');
  await expect(row).toContainText('Ausgeschaltet');

  await row.getByRole('button', { name: 'Einschalten' }).click();
  const consent = row.getByTestId('plugin-consent');
  await expect(consent).toContainText('Kurs, Klasse und Namen der Schüler/innen lesen');
  await expect(consent).toContainText('Eigene Daten in der Grader-Datenbank speichern');
  await expect(consent).toContainText('Spontane Beurteilungen anlegen und eigene wieder löschen');
  await expect(consent).toContainText('Zugangsdaten (z. B. ein Zugriffstoken) verschlüsselt auf diesem Computer speichern');
  await expect(consent.getByTestId('plugin-network')).toHaveText(['Verbindet sich mit granted.example.invalid']);
  await expect(row).toContainText('Ausgeschaltet');

  await consent.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(consent).toHaveCount(0);
  await expect(row).toContainText('Ausgeschaltet');

  await row.getByRole('button', { name: 'Einschalten' }).click();
  await consent.getByRole('button', { name: 'Erlauben und einschalten' }).click();
  await expect(row).toContainText('Aktiv');

  await row.getByRole('button', { name: 'Ausschalten' }).click();
  await expect(row).toContainText('Ausgeschaltet');
});

test('a course offers its tools, starts one and shows what it changed', async () => {
  const { courseId } = await createCourse();
  await main.evaluate(
    ([id, accepted, network]) =>
      (window as unknown as Api).grdr.plugin.setEnabled(id as string, true, accepted as string[], network as string[]),
    [PLUGIN_ID, PERMISSIONS, NETWORK],
  );

  await main.evaluate((id) => {
    window.location.hash = `#/courses/${id}`;
  }, courseId);
  await main.getByTestId('plugin-menu-button').click();
  await expect(main.getByTestId('plugin-menu')).toContainText('Echo');

  const [pluginPage] = await Promise.all([
    app.waitForEvent('window'),
    main.getByTestId('plugin-menu').getByRole('menuitem', { name: /Echo/ }).click(),
  ]);
  await pluginPage.waitForSelector('body[data-done="true"]', { timeout: 20000 });

  // The plugin recorded something on 2 January 2020; the open course shows that session without being reloaded by hand.
  await expect(main.getByText('02.01.2020')).toBeVisible({ timeout: 10000 });
});
