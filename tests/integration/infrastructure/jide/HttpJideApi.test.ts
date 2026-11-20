import { JideApiError } from '../../../../src/domain/jide/JideApi';
import { HttpJideApi } from '../../../../src/infrastructure/jide/HttpJideApi';
import { FakeJideServer, PACKAGE_ZIP } from './FakeJideServer';

describe('HttpJideApi', () => {
  const server = new FakeJideServer();
  const api = (key = FakeJideServer.KEY): HttpJideApi => new HttpJideApi(server.url, key);

  beforeAll(() => server.start());
  afterAll(() => server.stop());
  beforeEach(() => {
    server.requests.length = 0;
    server.override = () => undefined;
  });

  it('lists courses with their students and turns numeric ids into strings', async () => {
    const result = await api().listCourses();
    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: '7',
          subject: 'Programmieren',
          className: '3AHIF',
          students: [
            { id: '11', name: 'Max Mustermann' },
            { id: '12', name: 'Anna Bauer' },
          ],
        },
      ],
    });
    expect(server.requests[0]?.authorization).toBe(`Bearer ${FakeJideServer.KEY}`);
  });

  it('lists the exercises of a course', async () => {
    const result = await api().listExercises('7');
    expect(result.ok && result.value).toEqual([
      { id: '3', slug: 'summe', title: 'Summe zweier Zahlen', difficulty: 'newbie', unlockedAt: '2026-11-01T08:00:00Z', deadline: null },
      { id: '4', slug: 'fakultaet', title: 'Fakultät berechnen', difficulty: null, unlockedAt: null, deadline: null },
    ]);
  });

  it('downloads the package as bytes', async () => {
    const result = await api().fetchPackage('3');
    expect(result.ok && Buffer.from(result.value).equals(PACKAGE_ZIP)).toBe(true);
  });

  it('lists the latest hand-ins with their files', async () => {
    const result = await api().listHandins('7', '3');
    expect(result.ok && result.value).toEqual([
      {
        handinId: '501',
        studentId: '11',
        submittedAt: '2026-11-10T09:00:00Z',
        late: false,
        testsPassed: 2,
        testsTotal: 3,
        graded: false,
        files: [{ path: 'Summe.java', content: 'class Summe {\n}\n' }],
      },
    ]);
  });

  it('puts a grade with symbol, comment and line comments', async () => {
    const grade = { symbol: 'PLUS', comment: 'Gut gemacht.', lineComments: [{ path: 'Summe.java', line: 1, text: 'Schön.' }] };
    const result = await api().putGrade('501', grade);
    expect(result).toEqual({ ok: true, value: { gradedAt: '2026-11-20T10:00:00Z' } });
    expect(server.requests[0]).toMatchObject({ method: 'PUT', path: '/api/v1/handins/501/grade', body: grade });
  });

  it('encodes ids in the path', async () => {
    await api().listExercises('a/b');
    expect(server.requests[0]?.path).toBe('/api/v1/courses/a%2Fb/exercises');
  });

  it('reports a rejected key with the status and the server message', async () => {
    const result = await api('jide_wrong').listCourses();
    expect(result.ok).toBe(false);
    const error = !result.ok ? (result.error as JideApiError) : null;
    expect(error).toBeInstanceOf(JideApiError);
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHORIZED', message: 'Ungültiger API-Schlüssel.' });
  });

  it('recognises NEWER_HANDIN', async () => {
    server.override = (r) =>
      r.method === 'PUT' ? { status: 409, body: { error: 'NEWER_HANDIN', message: 'Es gibt eine neuere Abgabe.' } } : undefined;
    const result = await api().putGrade('501', { symbol: 'WELLE', comment: '', lineComments: [] });
    expect(!result.ok && result.error.isNewerHandin).toBe(true);
  });

  it('does not treat another 409 as NEWER_HANDIN', async () => {
    server.override = () => ({ status: 409, body: { error: 'GRADED', message: 'Bereits bewertet.' } });
    const result = await api().putGrade('501', { symbol: 'WELLE', comment: '', lineComments: [] });
    expect(!result.ok && result.error.isNewerHandin).toBe(false);
  });

  it('uses its own message when the error body is not the usual one', async () => {
    server.override = () => ({ status: 500 });
    const result = await api().listCourses();
    expect(!result.ok && result.error).toMatchObject({ status: 500, message: 'J;DE hat mit dem Fehler 500 geantwortet.' });
  });

  it('rejects an answer of the wrong shape', async () => {
    server.override = () => ({ status: 200, body: { not: 'a list' } });
    const result = await api().listCourses();
    expect(!result.ok && result.error.message).toBe('J;DE hat eine unerwartete Antwort geschickt.');
  });

  it('reports an unreachable server without the key or the address', async () => {
    const result = await new HttpJideApi('http://127.0.0.1:1', FakeJideServer.KEY).listCourses();
    expect(!result.ok && result.error).toMatchObject({ status: 0, message: 'J;DE ist nicht erreichbar.' });
    expect(JSON.stringify(!result.ok && result.error.message)).not.toContain('jide_');
  });
});
