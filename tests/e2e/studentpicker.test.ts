/**
 * The Zufallsauswahl that ships with Grader, run in the real app: started from a course, picking students,
 * recording and taking back grades in the course, remembering counts and specials, leaving out absent students.
 */
import { expect, test, type Page } from '@playwright/test';
import { createCourse, launchGrader, localDay, type Api, type CreatedStudent, type RunningGrader } from './helpers';

const PLUGIN_NAME = /Zufallsauswahl/;

let grader: RunningGrader;
let courseId: string;
let students: CreatedStudent[];

test.beforeEach(async () => {
  grader = await launchGrader();
  ({ courseId, students } = await createCourse(grader.main));
});

test.afterEach(async () => {
  await grader.dispose();
});

/** Opens the machine through the course's "Werkzeuge" menu, as a teacher would. */
async function openMachine(options: { animated?: boolean } = {}): Promise<Page> {
  const { app, main } = grader;
  await main.evaluate((id) => {
    window.location.hash = `#/courses/${id}`;
  }, courseId);
  await main.getByTestId('plugin-menu-button').click();
  const [page] = await Promise.all([
    app.waitForEvent('window'),
    main.getByTestId('plugin-menu').getByRole('menuitem', { name: PLUGIN_NAME }).click(),
  ]);
  // The spin takes 6 seconds; tests that are not about the animation skip it, as people who ask for less motion do.
  if (!options.animated) await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByTestId('course-title')).toBeVisible();
  return page;
}

/** What Grader holds for today's session: the assessments with who got which symbol. */
async function gradesOfToday(): Promise<{ title: string; category: string; impromptu: boolean; given: { studentId: string; symbol: string | null }[] }[]> {
  return grader.main.evaluate(
    async ([id, day]) => {
      const api = (window as unknown as Api).grdr;
      const sessions = await api.session.listByCourse(id as string);
      const today = sessions.find((s) => s.date.slice(0, 10) === day);
      if (!today) return [];
      const assessments = await api.assessment.listBySession(today.id);
      return Promise.all(
        assessments.map(async (a) => ({
          title: a.title,
          category: a.category.title,
          impromptu: a.isImpromptu,
          given: (await api.grade.getPerformancesByAssessment(a.id)).map((p) => ({ studentId: p.studentId, symbol: p.symbol })),
        })),
      );
    },
    [courseId, localDay(new Date())],
  );
}

const byName = (name: string): CreatedStudent => {
  const found = students.find((s) => `${s.firstName} ${s.lastName}` === name);
  if (!found) throw new Error(`no student ${name}`);
  return found;
};

test('ships with Grader, is on from the start and shows the students of the course', async () => {
  const launchable = await grader.main.evaluate(() => (window as unknown as Api).grdr.plugin.launchable());
  expect(launchable.map((p) => p.name)).toEqual(['Zufallsauswahl']);
  expect(launchable[0]).toMatchObject({ source: 'bundled', status: 'enabled' });

  const page = await openMachine();

  await expect(page.getByTestId('course-title')).toHaveText('1A · Mathematik');
  await expect(page.getByTestId('students').locator('tbody tr')).toHaveCount(3);
  await expect(page.getByTestId('picker')).toHaveAttribute('data-item-count', '3');
  await expect(page.getByTestId('fair-toggle')).toBeChecked();
});

test('picks a student and records, changes and takes back the grade in the course', async () => {
  const page = await openMachine();

  await page.getByTestId('spin').click();
  const name = (await page.getByTestId('result-name').textContent()) ?? '';
  const picked = byName(name);
  await expect(page.getByTestId('result-count')).toHaveText('Aufruf Nr. 1');
  expect(await gradesOfToday()).toEqual([]); // a pick alone records nothing

  await page.getByTestId('grade-PLUS').click();
  await expect(page.getByTestId('grade-saved')).toBeVisible();
  expect(await gradesOfToday()).toEqual([
    { title: 'Mitarbeit', category: 'Mitarbeit', impromptu: true, given: [{ studentId: picked.id, symbol: 'PLUS' }] },
  ]);

  // The same symbol again takes the grade back.
  await page.getByTestId('grade-PLUS').click();
  await expect(page.getByTestId('grade-saved')).toHaveCount(0);
  expect(await gradesOfToday()).toEqual([]);

  // Another symbol replaces it; there is never more than one entry for this call.
  await page.getByTestId('grade-WELLE').click();
  await page.getByTestId('grade-MINUS').click();
  await expect(page.getByTestId('grade-MINUS')).toHaveAttribute('aria-pressed', 'true');
  expect(await gradesOfToday()).toEqual([
    { title: 'Mitarbeit', category: 'Mitarbeit', impromptu: true, given: [{ studentId: picked.id, symbol: 'MINUS' }] },
  ]);
});

