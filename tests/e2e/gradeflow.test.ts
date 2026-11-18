/**
 * Drives the Gradeflow wizard of the real app. The agent is replaced by the fake runner (GRDR_GRADEFLOW_FAKE_RUNNER=1)
 * and the native file dialog by a stub in the main process. Needs `npm run build` first and the Electron build of
 * better-sqlite3:
 *   npx electron-rebuild -f -w better-sqlite3 && npm run build && npm run test:e2e
 */
import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCourse, launchGrader, type Api, type CreatedStudent, type RunningGrader } from './helpers';

let grader: RunningGrader;
let app: ElectronApplication;
let main: Page;
let work: string;
let assignment: string;
let handins: string;

test.beforeEach(async () => {
  grader = await launchGrader({
    env: { GRDR_GRADEFLOW_FAKE_RUNNER: '1' },
    userSkills: {
      streng: '---\nname: Streng\ndescription: Bewertet streng\n---\nBewerte streng.\n',
      kaputt: 'kein Frontmatter',
    },
  });
  ({ app, main } = grader);

  work = fs.mkdtempSync(path.join(os.tmpdir(), 'grdr-e2e-gradeflow-'));
  assignment = path.join(work, 'Aufgabe.txt');
  fs.writeFileSync(assignment, 'Schreibe ein Programm.');
  handins = path.join(work, 'abgaben');
  for (const [name, id] of [['Anna Bauer', '1001'], ['Max Muster', '1002'], ['Zoe Zorn', '1003']]) {
    const dir = path.join(handins, `${name}_${id}_assignsubmission_file`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'Main.java'), `// ${name}\nclass Main {}\n`);
  }
  fs.mkdirSync(path.join(handins, 'irgendein Ordner'), { recursive: true });

  // There is no way to click a native dialog; the main process answers the questions of pickPath itself.
  await app.evaluate(({ dialog }, paths) => {
    dialog.showOpenDialog = (async (_window: unknown, options: { properties?: string[] }) => ({
      canceled: false,
      filePaths: [options.properties?.includes('openDirectory') ? paths.handins : paths.assignment],
    })) as unknown as typeof dialog.showOpenDialog;
  }, { handins, assignment });
});

test.afterEach(async () => {
  await grader.dispose();
  fs.rmSync(work, { recursive: true, force: true });
});

interface Seeded {
  courseId: string;
  students: CreatedStudent[];
  sessionId: string;
  assessmentId: string;
}

async function seed(gradingType: 'TERTIARY' | 'NUMERIC', existingFor?: string): Promise<Seeded> {
  const { courseId, students } = await createCourse(main);
  const ids = await main.evaluate(
    async ([course, type, existing, people]) => {
      const api = (window as unknown as Api).grdr;
      const must = <T>(result: { ok: boolean; value?: T }): T => {
        if (!result.ok) throw new Error('setup failed');
        return result.value as T;
      };
      const category = must(await api.assessmentCategory.create({ courseId: course as string, title: 'Test', gradingType: type as string, displayAsGrade: false }));
      const session = must(await api.session.create({ courseId: course as string, date: '2026-10-05' }));
      const assessment = must(
        await api.assessment.create({
          sessionId: session.id,
          title: 'Programmieren',
          categoryId: category.id,
          courseId: course as string,
          ...(type === 'NUMERIC' ? { maxPoints: 20 } : {}),
        }),
      );
      if (existing) {
        const target = (people as { id: string; lastName: string }[]).find((s) => s.lastName === existing);
        must(
          await api.grade.recordPerformance({
            studentId: target?.id as string,
            assessmentId: assessment.id,
            ...(type === 'NUMERIC' ? { score: 3 } : { symbol: 'PLUS' }),
          }),
        );
      }
      return { sessionId: session.id, assessmentId: assessment.id };
    },
    [courseId, gradingType, existingFor ?? '', students] as const,
  );
  return { courseId, students, ...ids };
}

async function setupStep(page: Page): Promise<void> {
  await page.getByTestId('gradeflow-pick-assignment').click();
  await expect(page.getByTestId('gradeflow-assignment')).toHaveText(assignment);
  await page.getByTestId('gradeflow-pick-handins').click();
  await expect(page.getByTestId('gradeflow-handins')).toHaveText(handins);
  await page.getByTestId('gradeflow-skill').selectOption({ index: 1 });
  await page.getByTestId('gradeflow-prepare').click();
}

