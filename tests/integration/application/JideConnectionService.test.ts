import { JideConnectionService, normaliseBaseUrl } from '../../../src/application/JideConnectionService';
import { JideApiError } from '../../../src/domain/jide/JideApi';
import { Result } from '../../../src/domain/shared/Result';
import { SqliteJideConnectionRepository } from '../../../src/infrastructure/persistence/SqliteJideConnectionRepository';
import { SqliteJideLinkRepository } from '../../../src/infrastructure/persistence/SqliteJideLinkRepository';
import { createJideFixture, errorOf, FakeCipher, FakeJideApi, JideFixture, valueOf } from './jideHarness';

const KEY = 'jide_0123456789abcdef0123456789abcdef';

describe('normaliseBaseUrl', () => {
  it.each([
    ['https://jide.example.at', 'https://jide.example.at'],
    ['  https://jide.example.at/  ', 'https://jide.example.at'],
    ['https://example.at/jide/', 'https://example.at/jide'],
    ['http://localhost:3000', 'http://localhost:3000'],
    ['http://127.0.0.1:8787/', 'http://127.0.0.1:8787'],
  ])('accepts %s', (raw, expected) => {
    expect(valueOf(normaliseBaseUrl(raw))).toBe(expected);
  });

  it.each(['', 'jide.example.at', 'http://jide.example.at', 'ftp://jide.example.at', 'https://u:p@jide.example.at', 'https://jide.example.at/?a=1'])(
    'refuses %p',
    (raw) => {
      expect(normaliseBaseUrl(raw).ok).toBe(false);
    },
  );
});