/** The notes of today's results: one entry per result that has a note. */
async function notesOfToday(): Promise<{ symbol: string | null; notes: string[] }[]> {
  return grader.main.evaluate(
    async ([id, day]) => {
      const api = (window as unknown as Api).grdr;
      const today = (await api.session.listByCourse(id as string)).find((s) => s.date.slice(0, 10) === day);
      if (!today) return [];
      const performances = (
        await Promise.all((await api.assessment.listBySession(today.id)).map((a) => api.grade.getPerformancesByAssessment(a.id)))
      ).flat();
      return Promise.all(
        performances.map(async (p) => ({
          symbol: p.symbol,
          notes: (await api.finding.getFindings(p.id)).filter((f) => f.type === 'note').map((f) => f.text ?? ''),
        })),
      );
    },
    [courseId, localDay(new Date())],
  );
}

test('records a comment with the grade, written before or after it, and keeps it when the grade changes', async () => {
  const page = await openMachine();
  await page.getByTestId(`pick-${byName('Max Muster').id}`).click();

  // Written first: it waits for the grade. Clicking the grade straight from the field must still record it.
  await page.getByTestId('grade-note').fill('Bruchrechnen');
  await expect(page.getByTestId('grade-note-pending')).toBeVisible();
  await page.getByTestId('grade-PLUS_WELLE').click();
  await expect(page.getByTestId('grade-PLUS_WELLE')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('grade-note-pending')).toHaveCount(0);
  expect(await notesOfToday()).toEqual([{ symbol: 'PLUS_WELLE', notes: ['Bruchrechnen'] }]);

  // A changed grade takes the comment along; a changed comment is saved when the dialog closes.
  await page.getByTestId('grade-MINUS_WELLE').click();
  await expect(page.getByTestId('grade-MINUS_WELLE')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('grade-note').fill('Bruchrechnen, Kürzen');
  await page.getByTestId('result-close').click();
  await expect(page.getByTestId('result-name')).toHaveCount(0);

  expect(await notesOfToday()).toEqual([{ symbol: 'MINUS_WELLE', notes: ['Bruchrechnen, Kürzen'] }]);
});

test('is fair: everybody is called once before anybody is called again', async () => {
  const page = await openMachine();
  const picked = new Set<string>();

  for (let round = 0; round < 3; round++) {
    await page.getByTestId('spin').click();
    picked.add((await page.getByTestId('result-name').textContent()) ?? '');
    await page.getByTestId('result-close').click();
    await expect(page.getByTestId('result-name')).toHaveCount(0);
  }

  expect(picked.size).toBe(3);
  // Everybody was called once, so everybody is back on the machine.
  await expect(page.getByTestId('picker')).toHaveAttribute('data-item-count', '3');
});

test('a picked student leaves the fair pool until the others have been called', async () => {
  const page = await openMachine();

  await page.getByTestId('spin').click();
  await page.getByTestId('result-close').click();

  await expect(page.getByTestId('picker')).toHaveAttribute('data-item-count', '2');
  await page.getByTestId('fair-toggle').uncheck();
  await expect(page.getByTestId('picker')).toHaveAttribute('data-item-count', '3');
});

test('calls a student directly from the list', async () => {
  const page = await openMachine();
  const max = byName('Max Muster');

  await page.getByTestId(`pick-${max.id}`).click();

  await expect(page.getByTestId('result-name')).toHaveText('Max Muster');
  await expect(page.getByTestId('result-count')).toHaveText('Aufruf Nr. 1');
});

test('remembers the counts when the window is closed and opened again', async () => {
  const first = await openMachine();
  const max = byName('Max Muster');
  await first.getByTestId(`pick-${max.id}`).click();
  await first.getByTestId('result-close').click();
  await expect(first.getByTestId(`count-${max.id}`)).toHaveValue('1');
  await first.close();

  const second = await openMachine();

  await expect(second.getByTestId(`count-${max.id}`)).toHaveValue('1');
  await expect(second.getByTestId('picker')).toHaveAttribute('data-item-count', '2');
});

test('lets the teacher correct a count, refuses nonsense and resets all counts', async () => {
  const page = await openMachine();
  const anna = byName('Anna Bauer');

  await page.getByTestId(`count-${anna.id}`).fill('4');
  await page.getByTestId(`count-${anna.id}`).blur();
  await expect(page.getByTestId('picker')).toHaveAttribute('data-item-count', '2'); // the others are behind now

  await page.getByTestId(`count-${anna.id}`).fill('-3');
  await page.getByTestId(`count-${anna.id}`).blur();
  await expect(page.getByTestId('error')).toHaveText('Die Anzahl muss eine ganze Zahl ab 0 sein.');
  await expect(page.getByTestId(`count-${anna.id}`)).toHaveValue('4');

  await page.getByTestId('reset-counts').click();
  await page.getByTestId('reset-confirm').click();
  await expect(page.getByTestId(`count-${anna.id}`)).toHaveValue('0');
  await expect(page.getByTestId('picker')).toHaveAttribute('data-item-count', '3');
});

test('keeps the special fields of a course and puts them on the machine', async () => {
  const first = await openMachine();

  await first.getByTestId('edit-specials').click();
  await first.getByTestId('special-add').click();
  await expect(first.getByTestId('specials-save')).toBeDisabled(); // a field needs a name
  await first.getByTestId('special-label-0').fill('Nochmal drehen');
  await first.getByTestId('special-prob-0').fill('100');
  await expect(first.getByTestId('specials-error')).toHaveText('Die Wahrscheinlichkeiten müssen zusammen unter 100 % bleiben.');
  await first.getByTestId('special-prob-0').fill('5');
  await first.getByTestId('specials-save').click();

  await expect(first.getByTestId('picker')).toHaveAttribute('data-item-count', '4');
  await first.close();

  const second = await openMachine();
  await expect(second.getByTestId('picker')).toHaveAttribute('data-item-count', '4');
  await second.getByTestId('edit-specials').click();
  await expect(second.getByTestId('special-label-0')).toHaveValue('Nochmal drehen');
});

test('only offers the students who are present today', async () => {
  const absent = byName('Max Muster');
  await grader.main.evaluate(
    async ([course, studentId, day]) => {
      const api = (window as unknown as Api).grdr;
      const session = await api.session.create({ courseId: course as string, date: day as string });
      if (!session.ok) throw new Error('session failed');
      await api.session.setAbsence(session.value.id, { studentId: studentId as string, absent: true });
    },
    [courseId, absent.id, localDay(new Date())],
  );

  const page = await openMachine();

  await expect(page.getByTestId('students').locator('tbody tr')).toHaveCount(2);
  await expect(page.getByTestId(`pick-${absent.id}`)).toHaveCount(0);
  await expect(page.getByTestId('picker')).toHaveAttribute('data-item-count', '2');
});

test('notices that somebody was marked absent while it is open', async () => {
  const page = await openMachine();
  await expect(page.getByTestId('students').locator('tbody tr')).toHaveCount(3);
  const absent = byName('Zoe Zorn');

  await grader.main.evaluate(
    async ([course, studentId, day]) => {
      const api = (window as unknown as Api).grdr;
      const session = await api.session.create({ courseId: course as string, date: day as string });
      if (!session.ok) throw new Error('session failed');
      await api.session.setAbsence(session.value.id, { studentId: studentId as string, absent: true });
    },
    [courseId, absent.id, localDay(new Date())],
  );
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));

  await expect(page.getByTestId('students').locator('tbody tr')).toHaveCount(2);
});

