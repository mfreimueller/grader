import { gradeflowSkillRoots } from '../../../src/main/gradeflowPaths';

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
