import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { createFileDb, runMigrations } from '../src/infrastructure/persistence/db';

// ─── CLI ─────────────────────────────────────────────────────────────────────

const DB_PATH = process.argv[2];

if (!DB_PATH) {
  console.error('Usage: npx tsx scripts/seed.ts <path-to-db>');
  process.exit(1);
}

// ─── Deterministic helpers ───────────────────────────────────────────────────

function numericScore(
  proficiency: number,
  maxPoints: number,
  seed: number,
): number {
  const offset = ((seed * 7 + 13) % 21 - 10) / 100;
  const adjusted = Math.max(0, Math.min(1, proficiency + offset));
  return Math.round(adjusted * maxPoints);
}

function participationSymbol(proficiency: number, seed: number): string {
  const roll = ((seed * 11 + 17) % 100) / 100;
  if (proficiency > 0.8) {
    if (roll < 0.70) return 'PLUS';
    if (roll < 0.95) return 'WELLE';
    return 'MINUS';
  }
  if (proficiency > 0.6) {
    if (roll < 0.30) return 'PLUS';
    if (roll < 0.80) return 'WELLE';
    return 'MINUS';
  }
  if (proficiency > 0.4) {
    if (roll < 0.10) return 'PLUS';
    if (roll < 0.60) return 'WELLE';
    return 'MINUS';
  }
  if (roll < 0.05) return 'PLUS';
  if (roll < 0.35) return 'WELLE';
  return 'MINUS';
}

function proficiencyToGrade(avgPerformance: number): number {
  if (avgPerformance >= 0.85) return 1;
  if (avgPerformance >= 0.65) return 2;
  if (avgPerformance >= 0.45) return 3;
  if (avgPerformance >= 0.25) return 4;
  return 5;
}

// ─── Seed data: students ─────────────────────────────────────────────────────

interface StudentProfile {
  id: string;
  firstName: string;
  lastName: string;
  proficiency: number;
}

const class3BStudents: StudentProfile[] = [
  { id: 'student-lukas-mueller', firstName: 'Lukas', lastName: 'Müller', proficiency: 0.50 },
  { id: 'student-emma-wagner', firstName: 'Emma', lastName: 'Wagner', proficiency: 0.85 },
  { id: 'student-felix-schneider', firstName: 'Felix', lastName: 'Schneider', proficiency: 0.75 },
  { id: 'student-sophia-fischer', firstName: 'Sophia', lastName: 'Fischer', proficiency: 0.65 },
  { id: 'student-jonas-weber', firstName: 'Jonas', lastName: 'Weber', proficiency: 0.40 },
  { id: 'student-anna-hoffmann', firstName: 'Anna', lastName: 'Hoffmann', proficiency: 0.35 },
  { id: 'student-maximilian-becker', firstName: 'Maximilian', lastName: 'Becker', proficiency: 0.90 },
  { id: 'student-lena-richter', firstName: 'Lena', lastName: 'Richter', proficiency: 0.70 },
  { id: 'student-tobias-schaefer', firstName: 'Tobias', lastName: 'Schäfer', proficiency: 0.80 },
  { id: 'student-marie-koch', firstName: 'Marie', lastName: 'Koch', proficiency: 0.95 },
];

const class7CStudents: StudentProfile[] = [
  { id: 'student-leon-bauer', firstName: 'Leon', lastName: 'Bauer', proficiency: 0.85 },
  { id: 'student-hannah-wolf', firstName: 'Hannah', lastName: 'Wolf', proficiency: 0.70 },
  { id: 'student-paul-neumann', firstName: 'Paul', lastName: 'Neumann', proficiency: 0.75 },
  { id: 'student-emily-schwarz', firstName: 'Emily', lastName: 'Schwarz', proficiency: 0.55 },
  { id: 'student-tim-zimmermann', firstName: 'Tim', lastName: 'Zimmermann', proficiency: 0.65 },
  { id: 'student-laura-klein', firstName: 'Laura', lastName: 'Klein', proficiency: 0.45 },
  { id: 'student-niklas-schroeder', firstName: 'Niklas', lastName: 'Schröder', proficiency: 0.80 },
  { id: 'student-johanna-koenig', firstName: 'Johanna', lastName: 'König', proficiency: 0.90 },
  { id: 'student-fabian-lang', firstName: 'Fabian', lastName: 'Lang', proficiency: 0.60 },
  { id: 'student-lea-fuchs', firstName: 'Lea', lastName: 'Fuchs', proficiency: 0.50 },
];