describe('JideConnectionService', () => {
  let fixture: JideFixture;
  let cipher: FakeCipher;
  let api: FakeJideApi;
  let created: { baseUrl: string; apiKey: string }[];
  let service: JideConnectionService;
  let links: SqliteJideLinkRepository;

  beforeEach(async () => {
    fixture = await createJideFixture();
    cipher = new FakeCipher();
    api = new FakeJideApi();
    created = [];
    links = new SqliteJideLinkRepository(fixture.db);
    service = new JideConnectionService({
      connectionRepo: new SqliteJideConnectionRepository(fixture.db),
      linkRepo: links,
      cipher,
      courseRepo: fixture.courseRepo,
      rosterService: fixture.rosterService,
      createApi: (baseUrl, apiKey) => {
        created.push({ baseUrl, apiKey });
        return api;
      },
      now: () => new Date('2026-11-20T10:00:00Z'),
    });
  });
  afterEach(() => fixture.db.close());

  const configure = async (): Promise<void> => {
    valueOf(await service.saveSettings({ baseUrl: 'https://jide.example.at', apiKey: KEY }));
  };

  describe('settings', () => {
    it('starts empty', async () => {
      expect(await service.getSettings()).toEqual({ baseUrl: '', hasKey: false, encryptionAvailable: true });
    });

    it('stores the address and says that a key exists, without returning the key', async () => {
      const saved = valueOf(await service.saveSettings({ baseUrl: 'https://jide.example.at/', apiKey: KEY }));
      expect(saved).toEqual({ baseUrl: 'https://jide.example.at', hasKey: true, encryptionAvailable: true });
      expect(JSON.stringify(await service.getSettings())).not.toContain('jide_');
    });

    it('stores the key encrypted', async () => {
      await configure();
      const row = fixture.db.prepare('SELECT api_key FROM jide_connection').get() as { api_key: Buffer };
      expect(row.api_key.toString('utf8')).not.toContain(KEY);
      expect(valueOf(await service.api())).toBe(api);
      expect(created).toEqual([{ baseUrl: 'https://jide.example.at', apiKey: KEY }]);
    });

    it('keeps the stored key when only the address changes', async () => {
      await configure();
      valueOf(await service.saveSettings({ baseUrl: 'https://neu.example.at', apiKey: '' }));
      valueOf(await service.api());
      expect(created).toEqual([{ baseUrl: 'https://neu.example.at', apiKey: KEY }]);
    });

    it('needs a key the first time', async () => {
      expect(errorOf(await service.saveSettings({ baseUrl: 'https://jide.example.at', apiKey: '' })).message).toContain('API-Schlüssel');
    });

    it('refuses a key of the wrong shape and a bad address', async () => {
      expect((await service.saveSettings({ baseUrl: 'https://jide.example.at', apiKey: 'abc' })).ok).toBe(false);
      expect((await service.saveSettings({ baseUrl: 'http://jide.example.at', apiKey: KEY })).ok).toBe(false);
    });

    it('stores nothing without secure storage', async () => {
      cipher.available = false;
      const error = errorOf(await service.saveSettings({ baseUrl: 'https://jide.example.at', apiKey: KEY }));
      expect(error.message).toContain('verschlüsselte Ablage');
      expect((await service.getSettings()).hasKey).toBe(false);
    });

    it('asks for the key again when it cannot be decrypted', async () => {
      await configure();
      cipher.decrypt = () => {
        throw new Error('other machine');
      };
      expect(errorOf(await service.api()).message).toContain('erneut ein');
    });

    it('says so when nothing is configured', async () => {
      expect(errorOf(await service.api()).message).toContain('noch nicht eingerichtet');
    });

    it('clears the connection', async () => {
      await configure();
      await service.clearSettings();
      expect((await service.getSettings()).hasKey).toBe(false);
    });
  });

  describe('test', () => {
    it('counts the courses visible to the key and saves nothing', async () => {
      const result = valueOf(await service.test({ baseUrl: 'https://jide.example.at', apiKey: KEY }));
      expect(result).toEqual({ courseCount: 2 });
      expect(created).toEqual([{ baseUrl: 'https://jide.example.at', apiKey: KEY }]);
      expect((await service.getSettings()).hasKey).toBe(false);
    });

    it('uses the stored key when the form key is empty', async () => {
      await configure();
      valueOf(await service.test({ baseUrl: 'https://jide.example.at', apiKey: '' }));
      expect(created.at(-1)?.apiKey).toBe(KEY);
    });

    it('hands the server error on', async () => {
      api.courses = Result.fail(new JideApiError('J;DE hat den API-Schlüssel nicht akzeptiert.', 401, 'UNAUTHORIZED'));
      expect(errorOf(await service.test({ baseUrl: 'https://jide.example.at', apiKey: KEY }))).toBeInstanceOf(JideApiError);
    });
  });

  describe('linkOverview', () => {
    beforeEach(configure);

    it('proposes the J;DE course of the same class and the students by name', async () => {
      const overview = valueOf(await service.linkOverview('course-1'));
      expect(overview.jideCourseId).toBe('7');
      expect(overview.courseConfirmed).toBe(false);
      expect(overview.jideCourses.map((c) => c.id)).toEqual(['7', '8']);
      expect(overview.students.map((s) => [s.studentId, s.jideStudentId, s.suggestedJideStudentId])).toEqual([
        ['s-anna', null, '12'],
        ['s-max', null, '11'],
        ['s-zoe', null, null],
      ]);
    });

    it('shows the confirmed links and no longer calls the course a proposal', async () => {
      valueOf(await service.saveLinks({ courseId: 'course-1', jideCourseId: '7', links: [{ studentId: 's-max', jideStudentId: '13' }] }));
      const overview = valueOf(await service.linkOverview('course-1'));
      expect(overview.courseConfirmed).toBe(true);
      expect(overview.students.find((s) => s.studentId === 's-max')).toMatchObject({ jideStudentId: '13', suggestedJideStudentId: '11' });
    });

    it('shows another J;DE course when the teacher picks one', async () => {
      const overview = valueOf(await service.linkOverview('course-1', '8'));
      expect(overview.jideCourseId).toBe('8');
      expect(overview.students.find((s) => s.studentId === 's-zoe')?.suggestedJideStudentId).toBe('21');
    });

    it('shows no students without a J;DE course', async () => {
      const overview = valueOf(await service.linkOverview('course-1', null));
      expect(overview.jideCourseId).toBeNull();
      expect(overview.jideStudents).toEqual([]);
    });

    it('does not show a stored student link that is not in the shown course', async () => {
      valueOf(await service.saveLinks({ courseId: 'course-1', jideCourseId: '7', links: [{ studentId: 's-max', jideStudentId: '11' }] }));
      const overview = valueOf(await service.linkOverview('course-1', '8'));
      expect(overview.students.find((s) => s.studentId === 's-max')?.jideStudentId).toBeNull();
    });

    it('fails for an unknown course and for a server error', async () => {
      expect((await service.linkOverview('nope')).ok).toBe(false);
      api.courses = Result.fail(new JideApiError('J;DE ist nicht erreichbar.', 0));
      expect(errorOf(await service.linkOverview('course-1')).message).toBe('J;DE ist nicht erreichbar.');
    });
  });

  describe('saveLinks', () => {
    beforeEach(configure);

    it('stores course and student links for later runs', async () => {
      valueOf(
        await service.saveLinks({
          courseId: 'course-1',
          jideCourseId: '7',
          links: [
            { studentId: 's-max', jideStudentId: '11' },
            { studentId: 's-anna', jideStudentId: '12' },
            { studentId: 's-zoe', jideStudentId: null },
          ],
        }),
      );
      expect(await service.linkedJideCourseId('course-1')).toBe('7');
      expect([...(await service.studentLinksOf(['s-max', 's-anna', 's-zoe']))]).toEqual([
        ['s-max', '11'],
        ['s-anna', '12'],
      ]);
    });

    it('removes the course link', async () => {
      valueOf(await service.saveLinks({ courseId: 'course-1', jideCourseId: '7', links: [] }));
      valueOf(await service.saveLinks({ courseId: 'course-1', jideCourseId: null, links: [] }));
      expect(await service.linkedJideCourseId('course-1')).toBeNull();
    });

    it.each([
      ['an unknown J;DE course', { jideCourseId: '99', links: [] }],
      ['a J;DE person of another course', { jideCourseId: '7', links: [{ studentId: 's-max', jideStudentId: '21' }] }],
      [
        'one J;DE person for two students',
        { jideCourseId: '7', links: [{ studentId: 's-max', jideStudentId: '11' }, { studentId: 's-anna', jideStudentId: '11' }] },
      ],
      ['a student outside the course', { jideCourseId: '7', links: [{ studentId: 's-other', jideStudentId: '11' }] }],
    ])('refuses %s and stores nothing', async (_name, patch) => {
      expect((await service.saveLinks({ courseId: 'course-1', ...patch })).ok).toBe(false);
      expect(await service.linkedJideCourseId('course-1')).toBeNull();
      expect((await service.studentLinksOf(['s-max'])).size).toBe(0);
    });
  });

  describe('exercisesOf', () => {
    beforeEach(configure);

    it('lists the exercises of the linked J;DE course', async () => {
      valueOf(await service.saveLinks({ courseId: 'course-1', jideCourseId: '7', links: [] }));
      expect(valueOf(await service.exercisesOf('course-1'))).toEqual([{ id: '3', slug: 'summe', title: 'Summe' }]);
    });

    it('needs a linked course', async () => {
      expect(errorOf(await service.exercisesOf('course-1')).message).toContain('nicht mit einem J;DE-Kurs verknüpft');
    });
  });
});