test('plays the whole animation and still ends on a result', async () => {
  test.setTimeout(60_000);
  const page = await openMachine({ animated: true });

  await page.getByTestId('spin').click();
  await expect(page.getByTestId('picker')).toHaveClass(/spinning/);

  await expect(page.getByTestId('result-name')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('picker')).not.toHaveClass(/spinning/);
});

test('shows the slot machine until the course chooses the wheel, and remembers the choice', async () => {
  const first = await openMachine();
  await expect(first.getByTestId('skin-select')).toHaveValue('slotmachine');
  await expect(first.locator('[data-reel]')).toHaveCount(3);

  await first.getByTestId('skin-select').selectOption('wheel');

  await expect(first.locator('[data-segment]')).toHaveCount(3);
  await expect(first.locator('[data-reel]')).toHaveCount(0);
  await first.close();

  const second = await openMachine();
  await expect(second.getByTestId('skin-select')).toHaveValue('wheel');
  await expect(second.getByTestId('picker')).toHaveAttribute('data-item-count', '3');
});

test('the wheel picks a student, who then leaves the fair pool', async () => {
  const page = await openMachine();
  await page.getByTestId('skin-select').selectOption('wheel');

  await page.getByTestId('spin').click();
  await expect(page.getByTestId('result-name')).toBeVisible();
  await expect(page.getByTestId('result-count')).toHaveText('Aufruf Nr. 1');
  await page.getByTestId('result-close').click();

  await expect(page.getByTestId('picker')).toHaveAttribute('data-item-count', '2');
});