// ─── Setup DB ────────────────────────────────────────────────────────────────

fs.mkdirSync(path.dirname(path.resolve(DB_PATH)), { recursive: true });

if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
}

const db = createFileDb(DB_PATH);
runMigrations(db);

// ─── Prepared statements ─────────────────────────────────────────────────────

const insertClass = db.prepare(
  'INSERT INTO school_classes (id, name, school_year) VALUES (?, ?, ?)',
);
const insertStudent = db.prepare(
  'INSERT INTO students (id, first_name, last_name, school_class_id) VALUES (?, ?, ?, ?)',
);
const insertCourse = db.prepare(
  'INSERT INTO courses (id, title, school_class_id) VALUES (?, ?, ?)',
);
const insertCategory = db.prepare(
  'INSERT INTO assessment_categories (id, title, grading_type, display_as_grade, course_id) VALUES (?, ?, ?, ?, ?)',
);
const insertComposition = db.prepare(
  'INSERT INTO grade_compositions (category_id, course_id, weight) VALUES (?, ?, ?)',
);
const insertSession = db.prepare(
  'INSERT INTO sessions (id, date, notes, course_id) VALUES (?, ?, ?, ?)',
);
const insertSessionStudent = db.prepare(
  'INSERT INTO session_students (session_id, student_id) VALUES (?, ?)',
);
const insertAssessment = db.prepare(
  'INSERT INTO assessments (id, title, category_id, course_id, is_impromptu, max_points, session_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
);
const insertPerformance = db.prepare(
  'INSERT INTO student_performances (id, student_id, assessment_id, score, symbol, type) VALUES (?, ?, ?, ?, ?, ?)',
);
const insertGrade = db.prepare(
  'INSERT INTO grades (id, student_id, course_id, score) VALUES (?, ?, ?, ?)',
);

// ─── Transaction ─────────────────────────────────────────────────────────────

