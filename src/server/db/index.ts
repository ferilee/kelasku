import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema';

const sqlite = new Database(process.env.DATABASE_URL || 'sqlite.db');

// Runtime uses bun:sqlite, while drizzle-kit currently loads better-sqlite3.
// Keep the initial schema here so a fresh production volume can start without
// running a CLI migration that Bun cannot load.
sqlite.run(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    identifier TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    gender TEXT NOT NULL DEFAULT 'L',
    status TEXT NOT NULL DEFAULT 'Aktif',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    homeroom_teacher_id INTEGER REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'Aktif',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    role TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(user_id, role)
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    date TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'harian',
    subject TEXT,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'tugas',
    file_path TEXT,
    due_date INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    file_path TEXT NOT NULL,
    grade INTEGER,
    submitted_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT 'INFO',
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS agenda (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Kegiatan',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    author TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS page_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS gallery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    subject TEXT NOT NULL DEFAULT 'Matematika',
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS teaching_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL REFERENCES users(id),
    class_id INTEGER NOT NULL REFERENCES classes(id),
    subject_id INTEGER NOT NULL REFERENCES subjects(id),
    academic_year TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(teacher_id, class_id, subject_id, academic_year)
  );

  CREATE TABLE IF NOT EXISTS class_officers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    role TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER REFERENCES classes(id),
    day TEXT NOT NULL,
    subject TEXT NOT NULL,
    time_start TEXT NOT NULL,
    time_end TEXT NOT NULL,
    teacher_name TEXT,
    color TEXT NOT NULL DEFAULT 'blue',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS behavior_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL DEFAULT 'positif',
    points INTEGER NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    date TEXT NOT NULL,
    subject TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    level TEXT NOT NULL,
    rank TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS student_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES users(id),
    class_id INTEGER NOT NULL REFERENCES classes(id),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'sedang',
    status TEXT NOT NULL DEFAULT 'terbuka',
    summary TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'ringkasan',
    owner_id INTEGER NOT NULL REFERENCES users(id),
    due_date TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    closed_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS case_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL REFERENCES student_cases(id),
    author_id INTEGER NOT NULL REFERENCES users(id),
    note TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'ringkasan',
    next_follow_up_date TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
`);

function addColumnIfMissing(table: string, column: string, definition: string) {
  const columns = sqlite.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    sqlite.run(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

addColumnIfMissing('users', 'class_id', 'class_id INTEGER REFERENCES classes(id)');
addColumnIfMissing('behavior_records', 'subject', 'subject TEXT');
addColumnIfMissing('behavior_records', 'recorded_by', 'recorded_by INTEGER REFERENCES users(id)');
addColumnIfMissing('attendance', 'subject', 'subject TEXT');
addColumnIfMissing('schedules', 'class_id', 'class_id INTEGER REFERENCES classes(id)');

// Older installations created `assignments` before material types existed and
// required a due date for every item. Rebuild only that legacy table so both
// assignments and downloadable materials can be saved without losing rows.
const assignmentColumns = sqlite.query("PRAGMA table_info('assignments')").all() as Array<{ name: string; notnull: number }>;
const assignmentHasType = assignmentColumns.some((column) => column.name === 'type');
const legacyDueDate = assignmentColumns.find((column) => column.name === 'due_date')?.notnull === 1;
if (!assignmentHasType || legacyDueDate) {
  sqlite.run('PRAGMA foreign_keys = OFF');
  sqlite.run('BEGIN');
  try {
    sqlite.run(`
      CREATE TABLE assignments_migrated (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL DEFAULT 'tugas',
        file_path TEXT,
        due_date INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      )
    `);
    sqlite.run(`
      INSERT INTO assignments_migrated (id, title, description, type, file_path, due_date, created_at)
      SELECT id, title, description, ${assignmentHasType ? 'type' : "'tugas'"}, file_path, due_date, created_at
      FROM assignments
    `);
    sqlite.run('DROP TABLE assignments');
    sqlite.run('ALTER TABLE assignments_migrated RENAME TO assignments');
    sqlite.run('COMMIT');
  } catch (error) {
    sqlite.run('ROLLBACK');
    throw error;
  } finally {
    sqlite.run('PRAGMA foreign_keys = ON');
  }
}

const configuredClassName = (sqlite.query("SELECT value FROM page_settings WHERE key = 'class_name' LIMIT 1").get() as { value?: string } | null)?.value || 'X TKJ A';
const configuredAcademicYear = (sqlite.query("SELECT value FROM page_settings WHERE key = 'academic_year' LIMIT 1").get() as { value?: string } | null)?.value || '2026-2027';
let initialClass = sqlite.query('SELECT id FROM classes ORDER BY id LIMIT 1').get() as { id: number } | null;
if (!initialClass) {
  sqlite.query('INSERT INTO classes (name, academic_year) VALUES (?, ?)').run(configuredClassName, configuredAcademicYear);
  initialClass = sqlite.query('SELECT id FROM classes ORDER BY id LIMIT 1').get() as { id: number } | null;
}
if (initialClass) {
  sqlite.query("UPDATE users SET class_id = ? WHERE role = 'student' AND class_id IS NULL").run(initialClass.id);
  sqlite.query('UPDATE schedules SET class_id = ? WHERE class_id IS NULL').run(initialClass.id);
}
export const db = drizzle(sqlite, { schema });
