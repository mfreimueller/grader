// Controller of the linking panel in the Gradeflow setup: the J;DE course of a Grader course and the J;DE person of
// each student. Proposals come from the names; nothing counts as linked until the teacher saved it.

import { ref } from 'vue';
import type { JideLinkOverviewDto, JideResultDto, JideSaveLinksInput } from '../../shared/jide-api';
import { buildLinkRows, duplicateLinks, toSaveLinks, type LinkRow } from '../utils/jideLinks';
import { plain } from '../utils/plain';

export interface JideLinksApi {
  linkOverview: (courseId: string, jideCourseId?: string | null) => Promise<JideResultDto<JideLinkOverviewDto>>;
  saveLinks: (input: JideSaveLinksInput) => Promise<JideResultDto<void>>;
}

export function useJideLinks(courseId: string, api: JideLinksApi) {
  const overview = ref<JideLinkOverviewDto | null>(null);
  const rows = ref<LinkRow[]>([]);
  const jideCourseId = ref('');
  /** Whether the course link in the panel is the saved one. */
  const confirmed = ref(false);
  const busy = ref(false);
  const error = ref('');
  const message = ref('');

  async function guarded<T>(call: () => Promise<JideResultDto<T>>): Promise<T | null> {
    error.value = '';
    message.value = '';
    busy.value = true;
    try {
      const result = await call();
      if (result.ok) return result.value;
      error.value = result.error.message;
      return null;
    } finally {
      busy.value = false;
    }
  }

  function adopt(value: JideLinkOverviewDto): void {
    overview.value = value;
    rows.value = buildLinkRows(value);
    jideCourseId.value = value.jideCourseId ?? '';
    confirmed.value = value.courseConfirmed;
  }

  /** Loads the panel; `selected` shows another J;DE course than the stored link or the proposal. */
  async function load(selected?: string | null): Promise<void> {
    const value = await guarded(() => api.linkOverview(courseId, selected));
    if (value !== null) adopt(value);
  }

  const chooseCourse = (id: string): Promise<void> => load(id === '' ? null : id);

  /** Resolves to true when the links are saved. */
  async function save(): Promise<boolean> {
    if (jideCourseId.value === '') {
      error.value = 'Bitte einen J;DE-Kurs wählen.';
      return false;
    }
    const duplicates = duplicateLinks(rows.value);
    if (duplicates.length > 0) {
      error.value = `Dieselbe J;DE-Person ist mehreren zugeordnet: ${duplicates.join(', ')}`;
      return false;
    }
    const saved = await guarded(async () => api.saveLinks(plain(toSaveLinks(courseId, jideCourseId.value, rows.value))));
    if (saved === null && error.value !== '') return false;
    await load(jideCourseId.value);
    message.value = 'Verknüpfung gespeichert.';
    return error.value === '';
  }

  return { overview, rows, jideCourseId, confirmed, busy, error, message, load, chooseCourse, save };
}