const seedTransaction = db.transaction(() => {
  // 1. School classes
  insertClass.run('class-1a', '1A', '2025/26');
  insertClass.run('class-3b', '3B', '2025/26');
  insertClass.run('class-7c', '7C', '2025/26');

  // 2. Students
  for (const s of class3BStudents) {
    insertStudent.run(s.id, s.firstName, s.lastName, 'class-3b');
  }
  for (const s of class7CStudents) {
    insertStudent.run(s.id, s.firstName, s.lastName, 'class-7c');
  }

  // 3. Courses
  insertCourse.run('course-mathe', 'Mathematik', 'class-3b');
  insertCourse.run('course-englisch', 'Englisch', 'class-3b');
  insertCourse.run('course-deutsch', 'Deutsch', 'class-7c');

  // 4. Assessment categories – Mathematik (3)
  insertCategory.run('cat-mathe-sa', 'Schularbeit', 'NUMERIC', 1, 'course-mathe');
  insertCategory.run('cat-mathe-mi', 'Mitarbeit', 'TERTIARY', 0, 'course-mathe');
  insertCategory.run('cat-mathe-test', 'Test', 'NUMERIC', 1, 'course-mathe');

  // Assessment categories – Englisch (1)
  insertCategory.run('cat-englisch-mi', 'Mitarbeit', 'TERTIARY', 0, 'course-englisch');

  // Assessment categories – Deutsch (2)
  insertCategory.run('cat-deutsch-mi', 'Mitarbeit', 'TERTIARY', 0, 'course-deutsch');
  insertCategory.run('cat-deutsch-sa', 'Schularbeit', 'NUMERIC', 1, 'course-deutsch');

  // 5. Grade compositions
  insertComposition.run('cat-mathe-sa', 'course-mathe', 2);
  insertComposition.run('cat-mathe-mi', 'course-mathe', 1);
  insertComposition.run('cat-mathe-test', 'course-mathe', 1);
  insertComposition.run('cat-englisch-mi', 'course-englisch', 1);
  insertComposition.run('cat-deutsch-mi', 'course-deutsch', 1);
  insertComposition.run('cat-deutsch-sa', 'course-deutsch', 2);

  // 6. Sessions – Mathematik (5)
  const matheSessions = [
    { id: 'ses-mathe-01', date: '2025-10-06', notes: 'Wiederholung Grundrechnungsarten' },
    { id: 'ses-mathe-02', date: '2025-11-03', notes: 'Bruchrechnung' },
    { id: 'ses-mathe-03', date: '2025-12-01', notes: 'Gleichungen' },
    { id: 'ses-mathe-04', date: '2026-01-12', notes: 'Textgleichungen' },
    { id: 'ses-mathe-05', date: '2026-02-02', notes: 'Prozentrechnung' },
  ];
  for (const s of matheSessions) {
    insertSession.run(s.id, s.date, s.notes, 'course-mathe');
    for (const student of class3BStudents) {
      insertSessionStudent.run(s.id, student.id);
    }
  }

  // Sessions – Englisch (3)
  const englischSessions = [
    { id: 'ses-englisch-01', date: '2025-10-10', notes: 'Introductions' },
    { id: 'ses-englisch-02', date: '2025-11-14', notes: 'Present tense' },
    { id: 'ses-englisch-03', date: '2026-01-16', notes: 'Past tense' },
  ];
  for (const s of englischSessions) {
    insertSession.run(s.id, s.date, s.notes, 'course-englisch');
    for (const student of class3BStudents) {
      insertSessionStudent.run(s.id, student.id);
    }
  }

  // Sessions – Deutsch (3)
  const deutschSessions = [
    { id: 'ses-deutsch-01', date: '2025-10-08', notes: 'Rechtschreibung' },
    { id: 'ses-deutsch-02', date: '2025-11-12', notes: 'Aufsatz Vorbereitung' },
    { id: 'ses-deutsch-03', date: '2026-01-14', notes: 'Grammatik' },
  ];
  for (const s of deutschSessions) {
    insertSession.run(s.id, s.date, s.notes, 'course-deutsch');
    for (const student of class7CStudents) {
      insertSessionStudent.run(s.id, student.id);
    }
  }

  // 7. Assessments & performances – Mathematik
  let perfSeed = 0;

  const matheAssessments = [
    { id: 'assess-mathe-sa1', title: 'Schularbeit 1', category: 'cat-mathe-sa', maxPoints: 100, session: 'ses-mathe-01' },
    { id: 'assess-mathe-mi1', title: 'Mitarbeit 1', category: 'cat-mathe-mi', session: 'ses-mathe-01' },
    { id: 'assess-mathe-test1', title: 'Test 1', category: 'cat-mathe-test', maxPoints: 50, session: 'ses-mathe-02' },
    { id: 'assess-mathe-mi2', title: 'Mitarbeit 2', category: 'cat-mathe-mi', session: 'ses-mathe-02' },
    { id: 'assess-mathe-sa2', title: 'Schularbeit 2', category: 'cat-mathe-sa', maxPoints: 100, session: 'ses-mathe-03' },
    { id: 'assess-mathe-mi3', title: 'Mitarbeit 3', category: 'cat-mathe-mi', session: 'ses-mathe-03' },
    { id: 'assess-mathe-test2', title: 'Test 2', category: 'cat-mathe-test', maxPoints: 60, session: 'ses-mathe-04' },
    { id: 'assess-mathe-mi4', title: 'Mitarbeit 4', category: 'cat-mathe-mi', session: 'ses-mathe-04' },
    { id: 'assess-mathe-sa3', title: 'Schularbeit 3', category: 'cat-mathe-sa', maxPoints: 100, session: 'ses-mathe-05' },
    { id: 'assess-mathe-mi5', title: 'Mitarbeit 5', category: 'cat-mathe-mi', session: 'ses-mathe-05' },
  ];

  for (const a of matheAssessments) {
    const isNumeric = a.category === 'cat-mathe-sa' || a.category === 'cat-mathe-test';
    insertAssessment.run(
      a.id,
      a.title,
      a.category,
      'course-mathe',
      a.maxPoints ? 0 : 0,
      a.maxPoints ?? null,
      a.session,
    );

    for (let si = 0; si < class3BStudents.length; si++) {
      const student = class3BStudents[si]!;
      const seed = perfSeed + si;
      const perfId = `perf-${a.id}-${student.id}`;

      if (isNumeric) {
        const score = numericScore(student.proficiency, a.maxPoints!, seed);
        insertPerformance.run(perfId, student.id, a.id, score, null, 'graded');
      } else {
        const symbol = participationSymbol(student.proficiency, seed);
        insertPerformance.run(perfId, student.id, a.id, null, symbol, 'participation');
      }
    }
    perfSeed += class3BStudents.length;
  }

  // 8. Assessments & performances – Englisch
  const englischAssessments = [
    { id: 'assess-englisch-mi1', title: 'Mitarbeit 1', category: 'cat-englisch-mi', session: 'ses-englisch-01' },
    { id: 'assess-englisch-mi2', title: 'Mitarbeit 2', category: 'cat-englisch-mi', session: 'ses-englisch-02' },
    { id: 'assess-englisch-mi3', title: 'Mitarbeit 3', category: 'cat-englisch-mi', session: 'ses-englisch-03' },
  ];

  for (const a of englischAssessments) {
    insertAssessment.run(a.id, a.title, a.category, 'course-englisch', 0, null, a.session);

    for (let si = 0; si < class3BStudents.length; si++) {
      const student = class3BStudents[si]!;
      const seed = perfSeed + si;
      const symbol = participationSymbol(student.proficiency, seed);
      insertPerformance.run(
        `perf-${a.id}-${student.id}`,
        student.id,
        a.id,
        null,
        symbol,
        'participation',
      );
    }
    perfSeed += class3BStudents.length;
  }

  // 9. Assessments & performances – Deutsch
  const deutschAssessments = [
    { id: 'assess-deutsch-mi1', title: 'Mitarbeit 1', category: 'cat-deutsch-mi', session: 'ses-deutsch-01' },
    { id: 'assess-deutsch-sa1', title: 'Schularbeit 1', category: 'cat-deutsch-sa', maxPoints: 80, session: 'ses-deutsch-02' },
    { id: 'assess-deutsch-mi2', title: 'Mitarbeit 2', category: 'cat-deutsch-mi', session: 'ses-deutsch-03' },
  ];

  for (const a of deutschAssessments) {
    const isNumeric = a.category === 'cat-deutsch-sa';
    insertAssessment.run(
      a.id,
      a.title,
      a.category,
      'course-deutsch',
      0,
      a.maxPoints ?? null,
      a.session,
    );

    for (let si = 0; si < class7CStudents.length; si++) {
      const student = class7CStudents[si]!;
      const seed = perfSeed + si;
      const perfId = `perf-${a.id}-${student.id}`;

      if (isNumeric) {
        const score = numericScore(student.proficiency, a.maxPoints!, seed);
        insertPerformance.run(perfId, student.id, a.id, score, null, 'graded');
      } else {
        const symbol = participationSymbol(student.proficiency, seed);
        insertPerformance.run(perfId, student.id, a.id, null, symbol, 'participation');
      }
    }
    perfSeed += class7CStudents.length;
  }

  // 10. Compute and insert grades
  interface CoursePerf {
    courseId: string;
    categoryId: string;
    normalizedScore: number;
    weight: number;
  }

  const studentCourses: Map<string, CoursePerf[]> = new Map();

  function addPerf(studentId: string, courseId: string, categoryId: string, normalized: number, weight: number) {
    const key = `${studentId}|${courseId}`;
    if (!studentCourses.has(key)) studentCourses.set(key, []);
    studentCourses.get(key)!.push({ courseId, categoryId, normalizedScore: normalized, weight });
  }

  function normalizedScoreFromPoints(score: number, maxPoints: number): number {
    if (maxPoints <= 0) return 0;
    return Math.min(1, Math.max(0, score / maxPoints));
  }

  function normalizedFromSymbol(symbol: string): number {
    switch (symbol) {
      case 'PLUS': return 1.0;
      case 'WELLE': return 0.5;
      case 'MINUS': return 0.0;
      default: return 0.5;
    }
  }

  // Mathematik
  for (const a of matheAssessments) {
    const isNumeric = a.category === 'cat-mathe-sa' || a.category === 'cat-mathe-test';
    const weight = a.category === 'cat-mathe-sa' ? 2 : a.category === 'cat-mathe-test' ? 1 : 1;
    const catId = a.category;

    const rows = db.prepare('SELECT * FROM student_performances WHERE assessment_id = ?').all(a.id) as any[];
    for (const row of rows) {
      const norm = isNumeric
        ? normalizedScoreFromPoints(row.score, a.maxPoints!)
        : normalizedFromSymbol(row.symbol);
      addPerf(row.student_id, 'course-mathe', catId, norm, weight);
    }
  }

  // Englisch
  for (const a of englischAssessments) {
    const rows = db.prepare('SELECT * FROM student_performances WHERE assessment_id = ?').all(a.id) as any[];
    for (const row of rows) {
      const norm = normalizedFromSymbol(row.symbol);
      addPerf(row.student_id, 'course-englisch', a.category, norm, 1);
    }
  }

  // Deutsch
  for (const a of deutschAssessments) {
    const isNumeric = a.category === 'cat-deutsch-sa';
    const weight = a.category === 'cat-deutsch-sa' ? 2 : 1;
    const rows = db.prepare('SELECT * FROM student_performances WHERE assessment_id = ?').all(a.id) as any[];
    for (const row of rows) {
      const norm = isNumeric
        ? normalizedScoreFromPoints(row.score, a.maxPoints!)
        : normalizedFromSymbol(row.symbol);
      addPerf(row.student_id, 'course-deutsch', a.category, norm, weight);
    }
  }

  // Compute weighted average per student per course
  const gradeEntries = new Map<string, { studentId: string; courseId: string; avg: number }>();

  for (const [key, perfs] of studentCourses) {
    const [studentId, courseId] = key.split('|') as [string, string];

    const catScores = new Map<string, number[]>();
    const catWeights = new Map<string, number>();
    for (const p of perfs) {
      if (!catScores.has(p.categoryId)) catScores.set(p.categoryId, []);
      catScores.get(p.categoryId)!.push(p.normalizedScore);
      catWeights.set(p.categoryId, p.weight);
    }

    let totalWeighted = 0;
    let totalWeight = 0;
    for (const [catId, scores] of catScores) {
      const catAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const weight = catWeights.get(catId) ?? 1;
      totalWeighted += catAvg * weight;
      totalWeight += weight;
    }

    const overallAvg = totalWeight > 0 ? totalWeighted / totalWeight : 0;
    gradeEntries.set(key, { studentId, courseId, avg: overallAvg });
  }

  for (const entry of gradeEntries.values()) {
    const gradeScore = proficiencyToGrade(entry.avg);
    insertGrade.run(`grade-${entry.studentId}-${entry.courseId}`, entry.studentId, entry.courseId, gradeScore);
  }
});