test('a column of the grid leads through the whole wizard to saved results and notes', async () => {
  const { courseId, students, sessionId, assessmentId } = await seed('TERTIARY', 'Zorn');

  // Entry point 1: the column menu of the session grid.
  await main.evaluate((id) => {
    window.location.hash = `#/courses/${id}`;
  }, courseId);
  await main.getByText('05.10.2026').click();
  await main.locator(`[data-column-id="${assessmentId}"]`).click({ button: 'right' });
  await main.getByRole('menuitem', { name: 'Mit Gradeflow bewerten…' }).click();

  await expect(main).toHaveURL(new RegExp(`/courses/${courseId}/gradeflow\\?assessmentId=${assessmentId}`));
  await expect(main.getByTestId('gradeflow-assessment')).toHaveValue(assessmentId);
  await expect(main.getByTestId('gradeflow-skill')).toContainText('Streng');
  await expect(main.getByTestId('gradeflow-invalid-skills')).toContainText('kaputt');
  await expect(main.getByTestId('gradeflow-limits')).toContainText('Höchstens 3 USD und 15 Minuten');

  // 1. Einrichtung: nothing happens before everything is chosen.
  await main.getByTestId('gradeflow-prepare').click();
  await expect(main.getByTestId('gradeflow-error')).toContainText('Bitte noch wählen: Aufgabenstellung, Abgabenordner, Bewertungs-Skill');
  await setupStep(main);

  // 2. Zuordnung: all three hand-ins were recognised, the odd folder is listed.
  await expect(main.getByTestId('gradeflow-matching')).toBeVisible();
  await expect(main.getByTestId('gradeflow-match-row')).toHaveCount(3);
  await expect(main.getByTestId('gradeflow-matching')).toContainText('irgendein Ordner');
  await main.getByTestId('gradeflow-confirm').click();

  // 3. Vorprüfung: the names in the files were replaced; the plain text files carry no risk.
  await expect(main.getByTestId('gradeflow-preflight')).toBeVisible();
  await expect(main.getByTestId('gradeflow-preflight-group')).toHaveCount(3);
  await expect(main.getByTestId('gradeflow-preflight-group').first()).toContainText('Main.java');
  await expect(main.getByTestId('gradeflow-risk')).toHaveCount(0);
  await main.getByTestId('gradeflow-start').click();

  // 5. Prüfen & Speichern: the fake agent proposes WELLE for everybody; Zoe already has a result.
  await expect(main.getByTestId('gradeflow-review')).toBeVisible({ timeout: 20000 });
  await expect(main.getByTestId('gradeflow-review-row')).toHaveCount(3);
  await expect(main.getByTestId('gradeflow-replace-warning')).toContainText('1 Ergebnis wird');
  await expect(main.getByLabel('Kommentar für Bauer Anna')).toHaveValue('Testkommentar');
  await main.getByLabel('Kommentar für Muster Max').fill('Eigener Kommentar');

  await main.getByTestId('gradeflow-save').click();
  const dialog = main.getByRole('alertdialog');
  await expect(dialog).toContainText('1 bestehendes Ergebnis wird');
  await dialog.getByRole('button', { name: 'Ersetzen und speichern' }).click();

  // Back in the course workspace; the results and comments are in Grader.
  await expect(main).toHaveURL(new RegExp(`/courses/${courseId}$`));
  const performances = await main.evaluate((id) => (window as unknown as Api).grdr.grade.getPerformancesByAssessment(id), assessmentId);
  expect(performances.map((p) => p.symbol)).toEqual(['WELLE', 'WELLE', 'WELLE']);
  expect(performances.map((p) => p.studentId).sort()).toEqual(students.map((s) => s.id).sort());
  const notes = await main.evaluate((id) => (window as unknown as Api).grdr.finding.listNotesBySession(id), sessionId);
  expect(notes.map((n) => n.text).sort()).toEqual(['Eigener Kommentar', 'Testkommentar', 'Testkommentar']);
});

