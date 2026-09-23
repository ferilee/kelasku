import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'teacher', 'counselor', 'student'] }).notNull().default('student'),
  identifier: text('identifier').notNull().unique(), // email for admin, NIS for student
  passwordHash: text('password_hash').notNull(),
  gender: text('gender', { enum: ['L', 'P'] }).notNull().default('L'),
  status: text('status', { enum: ['Aktif', 'Nonaktif'] }).notNull().default('Aktif'),
  classId: integer('class_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const classes = sqliteTable('classes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  academicYear: text('academic_year').notNull(),
  homeroomTeacherId: integer('homeroom_teacher_id'),
  status: text('status', { enum: ['Aktif', 'Nonaktif'] }).notNull().default('Aktif'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const userRoles = sqliteTable('user_roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  role: text('role', { enum: ['admin', 'homeroom', 'teacher', 'counselor'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const teachingAssignments = sqliteTable('teaching_assignments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  teacherId: integer('teacher_id').notNull().references(() => users.id),
  classId: integer('class_id').notNull().references(() => classes.id),
  subjectId: integer('subject_id').notNull().references(() => subjects.id),
  academicYear: text('academic_year').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const attendance = sqliteTable('attendance', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  date: text('date').notNull(), // YYYY-MM-DD
  type: text('type').notNull().default('harian'), // harian, dhuha, dzuhur
  subject: text('subject'), // required for type: mapel
  status: text('status').notNull(), // Hadir, Sakit, Izin, Alfa, Berjamaah, Munfarid, Berhalangan
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const assignments = sqliteTable('assignments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').notNull().default('tugas'), // 'tugas' or 'materi'
  status: text('status', { enum: ['draft', 'published', 'archived'] }).notNull().default('published'),
  filePath: text('file_path'),
  fileOriginalName: text('file_original_name'),
  fileMimeType: text('file_mime_type'),
  fileSizeBytes: integer('file_size_bytes'),
  dueDate: integer('due_date', { mode: 'timestamp' }),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const assignmentClasses = sqliteTable('assignment_classes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  assignmentId: integer('assignment_id').notNull().references(() => assignments.id),
  classId: integer('class_id').notNull().references(() => classes.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const submissions = sqliteTable('submissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  assignmentId: integer('assignment_id').notNull().references(() => assignments.id),
  userId: integer('user_id').notNull().references(() => users.id),
  filePath: text('file_path').notNull(),
  originalName: text('original_name'),
  mimeType: text('mime_type'),
  sizeBytes: integer('size_bytes'),
  grade: integer('grade'),
  submittedAt: integer('submitted_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const announcements = sqliteTable('announcements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type', { enum: ['PENTING', 'INFO', 'SELAMAT'] }).notNull().default('INFO'),
  text: text('text').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const teachingAnnouncements = sqliteTable('teaching_announcements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  classId: integer('class_id').notNull().references(() => classes.id),
  teacherId: integer('teacher_id').notNull().references(() => users.id),
  subjectId: integer('subject_id').notNull().references(() => subjects.id),
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

export const pageSettings = sqliteTable('page_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const galleryItems = sqliteTable('gallery_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  imageUrl: text('image_url').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
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
  classId: integer('class_id').notNull().references(() => classes.id),
  teacherId: integer('teacher_id').references(() => users.id),
  day: text('day').notNull(), // 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
  subject: text('subject').notNull(),
  timeStart: text('time_start').notNull(), // e.g. "07:00"
  timeEnd: text('time_end').notNull(), // e.g. "08:30"
  teacherName: text('teacher_name'), // e.g. "Feri Dwi Hermawan, S.Pd."
  color: text('color').notNull().default('blue'), // e.g. "blue", "emerald", "amber", "rose", "indigo", "violet"
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const scheduleChangeRequests = sqliteTable('schedule_change_requests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scheduleId: integer('schedule_id').notNull().references(() => schedules.id),
  teacherId: integer('teacher_id').notNull().references(() => users.id),
  classId: integer('class_id').notNull().references(() => classes.id),
  subject: text('subject').notNull(),
  requestedDay: text('requested_day').notNull(),
  requestedTimeStart: text('requested_time_start').notNull(),
  requestedTimeEnd: text('requested_time_end').notNull(),
  reason: text('reason').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  reviewNote: text('review_note'),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const teachingJournals = sqliteTable('teaching_journals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  teacherId: integer('teacher_id').notNull().references(() => users.id),
  classId: integer('class_id').notNull().references(() => classes.id),
  subjectId: integer('subject_id').notNull().references(() => subjects.id),
  scheduleId: integer('schedule_id').references(() => schedules.id),
  date: text('date').notNull(),
  timeStart: text('time_start'),
  timeEnd: text('time_end'),
  materialCovered: text('material_covered').notNull(),
  classroomEvents: text('classroom_events'),
  nextPlan: text('next_plan'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const attendanceReminderExceptions = sqliteTable('attendance_reminder_exceptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scheduleId: integer('schedule_id').notNull().references(() => schedules.id),
  teacherId: integer('teacher_id').notNull().references(() => users.id),
  date: text('date').notNull(), // YYYY-MM-DD
  reason: text('reason').notNull(),
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
  subject: text('subject'),
  recordedBy: integer('recorded_by').references(() => users.id),
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

export const studentCases = sqliteTable('student_cases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id),
  classId: integer('class_id').notNull().references(() => classes.id),
  title: text('title').notNull(),
  category: text('category').notNull(),
  priority: text('priority', { enum: ['rendah', 'sedang', 'tinggi', 'mendesak'] }).notNull().default('sedang'),
  status: text('status', { enum: ['terbuka', 'ditangani', 'selesai'] }).notNull().default('terbuka'),
  summary: text('summary').notNull(),
  visibility: text('visibility', { enum: ['ringkasan', 'sensitif'] }).notNull().default('ringkasan'),
  ownerId: integer('owner_id').notNull().references(() => users.id),
  dueDate: text('due_date'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  closedAt: integer('closed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const caseUpdates = sqliteTable('case_updates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  caseId: integer('case_id').notNull().references(() => studentCases.id),
  authorId: integer('author_id').notNull().references(() => users.id),
  note: text('note').notNull(),
  visibility: text('visibility', { enum: ['ringkasan', 'sensitif'] }).notNull().default('ringkasan'),
  nextFollowUpDate: text('next_follow_up_date'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const studentActivitySessions = sqliteTable('student_activity_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id),
  classId: integer('class_id').references(() => classes.id),
  academicYear: text('academic_year'),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  endReason: text('end_reason'),
  activeSeconds: integer('active_seconds').notNull().default(0),
});

export const studentActivityLogs = sqliteTable('student_activity_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => studentActivitySessions.id),
  studentId: integer('student_id').notNull().references(() => users.id),
  action: text('action', { enum: ['login', 'logout', 'page_view', 'material_opened', 'material_downloaded', 'assignment_opened', 'assignment_submitted'] }).notNull(),
  page: text('page'),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  resourceTitle: text('resource_title'),
  metadata: text('metadata'),
  occurredAt: integer('occurred_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const studentLearningProfiles = sqliteTable('student_learning_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id),
  subject: text('subject').notNull(),
  topic: text('topic').notNull(),
  conceptLevel: integer('concept_level').notNull().default(1),
  reasoningLevel: integer('reasoning_level').notNull().default(1),
  literacyLevel: integer('literacy_level').notNull().default(1),
  independenceLevel: integer('independence_level').notNull().default(1),
  strengths: text('strengths'),
  supportNeeds: text('support_needs'),
  updatedBy: integer('updated_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  studentSubjectTopicUnique: uniqueIndex('student_learning_profiles_student_subject_topic').on(table.studentId, table.subject, table.topic),
}));

export const studentLearningObservations = sqliteTable('student_learning_observations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => users.id),
  classId: integer('class_id').notNull().references(() => classes.id),
  subject: text('subject').notNull(),
  topic: text('topic').notNull(),
  category: text('category').notNull(),
  note: text('note').notNull(),
  date: text('date').notNull(),
  recordedBy: integer('recorded_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
