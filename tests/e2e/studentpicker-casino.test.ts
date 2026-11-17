/**
 * The casino skin of the Zufallsauswahl, run in the real app: the disclaimer, the roulette and a fair blackjack hand
 * that decides whether the student answers (graded as usual) or passes (nothing recorded, out for the session).
 */
import { expect, test, type Page } from '@playwright/test';
import { createCourse, launchGrader, type CreatedStudent, type RunningGrader } from './helpers';
import { deal, newShoe, outcome, stand, type Outcome, type Shoe } from '../../plugins/studentpicker/src/core/blackjack';
import { consequence, DEFAULT_CASINO_SETTINGS } from '../../plugins/studentpicker/src/core/casino';

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

async function openMachine(): Promise<Page> {
  const { app, main } = grader;
  await main.evaluate((id) => {
    window.location.hash = `#/courses/${id}`;
  }, courseId);
  await main.getByTestId('plugin-menu-button').click();
  const [page] = await Promise.all([
    app.waitForEvent('window'),
    main.getByTestId('plugin-menu').getByRole('menuitem', { name: /Zufallsauswahl/ }).click(),
  ]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByTestId('course-title')).toBeVisible();
  return page;
}

async function chooseCasino(page: Page): Promise<void> {
  await page.getByTestId('skin-select').selectOption('casino');
  await expect(page.getByTestId('casino-disclaimer')).toContainText('Glücksspiel wird nicht unterstützt oder gefördert.');
  await page.getByTestId('casino-disclaimer-ok').click();
  await expect(page.getByTestId('casino-disclaimer')).toHaveCount(0);
}

/** The hands a teacher who always stands gets from a shoe shuffled with random() = 0, pushes dealt again. */
function standingHands(): () => Outcome[] {
  let shoe: Shoe = newShoe(() => 0);
  return () => {
    const hands: Outcome[] = [];
    for (;;) {
      let round = deal(shoe, () => 0);
      if (round.phase === 'player') round = stand(round);
      shoe = round.shoe;
      const result = outcome(round)!;
      hands.push(result);
      if (consequence(result, DEFAULT_CASINO_SETTINGS) !== 'deal-again') return hands;
    }
  };
}

test('shows the disclaimer whenever the casino is chosen, not when it is only remembered', async () => {
  const first = await openMachine();
  await chooseCasino(first);
  await expect(first.getByTestId('casino')).toBeVisible();
  await first.close();

  const second = await openMachine();
  await expect(second.getByTestId('casino')).toBeVisible();
  await expect(second.getByTestId('casino-disclaimer')).toHaveCount(0);
});

test('the roulette picks a student and takes them to the table', async () => {
  const page = await openMachine();
  await chooseCasino(page);
  await expect(page.getByTestId('picker')).toHaveAttribute('data-item-count', '3');

  await page.getByTestId('spin').click();
  await expect(page.getByTestId('casino-picked')).toBeVisible({ timeout: 15_000 });
  const name = await page.getByTestId('casino-picked').textContent();
  expect(students.map((s) => `${s.firstName} ${s.lastName}`)).toContain(name);

  await page.getByTestId('casino-deal').click();
  await expect(page.getByTestId('table-student')).toHaveText(name ?? '');
  await expect(page.getByTestId('students')).toHaveCount(0);
});

test('a lost hand leads to the grading, a won hand is a pass that counts nothing and leaves the wheel', async () => {
  const page = await openMachine();
  await chooseCasino(page);
  // Without fair mode only the passes take students off the wheel.
  await page.getByTestId('fair-toggle').uncheck();
  await page.evaluate(() => {
    Math.random = () => 0;
  });
  const nextStudent = standingHands();
  let onWheel = students.length;
  const winners = new Set<string>();

  for (const student of students) {
    await page.getByTestId(`pick-${student.id}`).click();
    const hands = nextStudent();
    for (const [index, hand] of hands.entries()) {
      const result = page.getByTestId('table-result');
      const stand = page.getByTestId('bj-stand');
      await expect(result.or(stand)).toBeVisible();
      if (await stand.isVisible()) await stand.click();
      await expect(result).toHaveAttribute('data-result', hand.result);
      if (index < hands.length - 1) await page.getByTestId('bj-continue').click();
    }

    const last = hands.at(-1)!;
    winners.add(last.winner);
    await expect(page.getByTestId('table-result')).toHaveAttribute('data-consequence', consequence(last, DEFAULT_CASINO_SETTINGS));
    await page.getByTestId('bj-continue').click();

    if (last.winner === 'bank') {
      await expect(page.getByTestId('result-name')).toHaveText(`${student.firstName} ${student.lastName}`);
      await page.getByTestId('result-close').click();
      await expect(page.getByTestId(`count-${student.id}`)).toHaveValue('1');
    } else {
      onWheel -= 1;
      await expect(page.getByTestId(`count-${student.id}`)).toHaveValue('0');
    }
    await expect(page.getByTestId('picker')).toHaveAttribute('data-item-count', String(onWheel));
  }
  // The fixed shoe must take both ways, or this test proves only one of them.
  expect([...winners].sort()).toEqual(['bank', 'player']);
});
