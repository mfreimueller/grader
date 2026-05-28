import { contextBridge, ipcRenderer } from 'electron';
import type { IpcApi } from '../shared/types';
import { IPC } from '../shared/ipc-channels';

const api: IpcApi = {
  student: {
    list: () => ipcRenderer.invoke(IPC.STUDENT_LIST),
    create: (data) => ipcRenderer.invoke(IPC.STUDENT_CREATE, data),
    update: (id, data) => ipcRenderer.invoke(IPC.STUDENT_UPDATE, id, data),
    delete: (id) => ipcRenderer.invoke(IPC.STUDENT_DELETE, id),
  },
  class: {
    list: () => ipcRenderer.invoke(IPC.CLASS_LIST),
    create: (data) => ipcRenderer.invoke(IPC.CLASS_CREATE, data),
    update: (id, data) => ipcRenderer.invoke(IPC.CLASS_UPDATE, id, data),
    delete: (id) => ipcRenderer.invoke(IPC.CLASS_DELETE, id),
  },
  course: {
    list: (params) => ipcRenderer.invoke(IPC.COURSE_LIST, params),
    create: (data) => ipcRenderer.invoke(IPC.COURSE_CREATE, data),
    clone: (id, targetClassId) => ipcRenderer.invoke(IPC.COURSE_CLONE, id, targetClassId),
    update: (id, data) => ipcRenderer.invoke(IPC.COURSE_UPDATE, id, data),
    delete: (id) => ipcRenderer.invoke(IPC.COURSE_DELETE, id),
  },
  assessmentCategory: {
    listByCourse: (courseId) => ipcRenderer.invoke(IPC.ASSESSMENT_CATEGORY_LIST_BY_COURSE, courseId),
    create: (data) => ipcRenderer.invoke(IPC.ASSESSMENT_CATEGORY_CREATE, data),
    update: (id, data) => ipcRenderer.invoke(IPC.ASSESSMENT_CATEGORY_UPDATE, id, data),
    delete: (id) => ipcRenderer.invoke(IPC.ASSESSMENT_CATEGORY_DELETE, id),
  },
  session: {
    listByCourse: (courseId) => ipcRenderer.invoke(IPC.SESSION_LIST_BY_COURSE, courseId),
    create: (data) => ipcRenderer.invoke(IPC.SESSION_CREATE, data),
    delete: (id) => ipcRenderer.invoke(IPC.SESSION_DELETE, id),
  },
  assessment: {
    listBySession: (sessionId) => ipcRenderer.invoke(IPC.ASSESSMENT_LIST_BY_SESSION, sessionId),
    create: (data) => ipcRenderer.invoke(IPC.ASSESSMENT_CREATE, data),
    createImpromptu: (data) => ipcRenderer.invoke(IPC.ASSESSMENT_CREATE_IMPROMPTU, data),
    delete: (id) => ipcRenderer.invoke(IPC.ASSESSMENT_DELETE, id),
  },
  grade: {
    recordPerformance: (data) => ipcRenderer.invoke(IPC.GRADE_RECORD_PERFORMANCE, data),
    getPerformancesByAssessment: (assessmentId) => ipcRenderer.invoke(IPC.GRADE_GET_PERFORMANCES_BY_ASSESSMENT, assessmentId),
    listByStudent: (studentId) => ipcRenderer.invoke(IPC.GRADE_LIST_BY_STUDENT, studentId),
    calculateFinal: (courseId, studentId) => ipcRenderer.invoke(IPC.GRADE_CALCULATE_FINAL, courseId, studentId),
    saveManualGrade: (data) => ipcRenderer.invoke(IPC.GRADE_SAVE_MANUAL, data),
    recordImpromptu: (data) => ipcRenderer.invoke(IPC.GRADE_RECORD_IMPROMPTU, data),
  },
  finding: {
    add: (data) => ipcRenderer.invoke(IPC.FINDING_ADD, data),
    remove: (id) => ipcRenderer.invoke(IPC.FINDING_REMOVE, id),
    getFindings: (performanceId) => ipcRenderer.invoke(IPC.FINDING_GET, performanceId),
  },
  report: {
    generate: (courseId, mode) => ipcRenderer.invoke(IPC.REPORT_GENERATE, courseId, mode),
  },
};

contextBridge.exposeInMainWorld('grdr', api);
