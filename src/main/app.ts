import { app } from 'electron';
import path from 'node:path';
import { createMainWindow } from './window';
import { createFileDb, runMigrations } from '../infrastructure/persistence/db';

import { SqliteStudentRepository } from '../infrastructure/persistence/SqliteStudentRepository';
import { SqliteSchoolClassRepository } from '../infrastructure/persistence/SqliteSchoolClassRepository';
import { SqliteCourseRepository } from '../infrastructure/persistence/SqliteCourseRepository';
import { SqliteAssessmentRepository } from '../infrastructure/persistence/SqliteAssessmentRepository';
import { SqliteSessionRepository } from '../infrastructure/persistence/SqliteSessionRepository';
import { SqliteFindingRepository } from '../infrastructure/persistence/SqliteFindingRepository';
import { SqliteGradeRepository } from '../infrastructure/persistence/SqliteGradeRepository';
import { SqliteReportRepository } from '../infrastructure/persistence/SqliteReportRepository';

import { StudentService } from '../application/StudentService';
import { SchoolClassService } from '../application/SchoolClassService';
import { CourseService } from '../application/CourseService';
import { AssessmentCategoryService } from '../application/AssessmentCategoryService';
import { SessionService } from '../application/SessionService';
import { AssessmentService } from '../application/AssessmentService';
import { GradingService } from '../application/GradingService';
import { FindingService } from '../application/FindingService';
import { GradeCalculationAppService } from '../application/GradeCalculationAppService';
import { ImpromptuAssessmentService } from '../application/ImpromptuAssessmentService';
import { ReportService } from '../application/ReportService';

import { GradeCalculationService } from '../domain/grade/GradeCalculationService';
import { PdfReportGenerator } from '../infrastructure/pdf/PdfReportGenerator';
import { DataExportService } from '../infrastructure/fs/DataExportService';

import { registerStudentHandlers } from './ipc/student.ipc';
import { registerCourseHandlers } from './ipc/course.ipc';
import { registerSessionHandlers } from './ipc/session.ipc';
import { registerGradeHandlers } from './ipc/grade.ipc';
import { registerReportHandlers } from './ipc/report.ipc';

app.on('ready', () => {
  const dbPath = path.join(app.getPath('userData'), 'grdr.db');
  const db = createFileDb(dbPath);
  runMigrations(db);

  const studentRepo = new SqliteStudentRepository(db);
  const classRepo = new SqliteSchoolClassRepository(db);
  const courseRepo = new SqliteCourseRepository(db);
  const assessmentRepo = new SqliteAssessmentRepository(db);
  const sessionRepo = new SqliteSessionRepository(db);
  const findingRepo = new SqliteFindingRepository(db);
  const gradeRepo = new SqliteGradeRepository(db);
  const reportRepo = new SqliteReportRepository(db);

  const gradeCalculationService = new GradeCalculationService();
  const pdfGenerator = new PdfReportGenerator(reportRepo);
  const dataExport = new DataExportService(reportRepo);

  const studentService = new StudentService(studentRepo, classRepo);
  const classService = new SchoolClassService(classRepo);
  const courseService = new CourseService(courseRepo, classRepo);
  const categoryService = new AssessmentCategoryService(courseRepo);
  const sessionService = new SessionService(sessionRepo, courseRepo, studentRepo);
  const assessmentService = new AssessmentService(assessmentRepo, sessionRepo, courseRepo);
  const gradingService = new GradingService(gradeRepo, courseRepo, gradeRepo, studentRepo, assessmentRepo);
  const findingService = new FindingService(findingRepo);
  const calcService = new GradeCalculationAppService(courseRepo, gradeRepo, gradeCalculationService);
  const impromptuService = new ImpromptuAssessmentService(assessmentService, gradingService);
  const reportService = new ReportService(reportRepo, pdfGenerator, dataExport, calcService);

  registerStudentHandlers(studentService);
  registerCourseHandlers(classService, courseService, categoryService);
  registerSessionHandlers(sessionService);
  registerGradeHandlers(assessmentService, gradingService, findingService, calcService, impromptuService);
  registerReportHandlers(reportService);

  const win = createMainWindow();
  win.loadFile('build/renderer/index.html');
});

app.on('window-all-closed', () => {
  app.quit();
});