test('the course tools menu opens the wizard; points can be edited before they are saved', async () => {
  const { courseId, assessmentId, students } = await seed('NUMERIC');

  await main.evaluate((id) => {
    window.location.hash = `#/courses/${id}`;
  }, courseId);
  await main.getByTestId('plugin-menu-button').click();
  await main.getByTestId('gradeflow-menu-item').click();

  await expect(main).toHaveURL(new RegExp(`/courses/${courseId}/gradeflow$`));
  await expect(main.getByTestId('gradeflow-assessment')).toHaveValue('');
  await main.getByTestId('gradeflow-assessment').selectOption(assessmentId);
  await setupStep(main);
  await main.getByTestId('gradeflow-confirm').click();
  await main.getByTestId('gradeflow-start').click();

  await expect(main.getByTestId('gradeflow-review')).toBeVisible({ timeout: 20000 });
  // Half of the 20 points; nobody has a result yet, so nothing is replaced.
  await expect(main.getByLabel('Punkte für Bauer Anna')).toHaveValue('10');
  await expect(main.getByTestId('gradeflow-replace-warning')).toHaveCount(0);

  await main.getByLabel('Punkte für Bauer Anna').fill('25');
  await main.getByTestId('gradeflow-save').click();
  await expect(main.getByTestId('gradeflow-error')).toContainText('Punkte zwischen 0 und 20');
  await main.getByLabel('Punkte für Bauer Anna').fill('17.5');
  await main.getByLabel('Muster Max übernehmen').uncheck();
  await main.getByTestId('gradeflow-save').click();

  await expect(main).toHaveURL(new RegExp(`/courses/${courseId}$`));
  const performances = await main.evaluate((id) => (window as unknown as Api).grdr.grade.getPerformancesByAssessment(id), assessmentId);
  const anna = students.find((s) => s.lastName === 'Bauer');
  expect(performances.map((p) => [p.studentId === anna?.id ? 'anna' : 'other', p.score]).sort()).toEqual([
    ['anna', 17.5],
    ['other', 10],
  ]);
});

test('leaving an open run asks first and discards it', async () => {
  const { courseId, assessmentId } = await seed('TERTIARY');

  await main.evaluate(([id, a]) => {
    window.location.hash = `#/courses/${id}/gradeflow?assessmentId=${a}`;
  }, [courseId, assessmentId]);
  await setupStep(main);
  await expect(main.getByTestId('gradeflow-matching')).toBeVisible();

  await main.getByTestId('gradeflow-back').click();
  const dialog = main.getByRole('alertdialog');
  await expect(dialog).toContainText('Gradeflow verlassen?');
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(main.getByTestId('gradeflow-matching')).toBeVisible();

  await main.getByTestId('gradeflow-back').click();
  await main.getByRole('alertdialog').getByRole('button', { name: 'Verwerfen und verlassen' }).click();
  await expect(main).toHaveURL(new RegExp(`/courses/${courseId}$`));

  // The run is gone: a new one can be prepared right away.
  await main.evaluate((id) => {
    window.location.hash = `#/courses/${id}/gradeflow`;
  }, courseId);
  await main.getByTestId('gradeflow-assessment').selectOption(assessmentId);
  await setupStep(main);
  await expect(main.getByTestId('gradeflow-matching')).toBeVisible();
});

test('the settings hold the limits of a run', async () => {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.send('show-settings'));
  const section = main.getByTestId('gradeflow-settings');
  await expect(section.getByTestId('gradeflow-budget')).toHaveValue('3');
  await expect(section.getByTestId('gradeflow-timeout')).toHaveValue('15');

  await section.getByTestId('gradeflow-budget').fill('99');
  await section.getByTestId('gradeflow-settings-save').click();
  await expect(section).toContainText('Bitte einen Betrag zwischen 0,1 und 50 USD angeben.');

  await section.getByTestId('gradeflow-budget').fill('7.5');
  await section.getByTestId('gradeflow-timeout').fill('20');
  await section.getByTestId('gradeflow-settings-save').click();
  await expect(section).toContainText('Gradeflow-Einstellungen gespeichert.');

  const stored = await main.evaluate(() => (window as unknown as Api).grdr.gradeflow.getSettings());
  expect(stored).toEqual({ ok: true, value: { maxBudgetUsd: 7.5, timeoutMinutes: 20 } });
});
