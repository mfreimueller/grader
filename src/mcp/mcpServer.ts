import http from 'node:http';
import { McpService } from './mcpService';

const DEFAULT_PORT = 43882;
const HOST = '127.0.0.1';

type ToolCallback = (args: Record<string, unknown>) => Promise<{
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}>;

interface McpServerHandle {
  registerTool(name: string, config: Record<string, unknown>, cb: ToolCallback): void;
}

export class GraderMcpServer {
  private server: McpServerHandle | null = null;
  private httpServer: http.Server | null = null;
  private transportHandle: unknown = null;
  private readonly mcpService: McpService;
  private _port: number;
  private _running = false;

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

    const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp');
    const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp');

    const mcpServer = new McpServer({
      name: 'Grader',
      version: '1.2.0',
    });

    this.registerTools(mcpServer);
    this.server = mcpServer as unknown as McpServerHandle;

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
        } catch {
          // let transport handle invalid body
        }
        await transport.handleRequest(req, res, parsedBody);
      } else {
        await transport.handleRequest(req, res);
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
      const transport = this.transportHandle as { close(): Promise<void> };
      await transport.close();
      this.transportHandle = null;
    }
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }
    this.server = null;
  }

  private registerTools(mcpServer: McpServerHandle): void {
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
        inputSchema: {
          type: 'object',
          properties: {
            classId: { type: 'string', description: 'ID der Klasse' },
          },
          required: ['classId'],
        },
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
        inputSchema: {
          type: 'object',
          properties: {
            classId: { type: 'string', description: 'ID der Klasse' },
          },
          required: ['classId'],
        },
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
        inputSchema: {
          type: 'object',
          properties: {
            studentId: { type: 'string', description: 'ID des Schülers' },
            courseId: { type: 'string', description: 'ID des Kurses (optional)' },
          },
          required: ['studentId'],
        },
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
        inputSchema: {
          type: 'object',
          properties: {
            courseId: { type: 'string', description: 'ID des Kurses' },
          },
          required: ['courseId'],
        },
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
        inputSchema: {
          type: 'object',
          properties: {
            courseId: { type: 'string', description: 'ID des Kurses' },
          },
          required: ['courseId'],
        },
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
