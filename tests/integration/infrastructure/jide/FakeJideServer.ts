import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface RecordedRequest {
  method: string;
  path: string;
  authorization: string | undefined;
  body: unknown;
}

type Handler = (request: RecordedRequest) => { status: number; body?: unknown; raw?: Buffer } | undefined;

/** A fake of the J;DE grading API (J;DE SPEC §5). `override` answers first; undefined falls through to the defaults. */
export class FakeJideServer {
  static readonly KEY = 'jide_0123456789abcdef0123456789abcdef';
  readonly requests: RecordedRequest[] = [];
  override: Handler = () => undefined;
  private server: http.Server | null = null;

  get url(): string {
    return `http://127.0.0.1:${(this.server?.address() as AddressInfo).port}`;
  }

  async start(): Promise<void> {
    this.server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const recorded: RecordedRequest = {
          method: req.method ?? '',
          path: req.url ?? '',
          authorization: req.headers.authorization,
          body: text === '' ? undefined : JSON.parse(text),
        };
        this.requests.push(recorded);
        const answer = this.answer(recorded);
        if (answer.raw) {
          res.writeHead(answer.status, { 'content-type': 'application/zip' });
          res.end(answer.raw);
          return;
        }
        res.writeHead(answer.status, { 'content-type': 'application/json' });
        res.end(answer.body === undefined ? '' : JSON.stringify(answer.body));
      });
    });
    await new Promise<void>((resolve) => this.server?.listen(0, '127.0.0.1', resolve));
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }

  private answer(request: RecordedRequest): { status: number; body?: unknown; raw?: Buffer } {
    if (request.authorization !== `Bearer ${FakeJideServer.KEY}`) {
      return { status: 401, body: { error: 'UNAUTHORIZED', message: 'Ungültiger API-Schlüssel.' } };
    }
    const custom = this.override(request);
    if (custom) return custom;
    const { method, path } = request;
    if (method === 'GET' && path === '/api/v1/courses') {
      return {
        status: 200,
        body: [
          {
            id: 7,
            subject: 'Programmieren',
            className: '3AHIF',
            students: [
              { id: 11, name: 'Max Mustermann' },
              { id: 12, name: 'Anna Bauer' },
            ],
          },
        ],
      };
    }
    if (method === 'GET' && path === '/api/v1/courses/7/exercises') {
      return {
        status: 200,
        body: [
          { id: 3, slug: 'summe', title: 'Summe zweier Zahlen', difficulty: 'newbie', unlockedAt: '2026-11-01T08:00:00Z', deadline: null },
        ],
      };
    }
    if (method === 'GET' && path === '/api/v1/exercises/3/package') return { status: 200, raw: Buffer.from('PK-fake-zip') };
    if (method === 'GET' && path === '/api/v1/courses/7/exercises/3/handins') {
      return {
        status: 200,
        body: [
          {
            handinId: 501,
            studentId: 11,
            submittedAt: '2026-11-10T09:00:00Z',
            late: false,
            testsPassed: 2,
            testsTotal: 3,
            graded: false,
            files: [{ path: 'Summe.java', content: 'class Summe {\n}\n' }],
          },
        ],
      };
    }
    if (method === 'PUT' && path === '/api/v1/handins/501/grade') {
      return { status: 200, body: { gradedAt: '2026-11-20T10:00:00Z' } };
    }
    return { status: 404, body: { error: 'NOT_FOUND', message: 'Nicht gefunden.' } };
  }
}
