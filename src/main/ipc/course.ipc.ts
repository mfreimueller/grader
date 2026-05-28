import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { SchoolClassService } from '../../application/SchoolClassService';
import { CourseService } from '../../application/CourseService';
import { AssessmentCategoryService } from '../../application/AssessmentCategoryService';
import {
  createClassSchema, updateClassSchema, studentIdParam,
  courseListSchema, createCourseSchema,
  updateCourseSchema, createCategorySchema, updateCategorySchema,
} from './schemas';

export function registerCourseHandlers(
  classService: SchoolClassService,
  courseService: CourseService,
  categoryService: AssessmentCategoryService,
): void {
  ipcMain.handle(IPC.CLASS_LIST, async () => {
    return await classService.list();
  });

  ipcMain.handle(IPC.CLASS_CREATE, async (_event, data: unknown) => {
    const input = createClassSchema.parse(data);
    return await classService.create(input);
  });

  ipcMain.handle(IPC.CLASS_UPDATE, async (_event, id: string, data: unknown) => {
    studentIdParam.parse({ id });
    const input = updateClassSchema.parse(data);
    return await classService.update(id, input as Parameters<SchoolClassService['update']>[1]);
  });

  ipcMain.handle(IPC.CLASS_DELETE, async (_event, id: string) => {
    studentIdParam.parse({ id });
    return await classService.delete(id);
  });

  ipcMain.handle(IPC.COURSE_LIST, async (_event, data: unknown) => {
    const { schoolYear } = courseListSchema.parse(data ?? {});
    return await courseService.list(schoolYear);
  });

  ipcMain.handle(IPC.COURSE_CREATE, async (_event, data: unknown) => {
    const input = createCourseSchema.parse(data);
    return await courseService.create(input);
  });

  ipcMain.handle(IPC.COURSE_CLONE, async (_event, id: string, targetClassId: string) => {
    studentIdParam.parse({ id });
    studentIdParam.parse({ id: targetClassId });
    return await courseService.clone(id, targetClassId);
  });

  ipcMain.handle(IPC.COURSE_UPDATE, async (_event, id: string, data: unknown) => {
    studentIdParam.parse({ id });
    const input = updateCourseSchema.parse(data);
    return await courseService.update(id, input as Parameters<CourseService['update']>[1]);
  });

  ipcMain.handle(IPC.COURSE_DELETE, async (_event, id: string) => {
    studentIdParam.parse({ id });
    return await courseService.delete(id);
  });

  ipcMain.handle(IPC.ASSESSMENT_CATEGORY_LIST_BY_COURSE, async (_event, courseId: string) => {
    studentIdParam.parse({ id: courseId });
    return await categoryService.listByCourse(courseId);
  });

  ipcMain.handle(IPC.ASSESSMENT_CATEGORY_CREATE, async (_event, data: unknown) => {
    const input = createCategorySchema.parse(data);
    return await categoryService.create(input);
  });

  ipcMain.handle(IPC.ASSESSMENT_CATEGORY_UPDATE, async (_event, id: string, data: unknown) => {
    studentIdParam.parse({ id });
    const input = updateCategorySchema.parse(data);
    return await categoryService.update(id, input as Parameters<AssessmentCategoryService['update']>[1]);
  });

  ipcMain.handle(IPC.ASSESSMENT_CATEGORY_DELETE, async (_event, id: string) => {
    studentIdParam.parse({ id });
    return await categoryService.delete(id);
  });
}
