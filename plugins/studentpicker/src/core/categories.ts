import type { PluginCategory } from '../../../../src/shared/plugin-api';

/** The categories a symbol can be recorded in: tertiary ones (+ ~ −), not points, and not hidden. */
export function categoryChoices(categories: readonly PluginCategory[]): PluginCategory[] {
  return categories.filter((c) => c.gradingType === 'TERTIARY' && !c.isHidden);
}

/** Mitarbeit, which is what a call in class counts as, otherwise the first one. */
export function defaultCategory(choices: readonly PluginCategory[]): PluginCategory | undefined {
  return choices.find((c) => c.isMitarbeit) ?? choices[0];
}
