import { contextBridge, ipcRenderer } from 'electron';
import type { IpcApi } from '../shared/types';

const IPC = {
  STUDENT_LIST: 'student:list',
  STUDENT_GET: 'student:get',
  STUDENT_CREATE: 'student:create',
  STUDENT_UPDATE: 'student:update',
  STUDENT_DELETE: 'student:delete',

  CLASS_LIST: 'class:list',
  CLASS_CREATE: 'class:create',
  CLASS_UPDATE: 'class:update',
  CLASS_DELETE: 'class:delete',

  COURSE_LIST: 'course:list',
  COURSE_GET: 'course:get',
  COURSE_CREATE: 'course:create',
  COURSE_CLONE: 'course:clone',
  COURSE_UPDATE: 'course:update',
  COURSE_DELETE: 'course:delete',

  ASSESSMENT_CATEGORY_LIST_BY_COURSE: 'assessmentCategory:listByCourse',
  ASSESSMENT_CATEGORY_CREATE: 'assessmentCategory:create',
  ASSESSMENT_CATEGORY_UPDATE: 'assessmentCategory:update',
  ASSESSMENT_CATEGORY_DELETE: 'assessmentCategory:delete',

  SESSION_LIST_BY_COURSE: 'session:listByCourse',
  SESSION_CREATE: 'session:create',
  SESSION_UPDATE: 'session:update',
  SESSION_DELETE: 'session:delete',

  ASSESSMENT_LIST_BY_SESSION: 'assessment:listBySession',
  ASSESSMENT_CREATE: 'assessment:create',
  ASSESSMENT_CREATE_IMPROMPTU: 'assessment:createImpromptu',
  ASSESSMENT_DELETE: 'assessment:delete',

  GRADE_DELETE_PERFORMANCE: 'grade:deletePerformance',
  GRADE_RECORD_PERFORMANCE: 'grade:recordPerformance',
  GRADE_GET_PERFORMANCES_BY_ASSESSMENT: 'grade:getPerformancesByAssessment',
  GRADE_LIST_BY_STUDENT: 'grade:listByStudent',
  GRADE_GET: 'grade:get',
  GRADE_CALCULATE_FINAL: 'grade:calculateFinal',
  GRADE_SAVE_MANUAL: 'grade:saveManualGrade',
  GRADE_RECORD_IMPROMPTU: 'grade:recordImpromptu',

  STUDENT_IMPORT_CSV: 'student:importCsv',

  GRADE_IMPORT_CSV: 'grade:importCsv',

  REPORT_GENERATE_SINGLE: 'report:generateSingle',

  FINDING_ADD: 'finding:add',
  FINDING_REMOVE: 'finding:remove',
  FINDING_GET: 'finding:getFindings',

  REPORT_GENERATE: 'report:generate',

  SETTINGS_GET_DB_PATH: 'settings:getDbPath',
  SETTINGS_PICK_DB_PATH: 'settings:pickDbPath',
  SETTINGS_SAVE_DB_PATH: 'settings:saveDbPath',
  SETTINGS_RESTART_APP: 'settings:restartApp',
  SHOW_SETTINGS: 'show-settings',
  BIN_LIST: 'bin:list',
  BIN_RESTORE: 'bin:restore',
  BIN_HARD_DELETE: 'bin:hardDelete',
  BIN_EMPTY: 'bin:empty',

  MCP_GET_URL: 'mcp:getUrl',
  MCP_GET_SETTINGS: 'mcp:getSettings',
  MCP_SET_ENABLED: 'mcp:setEnabled',
  MCP_STATUS_CHANGE: 'mcp:statusChange',
} as const;

