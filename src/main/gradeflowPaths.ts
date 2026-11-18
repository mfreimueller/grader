import { join } from 'node:path';

export interface GradeflowPathInput {
  isPackaged: boolean;
  resourcesPath: string;
  appPath: string;
  userDataPath: string;
}

/**
 * Where grading skills live. Bundled ones ship next to the app when packaged (a skill directory is copied into the
 * workspace, which cannot be done from inside the asar archive) and in assets/ in development.
 */
export function gradeflowSkillRoots(input: GradeflowPathInput): { bundled: string; user: string } {
  return {
    bundled: input.isPackaged
      ? join(input.resourcesPath, 'gradeflow', 'skills')
      : join(input.appPath, 'assets', 'gradeflow', 'skills'),
    user: join(input.userDataPath, 'gradeflow', 'skills'),
  };
}

/** Development and end-to-end tests may swap the Claude agent for a fake; a packaged app never does. */
export function useFakeGradeflowRunner(input: { isPackaged: boolean; env: Record<string, string | undefined> }): boolean {
  return !input.isPackaged && input.env['GRDR_GRADEFLOW_FAKE_RUNNER'] === '1';
}
