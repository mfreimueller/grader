import { useJideLinks } from '../../../src/renderer/controllers/useJideLinks';
import type { JideLinkOverviewDto, JideResultDto } from '../../../src/shared/jide-api';

const ok = <T>(value: T): JideResultDto<T> => ({ ok: true, value });

const overview = (patch: Partial<JideLinkOverviewDto> = {}): JideLinkOverviewDto => ({
  jideCourses: [{ id: '7', subject: 'Programmieren', className: '3AHIF' }],
  jideCourseId: '7',
  courseConfirmed: false,
  jideStudents: [{ id: '11', name: 'Max Mustermann' }],
  students: [{ studentId: 's1', firstName: 'Max', lastName: 'Mustermann', jideStudentId: null, suggestedJideStudentId: '11' }],
  ...patch,
});

function setup() {
  const api = {
    linkOverview: jest.fn().mockResolvedValue(ok(overview())),
    saveLinks: jest.fn().mockResolvedValue(ok(undefined)),
  };
  return { api, links: useJideLinks('c1', api) };
}

describe('useJideLinks', () => {
  it('shows the proposals but not as confirmed', async () => {
    const { links } = setup();
    await links.load();
    expect(links.jideCourseId.value).toBe('7');
    expect(links.confirmed.value).toBe(false);
    expect(links.rows.value[0]).toMatchObject({ selected: '11', suggested: true });
  });

  it('shows the error of a failed load', async () => {
    const { api, links } = setup();
    api.linkOverview.mockResolvedValue({ ok: false, error: { name: 'JideApiError', message: 'J;DE ist nicht erreichbar.' } });
    await links.load();
    expect(links.error.value).toBe('J;DE ist nicht erreichbar.');
  });

  it('reloads for another J;DE course', async () => {
    const { api, links } = setup();
    await links.chooseCourse('8');
    expect(api.linkOverview).toHaveBeenLastCalledWith('c1', '8');
    await links.chooseCourse('');
    expect(api.linkOverview).toHaveBeenLastCalledWith('c1', null);
  });

  it('saves the course and the chosen persons as a plain copy, then reloads', async () => {
    const { api, links } = setup();
    await links.load();
    api.linkOverview.mockResolvedValue(ok(overview({ courseConfirmed: true })));

    const saved = await links.save();

    expect(saved).toBe(true);
    expect(api.saveLinks).toHaveBeenCalledWith({ courseId: 'c1', jideCourseId: '7', links: [{ studentId: 's1', jideStudentId: '11' }] });
    expect(() => structuredClone(api.saveLinks.mock.calls[0]?.[0])).not.toThrow();
    expect(links.confirmed.value).toBe(true);
    expect(links.message.value).toBe('Verknüpfung gespeichert.');
  });

  it('does not save without a J;DE course', async () => {
    const { api, links } = setup();
    api.linkOverview.mockResolvedValue(ok(overview({ jideCourseId: null, students: [] })));
    await links.load();
    expect(await links.save()).toBe(false);
    expect(links.error.value).toBe('Bitte einen J;DE-Kurs wählen.');
    expect(api.saveLinks).not.toHaveBeenCalled();
  });

  it('does not save one J;DE person for two students', async () => {
    const { api, links } = setup();
    api.linkOverview.mockResolvedValue(
      ok(
        overview({
          students: [
            { studentId: 's1', firstName: 'Max', lastName: 'Mustermann', jideStudentId: '11', suggestedJideStudentId: null },
            { studentId: 's2', firstName: 'Anna', lastName: 'Bauer', jideStudentId: '11', suggestedJideStudentId: null },
          ],
        }),
      ),
    );
    await links.load();
    expect(await links.save()).toBe(false);
    expect(links.error.value).toContain('Bauer Anna, Mustermann Max');
    expect(api.saveLinks).not.toHaveBeenCalled();
  });

  it('reports a rejected save and keeps the rows', async () => {
    const { api, links } = setup();
    await links.load();
    api.saveLinks.mockResolvedValue({ ok: false, error: { name: 'ValidationError', message: 'abgelehnt' } });
    expect(await links.save()).toBe(false);
    expect(links.error.value).toBe('abgelehnt');
    expect(links.rows.value).toHaveLength(1);
  });
});
