export const IPC = {
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

  FINDING_ADD: 'finding:add',
  FINDING_REMOVE: 'finding:remove',
  FINDING_GET: 'finding:getFindings',

  GRADE_IMPORT_CSV: 'grade:importCsv',

  REPORT_GENERATE: 'report:generate',

  SHOW_SETTINGS: 'show-settings',
  SETTINGS_GET_DB_PATH: 'settings:getDbPath',
  SETTINGS_PICK_DB_PATH: 'settings:pickDbPath',
  SETTINGS_SAVE_DB_PATH: 'settings:saveDbPath',
  SETTINGS_RESTART_APP: 'settings:restartApp',

  BIN_LIST: 'bin:list',
  BIN_RESTORE: 'bin:restore',
  BIN_HARD_DELETE: 'bin:hardDelete',
  BIN_EMPTY: 'bin:empty',
} as const;
