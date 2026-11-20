import type { JideCourse } from '../../../../src/domain/jide/JideApi';
import { suggestCourseLink, suggestStudentLinks } from '../../../../src/domain/jide/JideLinkSuggestion';

const aJideCourse = (overrides: Partial<JideCourse> = {}): JideCourse => ({
  id: '1',
  subject: 'Programmieren',
  className: '3AHIF',
  students: [],
  ...overrides,
});

describe('suggestStudentLinks', () => {
  const students = [
    { id: 's-max', firstName: 'Max', lastName: 'Mustermann' },
    { id: 's-anna', firstName: 'Anna', lastName: 'Müller' },
    { id: 's-tom', firstName: 'Tom', lastName: 'Huber' },
  ];

  it('suggests the J;DE student whose name matches, in either order', () => {
    const links = suggestStudentLinks(students, [
      { id: 'j1', name: 'Max Mustermann' },
      { id: 'j2', name: 'Müller Anna' },
    ]);
    expect(links.get('s-max')).toBe('j1');
    expect(links.get('s-anna')).toBe('j2');
  });

  it('ignores case, umlaut spelling and extra name parts', () => {
    const links = suggestStudentLinks(students, [
      { id: 'j1', name: 'MAX mustermann' },
      { id: 'j2', name: 'Anna Mueller' },
    ]);
    expect(links.get('s-max')).toBe('j1');
    expect(links.get('s-anna')).toBe('j2');
  });

  it('suggests nothing when no J;DE student matches', () => {
    const links = suggestStudentLinks(students, [{ id: 'j1', name: 'Eva Fremd' }]);
    expect(links.size).toBe(0);
  });

  it('suggests nothing when several J;DE students match one student', () => {
    const links = suggestStudentLinks(students, [
      { id: 'j1', name: 'Tom Huber' },
      { id: 'j2', name: 'Huber Tom' },
    ]);
    expect(links.has('s-tom')).toBe(false);
  });

  it('suggests nothing when one J;DE student matches several students', () => {
    const twins = [
      { id: 'a', firstName: 'Max', lastName: 'Huber' },
      { id: 'b', firstName: 'Max', lastName: 'Huber' },
    ];
    expect(suggestStudentLinks(twins, [{ id: 'j1', name: 'Max Huber' }]).size).toBe(0);
  });
});

describe('suggestCourseLink', () => {
  it('suggests the only J;DE course of the same class', () => {
    const courses = [aJideCourse({ id: '1' }), aJideCourse({ id: '2', className: '4AHIF' })];
    expect(suggestCourseLink({ title: 'Programmieren', className: '3ahif' }, courses)).toBe('1');
  });

  it('uses the subject when several courses share the class', () => {
    const courses = [aJideCourse({ id: '1', subject: 'Datenbanken' }), aJideCourse({ id: '2', subject: 'Programmieren' })];
    expect(suggestCourseLink({ title: '3AHIF Programmieren', className: '3AHIF' }, courses)).toBe('2');
  });

  it('suggests nothing when the class is ambiguous or unknown', () => {
    const courses = [aJideCourse({ id: '1' }), aJideCourse({ id: '2' })];
    expect(suggestCourseLink({ title: 'Mathe', className: '3AHIF' }, courses)).toBeNull();
    expect(suggestCourseLink({ title: 'Mathe', className: '1BHIF' }, courses)).toBeNull();
  });
});