seedTransaction();

// ─── Summary ─────────────────────────────────────────────────────────────────

const classCount = db.prepare('SELECT COUNT(*) as c FROM school_classes').get() as { c: number };
const studentCount = db.prepare('SELECT COUNT(*) as c FROM students').get() as { c: number };
const courseCount = db.prepare('SELECT COUNT(*) as c FROM courses').get() as { c: number };
const sessionCount = db.prepare('SELECT COUNT(*) as c FROM sessions').get() as { c: number };
const assessmentCount = db.prepare('SELECT COUNT(*) as c FROM assessments').get() as { c: number };
const perfCount = db.prepare('SELECT COUNT(*) as c FROM student_performances').get() as { c: number };
const gradeCount = db.prepare('SELECT COUNT(*) as c FROM grades').get() as { c: number };

console.log('Seed complete!');
console.log(`  Classes:        ${classCount.c}`);
console.log(`  Students:       ${studentCount.c}`);
console.log(`  Courses:        ${courseCount.c}`);
console.log(`  Sessions:       ${sessionCount.c}`);
console.log(`  Assessments:    ${assessmentCount.c}`);
console.log(`  Performances:   ${perfCount.c}`);
console.log(`  Grades:         ${gradeCount.c}`);
console.log(`  DB file:        ${path.resolve(DB_PATH)}`);

db.close();