test('spins the wheel all the way and lets confetti rain on the winner', async () => {
  test.setTimeout(60_000);
  const page = await openMachine({ animated: true });
  await page.getByTestId('skin-select').selectOption('wheel');

  await page.getByTestId('spin').click();
  await expect(page.getByTestId('picker')).toHaveClass(/spinning/);

  await expect(page.getByTestId('result-name')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('confetti')).toBeVisible();
  // The confetti never stands in the way of the dialog.
  await page.getByTestId('grade-PLUS').click();
  await expect(page.getByTestId('grade-saved')).toBeVisible();
  await expect(page.getByTestId('confetti')).toHaveCount(0, { timeout: 10_000 });
});

const DOORS = '[data-testid^="advent-door-"]';

test('the Adventkalender opens a door with a student, keeps the name in the door and remembers it', async () => {
  const first = await openMachine();
  await first.getByTestId('skin-select').selectOption('advent');
  await expect(first.getByTestId('snow')).toBeAttached();
  await expect(first.locator(DOORS)).toHaveCount(24);
  await expect(first.getByTestId('advent-door-7')).toHaveAttribute('aria-label', 'Türchen 7');

  await first.getByTestId('advent-door-7').click();
  await expect(first.getByTestId('result-name')).toBeVisible();
  const name = (await first.getByTestId('result-name').textContent()) ?? '';
  await expect(first.getByTestId('result-count')).toHaveText('Aufruf Nr. 1');
  // No door can be opened while the dialog is up.
  await expect(first.getByTestId('advent-door-8')).toBeDisabled();
  await first.getByTestId('result-close').click();

  await expect(first.getByTestId('advent-door-7')).toContainText(name);
  await expect(first.getByTestId('advent-door-7')).toHaveAttribute('aria-label', `Türchen 7: ${name}`);
  await expect(first.getByTestId('advent-door-7')).toBeDisabled();
  await expect(first.getByTestId('advent-door-8')).toBeEnabled();
  await first.close();

  const second = await openMachine();
  await expect(second.getByTestId('skin-select')).toHaveValue('advent');
  await expect(second.getByTestId('advent-door-7')).toContainText(name);
  await expect(second.getByTestId('advent-door-8')).toBeEnabled();
});

test('the Adventkalender snows over the window without being in the way, and plays the door animation', async () => {
  test.setTimeout(60_000);
  const page = await openMachine({ animated: true });
  await page.getByTestId('skin-select').selectOption('advent');

  await expect(page.getByTestId('snowflake')).toHaveCount(70);
  await expect(page.getByTestId('snow')).toHaveCSS('pointer-events', 'none');
  await page.getByTestId('advent-door-3').click();
  await expect(page.getByTestId('advent-door-3')).toHaveClass(/wobbling/);
  await expect(page.getByTestId('result-name')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('confetti')).toBeVisible();
  await page.getByTestId('result-close').click(); // not blocked by the snow
  await expect(page.getByTestId('result-name')).toHaveCount(0);
});

test('a student picked from the table does not open a door', async () => {
  const page = await openMachine();
  await page.getByTestId('skin-select').selectOption('advent');

  await page.getByTestId(`pick-${byName('Max Muster').id}`).click();
  await expect(page.getByTestId('result-name')).toBeVisible();
  await page.getByTestId('result-close').click();

  await expect(page.locator(`${DOORS}:disabled`)).toHaveCount(0);
});

test('a door never spins again, even with a special that nearly always would', async () => {
  const page = await openMachine();
  await page.getByTestId('edit-specials').click();
  await page.getByTestId('special-add').click();
  await page.getByTestId('special-label-0').fill('Nochmal drehen');
  await page.getByTestId('special-prob-0').fill('95');
  await page.getByTestId('specials-save').click();
  await page.getByTestId('skin-select').selectOption('advent');

  for (const door of [1, 2, 3, 4, 5]) {
    await page.getByTestId(`advent-door-${door}`).click();
    await expect(page.getByTestId('result-name')).toBeVisible();
    await page.getByTestId('result-close').click();
    await expect(page.getByTestId(`advent-door-${door}`)).not.toContainText('Nochmal drehen');
  }
  await expect(page.locator(`${DOORS}:disabled`)).toHaveCount(5);
});
