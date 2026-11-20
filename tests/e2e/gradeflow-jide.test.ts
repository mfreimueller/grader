/**
 * Drives the J;DE source of the Gradeflow wizard of the real app against a fake J;DE server (the grading API of
 * J;DE SPEC §5). The agent is replaced by the fake runner (GRDR_GRADEFLOW_FAKE_RUNNER=1). Needs `npm run build` and
 * the Electron build of better-sqlite3, see gradeflow.test.ts.
 */
import { expect, test, type Page } from '@playwright/test';
import { FakeJideServer } from '../integration/infrastructure/jide/FakeJideServer';
import { createCourse, launchGrader, type Api, type RunningGrader } from './helpers';

let grader: RunningGrader;
let main: Page;
const server = new FakeJideServer();

test.beforeAll(() => server.start());
test.afterAll(() => server.stop());

test.beforeEach(async () => {
  server.requests.length = 0;
  server.override = () => undefined;
  server.coursesBody = [
    {
      id: 7,
      subject: 'Mathematik',
      className: '1A',
      students: [
        { id: 11, name: 'Anna Bauer' },
        { id: 12, name: 'Muster Max' },
        { id: 13, name: 'Eva Fremd' },
      ],
    },
  ];
  const handin = (handinId: number, studentId: number) => ({
    handinId,
    studentId,
    submittedAt: '2026-11-10T09:00:00Z',
    late: false,
    testsPassed: 1,
    testsTotal: 2,
    graded: false,
    files: [{ path: 'Summe.java', content: `// Anna Bauer\nclass Summe {\n}\n` }],
  });
  server.handinsBody = [handin(501, 11), handin(502, 12), handin(503, 13)];
  grader = await launchGrader({ env: { GRDR_GRADEFLOW_FAKE_RUNNER: '1' } });
  ({ main } = grader);
});

test.afterEach(async () => {
  await grader.dispose();
});