const api: IpcApi = {
  student: {
    list: (schoolClassId?: string) => ipcRenderer.invoke(IPC.STUDENT_LIST, schoolClassId),
    get: (id) => ipcRenderer.invoke(IPC.STUDENT_GET, id),
    create: (data) => ipcRenderer.invoke(IPC.STUDENT_CREATE, data),
    update: (id, data) => ipcRenderer.invoke(IPC.STUDENT_UPDATE, id, data),
    delete: (id) => ipcRenderer.invoke(IPC.STUDENT_DELETE, id),
    importCsv: (hasHeader) => ipcRenderer.invoke(IPC.STUDENT_IMPORT_CSV, hasHeader),
  },
  class: {
    list: () => ipcRenderer.invoke(IPC.CLASS_LIST),
    create: (data) => ipcRenderer.invoke(IPC.CLASS_CREATE, data),
    update: (id, data) => ipcRenderer.invoke(IPC.CLASS_UPDATE, id, data),
    delete: (id) => ipcRenderer.invoke(IPC.CLASS_DELETE, id),
  },
  course: {
    list: (params) => ipcRenderer.invoke(IPC.COURSE_LIST, params),
    get: (id) => ipcRenderer.invoke(IPC.COURSE_GET, id),
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
    update: (id, data) => ipcRenderer.invoke(IPC.SESSION_UPDATE, id, data),
    delete: (id) => ipcRenderer.invoke(IPC.SESSION_DELETE, id),
  },
  assessment: {
    listBySession: (sessionId) => ipcRenderer.invoke(IPC.ASSESSMENT_LIST_BY_SESSION, sessionId),
    create: (data) => ipcRenderer.invoke(IPC.ASSESSMENT_CREATE, data),
    createImpromptu: (data) => ipcRenderer.invoke(IPC.ASSESSMENT_CREATE_IMPROMPTU, data),
    delete: (id) => ipcRenderer.invoke(IPC.ASSESSMENT_DELETE, id),
  },
  grade: {
    deletePerformance: (performanceId) => ipcRenderer.invoke(IPC.GRADE_DELETE_PERFORMANCE, performanceId),
    recordPerformance: (data) => ipcRenderer.invoke(IPC.GRADE_RECORD_PERFORMANCE, data),
    getPerformancesByAssessment: (assessmentId) => ipcRenderer.invoke(IPC.GRADE_GET_PERFORMANCES_BY_ASSESSMENT, assessmentId),
    listByStudent: (studentId) => ipcRenderer.invoke(IPC.GRADE_LIST_BY_STUDENT, studentId),
    get: (courseId, studentId) => ipcRenderer.invoke(IPC.GRADE_GET, courseId, studentId),
    calculateFinal: (courseId, studentId) => ipcRenderer.invoke(IPC.GRADE_CALCULATE_FINAL, courseId, studentId),
    saveManualGrade: (data) => ipcRenderer.invoke(IPC.GRADE_SAVE_MANUAL, data),
    recordImpromptu: (data) => ipcRenderer.invoke(IPC.GRADE_RECORD_IMPROMPTU, data),
    importCsv: (courseId, hasHeader) => ipcRenderer.invoke(IPC.GRADE_IMPORT_CSV, courseId, hasHeader),
  },
  finding: {
    add: (data) => ipcRenderer.invoke(IPC.FINDING_ADD, data),
    remove: (id) => ipcRenderer.invoke(IPC.FINDING_REMOVE, id),
    getFindings: (performanceId) => ipcRenderer.invoke(IPC.FINDING_GET, performanceId),
  },
  report: {
    generate: (courseId, mode) => ipcRenderer.invoke(IPC.REPORT_GENERATE, courseId, mode),
    generateSingle: (courseId, studentId, mode, format) =>
      ipcRenderer.invoke(IPC.REPORT_GENERATE_SINGLE, courseId, studentId, mode, format),
  },
  settings: {
    getDbPath: () => ipcRenderer.invoke(IPC.SETTINGS_GET_DB_PATH),
    pickDbPath: () => ipcRenderer.invoke(IPC.SETTINGS_PICK_DB_PATH),
    saveDbPath: (path) => ipcRenderer.invoke(IPC.SETTINGS_SAVE_DB_PATH, path),
    restartApp: () => ipcRenderer.invoke(IPC.SETTINGS_RESTART_APP),
    onOpenSettings: (callback) => {
      ipcRenderer.on(IPC.SHOW_SETTINGS, callback);
      return () => ipcRenderer.removeListener(IPC.SHOW_SETTINGS, callback);
    },
  },
  bin: {
    listAll: () => ipcRenderer.invoke(IPC.BIN_LIST),
    restore: (type, id) => ipcRenderer.invoke(IPC.BIN_RESTORE, { type, id }),
    hardDelete: (type, id) => ipcRenderer.invoke(IPC.BIN_HARD_DELETE, { type, id }),
    empty: () => ipcRenderer.invoke(IPC.BIN_EMPTY),
  },
  mcp: {
    getUrl: () => ipcRenderer.invoke(IPC.MCP_GET_URL),
    getSettings: () => ipcRenderer.invoke(IPC.MCP_GET_SETTINGS),
    setEnabled: (enabled) => ipcRenderer.invoke(IPC.MCP_SET_ENABLED, enabled),
    onStatusChange: (callback) => {
      ipcRenderer.on(IPC.MCP_STATUS_CHANGE, (_event, status) => callback(status));
      return () => ipcRenderer.removeAllListeners(IPC.MCP_STATUS_CHANGE);
    },
  },
};

contextBridge.exposeInMainWorld('grdr', api);
