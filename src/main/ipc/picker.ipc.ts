import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { StudentPickerService } from '../../application/StudentPickerService';
import { MitarbeitPickService } from '../../application/MitarbeitPickService';
import {
  courseIdParam, pickRandomSchema, pickStudentSchema, setPickCountSchema, recordMitarbeitPickSchema,
} from './schemas';

export function registerPickerHandlers(
  pickerService: StudentPickerService,
  mitarbeitPickService: MitarbeitPickService,
): void {
  ipcMain.handle(IPC.PICKER_LIST, async (_event, courseId: string) => {
    courseIdParam.parse({ courseId });
    return await pickerService.list(courseId);
  });

  ipcMain.handle(IPC.PICKER_PICK_RANDOM, async (_event, data: unknown) => {
    const { courseId, fair } = pickRandomSchema.parse(data);
    return await pickerService.pickRandom(courseId, fair);
  });

  ipcMain.handle(IPC.PICKER_PICK_STUDENT, async (_event, data: unknown) => {
    const { courseId, studentId } = pickStudentSchema.parse(data);
    return await pickerService.pickStudent(courseId, studentId);
  });

  ipcMain.handle(IPC.PICKER_SET_COUNT, async (_event, data: unknown) => {
    const { courseId, studentId, count } = setPickCountSchema.parse(data);
    return await pickerService.setPickCount(courseId, studentId, count);
  });

  ipcMain.handle(IPC.PICKER_RESET, async (_event, courseId: string) => {
    courseIdParam.parse({ courseId });
    return await pickerService.reset(courseId);
  });

  ipcMain.handle(IPC.PICKER_RECORD_MITARBEIT, async (_event, data: unknown) => {
    return await mitarbeitPickService.record(recordMitarbeitPickSchema.parse(data));
  });
}
