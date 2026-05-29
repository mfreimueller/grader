import { ipcMain, dialog } from 'electron';
import { readFileSync } from 'fs';
import { IPC } from '../../shared/ipc-channels';
import { AssessmentService } from '../../application/AssessmentService';
import { GradingService } from '../../application/GradingService';
import { FindingService } from '../../application/FindingService';
import { GradeCalculationAppService } from '../../application/GradeCalculationAppService';
import { ImpromptuAssessmentService } from '../../application/ImpromptuAssessmentService';
import { GradeImportService } from '../../application/GradeImportService';
import {
  createAssessmentSchema, recordPerformanceSchema, saveGradeSchema,
  impromptuSchema, addNoteSchema, addDocumentSchema, addRemoteDocumentSchema,
  studentIdParam,
} from './schemas';

export function registerGradeHandlers(
  assessmentService: AssessmentService,
  gradingService: GradingService,
  findingService: FindingService,
  calcService: GradeCalculationAppService,
  impromptuService: ImpromptuAssessmentService,
  gradeImportService: GradeImportService,
): void {
  ipcMain.handle(IPC.ASSESSMENT_LIST_BY_SESSION, async (_event, sessionId: string) => {
    studentIdParam.parse({ id: sessionId });
    return await assessmentService.listBySession(sessionId);
  });

  ipcMain.handle(IPC.ASSESSMENT_CREATE, async (_event, data: unknown) => {
    const input = createAssessmentSchema.parse(data);
    return await assessmentService.create(input as Parameters<AssessmentService['create']>[0]);
  });

  ipcMain.handle(IPC.ASSESSMENT_CREATE_IMPROMPTU, async (_event, data: unknown) => {
    const input = createAssessmentSchema.parse(data);
    const { sessionId: _sid, ...rest } = input;
    void _sid;
    return await assessmentService.create(rest as Parameters<AssessmentService['create']>[0]);
  });

  ipcMain.handle(IPC.ASSESSMENT_DELETE, async (_event, id: string) => {
    studentIdParam.parse({ id });
    return await assessmentService.delete(id);
  });

  ipcMain.handle(IPC.GRADE_RECORD_PERFORMANCE, async (_event, data: unknown) => {
    const input = recordPerformanceSchema.parse(data);
    return await gradingService.recordPerformance(input as Parameters<GradingService['recordPerformance']>[0]);
  });

  ipcMain.handle(IPC.GRADE_GET_PERFORMANCES_BY_ASSESSMENT, async (_event, assessmentId: string) => {
    studentIdParam.parse({ id: assessmentId });
    return await gradingService.getPerformancesByAssessment(assessmentId);
  });

  ipcMain.handle(IPC.GRADE_LIST_BY_STUDENT, async (_event, studentId: string) => {
    studentIdParam.parse({ id: studentId });
    return await gradingService.getPerformancesByStudent(studentId);
  });

  ipcMain.handle(IPC.GRADE_GET, async (_event, courseId: string, studentId: string) => {
    studentIdParam.parse({ id: courseId });
    studentIdParam.parse({ id: studentId });
    return await gradingService.getGrade(studentId, courseId);
  });

  ipcMain.handle(IPC.GRADE_CALCULATE_FINAL, async (_event, courseId: string, studentId: string) => {
    studentIdParam.parse({ id: courseId });
    studentIdParam.parse({ id: studentId });
    return await calcService.calculate(courseId, studentId);
  });

  ipcMain.handle(IPC.GRADE_SAVE_MANUAL, async (_event, data: unknown) => {
    const input = saveGradeSchema.parse(data);
    return await gradingService.saveManualGrade(input);
  });

  ipcMain.handle(IPC.GRADE_RECORD_IMPROMPTU, async (_event, data: unknown) => {
    const input = impromptuSchema.parse(data);
    return await impromptuService.create(input as Parameters<ImpromptuAssessmentService['create']>[0]);
  });

  ipcMain.handle(IPC.GRADE_IMPORT_CSV, async (_event, courseId: string) => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'CSV', extensions: ['csv'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: true, value: { sessionsCreated: 0, assessmentsCreated: 0, performancesCreated: 0, performancesUpdated: 0, warnings: [] } };
    }
    const content = readFileSync(result.filePaths[0]!, 'utf-8');
    return { ok: true, value: await gradeImportService.importCsv(courseId, content) };
  });

  ipcMain.handle(IPC.FINDING_ADD, async (_event, data: unknown) => {
    const noteInput = addNoteSchema.safeParse(data);
    if (noteInput.success) return await findingService.addNote(noteInput.data);

    const docInput = addDocumentSchema.safeParse(data);
    if (docInput.success) return await findingService.addDocument(docInput.data);

    const remoteInput = addRemoteDocumentSchema.safeParse(data);
    if (remoteInput.success) return await findingService.addRemoteDocument(remoteInput.data);

    throw new Error('Invalid finding input: must match note, document, or remote_document schema');
  });

  ipcMain.handle(IPC.FINDING_REMOVE, async (_event, id: string) => {
    studentIdParam.parse({ id });
    return await findingService.remove(id);
  });

  ipcMain.handle(IPC.FINDING_GET, async (_event, performanceId: string) => {
    studentIdParam.parse({ id: performanceId });
    return await findingService.getFindings(performanceId);
  });
}
