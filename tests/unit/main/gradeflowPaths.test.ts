import { gradeflowSkillRoots, useFakeGradeflowRunner } from '../../../src/main/gradeflowPaths';

describe('gradeflowSkillRoots', () => {
  it('reads the bundled skills from the assets folder in development', () => {
    const roots = gradeflowSkillRoots({ isPackaged: false, resourcesPath: '/res', appPath: '/app', userDataPath: '/data' });

    expect(roots).toEqual({ bundled: '/app/assets/gradeflow/skills', user: '/data/gradeflow/skills' });
  });

  it('reads the bundled skills from the resources folder when packaged', () => {
    const roots = gradeflowSkillRoots({ isPackaged: true, resourcesPath: '/res', appPath: '/app.asar', userDataPath: '/data' });

    expect(roots).toEqual({ bundled: '/res/gradeflow/skills', user: '/data/gradeflow/skills' });
  });
});

describe('useFakeGradeflowRunner', () => {
  it('is on in development when the environment asks for it', () => {
    expect(useFakeGradeflowRunner({ isPackaged: false, env: { GRDR_GRADEFLOW_FAKE_RUNNER: '1' } })).toBe(true);
  });

  it('is never on in a packaged app', () => {
    expect(useFakeGradeflowRunner({ isPackaged: true, env: { GRDR_GRADEFLOW_FAKE_RUNNER: '1' } })).toBe(false);
  });

  it('is off unless the variable is exactly 1', () => {
    expect(useFakeGradeflowRunner({ isPackaged: false, env: {} })).toBe(false);
    expect(useFakeGradeflowRunner({ isPackaged: false, env: { GRDR_GRADEFLOW_FAKE_RUNNER: 'true' } })).toBe(false);
  });
});
