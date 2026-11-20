import { buildLinkRows, duplicateLinks, toSaveLinks, type LinkRow } from '../../../src/renderer/utils/jideLinks';
import type { JideLinkOverviewDto } from '../../../src/shared/jide-api';

const overview = (students: JideLinkOverviewDto['students']): JideLinkOverviewDto => ({
  jideCourses: [],
  jideCourseId: '7',
  courseConfirmed: false,
  jideStudents: [],
  students,
});

describe('buildLinkRows', () => {
  it('prefers the saved link over the proposal and marks only proposals', () => {
    const rows = buildLinkRows(
      overview([
        { studentId: 's1', firstName: 'Max', lastName: 'Mustermann', jideStudentId: '11', suggestedJideStudentId: '99' },
        { studentId: 's2', firstName: 'Anna', lastName: 'Bauer', jideStudentId: null, suggestedJideStudentId: '12' },
        { studentId: 's3', firstName: 'Zoe', lastName: 'Zorn', jideStudentId: null, suggestedJideStudentId: null },
      ]),
    );
    expect(rows).toEqual([
      { studentId: 's2', label: 'Bauer Anna', selected: '12', suggested: true },
      { studentId: 's1', label: 'Mustermann Max', selected: '11', suggested: false },
      { studentId: 's3', label: 'Zorn Zoe', selected: '', suggested: false },
    ]);
  });
});

describe('duplicateLinks', () => {
  const row = (label: string, selected: string): LinkRow => ({ studentId: label, label, selected, suggested: false });

  it('names the students that share a J;DE person', () => {
    expect(duplicateLinks([row('A', '1'), row('B', '1'), row('C', '2'), row('D', '')])).toEqual(['A', 'B']);
  });

  it('ignores unlinked rows', () => {
    expect(duplicateLinks([row('A', ''), row('B', '')])).toEqual([]);
  });
});

describe('toSaveLinks', () => {
  it('turns empty choices into null', () => {
    const rows: LinkRow[] = [
      { studentId: 's1', label: 'A', selected: '11', suggested: true },
      { studentId: 's2', label: 'B', selected: '', suggested: false },
    ];
    expect(toSaveLinks('c', '7', rows)).toEqual({
      courseId: 'c',
      jideCourseId: '7',
      links: [
        { studentId: 's1', jideStudentId: '11' },
        { studentId: 's2', jideStudentId: null },
      ],
    });
    expect(toSaveLinks('c', '', rows).jideCourseId).toBeNull();
  });
});
