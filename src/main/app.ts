import { app, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import { createMainWindow } from './window';
import { createAppMenu } from './menu';
import { resolveDbPath, ensureDbDirectory } from './config';
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
import { CsvImportService } from '../application/CsvImportService';
import { CourseService } from '../application/CourseService';
import { AssessmentCategoryService } from '../application/AssessmentCategoryService';
import { SessionService } from '../application/SessionService';
import { AssessmentService } from '../application/AssessmentService';
import { GradingService } from '../application/GradingService';
import { FindingService } from '../application/FindingService';
import { GradeCalculationAppService } from '../application/GradeCalculationAppService';
import { ImpromptuAssessmentService } from '../application/ImpromptuAssessmentService';
import { ReportService } from '../application/ReportService';

import { GradeImportService } from '../application/GradeImportService';
import { GradeCalculationService } from '../domain/grade/GradeCalculationService';
import { PdfReportGenerator } from '../infrastructure/pdf/PdfReportGenerator';

import { registerStudentHandlers } from './ipc/student.ipc';
import { registerCourseHandlers } from './ipc/course.ipc';
import { registerSessionHandlers } from './ipc/session.ipc';
import { registerGradeHandlers } from './ipc/grade.ipc';
import { registerReportHandlers } from './ipc/report.ipc';
import { registerSettingsHandlers } from './ipc/settings.ipc';

app.on('ready', () => {
  const dbPath = resolveDbPath();
  ensureDbDirectory(dbPath);
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
  const pdfGenerator = new PdfReportGenerator();

  const studentService = new StudentService(studentRepo, classRepo);
  const csvImportService = new CsvImportService(classRepo, studentRepo);
  const classService = new SchoolClassService(classRepo);
  const courseService = new CourseService(courseRepo, classRepo);
  const categoryService = new AssessmentCategoryService(courseRepo);
  const sessionService = new SessionService(sessionRepo, courseRepo, studentRepo);
  const assessmentService = new AssessmentService(assessmentRepo, sessionRepo, courseRepo);
  const gradingService = new GradingService(gradeRepo, courseRepo, gradeRepo, studentRepo, assessmentRepo, sessionRepo);
  const findingService = new FindingService(findingRepo);
  const calcService = new GradeCalculationAppService(courseRepo, gradeRepo, gradeCalculationService);
  const impromptuService = new ImpromptuAssessmentService(assessmentService, gradingService);
  const reportService = new ReportService(reportRepo, pdfGenerator, calcService);
  const gradeImportService = new GradeImportService(sessionRepo, assessmentRepo, gradeRepo, studentRepo, courseRepo);

  registerStudentHandlers(studentService, csvImportService);
  registerCourseHandlers(classService, courseService, categoryService);
  registerSessionHandlers(sessionService);
  registerGradeHandlers(assessmentService, gradingService, findingService, calcService, impromptuService, gradeImportService);
  registerReportHandlers(reportService);

  const win = createMainWindow();
  registerSettingsHandlers(win);
  createAppMenu(win);
  win.loadFile('build/renderer/index.html');

  autoUpdater.autoDownload = false;

  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Update check failed:', err);
    });

    autoUpdater.on('update-available', (info) => {
      dialog.showMessageBox(win, {
        type: 'info',
        title: 'Update verfügbar',
        message: `Version ${info.version} ist verfügbar. Möchten Sie sie jetzt herunterladen?`,
        buttons: ['Herunterladen', 'Später'],
        defaultId: 0,
        cancelId: 1,
      }).then(({ response }) => {
        if (response === 0) {
          autoUpdater.downloadUpdate().catch((err) => {
            console.error('Download failed:', err);
          });
        }
      });
    });

    autoUpdater.on('update-not-available', () => {
      // silent
    });

    autoUpdater.on('error', (err) => {
      console.error('Auto-updater error:', err);
    });

    autoUpdater.on('download-progress', () => {
      // could show progress in UI later
    });

    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox(win, {
        type: 'info',
        title: 'Update bereit',
        message: 'Das Update wurde heruntergeladen. Die App wird jetzt neu gestartet, um es zu installieren.',
        buttons: ['Jetzt neu starten'],
        defaultId: 0,
      }).then(() => {
        autoUpdater.quitAndInstall();
      });
    });
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
