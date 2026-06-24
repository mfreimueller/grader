import http from 'node:http';
import path from 'path';
import { z } from 'zod';
import { McpService } from './mcpService';

const DEFAULT_PORT = 43882;
const HOST = '127.0.0.1';

export class GraderMcpServer {
  private mcpServerInstance: unknown = null;
  private httpServer: http.Server | null = null;
  private transportHandle: unknown = null;
  private readonly mcpService: McpService;
  private _port: number;
  private _running = false;
  private _sessionActive = false;

  constructor(mcpService: McpService, port: number = DEFAULT_PORT) {
    this.mcpService = mcpService;
    this._port = port;
  }

  get running(): boolean {
    return this._running;
  }

  get port(): number {
    return this._port;
  }

  get url(): string | null {
    if (!this._running) return null;
    return `http://${HOST}:${this._port}/mcp`;
  }

  async start(): Promise<void> {
    if (this._running) return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { McpServer } = require(
      path.resolve(__dirname, '../../../node_modules/@modelcontextprotocol/sdk/dist/cjs/server/mcp.js')
    );
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { StreamableHTTPServerTransport } = require(
      path.resolve(__dirname, '../../../node_modules/@modelcontextprotocol/sdk/dist/cjs/server/streamableHttp.js')
    );

    const mcpServer = new McpServer({
      name: 'Grader',
      version: '1.2.0',
    });

    this.registerTools(mcpServer);
    this.mcpServerInstance = mcpServer;

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });
    this.transportHandle = transport;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await mcpServer.connect(transport as any);

    const httpServer = http.createServer(async (req, res) => {
      if (req.method === 'POST') {
        const buffers: Buffer[] = [];
        for await (const chunk of req) {
          buffers.push(chunk);
        }
        const body = Buffer.concat(buffers).toString('utf-8');
        let parsedBody: unknown = undefined;
        try {
          parsedBody = JSON.parse(body);
          const messages = Array.isArray(parsedBody) ? parsedBody : [parsedBody];
          const isInitialize = messages.some(
            m => typeof m === 'object' && m !== null && (m as Record<string, unknown>).method === 'initialize'
          );
          if (isInitialize && this._sessionActive && this.mcpServerInstance) {
            // New client re-initializing — close the old transport and create a fresh one
            // so the SDK accepts the new initialize request.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (this.mcpServerInstance as any).close();
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { StreamableHTTPServerTransport } = require(
              path.resolve(__dirname, '../../../node_modules/@modelcontextprotocol/sdk/dist/cjs/server/streamableHttp.js')
            );
            const newTransport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => crypto.randomUUID(),
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (this.mcpServerInstance as any).connect(newTransport);
            this.transportHandle = newTransport;
          }
        } catch {
          // let transport handle invalid body
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (this.transportHandle as any).handleRequest(req, res, parsedBody);
        if (!this._sessionActive) {
          this._sessionActive = true;
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (this.transportHandle as any).handleRequest(req, res);
      }
    });

    return new Promise<void>((resolve, reject) => {
      httpServer.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          this._port++;
          httpServer.listen(this._port, HOST);
        } else {
          reject(err);
        }
      });

      httpServer.listen(this._port, HOST, () => {
        this.httpServer = httpServer;
        this._running = true;
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this._running = false;
    if (this.transportHandle) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.transportHandle as any).close();
      this.transportHandle = null;
    }
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }
    this.mcpServerInstance = null;
    this._sessionActive = false;
  }

  private registerTools(mcpServer: {
    registerTool(name: string, config: Record<string, unknown>, cb: (args: Record<string, unknown>) => Promise<{
      content: { type: 'text'; text: string }[];
      isError?: boolean;
    }>): void;
  }): void {
    mcpServer.registerTool(
      'list_classes',
      {
        description: 'Listet alle Klassen mit Schuljahr auf',
      },
      async () => {
        const classes = await this.mcpService.listClasses();
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(classes, null, 2) }],
        };
      },
    );

    mcpServer.registerTool(
      'list_students_by_class',
      {
        description: 'Listet alle Schüler einer Klasse auf',
        inputSchema: z.object({
          classId: z.string().describe('ID der Klasse'),
        }),
      },
      async (args: Record<string, unknown>) => {
        const students = await this.mcpService.listStudentsByClass(String(args.classId));
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(students, null, 2) }],
        };
      },
    );

    mcpServer.registerTool(
      'list_courses_by_class',
      {
        description: 'Listet alle Kurse einer Klasse auf',
        inputSchema: z.object({
          classId: z.string().describe('ID der Klasse'),
        }),
      },
      async (args: Record<string, unknown>) => {
        const courses = await this.mcpService.listCoursesByClass(String(args.classId));
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(courses, null, 2) }],
        };
      },
    );

    mcpServer.registerTool(
      'get_student_gradings',
      {
        description: 'Ruft die Benotungsdetails eines Schülers ab (optional gefiltert nach Kurs)',
        inputSchema: z.object({
          studentId: z.string().describe('ID des Schülers'),
          courseId: z.string().optional().describe('ID des Kurses (optional)'),
        }),
      },
      async (args: Record<string, unknown>) => {
        const result = await this.mcpService.getStudentGradings(
          String(args.studentId),
          args.courseId ? String(args.courseId) : undefined,
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      },
    );

    mcpServer.registerTool(
      'get_grading_formula',
      {
        description: 'Ruft die Notenformel eines Kurses ab (Kategorien, Gewichtung, Algorithmus)',
        inputSchema: z.object({
          courseId: z.string().describe('ID des Kurses'),
        }),
      },
      async (args: Record<string, unknown>) => {
        const result = await this.mcpService.getGradingFormula(String(args.courseId));
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      },
    );

    mcpServer.registerTool(
      'get_course_summary',
      {
        description: 'Ruft eine Übersicht aller Schüler eines Kurses mit berechneten Noten ab',
        inputSchema: z.object({
          courseId: z.string().describe('ID des Kurses'),
        }),
      },
      async (args: Record<string, unknown>) => {
        const result = await this.mcpService.getCourseSummary(String(args.courseId));
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      },
    );
  }
}
