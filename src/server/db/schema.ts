import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'student'] }).notNull().default('student'),
  identifier: text('identifier').notNull().unique(), // email for admin, NIS for student
  passwordHash: text('password_hash').notNull(),
  gender: text('gender', { enum: ['L', 'P'] }).notNull().default('L'),
  status: text('status', { enum: ['Aktif', 'Nonaktif'] }).notNull().default('Aktif'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const attendance = sqliteTable('attendance', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  date: text('date').notNull(), // YYYY-MM-DD
  type: text('type').notNull().default('harian'), // harian, dhuha, dzuhur
  status: text('status').notNull(), // Hadir, Sakit, Izin, Alfa, Berjamaah, Munfarid, Berhalangan
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const assignments = sqliteTable('assignments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').notNull().default('tugas'), // 'tugas' or 'materi'
  filePath: text('file_path'),
  dueDate: integer('due_date', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const submissions = sqliteTable('submissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  assignmentId: integer('assignment_id').notNull().references(() => assignments.id),
  userId: integer('user_id').notNull().references(() => users.id),
  filePath: text('file_path').notNull(),
  grade: integer('grade'),
  submittedAt: integer('submitted_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const announcements = sqliteTable('announcements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type', { enum: ['PENTING', 'INFO', 'SELAMAT'] }).notNull().default('INFO'),
  text: text('text').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const agenda = sqliteTable('agenda', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(), // e.g. "15 Okt"
  title: text('title').notNull(),
  type: text('type').notNull().default('Kegiatan'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const quotes = sqliteTable('quotes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  text: text('text').notNull(),
  author: text('author').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const grades = sqliteTable('grades', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  subject: text('subject').notNull().default('Matematika'),
  type: text('type').notNull(), // 'Tugas', 'Ulangan', 'PTS', 'PAS'
  name: text('name').notNull(), // e.g. 'Tugas 1', 'Ulangan Harian 1'
  score: integer('score').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const subjects = sqliteTable('subjects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const classOfficers = sqliteTable('class_officers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  role: text('role').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const schedules = sqliteTable('schedules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  day: text('day').notNull(), // 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
  subject: text('subject').notNull(),
  timeStart: text('time_start').notNull(), // e.g. "07:00"
  timeEnd: text('time_end').notNull(), // e.g. "08:30"
  teacherName: text('teacher_name'), // e.g. "Feri Dwi Hermawan, S.Pd."
  color: text('color').notNull().default('blue'), // e.g. "blue", "emerald", "amber", "rose", "indigo", "violet"
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const behaviorRecords = sqliteTable('behavior_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id),
  type: text('type', { enum: ['positif', 'negatif'] }).notNull().default('positif'),
  points: integer('points').notNull(),
  category: text('category').notNull(), // e.g. 'Kedisiplinan', 'Kerapian', 'Sopan Santun', 'Tanggung Jawab', 'Prestasi'
  description: text('description').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const achievements = sqliteTable('achievements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id),
  title: text('title').notNull(), // e.g. 'Juara 1 Lomba Cerdas Cermat'
  level: text('level').notNull(), // e.g. 'Kabupaten', 'Provinsi', 'Nasional'
  rank: text('rank').notNull(), // e.g. 'Juara 1', 'Juara 2', 'Juara 3'
  date: text('date').notNull(), // YYYY-MM-DD
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