test('J;DE hand-ins are linked, reviewed with their line comments, saved in Grader and sent to J;DE', async () => {
  const { courseId, students } = await createCourse(main);
  const assessmentId = await main.evaluate(
    async ([course, key, url]) => {
      const api = (window as unknown as Api).grdr;
      const must = <T>(result: { ok: boolean; value?: T }): T => {
        if (!result.ok) throw new Error('setup failed');
        return result.value as T;
      };
      must(await api.jide.setSettings({ baseUrl: url as string, apiKey: key as string }));
      const category = must(await api.assessmentCategory.create({ courseId: course as string, title: 'Übung', gradingType: 'TERTIARY', displayAsGrade: false }));
      const session = must(await api.session.create({ courseId: course as string, date: '2026-11-12' }));
      return must(await api.assessment.create({ sessionId: session.id, title: 'Summe', categoryId: category.id, courseId: course as string })).id;
    },
    [courseId, FakeJideServer.KEY, server.url] as const,
  );
  expect(assessmentId).toBeTruthy();

  await main.evaluate((id) => {
    window.location.hash = `#/courses/${id}/gradeflow`;
  }, courseId);

  // 1. Einrichtung: the course and the names are proposed, the link is saved once.
  await main.getByTestId('gradeflow-source-jide').check();
  await expect(main.getByTestId('jide-links-status')).toContainText('noch nicht bestätigt');
  await expect(main.getByTestId('jide-course')).toHaveValue('7');
  await expect(main.getByTestId('jide-link-row')).toHaveCount(3);
  await main.getByTestId('jide-links-save').click();
  await expect(main.getByTestId('jide-links-message')).toContainText('Verknüpfung gespeichert');
  await expect(main.getByTestId('jide-links-status')).toContainText('Kurs verknüpft');

  // Searchable exercise list.
  await main.getByTestId('jide-exercise-search').fill('fakul');
  await expect(main.getByTestId('jide-exercise-option')).toHaveCount(1);
  await main.getByTestId('jide-exercise-search').fill('summe');
  await main.getByTestId('jide-exercise-option').click();
  await expect(main.getByTestId('jide-exercise-selected')).toContainText('Summe zweier Zahlen (summe)');
  await main.getByTestId('gradeflow-assessment').selectOption(assessmentId);
  await expect(main.getByTestId('gradeflow-skill')).toHaveValue('java-jide');
  await main.getByTestId('gradeflow-prepare').click();

  // 2. Zuordnung: through the links; the J;DE person without a link is listed as not linked.
  await expect(main.getByTestId('gradeflow-matching')).toBeVisible();
  await expect(main.getByTestId('gradeflow-match-row')).toHaveCount(3);
  await expect(main.getByTestId('gradeflow-matching')).toContainText('nicht verknüpft');
  await main.getByTestId('gradeflow-confirm').click();

  // 3. Vorprüfung: the name in the code was replaced.
  await expect(main.getByTestId('gradeflow-preflight')).toBeVisible();
  await main.getByTestId('gradeflow-start').click();

  // 5. Prüfen: code with the line comment of the fake agent; the teacher edits one of them.
  await expect(main.getByTestId('gradeflow-review')).toBeVisible({ timeout: 20000 });
  await expect(main.getByTestId('gradeflow-review-row')).toHaveCount(2);
  const codeRows = main.getByTestId('gradeflow-jide-code-row');
  await codeRows.first().locator('summary').click();
  await expect(main.getByTestId('jide-line-comment').first().locator('textarea')).toHaveValue('Testzeilenkommentar');
  await expect(main.getByTestId('jide-line').first()).toContainText('// Anna Bauer');
  await main.getByLabel('Zeilenkommentar zu Summe.java, Zeile 1').first().fill('Schön gelöst, du hast alles bedacht.');
  await codeRows.nth(1).locator('summary').click();
  await main.getByTestId('jide-line-comment-delete').last().click();

  // J;DE refuses the hand-in of the second student: they handed in again.
  server.override = (r) =>
    r.method === 'PUT' && r.path === '/api/v1/handins/502/grade'
      ? { status: 409, body: { error: 'NEWER_HANDIN', message: 'Es gibt eine neuere Abgabe.' } }
      : undefined;
  await main.getByTestId('gradeflow-save').click();

  await expect(main.getByTestId('gradeflow-jide-summary')).toContainText('1 an J;DE gesendet, 1 nicht gesendet (neue Abgabe seit dem Laden)');
  await expect(main.getByTestId('gradeflow-jide-sent')).toHaveCount(1);
  await expect(main.getByTestId('gradeflow-jide-newer')).toHaveCount(1);

  const puts = server.requests.filter((r) => r.method === 'PUT');
  expect(puts.map((p) => p.path)).toEqual(['/api/v1/handins/501/grade', '/api/v1/handins/502/grade']);
  expect(puts[0]?.body).toEqual({
    symbol: 'WELLE',
    comment: 'Testkommentar',
    lineComments: [{ path: 'Summe.java', line: 1, text: 'Schön gelöst, du hast alles bedacht.' }],
  });

  // Both are saved in Grader although one was not sent.
  const performances = await main.evaluate((id) => (window as unknown as Api).grdr.grade.getPerformancesByAssessment(id), assessmentId);
  expect(performances.map((p) => p.symbol)).toEqual(['WELLE', 'WELLE']);
  expect(performances.map((p) => p.studentId).sort()).toEqual(students.filter((s) => s.lastName !== 'Zorn').map((s) => s.id).sort());

  await main.getByTestId('gradeflow-finish').click();
  await expect(main).toHaveURL(new RegExp(`/courses/${courseId}$`));
});

test('without a connection the link panel explains what is missing', async () => {
  const { courseId } = await createCourse(main);
  await main.evaluate((id) => {
    window.location.hash = `#/courses/${id}/gradeflow`;
  }, courseId);
  await main.getByTestId('gradeflow-source-jide').check();
  await expect(main.getByTestId('jide-links-error')).toContainText('noch nicht eingerichtet');
});
