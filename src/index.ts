import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { db } from './server/db';
import { announcements, teachingAnnouncements, agenda, quotes, users, attendance, grades, subjects, classOfficers, assignments, assignmentClasses, submissions, schedules, attendanceReminderExceptions, scheduleChangeRequests, teachingJournals, behaviorRecords, achievements, pageSettings, galleryItems, classes, teachingAssignments, userRoles, studentCases, caseUpdates, studentActivitySessions, studentActivityLogs, studentLearningProfiles, studentLearningObservations, studentLearningCheckpoints } from './server/db/schema';
import { eq, and, like, isNull, inArray, lt } from 'drizzle-orm';
import { deleteObject, getStorageErrorCode, isRustFsReference, MAX_ASSIGNMENT_FILE_SIZE, MAX_SUBMISSION_FILE_SIZE, readObject, storageErrorResponse, uploadPdf } from './server/storage';

const app = new Hono();

type AuthUser = { id: number; name: string; role: 'admin' | 'teacher' | 'counselor' | 'student'; roles: Array<'admin' | 'homeroom' | 'teacher' | 'counselor'> };
type ActivityAction = 'login' | 'logout' | 'page_view' | 'material_opened' | 'material_downloaded' | 'assignment_opened' | 'assignment_submitted';
type ActivitySession = { user: AuthUser; expiresAt: number; activitySessionId?: number };
const activeSessions = new Map<string, ActivitySession>();
const ACTIVITY_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const CLIENT_ACTIVITY_ACTIONS = new Set<ActivityAction>(['page_view', 'material_opened', 'material_downloaded', 'assignment_opened', 'assignment_submitted']);
const JAKARTA_TIME_ZONE = 'Asia/Jakarta';
const REMINDER_GRACE_MS = 15 * 60 * 1000;
const REMINDER_LOOKBACK_DAYS = 7;
const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const TEACHING_DAYS = new Set(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']);

const DEFAULT_OFFICER_DUTIES = [
  { key: 'ketua', label: 'Ketua Kelas', description: 'Memimpin koordinasi kegiatan kelas.\nMenyampaikan informasi dari wali kelas kepada teman-teman.\nMenjaga ketertiban dan menjadi teladan bagi kelas.' },
  { key: 'wakil', label: 'Wakil Ketua Kelas', description: 'Mendampingi ketua kelas dalam menjalankan tugas.\nMenggantikan ketua kelas saat berhalangan.\nMembantu menjaga koordinasi dan ketertiban kelas.' },
  { key: 'sekretaris', label: 'Sekretaris', description: 'Mencatat hasil rapat dan administrasi kelas.\nMembantu pencatatan kehadiran serta informasi kelas.\nMenyimpan dokumen penting kelas dengan rapi.' },
  { key: 'bendahara', label: 'Bendahara', description: 'Mencatat pemasukan dan pengeluaran kas kelas.\nMenyampaikan laporan kas secara terbuka dan berkala.\nMenjaga bukti transaksi serta saldo kas kelas.' },
];

function parseOfficerDuties(value?: string) {
  if (!value) return DEFAULT_OFFICER_DUTIES;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return DEFAULT_OFFICER_DUTIES;
    return DEFAULT_OFFICER_DUTIES.map((defaultDuty) => {
      const saved = parsed.find((item: unknown) => typeof item === 'object' && item !== null && (item as { key?: unknown }).key === defaultDuty.key) as { description?: unknown } | undefined;
      return { ...defaultDuty, description: typeof saved?.description === 'string' && saved.description.trim() ? saved.description.trim() : defaultDuty.description };
    });
  } catch {
    return DEFAULT_OFFICER_DUTIES;
  }
}

function getAuthenticatedUser(c: { req: { raw: Request } }): AuthUser | null {
  const token = getCookie(c as any, 'webkelas_session');
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) activeSessions.delete(token);
    return null;
  }
  return session.user;
}

async function closeStaleActivitySessions() {
  const cutoff = Date.now() - ACTIVITY_IDLE_TIMEOUT_MS;
  const openSessions = await db.select({ id: studentActivitySessions.id, lastSeenAt: studentActivitySessions.lastSeenAt })
    .from(studentActivitySessions)
    .where(isNull(studentActivitySessions.endedAt));
  for (const session of openSessions) {
    if (session.lastSeenAt.getTime() < cutoff) {
      await db.update(studentActivitySessions).set({ endedAt: session.lastSeenAt, endReason: 'idle' }).where(eq(studentActivitySessions.id, session.id));
    }
  }
}

async function purgeOldActivity() {
  const cutoff = new Date(Date.now() - ACTIVITY_RETENTION_MS);
  const oldSessions = await db.select({ id: studentActivitySessions.id }).from(studentActivitySessions).where(lt(studentActivitySessions.startedAt, cutoff));
  const sessionIds = oldSessions.map((session) => session.id);
  if (sessionIds.length) await db.delete(studentActivityLogs).where(inArray(studentActivityLogs.sessionId, sessionIds));
  if (sessionIds.length) await db.delete(studentActivitySessions).where(inArray(studentActivitySessions.id, sessionIds));
}

async function getActivitySession(sessionId: number, studentId: number) {
  const rows = await db.select().from(studentActivitySessions).where(and(
    eq(studentActivitySessions.id, sessionId),
    eq(studentActivitySessions.studentId, studentId),
  )).limit(1);
  return rows[0] || null;
}

async function touchActivitySession(sessionId: number, studentId: number) {
  const session = await getActivitySession(sessionId, studentId);
  if (!session || session.endedAt) return { active: false, session: null };
  const now = new Date();
  const elapsed = now.getTime() - session.lastSeenAt.getTime();
  if (elapsed > ACTIVITY_IDLE_TIMEOUT_MS) {
    await db.update(studentActivitySessions).set({ endedAt: session.lastSeenAt, endReason: 'idle' }).where(eq(studentActivitySessions.id, session.id));
    return { active: false, session };
  }
  const addedSeconds = Math.max(0, Math.floor(elapsed / 1000));
  await db.update(studentActivitySessions).set({ lastSeenAt: now, activeSeconds: session.activeSeconds + addedSeconds }).where(eq(studentActivitySessions.id, session.id));
  return { active: true, session: { ...session, lastSeenAt: now, activeSeconds: session.activeSeconds + addedSeconds } };
}

async function finishActivitySession(sessionId: number, studentId: number, reason: string) {
  const session = await getActivitySession(sessionId, studentId);
  if (!session || session.endedAt) return session;
  const now = new Date();
  const elapsed = now.getTime() - session.lastSeenAt.getTime();
  const isWithinActiveWindow = elapsed <= ACTIVITY_IDLE_TIMEOUT_MS;
  const addedSeconds = isWithinActiveWindow ? Math.max(0, Math.floor(elapsed / 1000)) : 0;
  const endedAt = isWithinActiveWindow ? now : session.lastSeenAt;
  await db.update(studentActivitySessions).set({
    lastSeenAt: isWithinActiveWindow ? now : session.lastSeenAt,
    endedAt,
    endReason: isWithinActiveWindow ? reason : 'idle',
    activeSeconds: session.activeSeconds + addedSeconds,
  }).where(eq(studentActivitySessions.id, session.id));
  return { ...session, lastSeenAt: endedAt, endedAt, activeSeconds: session.activeSeconds + addedSeconds };
}

async function recordActivityEvent(sessionId: number, studentId: number, action: ActivityAction, details: { page?: string; resourceType?: string; resourceId?: string; resourceTitle?: string; metadata?: Record<string, unknown> } = {}) {
  await db.insert(studentActivityLogs).values({
    sessionId,
    studentId,
    action,
    page: details.page,
    resourceType: details.resourceType,
    resourceId: details.resourceId,
    resourceTitle: details.resourceTitle,
    metadata: details.metadata ? JSON.stringify(details.metadata) : null,
  });
}

async function accessibleClassIds(user: AuthUser) {
  if (user.roles.includes('admin')) return null;
  if (user.roles.includes('counselor') || user.role === 'counselor') {
    const rows = await db.select({ id: classes.id }).from(classes).where(eq(classes.status, 'Aktif'));
    return rows.map((item) => item.id);
  }
  if (user.role === 'student') {
    const student = await db.select({ classId: users.classId }).from(users).where(eq(users.id, user.id)).limit(1);
    return student[0]?.classId ? [student[0].classId] : [];
  }
  const [assignmentsForTeacher, homeroomClasses] = await Promise.all([
    db.select({ classId: teachingAssignments.classId }).from(teachingAssignments).where(eq(teachingAssignments.teacherId, user.id)),
    db.select({ id: classes.id }).from(classes).where(eq(classes.homeroomTeacherId, user.id)),
  ]);
  return [...new Set([...assignmentsForTeacher.map((item) => item.classId), ...homeroomClasses.map((item) => item.id)])];
}

const canManageClass = (user: AuthUser) => user.roles.includes('admin') || user.roles.includes('homeroom');
const canManageStudentCases = (user: AuthUser) => canManageClass(user) || user.roles.includes('counselor') || user.role === 'counselor';

async function mayAccessClass(user: AuthUser | null, classId: number) {
  if (!user) return true;
  const ids = await accessibleClassIds(user);
  return ids === null || ids.includes(classId);
}

function parseTargetClassIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))];
}

async function getAssignmentTargetMap(assignmentIds: number[]) {
  const targetMap = new Map<number, Array<{ id: number; name: string; academicYear: string }>>();
  if (!assignmentIds.length) return targetMap;
  const rows = await db.select({
    assignmentId: assignmentClasses.assignmentId,
    id: classes.id,
    name: classes.name,
    academicYear: classes.academicYear,
  }).from(assignmentClasses).innerJoin(classes, eq(assignmentClasses.classId, classes.id)).where(inArray(assignmentClasses.assignmentId, assignmentIds));
  for (const row of rows) {
    const current = targetMap.get(row.assignmentId) || [];
    current.push({ id: row.id, name: row.name, academicYear: row.academicYear });
    targetMap.set(row.assignmentId, current);
  }
  return targetMap;
}

async function serializeAssignments(items: typeof assignments.$inferSelect[]) {
  const targetMap = await getAssignmentTargetMap(items.map((item) => item.id));
  return items.map((item) => {
    const targetClasses = targetMap.get(item.id) || [];
    return {
      ...item,
      targetClassIds: targetClasses.map((target) => target.id),
      targetClasses,
      fileName: assignmentFileName(item),
      fileDownloadUrl: assignmentDownloadUrl(item.id, item.filePath),
    };
  });
}

async function canManageAssignmentTargets(user: AuthUser, targetClassIds: number[]) {
  if (!targetClassIds.length) return false;
  const existingClasses = await db.select({ id: classes.id }).from(classes).where(inArray(classes.id, targetClassIds));
  if (existingClasses.length !== targetClassIds.length) return false;
  return (await Promise.all(targetClassIds.map((classId) => mayAccessClass(user, classId)))).every(Boolean);
}

function submissionDownloadUrl(submissionId: number | null | undefined, filePath: string | null | undefined) {
  if (!submissionId || !filePath || filePath === 'N/A') return null;
  if (isRustFsReference(filePath)) return `/api/submissions/${submissionId}/download`;
  return /^https?:\/\//i.test(filePath) ? filePath : null;
}

function submissionFileName(submission: { originalName?: string | null; filePath?: string | null } | null | undefined) {
  if (!submission?.filePath || submission.filePath === 'N/A') return null;
  if (submission.originalName) return submission.originalName;
  return submission.filePath.split('/').pop() || 'File tugas';
}

function assignmentFileName(assignment: { fileOriginalName?: string | null; filePath?: string | null } | null | undefined) {
  if (!assignment?.filePath) return null;
  return assignment.fileOriginalName || assignment.filePath.split('/').pop() || 'File pendukung';
}

function assignmentDownloadUrl(assignmentId: number | null | undefined, filePath: string | null | undefined) {
  if (!assignmentId || !filePath) return null;
  if (isRustFsReference(filePath)) return `/api/assignments/${assignmentId}/file`;
  return /^https?:\/\//i.test(filePath) ? filePath : null;
}

function storageFailure(c: any, error: unknown) {
  const code = getStorageErrorCode(error);
  return code ? c.json(storageErrorResponse(code), code === 'STORAGE_FORBIDDEN' ? 403 : 503) : null;
}

async function readPdfUpload(value: FormDataEntryValue | null, label: string) {
  if (!(value instanceof File)) throw new Error(`Pilih file PDF ${label}.`);
  if (value.size <= 0 || value.size > MAX_ASSIGNMENT_FILE_SIZE) throw new Error('Ukuran PDF harus lebih dari 0 dan maksimal 10 MB.');
  const originalName = value.name.trim().replace(/[\\/\r\n]/g, '_') || 'materi.pdf';
  if (!originalName.toLowerCase().endsWith('.pdf')) throw new Error('File pendukung harus berformat PDF.');
  if (value.type && !['application/pdf', 'application/octet-stream'].includes(value.type)) throw new Error('Tipe file yang diizinkan hanya PDF.');
  const signature = new TextDecoder().decode(new Uint8Array(await value.slice(0, 4).arrayBuffer()));
  if (signature !== '%PDF') throw new Error('Isi file tidak dikenali sebagai PDF.');
  return { file: value, originalName };
}

async function mayTeachSubject(user: AuthUser, classId: number, subject: string) {
  if (canManageClass(user)) return true;
  if (!user.roles.includes('teacher')) return false;
  const subjectRow = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.name, subject)).limit(1);
  if (!subjectRow[0]) return false;
  const assignment = await db.select({ id: teachingAssignments.id }).from(teachingAssignments).where(and(
    eq(teachingAssignments.teacherId, user.id),
    eq(teachingAssignments.classId, classId),
    eq(teachingAssignments.subjectId, subjectRow[0].id),
  )).limit(1);
  return Boolean(assignment[0]);
}

function normalizeTeacherName(value: string | null | undefined) {
  return (value || '')
    .split(',')[0]
    .replace(/^(bpk|bapak|ibu|dr)\.?\s+/i, '')
    .toLocaleLowerCase('id-ID')
    .replace(/[^a-z0-9]+/g, '');
}

let scheduleSyncPromise: Promise<void> | null = null;

async function syncLegacyScheduleTeacherIds() {
  if (scheduleSyncPromise) return scheduleSyncPromise;
  scheduleSyncPromise = (async () => {
    const [scheduleRows, teacherRows, assignmentRows, subjectRows] = await Promise.all([
      db.select({ id: schedules.id, classId: schedules.classId, subject: schedules.subject, teacherId: schedules.teacherId, teacherName: schedules.teacherName }).from(schedules),
      db.select({ id: users.id, name: users.name }).from(users).where(eq(users.role, 'teacher')),
      db.select({ teacherId: teachingAssignments.teacherId, classId: teachingAssignments.classId, subjectId: teachingAssignments.subjectId }).from(teachingAssignments),
      db.select({ id: subjects.id, name: subjects.name }).from(subjects),
    ]);
    const subjectIdsByName = new Map(subjectRows.map((subject) => [subject.name.trim().toLocaleLowerCase('id-ID'), subject.id]));
    const assignmentKeys = new Set(assignmentRows.map((assignment) => `${assignment.teacherId}|${assignment.classId}|${assignment.subjectId}`));
    for (const schedule of scheduleRows) {
      if (!schedule.classId || !schedule.teacherName) continue;
      const subjectId = subjectIdsByName.get(schedule.subject.trim().toLocaleLowerCase('id-ID'));
      if (!subjectId) continue;
      const matches = teacherRows.filter((teacher) => normalizeTeacherName(teacher.name) === normalizeTeacherName(schedule.teacherName) && assignmentKeys.has(`${teacher.id}|${schedule.classId}|${subjectId}`));
      if (matches.length === 1 && schedule.teacherId !== matches[0].id) {
        await db.update(schedules).set({ teacherId: matches[0].id }).where(eq(schedules.id, schedule.id));
      }
    }
  })().catch((error) => {
    console.error('Gagal menyinkronkan relasi guru pada jadwal lama:', error);
  }).finally(() => {
    scheduleSyncPromise = null;
  });
  return scheduleSyncPromise;
}

function jakartaDateParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return { year: part('year'), month: part('month'), day: part('day') };
}

function jakartaDateString(value = new Date()) {
  const parts = jakartaDateParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addCalendarDays(dateString: string, amount: number) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function dayNameForDate(dateString: string) {
  return DAY_NAMES[new Date(`${dateString}T12:00:00Z`).getUTCDay()];
}

function scheduleEndTimestamp(dateString: string, time: string) {
  if (!/^\d{2}:\d{2}$/.test(time)) return Number.NaN;
  const [hour, minute] = time.split(':').map(Number);
  if (hour > 23 || minute > 59) return Number.NaN;
  return new Date(`${dateString}T${time}:00+07:00`).getTime() + REMINDER_GRACE_MS;
}

type AttendanceReminder = {
  id: string;
  scheduleId: string;
  scheduleIds: string[];
  classId: string;
  className: string;
  subject: string;
  date: string;
  day: string;
  timeStart: string;
  timeEnd: string;
  dueAt: string;
  studentCount: number;
  recordedCount: number;
  status: 'missing' | 'incomplete';
};

async function buildAttendanceReminders(user: AuthUser, requestedClassId?: number) {
  await syncLegacyScheduleTeacherIds();
  const [assignmentRows, scheduleRows, classRows, studentRows, attendanceRows] = await Promise.all([
    db.select({ classId: teachingAssignments.classId, subjectId: teachingAssignments.subjectId })
      .from(teachingAssignments).where(eq(teachingAssignments.teacherId, user.id)),
    db.select().from(schedules).where(eq(schedules.teacherId, user.id)),
    db.select().from(classes),
    db.select({ id: users.id, classId: users.classId, status: users.status })
      .from(users).where(eq(users.role, 'student')),
    db.select({ userId: attendance.userId, date: attendance.date, subject: attendance.subject })
      .from(attendance).where(eq(attendance.type, 'mapel')),
  ]);
  const assignedKeys = new Set(assignmentRows.map((row) => `${row.classId}|${row.subjectId}`));
  const classMap = new Map(classRows.map((row) => [row.id, row]));
  const subjectRows = await db.select({ id: subjects.id, name: subjects.name }).from(subjects);
  const subjectMap = new Map(subjectRows.map((row) => [row.name, row]));
  const activeStudentsByClass = new Map<number, Set<number>>();
  for (const student of studentRows) {
    if (student.status !== 'Aktif' || student.classId === null) continue;
    const ids = activeStudentsByClass.get(student.classId) || new Set<number>();
    ids.add(student.id);
    activeStudentsByClass.set(student.classId, ids);
  }
  const dates = Array.from({ length: REMINDER_LOOKBACK_DAYS + 1 }, (_, index) => addCalendarDays(jakartaDateString(), -index));
  const scheduleIds = scheduleRows.map((row) => row.id);
  const exceptionRows = scheduleIds.length
    ? await db.select().from(attendanceReminderExceptions).where(inArray(attendanceReminderExceptions.scheduleId, scheduleIds))
    : [];
  const exceptionKeys = new Set(exceptionRows.map((row) => `${row.scheduleId}|${row.date}`));
  const now = Date.now();
  const groups = new Map<string, { date: string; classId: number; subject: string; schedules: typeof scheduleRows; endMs: number }>();

  for (const date of dates) {
    const day = dayNameForDate(date);
    for (const schedule of scheduleRows) {
      if (requestedClassId && schedule.classId !== requestedClassId) continue;
      if (!TEACHING_DAYS.has(schedule.day) || schedule.day !== day || !classMap.get(schedule.classId)?.status || classMap.get(schedule.classId)?.status !== 'Aktif') continue;
      const subject = subjectMap.get(schedule.subject);
      if (!subject || !assignedKeys.has(`${schedule.classId}|${subject.id}`)) continue;
      const endMs = scheduleEndTimestamp(date, schedule.timeEnd);
      if (!Number.isFinite(endMs) || endMs > now) continue;
      const key = `${schedule.classId}|${schedule.subject}|${date}`;
      const current = groups.get(key);
      if (current) {
        current.schedules.push(schedule);
        current.endMs = Math.max(current.endMs, endMs);
      } else {
        groups.set(key, { date, classId: schedule.classId, subject: schedule.subject, schedules: [schedule], endMs });
      }
    }
  }

  const reminders: AttendanceReminder[] = [];
  for (const group of groups.values()) {
    const activeStudentIds = activeStudentsByClass.get(group.classId) || new Set<number>();
    if (!activeStudentIds.size || group.schedules.some((schedule) => exceptionKeys.has(`${schedule.id}|${group.date}`))) continue;
    const recordedStudentIds = new Set(attendanceRows
      .filter((record) => record.date === group.date && record.subject === group.subject && activeStudentIds.has(record.userId))
      .map((record) => record.userId));
    if (recordedStudentIds.size >= activeStudentIds.size) continue;
    const latestSchedule = [...group.schedules].sort((a, b) => b.timeEnd.localeCompare(a.timeEnd))[0];
    const earliestSchedule = [...group.schedules].sort((a, b) => a.timeStart.localeCompare(b.timeStart))[0];
    reminders.push({
      id: `${group.classId}|${group.subject}|${group.date}`,
      scheduleId: latestSchedule.id.toString(),
      scheduleIds: group.schedules.map((schedule) => schedule.id.toString()),
      classId: group.classId.toString(),
      className: classMap.get(group.classId)?.name || 'Kelas',
      subject: group.subject,
      date: group.date,
      day: dayNameForDate(group.date),
      timeStart: earliestSchedule.timeStart,
      timeEnd: latestSchedule.timeEnd,
      dueAt: new Date(group.endMs).toISOString(),
      studentCount: activeStudentIds.size,
      recordedCount: recordedStudentIds.size,
      status: recordedStudentIds.size ? 'incomplete' : 'missing',
    });
  }
  return reminders.sort((first, second) => second.date.localeCompare(first.date) || first.timeEnd.localeCompare(second.timeEnd) || first.className.localeCompare(second.className, 'id'));
}

function timeToMinutes(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return Number.NaN;
  const [hour, minute] = value.split(':').map(Number);
  if (hour > 23 || minute > 59) return Number.NaN;
  return hour * 60 + minute;
}

function schedulesOverlap(firstStart: string, firstEnd: string, secondStart: string, secondEnd: string) {
  const startA = timeToMinutes(firstStart), endA = timeToMinutes(firstEnd);
  const startB = timeToMinutes(secondStart), endB = timeToMinutes(secondEnd);
  return Number.isFinite(startA) && Number.isFinite(endA) && Number.isFinite(startB) && Number.isFinite(endB)
    && startA < endA && startB < endB && startA < endB && startB < endA;
}

// Helper to seed data if database is empty
async function seedIfNeeded() {
  try {
    const existingUsers = await db.select().from(users);
    if (existingUsers.length === 0) {
      await db.insert(users).values([
        {
          name: 'Bpk. Ferilee',
          role: 'admin',
          identifier: 'Ferilee',
          passwordHash: 'F3r!-lee',
          gender: 'L',
          status: 'Aktif',
        },
        {
          name: 'Ahmad Fauzi',
          role: 'student',
          identifier: '10029381',
          passwordHash: '123456',
          gender: 'L',
          status: 'Aktif',
        },
        {
          name: 'Citra Kirana',
          role: 'student',
          identifier: '10029382',
          passwordHash: '123456',
          gender: 'P',
          status: 'Aktif',
        },
        {
          name: 'Budi Santoso',
          role: 'student',
          identifier: '10029383',
          passwordHash: '123456',
          gender: 'L',
          status: 'Aktif',
        },
        {
          name: 'Dewi Lestari',
          role: 'student',
          identifier: '10029384',
          passwordHash: '123456',
          gender: 'P',
          status: 'Aktif',
        },
      ]);
    }

    const existingAnn = await db.select().from(announcements);
    if (existingAnn.length === 0) {
      await db.insert(announcements).values([
        { type: 'PENTING', text: 'Batas pengumpulan Tugas Akhir Fisika adalah hari Jumat, pukul 23:59 WIB.' },
        { type: 'INFO', text: 'Jadwal Olahraga besok, jangan lupa membawa baju ganti dan air minum.' },
        { type: 'SELAMAT', text: 'Kepada Tim Futsal Kelas atas raihan Juara 1 Antar Kelas!' }
      ]);
    }

    const existingAgenda = await db.select().from(agenda);
    if (existingAgenda.length === 0) {
      await db.insert(agenda).values([
        { date: "15 Okt", title: "Ujian Tengah Semester", type: "Ujian" },
        { date: "20 Okt", title: "Tugas Praktikum", type: "Tugas" },
      ]);
    }

    const existingQuotes = await db.select().from(quotes);
    if (existingQuotes.length === 0) {
      await db.insert(quotes).values([
        {
          text: "Pendidikan adalah senjata paling mematikan di dunia, karena dengan pendidikan, Anda dapat mengubah dunia.",
          author: "Nelson Mandela"
        }
      ]);
    }
    const existingSchedules = await db.select().from(schedules);
    const defaultClass = await db.select({ id: classes.id }).from(classes).orderBy(classes.id).limit(1);
    if (existingSchedules.length === 0 && defaultClass[0]) {
      await db.insert(schedules).values([
        { day: 'Senin', subject: 'Upacara & Wali Kelas', timeStart: '07:00', timeEnd: '08:30', teacherName: 'Feri Dwi Hermawan, S.Pd.', color: 'blue' },
        { day: 'Senin', subject: 'Matematika', timeStart: '08:30', timeEnd: '10:00', teacherName: 'Budi Santoso, M.Pd.', color: 'indigo' },
        { day: 'Senin', subject: 'Bahasa Indonesia', timeStart: '10:15', timeEnd: '12:00', teacherName: 'Siti Aminah, S.Pd.', color: 'emerald' },
        { day: 'Selasa', subject: 'Fisika', timeStart: '07:30', timeEnd: '09:30', teacherName: 'Ahmad Fauzi, S.Si.', color: 'amber' },
        { day: 'Selasa', subject: 'Kimia', timeStart: '09:45', timeEnd: '11:45', teacherName: 'Dewi Lestari, S.Pd.', color: 'rose' },
        { day: 'Rabu', subject: 'Pemrograman Web', timeStart: '07:30', timeEnd: '09:30', teacherName: 'Feri Dwi Hermawan, S.Pd.', color: 'violet' },
        { day: 'Rabu', subject: 'Pemrograman Mobile', timeStart: '09:45', timeEnd: '11:45', teacherName: 'Feri Dwi Hermawan, S.Pd.', color: 'indigo' },
        { day: 'Kamis', subject: 'Bahasa Inggris', timeStart: '07:30', timeEnd: '09:30', teacherName: 'Joni, M.Hum.', color: 'blue' },
        { day: 'Kamis', subject: 'PAI / Keagamaan', timeStart: '09:45', timeEnd: '11:45', teacherName: 'Syukur, S.Ag.', color: 'emerald' },
        { day: 'Jumat', subject: 'Olahraga', timeStart: '07:30', timeEnd: '09:00', teacherName: 'Anto, S.Pd.', color: 'rose' },
        { day: 'Jumat', subject: 'Sejarah Indonesia', timeStart: '09:00', timeEnd: '10:30', teacherName: 'Retno, S.Pd.', color: 'amber' },
      ].map((schedule) => ({ ...schedule, classId: defaultClass[0].id })));
    }

    const existingBehavior = await db.select().from(behaviorRecords);
    if (existingBehavior.length === 0) {
      await db.insert(behaviorRecords).values([
        { studentId: 2, type: 'positif', points: 10, category: 'Sopan Santun', description: 'Membantu guru merapikan ruang kelas setelah selesai jam pelajaran.', date: '2026-07-20' },
        { studentId: 2, type: 'negatif', points: 5, category: 'Kedisiplinan', description: 'Terlambat masuk kelas selama 15 menit tanpa alasan.', date: '2026-07-21' },
        { studentId: 3, type: 'positif', points: 15, category: 'Tanggung Jawab', description: 'Menyelesaikan tugas kelompok sebagai ketua kelompok dengan sangat baik.', date: '2026-07-19' },
      ]);
    }

    const existingAchievements = await db.select().from(achievements);
    if (existingAchievements.length === 0) {
      await db.insert(achievements).values([
        { studentId: 2, title: 'Juara 2 Lomba Matematika Tingkat Kota', level: 'Kabupaten', rank: 'Juara 2', date: '2026-07-15', description: 'Memenangkan medali perak dalam olimpiade matematika tingkat kota.' },
        { studentId: 3, title: 'Juara 1 Lomba Pidato Bahasa Inggris', level: 'Provinsi', rank: 'Juara 1', date: '2026-07-10', description: 'Memperoleh predikat pidato terbaik tingkat provinsi.' },
      ]);
    }

    const existingSubjects = await db.select().from(subjects);
    if (existingSubjects.length === 0) {
      await db.insert(subjects).values([
        { name: 'Matematika' }, { name: 'Bahasa Indonesia' }, { name: 'IPA' },
        { name: 'IPS' }, { name: 'Bahasa Inggris' }, { name: 'PABP' }, { name: 'PPKn' },
      ]);
    }

    const existingOfficers = await db.select().from(classOfficers);
    if (existingOfficers.length === 0) {
      await db.insert(classOfficers).values([
        { userId: 2, role: 'Ketua Kelas' },
        { userId: 3, role: 'Wakil Ketua' },
        { userId: 4, role: 'Sekretaris' },
        { userId: 5, role: 'Bendahara' },
      ]);
    }

    const primaryClass = await db.select().from(classes).orderBy(classes.id).limit(1);
    if (primaryClass[0]) {
      await db.update(users)
        .set({ classId: primaryClass[0].id })
        .where(and(eq(users.role, 'student'), isNull(users.classId)));
    }

    const allAccounts = await db.select({ id: users.id, role: users.role }).from(users);
    for (const account of allAccounts) {
      if (account.role === 'admin') {
        await db.insert(userRoles).values({ userId: account.id, role: 'admin' }).onConflictDoNothing();
        await db.insert(userRoles).values({ userId: account.id, role: 'homeroom' }).onConflictDoNothing();
      }
      if (account.role === 'teacher') {
        await db.insert(userRoles).values({ userId: account.id, role: 'teacher' }).onConflictDoNothing();
      }
      if (account.role === 'counselor') {
        await db.insert(userRoles).values({ userId: account.id, role: 'counselor' }).onConflictDoNothing();
      }
    }
    if (primaryClass[0]) {
      const admin = allAccounts.find((account) => account.role === 'admin');
      if (admin) await db.update(classes).set({ homeroomTeacherId: admin.id }).where(and(eq(classes.id, primaryClass[0].id), isNull(classes.homeroomTeacherId)));
    }

    await syncLegacyScheduleTeacherIds();

  } catch (err) {
    console.error("Database seeding error:", err);
  }
}

// Run seeding
seedIfNeeded();

// API Routes
app.get('/api/hello', (c) => {
  return c.json({ message: 'Hello from WebKelas API' });
});

// Public liveness probe for Docker and the reverse proxy. It deliberately does
// not expose application data or require an authenticated session.
app.get('/api/health', (c) => c.json({ status: 'ok' }));

app.post('/api/auth/login', async (c) => {
  try {
    const body = await c.req.json();
    const identifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const account = await db.select().from(users).where(and(eq(users.identifier, identifier), eq(users.status, 'Aktif'))).limit(1);
    if (!account[0]) return c.json({ error: 'Username atau password salah.' }, 401);
    const storedPassword = account[0].passwordHash;
    const validPassword = storedPassword.startsWith('$')
      ? await Bun.password.verify(password, storedPassword)
      : storedPassword === password;
    if (!validPassword) return c.json({ error: 'Username atau password salah.' }, 401);
    if (!storedPassword.startsWith('$')) {
      await db.update(users).set({ passwordHash: await Bun.password.hash(password) }).where(eq(users.id, account[0].id));
    }
    const user = account[0];
    const token = crypto.randomUUID();
    const roleRows = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.id));
    const roles = [...new Set([
      ...roleRows.map((item) => item.role as AuthUser['roles'][number]),
      ...(user.role === 'counselor' ? ['counselor' as const] : []),
    ])];
    const sessionUser: AuthUser = { id: user.id, name: user.name, role: user.role as AuthUser['role'], roles };
    let activitySessionId: number | undefined;
    if (user.role === 'student') {
      const classRow = user.classId ? await db.select({ academicYear: classes.academicYear }).from(classes).where(eq(classes.id, user.classId)).limit(1) : [];
      const insertedSession = await db.insert(studentActivitySessions).values({
        studentId: user.id,
        classId: user.classId ?? null,
        academicYear: classRow[0]?.academicYear ?? null,
      }).returning({ id: studentActivitySessions.id });
      activitySessionId = insertedSession[0]?.id;
      if (activitySessionId) await recordActivityEvent(activitySessionId, user.id, 'login', { page: 'login' });
    }
    activeSessions.set(token, { user: sessionUser, expiresAt: Date.now() + 1000 * 60 * 60 * 12, activitySessionId });
    setCookie(c, 'webkelas_session', token, { httpOnly: true, sameSite: 'Lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 12 });
    return c.json({ user: sessionUser });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.get('/api/auth/me', (c) => {
  const user = getAuthenticatedUser(c);
  if (!user) return c.json({ error: 'Sesi tidak ditemukan.' }, 401);
  return c.json({ user });
});

app.put('/api/auth/password', async (c) => {
  try {
    const authenticatedUser = getAuthenticatedUser(c);
    if (!authenticatedUser) return c.json({ error: 'Silakan masuk terlebih dahulu.' }, 401);
    const body = await c.req.json();
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    if (!currentPassword || newPassword.length < 6 || newPassword.length > 128) {
      return c.json({ error: 'Password baru harus terdiri dari 6–128 karakter.' }, 400);
    }
    if (currentPassword === newPassword) return c.json({ error: 'Password baru harus berbeda dari password saat ini.' }, 400);
    const account = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, authenticatedUser.id)).limit(1);
    if (!account[0]) return c.json({ error: 'Akun tidak ditemukan.' }, 404);
    const validPassword = account[0].passwordHash.startsWith('$')
      ? await Bun.password.verify(currentPassword, account[0].passwordHash)
      : currentPassword === account[0].passwordHash;
    if (!validPassword) return c.json({ error: 'Password saat ini tidak sesuai.' }, 401);
    await db.update(users).set({ passwordHash: await Bun.password.hash(newPassword) }).where(eq(users.id, authenticatedUser.id));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/auth/logout', async (c) => {
  const token = getCookie(c, 'webkelas_session');
  const session = token ? activeSessions.get(token) : undefined;
  if (session?.activitySessionId && session.user.role === 'student') {
    const finished = await finishActivitySession(session.activitySessionId, session.user.id, 'logout');
    if (finished) await recordActivityEvent(session.activitySessionId, session.user.id, 'logout', { page: 'logout' });
  }
  if (token) activeSessions.delete(token);
  deleteCookie(c, 'webkelas_session', { path: '/' });
  return c.json({ success: true });
});

app.use('/api/*', async (c, next) => {
  if (c.req.method === 'GET' && c.req.path === '/api/class-data') return next();
  const user = getAuthenticatedUser(c);
  if (!user) return c.json({ error: 'Silakan masuk terlebih dahulu.' }, 401);
  const teacherWritePath = (c.req.method === 'POST' && (c.req.path === '/api/grades' || c.req.path === '/api/behavior' || c.req.path === '/api/attendance' || c.req.path === '/api/assignments' || c.req.path === '/api/teaching-announcements' || c.req.path === '/api/schedule-change-requests' || c.req.path === '/api/teaching-journals' || /^\/api\/attendance-reminders\/\d+\/skip$/.test(c.req.path) || /^\/api\/student-learning-profiles\/\d+\/(observations|checkpoints)$/.test(c.req.path))) || (c.req.method === 'PUT' && (c.req.path.startsWith('/api/assignments/') || c.req.path.startsWith('/api/teaching-journals/') || /^\/api\/student-learning-profiles\/\d+$/.test(c.req.path))) || (c.req.method === 'PATCH' && c.req.path.startsWith('/api/schedule-change-requests/')) || (c.req.method === 'DELETE' && (c.req.path.startsWith('/api/behavior/') || c.req.path.startsWith('/api/teaching-announcements/') || c.req.path.startsWith('/api/assignments/') || c.req.path.startsWith('/api/teaching-journals/') || /^\/api\/attendance-reminders\/\d+\/skip$/.test(c.req.path) || /^\/api\/student-learning-(observations|checkpoints)\/\d+$/.test(c.req.path)));
  const studentWritePath = (c.req.method === 'POST' && (c.req.path === '/api/activity/heartbeat' || c.req.path === '/api/activity/events' || /^\/api\/student\/\d+\/submissions$/.test(c.req.path)));
  if (!canManageClass(user) && user.roles.includes('teacher') && c.req.method !== 'GET' && !teacherWritePath && !studentWritePath) {
    return c.json({ error: 'Fitur ini hanya dapat dikelola wali kelas.' }, 403);
  }
  if (user.role === 'student' && c.req.method !== 'GET' && !studentWritePath) return c.json({ error: 'Siswa tidak memiliki akses untuk mengubah data ini.' }, 403);
  return next();
});

app.post('/api/activity/heartbeat', async (c) => {
  const token = getCookie(c as any, 'webkelas_session');
  const authSession = token ? activeSessions.get(token) : undefined;
  if (!authSession || authSession.user.role !== 'student' || !authSession.activitySessionId) {
    return c.json({ active: false });
  }
  const result = await touchActivitySession(authSession.activitySessionId, authSession.user.id);
  return c.json({ active: result.active, lastSeenAt: result.session?.lastSeenAt?.toISOString() || null });
});

app.post('/api/activity/events', async (c) => {
  const token = getCookie(c as any, 'webkelas_session');
  const authSession = token ? activeSessions.get(token) : undefined;
  if (!authSession || authSession.user.role !== 'student' || !authSession.activitySessionId) {
    return c.json({ error: 'Sesi aktivitas siswa tidak ditemukan.' }, 401);
  }
  const body = await c.req.json().catch(() => ({}));
  const action = typeof body.action === 'string' ? body.action as ActivityAction : null;
  if (!action || !CLIENT_ACTIVITY_ACTIONS.has(action)) return c.json({ error: 'Jenis aktivitas tidak valid.' }, 400);
  const session = await touchActivitySession(authSession.activitySessionId, authSession.user.id);
  if (!session.active) return c.json({ error: 'Sesi aktivitas telah berakhir.' }, 409);
  await recordActivityEvent(authSession.activitySessionId, authSession.user.id, action, {
    page: typeof body.page === 'string' ? body.page.slice(0, 100) : undefined,
    resourceType: typeof body.resourceType === 'string' ? body.resourceType.slice(0, 50) : undefined,
    resourceId: typeof body.resourceId === 'string' ? body.resourceId.slice(0, 100) : undefined,
    resourceTitle: typeof body.resourceTitle === 'string' ? body.resourceTitle.slice(0, 200) : undefined,
  });
  return c.json({ success: true });
});

type ActivityReportQuery = { classId?: number; studentId?: number; from?: string; to?: string; action?: ActivityAction };

function parseReportDate(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function buildStudentActivityReport(user: AuthUser, query: ActivityReportQuery) {
  await closeStaleActivitySessions();
  await purgeOldActivity();
  if (query.classId && !(await mayAccessClass(user, query.classId))) return null;

  const permittedClassIds = await accessibleClassIds(user);
  const allStudents = await db.select({ id: users.id, name: users.name, identifier: users.identifier, classId: users.classId, status: users.status })
    .from(users)
    .where(eq(users.role, 'student'));
  const visibleStudents = allStudents.filter((student) => (
    (permittedClassIds === null || (student.classId !== null && permittedClassIds.includes(student.classId))) &&
    (!query.classId || student.classId === query.classId) &&
    (!query.studentId || student.id === query.studentId)
  ));
  if (query.studentId && !visibleStudents.some((student) => student.id === query.studentId)) return null;
  const studentIds = visibleStudents.map((student) => student.id);
  const classRows = await db.select({ id: classes.id, name: classes.name, academicYear: classes.academicYear }).from(classes);
  const allAssignments = await db.select().from(assignments);
  const assignmentTargetMap = await getAssignmentTargetMap(allAssignments.map((item) => item.id));
  const submissionRows = studentIds.length ? await db.select().from(submissions).where(inArray(submissions.userId, studentIds)) : [];
  if (!studentIds.length) {
    return { generatedAt: new Date().toISOString(), from: query.from || null, to: query.to || null, summary: { onlineCount: 0, activeStudentCount: 0, totalActiveSeconds: 0, sessionCount: 0, activityCount: 0 }, students: [], sessions: [], activities: [] };
  }

  const [sessionRows, activityRows] = await Promise.all([
    db.select().from(studentActivitySessions).where(inArray(studentActivitySessions.studentId, studentIds)),
    db.select().from(studentActivityLogs).where(inArray(studentActivityLogs.studentId, studentIds)),
  ]);
  const fromDate = parseReportDate(query.from) || new Date(new Date().setHours(0, 0, 0, 0));
  const toDate = parseReportDate(query.to, true) || new Date();
  const sessions = sessionRows.filter((session) => {
    const endedAt = session.endedAt || new Date();
    return session.startedAt <= toDate && endedAt >= fromDate;
  });
  const activities = activityRows.filter((activity) => activity.occurredAt >= fromDate && activity.occurredAt <= toDate && (!query.action || activity.action === query.action));
  const visibleSessionIds = new Set(sessions.map((session) => session.id));
  const filteredActivities = activities.filter((activity) => visibleSessionIds.has(activity.sessionId));
  const studentMap = new Map(visibleStudents.map((student) => [student.id, student]));
  const classMap = new Map(classRows.map((classRow) => [classRow.id, classRow]));
  const now = Date.now();
  const students = visibleStudents.map((student) => {
    const studentSessions = sessions.filter((session) => session.studentId === student.id);
    const studentActivities = filteredActivities.filter((activity) => activity.studentId === student.id).sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || b.id - a.id);
    const latestSession = [...studentSessions].sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())[0];
    const latestActivity = studentActivities[0];
    return {
      id: student.id.toString(), name: student.name, identifier: student.identifier, status: student.status,
      classId: student.classId?.toString() || null, className: student.classId ? classMap.get(student.classId)?.name || 'Kelas' : 'Belum berkelas',
      online: studentSessions.some((session) => !session.endedAt && now - session.lastSeenAt.getTime() <= ACTIVITY_IDLE_TIMEOUT_MS),
      lastActiveAt: latestSession?.lastSeenAt?.toISOString() || null,
      totalActiveSeconds: studentSessions.reduce((total, session) => total + session.activeSeconds, 0),
      sessionCount: studentSessions.length, activityCount: studentActivities.length,
      latestActivity: latestActivity ? { action: latestActivity.action, occurredAt: latestActivity.occurredAt.toISOString(), page: latestActivity.page, resourceTitle: latestActivity.resourceTitle } : null,
      assignmentStats: (() => {
        const classAssignments = allAssignments.filter((item) => item.status === 'published' && item.type === 'tugas' && (assignmentTargetMap.get(item.id) || []).some((target) => target.id === student.classId));
        const studentSubmissions = submissionRows.filter((submission) => submission.userId === student.id && submission.filePath !== 'N/A');
        const submittedIds = new Set(studentSubmissions.map((submission) => submission.assignmentId));
        const openedIds = new Set(studentActivities.filter((activity) => activity.action === 'assignment_opened' && activity.resourceId).map((activity) => Number(activity.resourceId)));
        const overdueCount = classAssignments.filter((item) => Boolean(item.dueDate && item.dueDate.getTime() < now && !submittedIds.has(item.id))).length;
        const openedPendingCount = classAssignments.filter((item) => openedIds.has(item.id) && !submittedIds.has(item.id)).length;
        const pendingCount = classAssignments.filter((item) => !submittedIds.has(item.id)).length;
        const lateCount = studentSubmissions.filter((submission) => {
          const assignment = allAssignments.find((item) => item.id === submission.assignmentId);
          return Boolean(assignment?.dueDate && submission.submittedAt.getTime() > assignment.dueDate.getTime());
        }).length;
        const attention = overdueCount > 0 ? 'overdue' : openedPendingCount > 0 ? 'opened_pending' : pendingCount > 0 ? 'not_started' : 'none';
        return { total: classAssignments.length, pendingCount, overdueCount, lateCount, attention };
      })(),
    };
  });
  return {
    generatedAt: new Date().toISOString(), from: fromDate.toISOString(), to: toDate.toISOString(),
    summary: {
      onlineCount: students.filter((student) => student.online).length,
      activeStudentCount: students.filter((student) => student.activityCount > 0 || student.online).length,
      totalActiveSeconds: students.reduce((total, student) => total + student.totalActiveSeconds, 0),
      sessionCount: sessions.length, activityCount: filteredActivities.length,
    },
    students: students.sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, 'id')),
    sessions: sessions.map((session) => ({
      id: session.id.toString(), studentId: session.studentId.toString(), studentName: studentMap.get(session.studentId)?.name || 'Siswa',
      className: session.classId ? classMap.get(session.classId)?.name || 'Kelas' : 'Belum berkelas', startedAt: session.startedAt.toISOString(), lastSeenAt: session.lastSeenAt.toISOString(), endedAt: session.endedAt?.toISOString() || null, endReason: session.endReason, activeSeconds: session.activeSeconds,
    })).sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    activities: filteredActivities.map((activity) => ({
      id: activity.id.toString(), sessionId: activity.sessionId.toString(), studentId: activity.studentId.toString(), studentName: studentMap.get(activity.studentId)?.name || 'Siswa', action: activity.action, page: activity.page, resourceType: activity.resourceType, resourceId: activity.resourceId, resourceTitle: activity.resourceTitle, occurredAt: activity.occurredAt.toISOString(),
    })).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
  };
}

app.get('/api/student-activity', async (c) => {
  const user = getAuthenticatedUser(c);
  if (!user || user.role === 'student') return c.json({ error: 'Anda tidak memiliki akses ke laporan aktivitas siswa.' }, 403);
  const classId = Number(c.req.query('classId'));
  const studentId = Number(c.req.query('studentId'));
  const action = c.req.query('action');
  const report = await buildStudentActivityReport(user, {
    classId: Number.isInteger(classId) && classId > 0 ? classId : undefined,
    studentId: Number.isInteger(studentId) && studentId > 0 ? studentId : undefined,
    from: c.req.query('from'), to: c.req.query('to'), action: CLIENT_ACTIVITY_ACTIONS.has(action as ActivityAction) ? action as ActivityAction : undefined,
  });
  if (!report) return c.json({ error: 'Anda tidak memiliki akses ke data aktivitas ini.' }, 403);
  return c.json(report);
});

app.get('/api/student-activity/:studentId', async (c) => {
  const user = getAuthenticatedUser(c);
  if (!user || user.role === 'student') return c.json({ error: 'Anda tidak memiliki akses ke laporan aktivitas siswa.' }, 403);
  const studentId = Number(c.req.param('studentId'));
  if (!Number.isInteger(studentId) || studentId <= 0) return c.json({ error: 'Siswa tidak valid.' }, 400);
  const report = await buildStudentActivityReport(user, { studentId, from: c.req.query('from'), to: c.req.query('to'), action: c.req.query('action') as ActivityAction || undefined });
  if (!report) return c.json({ error: 'Anda tidak memiliki akses ke siswa ini.' }, 403);
  return c.json(report);
});

app.get('/api/my-workspace', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    if (!user) return c.json({ error: 'Silakan masuk terlebih dahulu.' }, 401);
    await syncLegacyScheduleTeacherIds();
    const [homeroomClasses, assignmentsForTeacher, teachingScheduleRows, classRows, subjectRows, studentRows, gradeRows] = await Promise.all([
      db.select().from(classes).where(eq(classes.homeroomTeacherId, user.id)).orderBy(classes.name),
      db.select().from(teachingAssignments).where(eq(teachingAssignments.teacherId, user.id)).orderBy(teachingAssignments.id),
      db.select().from(schedules).where(eq(schedules.teacherId, user.id)),
      db.select().from(classes), db.select().from(subjects),
      db.select({ id: users.id, classId: users.classId }).from(users).where(eq(users.role, 'student')),
      db.select().from(grades),
    ]);
    const subjectGroups = Array.from(new Map(assignmentsForTeacher.map((assignment) => [assignment.subjectId, assignment])).values()).map((firstAssignment) => {
      const subject = subjectRows.find((item) => item.id === firstAssignment.subjectId);
      const classAssignments = assignmentsForTeacher.filter((item) => item.subjectId === firstAssignment.subjectId);
      return {
        subjectId: firstAssignment.subjectId.toString(), subjectName: subject?.name || 'Mata pelajaran',
        classes: classAssignments.map((assignment) => {
          const classItem = classRows.find((item) => item.id === assignment.classId);
          const studentIds = studentRows.filter((student) => student.classId === assignment.classId).map((student) => student.id);
          return {
            assignmentId: assignment.id.toString(), classId: assignment.classId.toString(), className: classItem?.name || 'Kelas', academicYear: assignment.academicYear,
            studentCount: studentIds.length,
            gradeCount: gradeRows.filter((grade) => grade.subject === subject?.name && studentIds.includes(grade.userId)).length,
          };
        }),
      };
    });
    return c.json({
      user: { id: user.id.toString(), name: user.name, roles: user.roles },
      homeroomClasses: homeroomClasses.map((item) => ({ id: item.id.toString(), name: item.name, academicYear: item.academicYear })),
      subjectGroups,
      teachingSchedule: teachingScheduleRows
        .filter((item) => TEACHING_DAYS.has(item.day) && classRows.find((classItem) => classItem.id === item.classId)?.status === 'Aktif')
        .map((item) => ({
          id: item.id.toString(), classId: item.classId.toString(), className: classRows.find((classItem) => classItem.id === item.classId)?.name || 'Kelas',
          day: item.day, subject: item.subject, timeStart: item.timeStart, timeEnd: item.timeEnd,
        }))
        .sort((first, second) => `${['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].indexOf(first.day)}-${first.timeStart}`.localeCompare(`${['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].indexOf(second.day)}-${second.timeStart}`)),
    });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.get('/api/classes', async (c) => {
  try {
    const classRows = await db.select().from(classes).orderBy(classes.academicYear, classes.name);
    const studentRows = await db.select({ classId: users.classId }).from(users).where(eq(users.role, 'student'));
    return c.json(classRows.map((item) => ({
      id: item.id.toString(), name: item.name, academicYear: item.academicYear, status: item.status,
      homeroomTeacherId: item.homeroomTeacherId?.toString() || null,
      studentCount: studentRows.filter((student) => student.classId === item.id).length,
    })));
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.post('/api/classes', async (c) => {
  try {
    const body = await c.req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const academicYear = typeof body.academicYear === 'string' ? body.academicYear.trim() : '';
    if (!name || !academicYear || name.length > 100 || academicYear.length > 30) return c.json({ error: 'Nama kelas dan tahun ajaran wajib diisi.' }, 400);
    const inserted = await db.insert(classes).values({ name, academicYear, status: body.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif' }).returning();
    return c.json({ id: inserted[0].id.toString() }, 201);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.put('/api/classes/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const body = await c.req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const academicYear = typeof body.academicYear === 'string' ? body.academicYear.trim() : '';
    if (!Number.isInteger(id) || !name || !academicYear) return c.json({ error: 'Data kelas tidak valid.' }, 400);
    const result = await db.update(classes).set({ name, academicYear, status: body.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif' }).where(eq(classes.id, id)).returning();
    if (!result.length) return c.json({ error: 'Kelas tidak ditemukan.' }, 404);
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.delete('/api/classes/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const assignedStudents = await db.select({ id: users.id }).from(users).where(and(eq(users.role, 'student'), eq(users.classId, id))).limit(1);
    const assignedTeachers = await db.select({ id: teachingAssignments.id }).from(teachingAssignments).where(eq(teachingAssignments.classId, id)).limit(1);
    if (assignedStudents.length || assignedTeachers.length) return c.json({ error: 'Kelas masih memiliki siswa atau penugasan mengajar. Nonaktifkan kelas atau pindahkan datanya terlebih dahulu.' }, 409);
    await db.delete(classes).where(eq(classes.id, id));
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.get('/api/teachers', async (c) => {
  try {
    const list = (await db.select().from(users).orderBy(users.name)).filter((account) => account.role !== 'student');
    return c.json(list.map((teacher) => ({ id: teacher.id.toString(), name: teacher.name, identifier: teacher.identifier, status: teacher.status, primaryRole: teacher.role })));
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.post('/api/teachers', async (c) => {
  try {
    const body = await c.req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const identifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
    const accountRole = body.accountRole === 'counselor' ? 'counselor' : 'teacher';
    if (!name || !identifier) return c.json({ error: 'Nama dan identitas akun wajib diisi.' }, 400);
    const inserted = await db.insert(users).values({ name, role: accountRole, identifier, passwordHash: await Bun.password.hash('123456'), gender: body.gender === 'P' ? 'P' : 'L', status: 'Aktif' }).returning();
    await db.insert(userRoles).values({ userId: inserted[0].id, role: accountRole }).onConflictDoNothing();
    return c.json({ id: inserted[0].id.toString() }, 201);
  } catch (err: any) { return c.json({ error: 'Identitas guru sudah digunakan atau data tidak valid.' }, 400); }
});

app.delete('/api/teachers/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const linked = await db.select({ id: teachingAssignments.id }).from(teachingAssignments).where(eq(teachingAssignments.teacherId, id)).limit(1);
    if (linked.length) return c.json({ error: 'Guru masih memiliki penugasan mengajar.' }, 409);
    await db.delete(users).where(and(eq(users.id, id), inArray(users.role, ['teacher', 'counselor'])));
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.get('/api/teaching-assignments', async (c) => {
  try {
    const [items, classRows, teacherRows, subjectRows] = await Promise.all([
      db.select().from(teachingAssignments).orderBy(teachingAssignments.id), db.select().from(classes),
      db.select().from(users), db.select().from(subjects),
    ]);
    return c.json(items.map((item) => ({
      id: item.id.toString(), teacherId: item.teacherId.toString(), classId: item.classId.toString(), subjectId: item.subjectId.toString(), academicYear: item.academicYear,
      teacherName: teacherRows.find((teacher) => teacher.id === item.teacherId)?.name || 'Guru tidak ditemukan',
      className: classRows.find((classItem) => classItem.id === item.classId)?.name || 'Kelas tidak ditemukan',
      subjectName: subjectRows.find((subject) => subject.id === item.subjectId)?.name || 'Mapel tidak ditemukan',
    })));
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.post('/api/teaching-assignments', async (c) => {
  try {
    const body = await c.req.json();
    const teacherId = Number(body.teacherId), classId = Number(body.classId), subjectId = Number(body.subjectId);
    const academicYear = typeof body.academicYear === 'string' ? body.academicYear.trim() : '';
    if (![teacherId, classId, subjectId].every(Number.isInteger) || !academicYear) return c.json({ error: 'Data penugasan tidak valid.' }, 400);
    const [teacher, classItem, subject] = await Promise.all([
      db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, teacherId)).limit(1),
      db.select({ id: classes.id }).from(classes).where(eq(classes.id, classId)).limit(1),
      db.select({ id: subjects.id }).from(subjects).where(eq(subjects.id, subjectId)).limit(1),
    ]);
    if (!teacher.length || teacher[0].role === 'student' || !classItem.length || !subject.length) return c.json({ error: 'Guru, kelas, atau mata pelajaran tidak ditemukan.' }, 400);
    await db.insert(userRoles).values({ userId: teacherId, role: 'teacher' }).onConflictDoNothing();
    const inserted = await db.insert(teachingAssignments).values({ teacherId, classId, subjectId, academicYear }).returning();
    return c.json({ id: inserted[0].id.toString() }, 201);
  } catch (err: any) { return c.json({ error: 'Penugasan sudah ada atau data tidak valid.' }, 400); }
});

app.delete('/api/teaching-assignments/:id', async (c) => {
  try { await db.delete(teachingAssignments).where(eq(teachingAssignments.id, Number(c.req.param('id')))); return c.json({ success: true }); }
  catch (err: any) { return c.json({ error: err.message }, 500); }
});

const ANNOUNCEMENT_TYPES = ['PENTING', 'INFO', 'SELAMAT'] as const;

app.post('/api/teaching-announcements', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    if (!user || user.role === 'student' || !user.roles.includes('teacher')) return c.json({ error: 'Hanya guru pengajar yang dapat membuat informasi.' }, 403);
    const body = await c.req.json();
    const classId = Number(body.classId);
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const type = ANNOUNCEMENT_TYPES.includes(body.type as typeof ANNOUNCEMENT_TYPES[number]) ? body.type as typeof ANNOUNCEMENT_TYPES[number] : 'INFO';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!Number.isInteger(classId) || !subject || !text || text.length > 500) return c.json({ error: 'Kelas, mata pelajaran, dan isi informasi wajib diisi.' }, 400);
    if (!(await mayTeachSubject(user, classId, subject))) return c.json({ error: 'Anda tidak memiliki penugasan pada kelas dan mata pelajaran ini.' }, 403);
    const subjectRow = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.name, subject)).limit(1);
    if (!subjectRow[0]) return c.json({ error: 'Mata pelajaran tidak ditemukan.' }, 400);
    const inserted = await db.insert(teachingAnnouncements).values({ classId, teacherId: user.id, subjectId: subjectRow[0].id, type, text }).returning();
    return c.json({ id: inserted[0].id.toString() }, 201);
  } catch (err: any) { return c.json({ error: 'Informasi gagal disimpan.' }, 400); }
});

app.delete('/api/teaching-announcements/:id', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const id = Number(c.req.param('id'));
    if (!user || !Number.isInteger(id)) return c.json({ error: 'Informasi tidak ditemukan.' }, 404);
    const item = (await db.select({ teacherId: teachingAnnouncements.teacherId }).from(teachingAnnouncements).where(eq(teachingAnnouncements.id, id)).limit(1))[0];
    if (!item) return c.json({ error: 'Informasi tidak ditemukan.' }, 404);
    if (item.teacherId !== user.id && !canManageClass(user)) return c.json({ error: 'Anda tidak dapat menghapus informasi ini.' }, 403);
    await db.delete(teachingAnnouncements).where(eq(teachingAnnouncements.id, id));
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: 'Informasi gagal dihapus.' }, 500); }
});

function isValidJournalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeJournalTime(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  return typeof value === 'string' ? value.trim() : null;
}

function validJournalTimeRange(timeStart: string | null, timeEnd: string | null) {
  if (!timeStart && !timeEnd) return true;
  if (!timeStart || !timeEnd) return false;
  const start = timeToMinutes(timeStart), end = timeToMinutes(timeEnd);
  return Number.isFinite(start) && Number.isFinite(end) && start < end;
}

async function serializeTeachingJournals(user: AuthUser, query: { classId?: number; subject?: string; from?: string; to?: string } = {}) {
  const [journalRows, classRows, subjectRows, teacherRows, scheduleRows] = await Promise.all([
    db.select().from(teachingJournals), db.select().from(classes), db.select().from(subjects), db.select().from(users), db.select().from(schedules),
  ]);
  const permittedClassIds = await accessibleClassIds(user);
  const visibleRows = journalRows.filter((item) => {
    if (user.roles.includes('teacher') && !canManageClass(user) && item.teacherId !== user.id) return false;
    if (permittedClassIds !== null && !permittedClassIds.includes(item.classId)) return false;
    if (query.classId && item.classId !== query.classId) return false;
    if (query.subject && subjectRows.find((subject) => subject.id === item.subjectId)?.name !== query.subject) return false;
    if (query.from && item.date < query.from) return false;
    if (query.to && item.date > query.to) return false;
    return true;
  }).sort((first, second) => second.date.localeCompare(first.date) || second.id - first.id);
  return visibleRows.map((item) => {
    const subject = subjectRows.find((row) => row.id === item.subjectId);
    const schedule = item.scheduleId ? scheduleRows.find((row) => row.id === item.scheduleId) : null;
    return {
      id: item.id.toString(), teacherId: item.teacherId.toString(), teacherName: teacherRows.find((row) => row.id === item.teacherId)?.name || 'Guru',
      classId: item.classId.toString(), className: classRows.find((row) => row.id === item.classId)?.name || 'Kelas',
      subjectId: item.subjectId.toString(), subject: subject?.name || 'Mata pelajaran', scheduleId: item.scheduleId?.toString() || null,
      date: item.date, day: dayNameForDate(item.date), timeStart: item.timeStart, timeEnd: item.timeEnd,
      schedule: schedule ? { day: schedule.day, timeStart: schedule.timeStart, timeEnd: schedule.timeEnd } : null,
      materialCovered: item.materialCovered, classroomEvents: item.classroomEvents || '', nextPlan: item.nextPlan || '',
      createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(),
    };
  });
}

app.get('/api/teaching-journals', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    if (!user || user.role === 'student') return c.json({ error: 'Anda tidak memiliki akses ke jurnal mengajar.' }, 403);
    const classId = Number(c.req.query('classId'));
    return c.json(await serializeTeachingJournals(user, {
      classId: Number.isInteger(classId) && classId > 0 ? classId : undefined,
      subject: c.req.query('subject') || undefined, from: c.req.query('from') || undefined, to: c.req.query('to') || undefined,
    }));
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.post('/api/teaching-journals', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    if (!user || (!user.roles.includes('teacher') && !canManageClass(user))) return c.json({ error: 'Hanya guru pengajar yang dapat membuat jurnal.' }, 403);
    const body = await c.req.json();
    const classId = Number(body.classId);
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const date = typeof body.date === 'string' ? body.date.trim() : '';
    const materialCovered = typeof body.materialCovered === 'string' ? body.materialCovered.trim() : '';
    const classroomEvents = typeof body.classroomEvents === 'string' ? body.classroomEvents.trim() : '';
    const nextPlan = typeof body.nextPlan === 'string' ? body.nextPlan.trim() : '';
    const scheduleIdValue = body.scheduleId === undefined || body.scheduleId === null || body.scheduleId === '' ? null : Number(body.scheduleId);
    if (!Number.isInteger(classId) || classId <= 0 || !subject || !isValidJournalDate(date)) return c.json({ error: 'Kelas, mata pelajaran, dan tanggal jurnal wajib diisi dengan benar.' }, 400);
    if (materialCovered.length < 3 || materialCovered.length > 3000) return c.json({ error: 'Materi yang diajarkan wajib diisi (3–3000 karakter).' }, 400);
    if (classroomEvents.length > 3000 || nextPlan.length > 3000) return c.json({ error: 'Catatan jurnal maksimal 3000 karakter per bagian.' }, 400);
    if (scheduleIdValue !== null && (!Number.isInteger(scheduleIdValue) || scheduleIdValue <= 0)) return c.json({ error: 'Jadwal mengajar tidak valid.' }, 400);
    if (!(await mayTeachSubject(user, classId, subject))) return c.json({ error: 'Anda tidak memiliki penugasan pada kelas dan mata pelajaran ini.' }, 403);
    const subjectRow = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.name, subject)).limit(1);
    if (!subjectRow[0]) return c.json({ error: 'Mata pelajaran tidak ditemukan.' }, 400);
    const schedule = scheduleIdValue === null ? null : (await db.select().from(schedules).where(eq(schedules.id, scheduleIdValue)).limit(1))[0];
    if (scheduleIdValue !== null && (!schedule || schedule.classId !== classId || schedule.subject !== subject || (user.roles.includes('teacher') && !canManageClass(user) && schedule.teacherId !== user.id))) return c.json({ error: 'Jadwal tidak sesuai dengan penugasan Anda.' }, 403);
    const timeStart = normalizeJournalTime(body.timeStart) || schedule?.timeStart || null;
    const timeEnd = normalizeJournalTime(body.timeEnd) || schedule?.timeEnd || null;
    if (!validJournalTimeRange(timeStart, timeEnd)) return c.json({ error: 'Rentang jam mengajar tidak valid.' }, 400);
    const existingRows = await db.select({ id: teachingJournals.id, scheduleId: teachingJournals.scheduleId }).from(teachingJournals).where(and(eq(teachingJournals.teacherId, user.id), eq(teachingJournals.classId, classId), eq(teachingJournals.subjectId, subjectRow[0].id), eq(teachingJournals.date, date)));
    if (existingRows.some((item) => item.scheduleId === scheduleIdValue)) return c.json({ error: 'Jurnal untuk sesi ini pada tanggal tersebut sudah ada.' }, 409);
    const inserted = await db.insert(teachingJournals).values({ teacherId: user.id, classId, subjectId: subjectRow[0].id, scheduleId: scheduleIdValue, date, timeStart, timeEnd, materialCovered, classroomEvents: classroomEvents || null, nextPlan: nextPlan || null }).returning({ id: teachingJournals.id });
    return c.json({ id: inserted[0].id.toString() }, 201);
  } catch (err: any) { return c.json({ error: err.message }, 400); }
});

app.put('/api/teaching-journals/:id', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const id = Number(c.req.param('id'));
    if (!user || user.role === 'student' || !Number.isInteger(id)) return c.json({ error: 'Jurnal tidak ditemukan.' }, 404);
    const journal = (await db.select().from(teachingJournals).where(eq(teachingJournals.id, id)).limit(1))[0];
    if (!journal) return c.json({ error: 'Jurnal tidak ditemukan.' }, 404);
    if (journal.teacherId !== user.id && !canManageClass(user)) return c.json({ error: 'Anda tidak dapat mengubah jurnal ini.' }, 403);
    const body = await c.req.json();
    const date = typeof body.date === 'string' ? body.date.trim() : journal.date;
    const timeStart = normalizeJournalTime(body.timeStart) ?? journal.timeStart;
    const timeEnd = normalizeJournalTime(body.timeEnd) ?? journal.timeEnd;
    const materialCovered = typeof body.materialCovered === 'string' ? body.materialCovered.trim() : journal.materialCovered;
    const classroomEvents = typeof body.classroomEvents === 'string' ? body.classroomEvents.trim() : journal.classroomEvents || '';
    const nextPlan = typeof body.nextPlan === 'string' ? body.nextPlan.trim() : journal.nextPlan || '';
    if (!isValidJournalDate(date) || !validJournalTimeRange(timeStart, timeEnd)) return c.json({ error: 'Tanggal atau jam jurnal tidak valid.' }, 400);
    if (materialCovered.length < 3 || materialCovered.length > 3000 || classroomEvents.length > 3000 || nextPlan.length > 3000) return c.json({ error: 'Isi jurnal tidak valid atau terlalu panjang.' }, 400);
    await db.update(teachingJournals).set({ date, timeStart, timeEnd, materialCovered, classroomEvents: classroomEvents || null, nextPlan: nextPlan || null, updatedAt: new Date() }).where(eq(teachingJournals.id, id));
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err.message }, 400); }
});

app.delete('/api/teaching-journals/:id', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const id = Number(c.req.param('id'));
    if (!user || !Number.isInteger(id)) return c.json({ error: 'Jurnal tidak ditemukan.' }, 404);
    const journal = (await db.select({ teacherId: teachingJournals.teacherId }).from(teachingJournals).where(eq(teachingJournals.id, id)).limit(1))[0];
    if (!journal) return c.json({ error: 'Jurnal tidak ditemukan.' }, 404);
    if (journal.teacherId !== user.id && !canManageClass(user)) return c.json({ error: 'Anda tidak dapat menghapus jurnal ini.' }, 403);
    await db.delete(teachingJournals).where(eq(teachingJournals.id, id));
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

// Get unified class data
app.get('/api/class-data', async (c) => {
  try {
    const requestedClassId = Number(c.req.query('classId'));
    const authenticatedUser = getAuthenticatedUser(c);
    const permittedClassIds = authenticatedUser ? await accessibleClassIds(authenticatedUser) : null;
    const allClasses = (await db.select().from(classes).orderBy(classes.academicYear, classes.name))
      .filter((item) => permittedClassIds === null || permittedClassIds.includes(item.id));
    if (authenticatedUser && Number.isInteger(requestedClassId) && !allClasses.some((item) => item.id === requestedClassId)) {
      return c.json({ error: 'Anda tidak memiliki akses ke kelas ini.' }, 403);
    }
    const currentClass = (Number.isInteger(requestedClassId) && allClasses.find((item) => item.id === requestedClassId)) || allClasses[0];
    if (!currentClass) return c.json({ error: 'Belum ada kelas yang tersedia.' }, 404);
    const allAnnouncements = await db.select().from(announcements);
    const allAgenda = await db.select().from(agenda);
    const allStudents = await db.select().from(users).where(and(eq(users.role, 'student'), eq(users.classId, currentClass.id)));
    const classStudentIds = new Set(allStudents.map((student) => student.id));
    const classTeachingAnnouncements = await db.select().from(teachingAnnouncements).where(eq(teachingAnnouncements.classId, currentClass.id));
    const announcementTeacherIds = [...new Set(classTeachingAnnouncements.map((item) => item.teacherId))];
    const announcementSubjectIds = [...new Set(classTeachingAnnouncements.map((item) => item.subjectId))];
    const [announcementTeachers, announcementSubjects] = await Promise.all([
      announcementTeacherIds.length ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, announcementTeacherIds)) : Promise.resolve([]),
      announcementSubjectIds.length ? db.select({ id: subjects.id, name: subjects.name }).from(subjects).where(inArray(subjects.id, announcementSubjectIds)) : Promise.resolve([]),
    ]);
    const currentQuote = await db.select().from(quotes).limit(1);
    const allSchedules = await db.select().from(schedules).where(eq(schedules.classId, currentClass.id));
    let allBehavior = (await db.select().from(behaviorRecords)).filter((record) => classStudentIds.has(record.studentId));
    if (authenticatedUser?.roles.includes('teacher') && !canManageClass(authenticatedUser)) {
      const assignmentsForTeacher = await db.select({ subjectId: teachingAssignments.subjectId }).from(teachingAssignments).where(and(eq(teachingAssignments.teacherId, authenticatedUser.id), eq(teachingAssignments.classId, currentClass.id)));
      const allowedSubjectIds = assignmentsForTeacher.map((item) => item.subjectId);
      const allowedSubjects = allowedSubjectIds.length ? await db.select({ name: subjects.name }).from(subjects).where(inArray(subjects.id, allowedSubjectIds)) : [];
      const allowedNames = new Set(allowedSubjects.map((item) => item.name));
      allBehavior = allBehavior.filter((record) => record.subject && allowedNames.has(record.subject));
    }
    const allAchievements = (await db.select().from(achievements)).filter((record) => classStudentIds.has(record.studentId));
    const allOfficers = await db.select().from(classOfficers);
    const allGalleryItems = await db.select().from(galleryItems).orderBy(galleryItems.createdAt);
    const heroImageSetting = await db.select().from(pageSettings).where(eq(pageSettings.key, 'hero_image')).limit(1);
    const homeroomPhotoSetting = await db.select().from(pageSettings).where(eq(pageSettings.key, 'homeroom_teacher_photo')).limit(1);
    const officerDutiesSetting = await db.select().from(pageSettings).where(eq(pageSettings.key, 'officer_duties')).limit(1);
    const dailyAttendance = await db.select().from(attendance).where(eq(attendance.type, 'harian'));
    const allGrades = await db.select().from(grades);

    const quoteVal = currentQuote[0] || {
      text: "Pendidikan adalah senjata paling mematikan di dunia, karena dengan pendidikan, Anda dapat mengubah dunia.",
      author: "Nelson Mandela"
    };

    const studentList = allStudents.map(s => ({
      id: s.id.toString(),
      nisn: s.identifier,
      name: s.name,
      gender: s.gender as 'L' | 'P',
      status: s.status as 'Aktif' | 'Nonaktif'
    }));

    const activeStudentIds = new Set(allStudents.filter((student) => student.status === 'Aktif').map((student) => student.id));
    const activeDailyAttendance = dailyAttendance.filter((record) => activeStudentIds.has(record.userId));
    const activeGrades = allGrades.filter((grade) => activeStudentIds.has(grade.userId));
    const attendanceAverage = activeDailyAttendance.length
      ? (activeDailyAttendance.filter((record) => record.status === 'Hadir').length / activeDailyAttendance.length) * 100
      : null;
    const gradeAverage = activeGrades.length
      ? activeGrades.reduce((total, grade) => total + grade.score, 0) / activeGrades.length
      : null;
    const studentGrades = new Map<number, { total: number; count: number }>();
    for (const grade of activeGrades) {
      const current = studentGrades.get(grade.userId) || { total: 0, count: 0 };
      studentGrades.set(grade.userId, { total: current.total + grade.score, count: current.count + 1 });
    }
    const academicLeaderboard = Array.from(studentGrades.entries())
      .map(([studentId, summary]) => ({
        studentId: studentId.toString(),
        name: allStudents.find((student) => student.id === studentId)?.name || 'Siswa tidak ditemukan',
        average: Number((summary.total / summary.count).toFixed(1)),
      }))
      .sort((first, second) => second.average - first.average || first.name.localeCompare(second.name, 'id'))
      .slice(0, 3);
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    const now = new Date();
    const gradeTrend = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const monthlyGrades = activeGrades.filter((grade) => grade.createdAt.getFullYear() === date.getFullYear() && grade.createdAt.getMonth() === date.getMonth());
      return {
        month: monthLabels[date.getMonth()],
        average: monthlyGrades.length ? Number((monthlyGrades.reduce((total, grade) => total + grade.score, 0) / monthlyGrades.length).toFixed(1)) : null,
      };
    });

    const stats = {
      attendance: attendanceAverage === null ? '—' : `${attendanceAverage.toFixed(1)}%`,
      averageGrade: gradeAverage === null ? '—' : gradeAverage.toFixed(1),
      totalStudents: studentList.length.toString()
    };

    return c.json({
      announcements: allAnnouncements.map(a => ({ id: a.id.toString(), type: a.type, text: a.text })),
      teachingAnnouncements: authenticatedUser ? classTeachingAnnouncements.map((item) => ({
        id: item.id.toString(), type: item.type, text: item.text, teacherId: item.teacherId.toString(),
        teacherName: announcementTeachers.find((teacher) => teacher.id === item.teacherId)?.name || 'Guru Pengajar',
        subjectId: item.subjectId.toString(), subjectName: announcementSubjects.find((subject) => subject.id === item.subjectId)?.name || 'Mata Pelajaran',
        createdAt: item.createdAt.toISOString(),
      })) : [],
      agenda: allAgenda.map(g => ({ id: g.id.toString(), date: g.date, title: g.title, type: g.type })),
      schedules: allSchedules.filter((schedule) => TEACHING_DAYS.has(schedule.day)).map(s => ({
        id: s.id.toString(),
        teacherId: s.teacherId?.toString() || null,
        day: s.day,
        subject: s.subject,
        timeStart: s.timeStart,
        timeEnd: s.timeEnd,
        teacherName: s.teacherName || '',
        color: s.color
      })),
      students: authenticatedUser ? studentList : [],
      behaviorRecords: authenticatedUser ? allBehavior.map(b => ({
        id: b.id.toString(),
        studentId: b.studentId.toString(),
        type: b.type,
        points: b.points,
        category: b.category,
        description: b.description,
        date: b.date,
        subject: b.subject || undefined
      })) : [],
      achievements: allAchievements.map(ac => ({
        id: ac.id.toString(),
        studentId: ac.studentId.toString(),
        title: ac.title,
        level: ac.level,
        rank: ac.rank,
        date: ac.date,
        description: ac.description || ''
      })),
      officers: allOfficers.map(officer => ({
        id: officer.id.toString(),
        userId: officer.userId.toString(),
        role: officer.role,
        name: allStudents.find(student => student.id === officer.userId)?.name || 'Siswa tidak ditemukan',
      })),
      academicLeaderboard,
      galleryItems: allGalleryItems.map((item) => ({ id: item.id.toString(), title: item.title, imageUrl: item.imageUrl, description: item.description || '' })),
      gradeTrend,
      heroImage: heroImageSetting[0]?.value || '/hero-default.svg',
      homeroomTeacherPhoto: homeroomPhotoSetting[0]?.value || '/wali-kelas-placeholder.svg',
      officerDuties: parseOfficerDuties(officerDutiesSetting[0]?.value),
      classId: currentClass.id.toString(),
      className: currentClass.name,
      academicYear: currentClass.academicYear,
      classes: allClasses.map((item) => ({ id: item.id.toString(), name: item.name, academicYear: item.academicYear, status: item.status })),
      quote: { text: quoteVal.text, author: quoteVal.author },
      stats
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/gallery', async (c) => {
  try {
    const body = await c.req.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (!title || !imageUrl || title.length > 120 || imageUrl.length > 2048 || (!imageUrl.startsWith('/') && !/^https?:\/\//i.test(imageUrl))) {
      return c.json({ error: 'Judul dan URL gambar yang valid wajib diisi.' }, 400);
    }
    const inserted = await db.insert(galleryItems).values({ title, imageUrl, description: description || null }).returning();
    return c.json({ id: inserted[0].id.toString() }, 201);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.delete('/api/gallery/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id)) return c.json({ error: 'ID galeri tidak valid.' }, 400);
    await db.delete(galleryItems).where(eq(galleryItems.id, id));
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.put('/api/page-settings/class-profile', async (c) => {
  try {
    const body = await c.req.json();
    const className = typeof body.className === 'string' ? body.className.trim() : '';
    const academicYear = typeof body.academicYear === 'string' ? body.academicYear.trim() : '';
    const classId = Number(body.classId);
    if (!className || !academicYear || className.length > 100 || academicYear.length > 30) {
      return c.json({ error: 'Nama kelas dan tahun ajaran wajib diisi.' }, 400);
    }

    if (!Number.isInteger(classId)) return c.json({ error: 'Kelas aktif tidak valid.' }, 400);
    const updated = await db.update(classes).set({ name: className, academicYear }).where(eq(classes.id, classId)).returning();
    if (!updated.length) return c.json({ error: 'Kelas tidak ditemukan.' }, 404);
    return c.json({ success: true, className, academicYear });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/class-officers', async (c) => {
  try {
    const body = await c.req.json();
    const userId = Number(body.userId);
    const role = typeof body.role === 'string' ? body.role.trim() : '';
    if (!Number.isInteger(userId) || !role || role.length > 80) {
      return c.json({ error: 'Data pengurus tidak valid.' }, 400);
    }

    const student = await db.select().from(users).where(and(eq(users.id, userId), eq(users.role, 'student'), eq(users.status, 'Aktif'))).limit(1);
    if (!student.length) return c.json({ error: 'Siswa aktif tidak ditemukan.' }, 400);

    const existingRole = await db.select().from(classOfficers).where(eq(classOfficers.role, role)).limit(1);
    if (existingRole.length) {
      await db.update(classOfficers).set({ userId }).where(eq(classOfficers.id, existingRole[0].id));
      return c.json({ success: true, id: existingRole[0].id.toString(), action: 'updated' });
    }

    const inserted = await db.insert(classOfficers).values({ userId, role }).returning({ id: classOfficers.id });
    return c.json({ success: true, id: inserted[0].id.toString(), action: 'created' });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.delete('/api/class-officers/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id)) return c.json({ error: 'ID pengurus tidak valid.' }, 400);
    await db.delete(classOfficers).where(eq(classOfficers.id, id));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.put('/api/page-settings/hero-image', async (c) => {
  try {
    const { imageUrl } = await c.req.json();
    const value = typeof imageUrl === 'string' ? imageUrl.trim() : '';
    if (!value || value.length > 2048 || (!value.startsWith('/') && !/^https?:\/\//i.test(value))) {
      return c.json({ error: 'Gunakan URL gambar https:// atau path internal yang diawali /.' }, 400);
    }
    const existing = await db.select().from(pageSettings).where(eq(pageSettings.key, 'hero_image')).limit(1);
    if (existing.length) {
      await db.update(pageSettings).set({ value, updatedAt: new Date() }).where(eq(pageSettings.key, 'hero_image'));
    } else {
      await db.insert(pageSettings).values({ key: 'hero_image', value });
    }
    return c.json({ success: true, heroImage: value });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.delete('/api/page-settings/hero-image', async (c) => {
  try {
    await db.delete(pageSettings).where(eq(pageSettings.key, 'hero_image'));
    return c.json({ success: true, heroImage: '/hero-default.svg' });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.put('/api/page-settings/homeroom-teacher-photo', async (c) => {
  try {
    const { imageUrl } = await c.req.json();
    const value = typeof imageUrl === 'string' ? imageUrl.trim() : '';
    if (!value || value.length > 2048 || (!value.startsWith('/') && !/^https?:\/\//i.test(value))) {
      return c.json({ error: 'Gunakan URL gambar https:// atau path internal yang diawali /.' }, 400);
    }
    const existing = await db.select().from(pageSettings).where(eq(pageSettings.key, 'homeroom_teacher_photo')).limit(1);
    if (existing.length) {
      await db.update(pageSettings).set({ value, updatedAt: new Date() }).where(eq(pageSettings.key, 'homeroom_teacher_photo'));
    } else {
      await db.insert(pageSettings).values({ key: 'homeroom_teacher_photo', value });
    }
    return c.json({ success: true, homeroomTeacherPhoto: value });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.delete('/api/page-settings/homeroom-teacher-photo', async (c) => {
  try {
    await db.delete(pageSettings).where(eq(pageSettings.key, 'homeroom_teacher_photo'));
    return c.json({ success: true, homeroomTeacherPhoto: '/wali-kelas-placeholder.svg' });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.put('/api/page-settings/officer-duties', async (c) => {
  try {
    const body = await c.req.json();
    if (!Array.isArray(body.duties)) return c.json({ error: 'Daftar tugas pengurus tidak valid.' }, 400);
    const duties = DEFAULT_OFFICER_DUTIES.map((defaultDuty) => {
      const submitted = body.duties.find((item: unknown) => typeof item === 'object' && item !== null && (item as { key?: unknown }).key === defaultDuty.key) as { description?: unknown } | undefined;
      const description = typeof submitted?.description === 'string' ? submitted.description.trim() : '';
      if (!description || description.length > 1500) throw new Error(`Tugas ${defaultDuty.label} wajib diisi (maksimal 1500 karakter).`);
      return { ...defaultDuty, description };
    });
    const value = JSON.stringify(duties);
    const existing = await db.select().from(pageSettings).where(eq(pageSettings.key, 'officer_duties')).limit(1);
    if (existing.length) await db.update(pageSettings).set({ value, updatedAt: new Date() }).where(eq(pageSettings.key, 'officer_duties'));
    else await db.insert(pageSettings).values({ key: 'officer_duties', value });
    return c.json({ success: true, duties });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// Update current quote
app.post('/api/quote', async (c) => {
  try {
    const body = await c.req.json();
    const existing = await db.select().from(quotes).limit(1);
    if (existing.length > 0) {
      await db.update(quotes).set({ text: body.text, author: body.author, updatedAt: new Date() }).where(eq(quotes.id, existing[0].id));
    } else {
      await db.insert(quotes).values({ text: body.text, author: body.author });
    }
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Add a new announcement
app.post('/api/announcements', async (c) => {
  try {
    const body = await c.req.json();
    const result = await db.insert(announcements).values({ type: body.type, text: body.text }).returning();
    return c.json({ success: true, id: result[0]?.id?.toString() });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Delete an announcement
app.delete('/api/announcements/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    await db.delete(announcements).where(eq(announcements.id, id));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Add a new agenda item
app.post('/api/agenda', async (c) => {
  try {
    const body = await c.req.json();
    const result = await db.insert(agenda).values({ date: body.date, title: body.title, type: body.type }).returning();
    return c.json({ success: true, id: result[0]?.id?.toString() });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Delete an agenda item
app.delete('/api/agenda/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    await db.delete(agenda).where(eq(agenda.id, id));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Add a new student
app.post('/api/students', async (c) => {
  try {
    const body = await c.req.json();
    const classId = Number(body.classId);
    const classItem = await db.select({ id: classes.id }).from(classes).where(eq(classes.id, classId)).limit(1);
    if (!Number.isInteger(classId) || !classItem.length) return c.json({ error: 'Kelas tujuan tidak valid.' }, 400);
    await db.insert(users).values({
      name: body.name,
      role: 'student',
      identifier: body.nisn || ('10' + Math.floor(Math.random() * 1000000)),
      passwordHash: '123456',
      gender: body.gender || 'L',
      status: body.status || 'Aktif',
      classId,
    });
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Keep student history intact by marking a student as inactive instead of deleting it.
app.delete('/api/students/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const result = await db.update(users)
      .set({ status: 'Nonaktif' })
      .where(and(eq(users.id, id), eq(users.role, 'student')))
      .returning({ id: users.id });

    if (result.length === 0) {
      return c.json({ error: 'Siswa tidak ditemukan' }, 404);
    }

    return c.json({ success: true, status: 'Nonaktif' });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Permanently delete a student only when no academic or class history exists.
app.delete('/api/students/:id/permanent', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const student = await db.select().from(users).where(and(eq(users.id, id), eq(users.role, 'student'))).limit(1);
    if (!student.length) return c.json({ error: 'Siswa tidak ditemukan.' }, 404);

    const [officer, attendanceRecord, grade, behavior, achievement, submission] = await Promise.all([
      db.select({ id: classOfficers.id }).from(classOfficers).where(eq(classOfficers.userId, id)).limit(1),
      db.select({ id: attendance.id }).from(attendance).where(eq(attendance.userId, id)).limit(1),
      db.select({ id: grades.id }).from(grades).where(eq(grades.userId, id)).limit(1),
      db.select({ id: behaviorRecords.id }).from(behaviorRecords).where(eq(behaviorRecords.studentId, id)).limit(1),
      db.select({ id: achievements.id }).from(achievements).where(eq(achievements.studentId, id)).limit(1),
      db.select({ id: submissions.id }).from(submissions).where(eq(submissions.userId, id)).limit(1),
    ]);

    const relatedData = [
      officer.length && 'jabatan pengurus', attendanceRecord.length && 'presensi', grade.length && 'nilai',
      behavior.length && 'catatan sikap', achievement.length && 'prestasi', submission.length && 'pengumpulan tugas',
    ].filter(Boolean);
    if (relatedData.length) {
      return c.json({ error: `Siswa masih memiliki ${relatedData.join(', ')}. Gunakan status Nonaktif untuk menjaga riwayat.` }, 409);
    }

    await db.delete(users).where(eq(users.id, id));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Update a student
app.put('/api/students/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    await db.update(users).set({
      name: body.name,
      identifier: body.nisn,
      gender: body.gender,
      status: body.status
    }).where(eq(users.id, id));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Get attendance records
app.get('/api/attendance', async (c) => {
  try {
    const date = c.req.query('date');
    const type = c.req.query('type');
    const classId = Number(c.req.query('classId'));
    const subject = c.req.query('subject');
    if (!date || !type) {
      return c.json({ error: 'Missing date or type' }, 400);
    }
    if (!Number.isInteger(classId)) return c.json({ error: 'Missing classId' }, 400);
    const authenticatedUser = getAuthenticatedUser(c);
    if (authenticatedUser && !(await mayAccessClass(authenticatedUser, classId))) return c.json({ error: 'Anda tidak memiliki akses ke kelas ini.' }, 403);
    if (type === 'mapel' && (!subject || !authenticatedUser || !(await mayTeachSubject(authenticatedUser, classId, subject)))) return c.json({ error: 'Mata pelajaran ini tidak ada dalam penugasan Anda.' }, 403);
    const classStudents = await db.select({ id: users.id, gender: users.gender }).from(users).where(and(eq(users.role, 'student'), eq(users.classId, classId)));
    const studentIds = classStudents.map((student) => student.id);
    const records = studentIds.length ? await db.select().from(attendance).where(
      and(eq(attendance.date, date), eq(attendance.type, type), ...(type === 'mapel' ? [eq(attendance.subject, subject!)] : []), inArray(attendance.userId, studentIds))
    ) : [];
    return c.json(records.map(r => ({
      id: r.id.toString(),
      studentId: r.userId.toString(),
      status: r.status
    })));
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Save or update attendance records (bulk)
app.post('/api/attendance', async (c) => {
  try {
    const body = await c.req.json();
    const { date, type, records } = body;
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const classId = Number(body.classId);
    const validTypes = new Set(['harian', 'dhuha', 'dzuhur', 'jumat', 'mapel']);
    const validStatuses = type === 'harian' || type === 'mapel'
      ? new Set(['Hadir', 'Sakit', 'Izin', 'Alfa'])
      : type === 'jumat'
        ? new Set(['Sholat', 'Alfa'])
        : new Set(['Sholat', 'Berhalangan', 'Alfa']);
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !validTypes.has(type) || !Array.isArray(records) || !Number.isInteger(classId) || classId <= 0) {
      return c.json({ error: 'Invalid payload' }, 400);
    }
    if (type === 'mapel' && !subject) return c.json({ error: 'Mata pelajaran wajib dipilih.' }, 400);
    if (records.some((record: any) => !record || !Number.isInteger(Number(record.studentId)) || Number(record.studentId) <= 0 || typeof record.status !== 'string' || !validStatuses.has(record.status))) {
      return c.json({ error: 'Data status presensi tidak valid.' }, 400);
    }
    const authenticatedUser = getAuthenticatedUser(c);
    if (!authenticatedUser || authenticatedUser.role === 'student') return c.json({ error: 'Silakan masuk sebagai guru.' }, 401);
    if (!(await mayAccessClass(authenticatedUser, classId))) return c.json({ error: 'Anda tidak memiliki akses ke kelas ini.' }, 403);
    if (!canManageClass(authenticatedUser)) {
      if (type !== 'mapel' || !subject || !(await mayTeachSubject(authenticatedUser, classId, subject))) return c.json({ error: 'Presensi hanya dapat dicatat untuk mata pelajaran yang Anda ampu.' }, 403);
    }
    
    const classStudents = await db.select({ id: users.id, gender: users.gender }).from(users).where(and(eq(users.role, 'student'), eq(users.classId, classId)));
    const studentIds = classStudents.map((student) => student.id);
    if (records.some((record: any) => !studentIds.includes(Number(record.studentId)))) return c.json({ error: 'Siswa harus berasal dari kelas aktif.' }, 400);
    if (type === 'jumat') {
      const maleStudentIds = new Set(classStudents.filter((student) => student.gender === 'L').map((student) => student.id));
      if (records.some((record: any) => !maleStudentIds.has(Number(record.studentId)))) return c.json({ error: 'Presensi Sholat Jumat hanya untuk siswa laki-laki.' }, 400);
    }

    if (studentIds.length) await db.delete(attendance).where(and(eq(attendance.date, date), eq(attendance.type, type), ...(type === 'mapel' ? [eq(attendance.subject, subject)] : []), inArray(attendance.userId, studentIds)));

    // Insert new ones after all validation has passed.
    if (records.length > 0) {
      await db.insert(attendance).values(
        records.map((r: any) => ({
          userId: parseInt(r.studentId),
          date,
          type,
          subject: type === 'mapel' ? subject : null,
          status: r.status
        }))
      );
    }
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get('/api/attendance-reminders', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    if (!user || !user.roles.includes('teacher')) {
      return c.json({ error: 'Pengingat ini hanya tersedia untuk guru pengajar.' }, 403);
    }
    const classIdValue = c.req.query('classId');
    const classId = classIdValue ? Number(classIdValue) : undefined;
    if (classIdValue && (!Number.isInteger(classId) || classId! <= 0)) return c.json({ error: 'Kelas tidak valid.' }, 400);
    const reminders = await buildAttendanceReminders(user, classId);
    return c.json({ generatedAt: new Date().toISOString(), reminders });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/attendance-reminders/:scheduleId/skip', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const scheduleId = Number(c.req.param('scheduleId'));
    const body = await c.req.json().catch(() => ({}));
    const date = typeof body.date === 'string' ? body.date : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!user || user.role === 'student' || !user.roles.includes('teacher')) return c.json({ error: 'Hanya guru pengajar yang dapat menandai jadwal.' }, 403);
    if (!Number.isInteger(scheduleId) || scheduleId <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: 'Jadwal dan tanggal tidak valid.' }, 400);
    if (reason.length < 3 || reason.length > 200) return c.json({ error: 'Alasan wajib diisi (3–200 karakter).' }, 400);
    const schedule = await db.select().from(schedules).where(eq(schedules.id, scheduleId)).limit(1);
    if (!schedule[0] || schedule[0].teacherId !== user.id) return c.json({ error: 'Jadwal ini bukan bagian dari penugasan Anda.' }, 403);
    const existing = await db.select({ id: attendanceReminderExceptions.id }).from(attendanceReminderExceptions).where(and(
      eq(attendanceReminderExceptions.scheduleId, scheduleId), eq(attendanceReminderExceptions.date, date),
    )).limit(1);
    if (existing[0]) {
      await db.update(attendanceReminderExceptions).set({ reason, createdAt: new Date() }).where(eq(attendanceReminderExceptions.id, existing[0].id));
    } else {
      await db.insert(attendanceReminderExceptions).values({ scheduleId, teacherId: user.id, date, reason });
    }
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.delete('/api/attendance-reminders/:scheduleId/skip', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const scheduleId = Number(c.req.param('scheduleId'));
    const date = c.req.query('date') || '';
    if (!user || user.role === 'student' || !user.roles.includes('teacher')) return c.json({ error: 'Hanya guru pengajar yang dapat membatalkan penandaan.' }, 403);
    if (!Number.isInteger(scheduleId) || scheduleId <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: 'Jadwal dan tanggal tidak valid.' }, 400);
    const schedule = await db.select({ teacherId: schedules.teacherId }).from(schedules).where(eq(schedules.id, scheduleId)).limit(1);
    if (!schedule[0] || schedule[0].teacherId !== user.id) return c.json({ error: 'Jadwal ini bukan bagian dari penugasan Anda.' }, 403);
    await db.delete(attendanceReminderExceptions).where(and(
      eq(attendanceReminderExceptions.scheduleId, scheduleId), eq(attendanceReminderExceptions.date, date),
    ));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Attendance recap for the currently signed-in student.  The student id is
// intentionally taken from the session, never from a query parameter, so a
// student cannot inspect another student's attendance history.
app.get('/api/student/attendance-summary', async (c) => {
  try {
    const authenticatedUser = getAuthenticatedUser(c);
    if (!authenticatedUser || authenticatedUser.role !== 'student') {
      return c.json({ error: 'Fitur ini hanya tersedia untuk akun siswa.' }, 403);
    }

    const student = await db.select({ gender: users.gender }).from(users).where(eq(users.id, authenticatedUser.id)).limit(1);
    if (!student[0]) return c.json({ error: 'Data siswa tidak ditemukan.' }, 404);

    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const part = (type: string) => dateParts.find((item) => item.type === type)?.value || '';
    const today = `${part('year')}-${part('month')}-${part('day')}`;
    const todayDate = new Date(`${today}T12:00:00+07:00`);
    const daysSinceMonday = (todayDate.getUTCDay() + 6) % 7;
    const weekStartDate = new Date(todayDate);
    weekStartDate.setUTCDate(todayDate.getUTCDate() - daysSinceMonday);
    const weekStart = weekStartDate.toISOString().slice(0, 10);

    const records = await db.select().from(attendance).where(eq(attendance.userId, authenticatedUser.id));
    const createDailyCounts = () => ({ Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0, total: 0 });
    const countDailyAttendance = (source: typeof records) => source.reduce((totals, record) => {
      if (record.type !== 'harian') return totals;
      if (record.status in totals && record.status !== 'total') totals[record.status as 'Hadir' | 'Sakit' | 'Izin' | 'Alfa']++;
      totals.total++;
      return totals;
    }, createDailyCounts());
    const todayRecord = (type: string) => records.find((record) => record.date === today && record.type === type)?.status || null;

    return c.json({
      today,
      gender: student[0].gender,
      todayStatus: {
        harian: todayRecord('harian'),
        dhuha: todayRecord('dhuha'),
        dzuhur: todayRecord('dzuhur'),
        jumat: student[0].gender === 'L' ? todayRecord('jumat') : null,
      },
      daily: countDailyAttendance(records.filter((record) => record.date === today)),
      weekly: countDailyAttendance(records.filter((record) => record.date >= weekStart && record.date <= today)),
      monthly: countDailyAttendance(records.filter((record) => record.date.startsWith(today.slice(0, 7)))),
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get('/api/teaching-attendance/summary', async (c) => {
  try {
    const month = c.req.query('month');
    const subject = c.req.query('subject');
    const classId = Number(c.req.query('classId'));
    const authenticatedUser = getAuthenticatedUser(c);
    if (!month || !subject || !Number.isInteger(classId)) return c.json({ error: 'Missing month, subject, or classId' }, 400);
    if (!authenticatedUser || !(await mayTeachSubject(authenticatedUser, classId, subject))) return c.json({ error: 'Anda tidak memiliki akses ke laporan ini.' }, 403);
    const studentsList = await db.select().from(users).where(and(eq(users.role, 'student'), eq(users.classId, classId)));
    const studentIds = studentsList.map((student) => student.id);
    const records = studentIds.length ? await db.select().from(attendance).where(and(
      eq(attendance.type, 'mapel'), eq(attendance.subject, subject), like(attendance.date, `${month}-%`), inArray(attendance.userId, studentIds),
    )) : [];
    return c.json(studentsList.map((student) => {
      const studentRecords = records.filter((record) => record.userId === student.id);
      const totals = { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0 };
      studentRecords.forEach((record) => { if (record.status in totals) totals[record.status as keyof typeof totals]++; });
      const attendanceByDate = studentRecords.reduce<Record<string, string>>((byDate, record) => {
        byDate[record.date] = record.status;
        return byDate;
      }, {});
      return { studentId: student.id.toString(), name: student.name, gender: student.gender, attendanceByDate, ...totals };
    }));
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

// Get monthly attendance summary
app.get('/api/attendance/summary', async (c) => {
  try {
    const month = c.req.query('month'); // Expecting 'YYYY-MM'
    const classId = Number(c.req.query('classId'));
    if (!month || !Number.isInteger(classId)) {
      return c.json({ error: 'Missing month parameter' }, 400);
    }
    
    // Fetch all students
    const studentsList = await db.select().from(users).where(and(eq(users.role, 'student'), eq(users.classId, classId)));
    
    // Fetch all attendance records for this month
    const studentIds = studentsList.map((student) => student.id);
    const records = studentIds.length ? await db.select().from(attendance).where(and(like(attendance.date, `${month}-%`), inArray(attendance.userId, studentIds))) : [];
    
    const summary = studentsList.map(s => {
      const studentRecords = records.filter(r => r.userId === s.id);
      
      const harian = { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0, total: 0 };
      const dhuha = { Berjamaah: 0, Munfarid: 0, Berhalangan: 0, Alfa: 0, total: 0 };
      const dzuhur = { Berjamaah: 0, Munfarid: 0, Berhalangan: 0, Alfa: 0, total: 0 };
      const jumat = { Berjamaah: 0, Munfarid: 0, Berhalangan: 0, Alfa: 0, total: 0 };
      
      studentRecords.forEach(r => {
        if (r.type === 'harian') {
          if (r.status === 'Hadir') harian.Hadir++;
          else if (r.status === 'Sakit') harian.Sakit++;
          else if (r.status === 'Izin') harian.Izin++;
          else if (r.status === 'Alfa') harian.Alfa++;
          harian.total++;
        } else if (r.type === 'dhuha') {
          if (r.status === 'Berjamaah' || r.status === 'Sholat') dhuha.Berjamaah++;
          else if (r.status === 'Munfarid') dhuha.Munfarid++;
          else if (r.status === 'Berhalangan') dhuha.Berhalangan++;
          else if (r.status === 'Alfa') dhuha.Alfa++;
          dhuha.total++;
        } else if (r.type === 'dzuhur') {
          if (r.status === 'Berjamaah' || r.status === 'Sholat') dzuhur.Berjamaah++;
          else if (r.status === 'Munfarid') dzuhur.Munfarid++;
          else if (r.status === 'Berhalangan') dzuhur.Berhalangan++;
          else if (r.status === 'Alfa') dzuhur.Alfa++;
          dzuhur.total++;
        } else if (r.type === 'jumat') {
          if (r.status === 'Berjamaah' || r.status === 'Sholat') jumat.Berjamaah++;
          else if (r.status === 'Munfarid') jumat.Munfarid++;
          else if (r.status === 'Berhalangan') jumat.Berhalangan++;
          else if (r.status === 'Alfa') jumat.Alfa++;
          jumat.total++;
        }
      });
      
      return {
        studentId: s.id.toString(),
        name: s.name,
        gender: s.gender,
        attendanceByDate: studentRecords.reduce<Record<string, Record<string, string>>>((byDate, record) => {
          byDate[record.date] ??= {};
          byDate[record.date][record.type] = record.status;
          return byDate;
        }, {}),
        harian,
        dhuha,
        dzuhur,
        jumat
      };
    });
    
    return c.json(summary);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Get aggregated stats for dashboard (harian/mingguan/bulanan)
app.get('/api/attendance/stats', async (c) => {
  try {
    const classId = Number(c.req.query('classId'));
    if (!Number.isInteger(classId)) return c.json({ error: 'Missing classId' }, 400);
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Get start of week (7 days ago)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    
    // Get start of month
    const currentMonthPrefix = todayStr.slice(0, 8); // e.g. '2026-07-'
    
    // Fetch all attendance records
    const classStudents = await db.select({ id: users.id }).from(users).where(and(eq(users.role, 'student'), eq(users.classId, classId)));
    const studentIds = classStudents.map((student) => student.id);
    const allRecords = studentIds.length ? await db.select().from(attendance).where(inArray(attendance.userId, studentIds)) : [];
    
    const createEmptyStats = () => ({
      harian: { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0, total: 0 },
      dhuha: { Berjamaah: 0, Munfarid: 0, Berhalangan: 0, Alfa: 0, total: 0 },
      dzuhur: { Berjamaah: 0, Munfarid: 0, Berhalangan: 0, Alfa: 0, total: 0 },
      jumat: { Berjamaah: 0, Munfarid: 0, Berhalangan: 0, Alfa: 0, total: 0 }
    });

    const daily = createEmptyStats();
    const weekly = createEmptyStats();
    const monthly = createEmptyStats();

    const processRecord = (r: any, target: any) => {
      const t = r.type as 'harian' | 'dhuha' | 'dzuhur' | 'jumat';
      if (!target[t]) return;
      
      const s = r.status;
      if (t === 'harian') {
        if (s === 'Hadir') target.harian.Hadir++;
        else if (s === 'Sakit') target.harian.Sakit++;
        else if (s === 'Izin') target.harian.Izin++;
        else if (s === 'Alfa') target.harian.Alfa++;
        target.harian.total++;
      } else {
        if (s === 'Berjamaah' || s === 'Sholat') target[t].Berjamaah++;
        else if (s === 'Munfarid') target[t].Munfarid++;
        else if (s === 'Berhalangan') target[t].Berhalangan++;
        else if (s === 'Alfa') target[t].Alfa++;
        target[t].total++;
      }
    };

    allRecords.forEach(r => {
      // Daily
      if (r.date === todayStr) {
        processRecord(r, daily);
      }
      // Weekly
      if (r.date >= sevenDaysAgoStr && r.date <= todayStr) {
        processRecord(r, weekly);
      }
      // Monthly
      if (r.date.startsWith(currentMonthPrefix)) {
        processRecord(r, monthly);
      }
    });
    
    return c.json({ daily, weekly, monthly });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Personal names in this recap are limited to the homeroom/admin view. It is
// intended as a concise monthly follow-up aid, not a public ranking.
app.get('/api/class-insights', async (c) => {
  try {
    const classId = Number(c.req.query('classId'));
    const month = c.req.query('month') || new Date().toISOString().slice(0, 7);
    const authenticatedUser = getAuthenticatedUser(c);
    if (!Number.isInteger(classId) || !/^\d{4}-\d{2}$/.test(month)) return c.json({ error: 'Kelas atau periode tidak valid.' }, 400);
    if (!authenticatedUser || !canManageClass(authenticatedUser) || !(await mayAccessClass(authenticatedUser, classId))) {
      return c.json({ error: 'Anda tidak memiliki akses ke ringkasan tindak lanjut kelas ini.' }, 403);
    }

    const studentsList = await db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.role, 'student'), eq(users.classId, classId), eq(users.status, 'Aktif')));
    const studentIds = studentsList.map((student) => student.id);
    const [attendanceRecords, behaviorRows] = studentIds.length ? await Promise.all([
      db.select().from(attendance).where(and(like(attendance.date, `${month}-%`), inArray(attendance.userId, studentIds))),
      db.select().from(behaviorRecords).where(and(like(behaviorRecords.date, `${month}-%`), inArray(behaviorRecords.studentId, studentIds))),
    ]) : [[], []];

    const metrics = studentsList.map((student) => {
      const records = attendanceRecords.filter((record) => record.userId === student.id);
      const daily = records.filter((record) => record.type === 'harian');
      const positivePoints = behaviorRows.filter((record) => record.studentId === student.id && record.type === 'positif').reduce((total, record) => total + record.points, 0);
      return {
        studentId: student.id.toString(), name: student.name,
        dailyAlfa: daily.filter((record) => record.status === 'Alfa').length,
        prayerAlfa: records.filter((record) => ['dhuha', 'dzuhur', 'jumat'].includes(record.type) && record.status === 'Alfa').length,
        dailyRecords: daily.length,
        attendanceRate: daily.length ? Math.round((daily.filter((record) => record.status === 'Hadir').length / daily.length) * 100) : 0,
        positivePoints,
      };
    });
    const highest = (items: typeof metrics, value: (item: (typeof metrics)[number]) => number, minimum = 1) => {
      const sorted = [...items].sort((first, second) => value(second) - value(first) || first.name.localeCompare(second.name, 'id'));
      return sorted.length && value(sorted[0]) >= minimum ? sorted[0] : null;
    };
    const mostDiligentCandidates = metrics.filter((item) => item.dailyRecords >= 10);

    return c.json({
      month,
      followUp: {
        dailyAlfa: highest(metrics, (item) => item.dailyAlfa),
        prayerAlfa: highest(metrics, (item) => item.prayerAlfa),
      },
      appreciation: {
        mostDiligent: highest(mostDiligentCandidates, (item) => item.attendanceRate),
        mostActive: highest(metrics, (item) => item.positivePoints),
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

const CASE_CATEGORIES = ['akademik', 'presensi', 'sikap', 'sosial-emosional', 'kesehatan', 'keluarga-lingkungan', 'lainnya'] as const;
const CASE_PRIORITIES = ['rendah', 'sedang', 'tinggi', 'mendesak'] as const;
const CASE_STATUSES = ['terbuka', 'ditangani', 'selesai'] as const;
const CASE_VISIBILITIES = ['ringkasan', 'sensitif'] as const;

const LEARNING_OBSERVATION_CATEGORIES = ['pemahaman konsep', 'strategi pemecahan masalah', 'literasi soal', 'kemandirian', 'partisipasi', 'kolaborasi', 'lainnya'] as const;

const canManageLearningProfiles = (user: AuthUser) =>
  user.role !== 'student' && (canManageClass(user) || user.roles.includes('teacher') || user.roles.includes('counselor') || user.role === 'counselor');

async function getAccessibleLearningStudent(user: AuthUser, studentId: number) {
  const student = (await db.select({ id: users.id, name: users.name, identifier: users.identifier, classId: users.classId, status: users.status }).from(users).where(and(eq(users.id, studentId), eq(users.role, 'student'))).limit(1))[0];
  if (!student || !student.classId || !(await mayAccessClass(user, student.classId))) return null;
  const classItem = (await db.select({ id: classes.id, name: classes.name, academicYear: classes.academicYear }).from(classes).where(eq(classes.id, student.classId)).limit(1))[0];
  return { student, classItem };
}

function learningLevel(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 4 ? parsed : null;
}

async function serializeLearningProfile(item: typeof studentLearningProfiles.$inferSelect) {
  const updater = (await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, item.updatedBy)).limit(1))[0];
  return {
    id: item.id.toString(), studentId: item.studentId.toString(), subject: item.subject, topic: item.topic,
    conceptLevel: item.conceptLevel, reasoningLevel: item.reasoningLevel, literacyLevel: item.literacyLevel, independenceLevel: item.independenceLevel,
    strengths: item.strengths || '', supportNeeds: item.supportNeeds || '', updatedBy: updater ? { id: updater.id.toString(), name: updater.name } : null,
    createdAt: formatCaseDate(item.createdAt), updatedAt: formatCaseDate(item.updatedAt),
  };
}

function serializeLearningCheckpoint(item: typeof studentLearningCheckpoints.$inferSelect, recorderRows: Array<{ id: number; name: string }>) {
  const recorder = recorderRows.find((candidate) => candidate.id === item.recordedBy);
  return {
    id: item.id.toString(), studentId: item.studentId.toString(), classId: item.classId.toString(), subject: item.subject, topic: item.topic, date: item.date,
    recallLevel: item.recallLevel, reasoningLevel: item.reasoningLevel, transferLevel: item.transferLevel, reflection: item.reflection || '',
    recordedBy: recorder ? { id: recorder.id.toString(), name: recorder.name } : null, createdAt: formatCaseDate(item.createdAt),
  };
}

app.get('/api/student-learning-profiles/:studentId', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const studentId = Number(c.req.param('studentId'));
    if (!user || !canManageLearningProfiles(user) || !Number.isInteger(studentId) || studentId <= 0) return c.json({ error: 'Anda tidak memiliki akses ke profil belajar ini.' }, 403);
    const context = await getAccessibleLearningStudent(user, studentId);
    if (!context) return c.json({ error: 'Siswa tidak ditemukan atau tidak termasuk kelas yang dapat Anda akses.' }, 404);
    const [profileRows, observationRows, checkpointRows, recorderRows] = await Promise.all([
      db.select().from(studentLearningProfiles).where(eq(studentLearningProfiles.studentId, studentId)),
      db.select().from(studentLearningObservations).where(eq(studentLearningObservations.studentId, studentId)),
      db.select().from(studentLearningCheckpoints).where(eq(studentLearningCheckpoints.studentId, studentId)),
      db.select({ id: users.id, name: users.name }).from(users),
    ]);
    return c.json({
      student: { id: context.student.id.toString(), name: context.student.name, identifier: context.student.identifier, status: context.student.status, classId: context.student.classId.toString(), className: context.classItem?.name || 'Kelas', academicYear: context.classItem?.academicYear || '' },
      profiles: await Promise.all(profileRows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).map(serializeLearningProfile)),
      observations: observationRows.sort((a, b) => `${b.date}-${b.id}`.localeCompare(`${a.date}-${a.id}`)).map((item) => ({
        id: item.id.toString(), studentId: item.studentId.toString(), classId: item.classId.toString(), subject: item.subject, topic: item.topic, category: item.category, note: item.note, date: item.date,
        recordedBy: recorderRows.find((recorder) => recorder.id === item.recordedBy) ? { id: item.recordedBy.toString(), name: recorderRows.find((recorder) => recorder.id === item.recordedBy)!.name } : null,
        createdAt: formatCaseDate(item.createdAt),
      })),
      checkpoints: checkpointRows.sort((a, b) => `${b.date}-${b.id}`.localeCompare(`${a.date}-${a.id}`)).map((item) => serializeLearningCheckpoint(item, recorderRows)),
    });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.put('/api/student-learning-profiles/:studentId', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const studentId = Number(c.req.param('studentId'));
    if (!user || !canManageLearningProfiles(user) || !Number.isInteger(studentId) || studentId <= 0) return c.json({ error: 'Anda tidak memiliki akses untuk mengubah profil belajar.' }, 403);
    const context = await getAccessibleLearningStudent(user, studentId);
    if (!context) return c.json({ error: 'Siswa tidak ditemukan atau tidak termasuk kelas yang dapat Anda akses.' }, 404);
    const body = await c.req.json().catch(() => ({}));
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    const conceptLevel = learningLevel(body.conceptLevel);
    const reasoningLevel = learningLevel(body.reasoningLevel);
    const literacyLevel = learningLevel(body.literacyLevel);
    const independenceLevel = learningLevel(body.independenceLevel);
    const strengths = typeof body.strengths === 'string' ? body.strengths.trim() : '';
    const supportNeeds = typeof body.supportNeeds === 'string' ? body.supportNeeds.trim() : '';
    if (!subject || subject.length > 80 || !topic || topic.length > 120 || conceptLevel === null || reasoningLevel === null || literacyLevel === null || independenceLevel === null || strengths.length > 1000 || supportNeeds.length > 1000) return c.json({ error: 'Data profil belajar belum lengkap atau tidak valid.' }, 400);
    const existing = (await db.select().from(studentLearningProfiles).where(and(eq(studentLearningProfiles.studentId, studentId), eq(studentLearningProfiles.subject, subject), eq(studentLearningProfiles.topic, topic))).limit(1))[0];
    if (existing) {
      await db.update(studentLearningProfiles).set({ conceptLevel, reasoningLevel, literacyLevel, independenceLevel, strengths: strengths || null, supportNeeds: supportNeeds || null, updatedBy: user.id, updatedAt: new Date() }).where(eq(studentLearningProfiles.id, existing.id));
    } else {
      await db.insert(studentLearningProfiles).values({ studentId, subject, topic, conceptLevel, reasoningLevel, literacyLevel, independenceLevel, strengths: strengths || null, supportNeeds: supportNeeds || null, updatedBy: user.id });
    }
    const saved = (await db.select().from(studentLearningProfiles).where(and(eq(studentLearningProfiles.studentId, studentId), eq(studentLearningProfiles.subject, subject), eq(studentLearningProfiles.topic, topic))).limit(1))[0];
    return c.json(await serializeLearningProfile(saved));
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.post('/api/student-learning-profiles/:studentId/observations', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const studentId = Number(c.req.param('studentId'));
    if (!user || !canManageLearningProfiles(user) || !Number.isInteger(studentId) || studentId <= 0) return c.json({ error: 'Anda tidak memiliki akses untuk menambah observasi.' }, 403);
    const context = await getAccessibleLearningStudent(user, studentId);
    if (!context || !context.student.classId) return c.json({ error: 'Siswa tidak ditemukan atau tidak termasuk kelas yang dapat Anda akses.' }, 404);
    const body = await c.req.json().catch(() => ({}));
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    const category = typeof body.category === 'string' ? body.category : '';
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : jakartaDateString();
    if (!subject || subject.length > 80 || !topic || topic.length > 120 || !LEARNING_OBSERVATION_CATEGORIES.includes(category as typeof LEARNING_OBSERVATION_CATEGORIES[number]) || !note || note.length > 1000) return c.json({ error: 'Data observasi belum lengkap atau tidak valid.' }, 400);
    const inserted = await db.insert(studentLearningObservations).values({ studentId, classId: context.student.classId, subject, topic, category, note, date, recordedBy: user.id }).returning();
    return c.json({ id: inserted[0].id.toString(), studentId: studentId.toString(), classId: context.student.classId.toString(), subject, topic, category, note, date, recordedBy: { id: user.id.toString(), name: user.name }, createdAt: formatCaseDate(inserted[0].createdAt) }, 201);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.post('/api/student-learning-profiles/:studentId/checkpoints', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const studentId = Number(c.req.param('studentId'));
    if (!user || !canManageLearningProfiles(user) || !Number.isInteger(studentId) || studentId <= 0) return c.json({ error: 'Anda tidak memiliki akses untuk menambah checkpoint.' }, 403);
    const context = await getAccessibleLearningStudent(user, studentId);
    if (!context || !context.student.classId) return c.json({ error: 'Siswa tidak ditemukan atau tidak termasuk kelas yang dapat Anda akses.' }, 404);
    const body = await c.req.json().catch(() => ({}));
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : jakartaDateString();
    const recallLevel = learningLevel(body.recallLevel);
    const reasoningLevel = learningLevel(body.reasoningLevel);
    const transferLevel = learningLevel(body.transferLevel);
    const reflection = typeof body.reflection === 'string' ? body.reflection.trim() : '';
    if (!subject || subject.length > 80 || !topic || topic.length > 120 || recallLevel === null || reasoningLevel === null || transferLevel === null || reflection.length > 1000) return c.json({ error: 'Data checkpoint belum lengkap atau tidak valid.' }, 400);
    const inserted = await db.insert(studentLearningCheckpoints).values({ studentId, classId: context.student.classId, subject, topic, date, recallLevel, reasoningLevel, transferLevel, reflection: reflection || null, recordedBy: user.id }).returning();
    return c.json(serializeLearningCheckpoint(inserted[0], [{ id: user.id, name: user.name }]), 201);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.delete('/api/student-learning-observations/:id', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const id = Number(c.req.param('id'));
    if (!user || !canManageLearningProfiles(user) || !Number.isInteger(id) || id <= 0) return c.json({ error: 'Anda tidak memiliki akses untuk menghapus observasi.' }, 403);
    const observation = (await db.select().from(studentLearningObservations).where(eq(studentLearningObservations.id, id)).limit(1))[0];
    if (!observation || !(await mayAccessClass(user, observation.classId))) return c.json({ error: 'Observasi tidak ditemukan.' }, 404);
    await db.delete(studentLearningObservations).where(eq(studentLearningObservations.id, id));
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.delete('/api/student-learning-checkpoints/:id', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const id = Number(c.req.param('id'));
    if (!user || !canManageLearningProfiles(user) || !Number.isInteger(id) || id <= 0) return c.json({ error: 'Anda tidak memiliki akses untuk menghapus checkpoint.' }, 403);
    const checkpoint = (await db.select().from(studentLearningCheckpoints).where(eq(studentLearningCheckpoints.id, id)).limit(1))[0];
    if (!checkpoint || !(await mayAccessClass(user, checkpoint.classId))) return c.json({ error: 'Checkpoint tidak ditemukan.' }, 404);
    await db.delete(studentLearningCheckpoints).where(eq(studentLearningCheckpoints.id, id));
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.get('/api/student-learning-summary', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const classId = Number(c.req.query('classId'));
    const subject = typeof c.req.query('subject') === 'string' ? c.req.query('subject')!.trim() : '';
    const topic = typeof c.req.query('topic') === 'string' ? c.req.query('topic')!.trim() : '';
    if (!user || !canManageLearningProfiles(user) || !Number.isInteger(classId) || classId <= 0) return c.json({ error: 'Kelas atau akses profil belajar tidak valid.' }, 400);
    if (!(await mayAccessClass(user, classId))) return c.json({ error: 'Anda tidak memiliki akses ke kelas ini.' }, 403);
    const [classItem, studentRows] = await Promise.all([
      db.select({ id: classes.id, name: classes.name, academicYear: classes.academicYear }).from(classes).where(eq(classes.id, classId)).limit(1),
      db.select({ id: users.id, name: users.name, identifier: users.identifier, status: users.status }).from(users).where(and(eq(users.role, 'student'), eq(users.classId, classId), eq(users.status, 'Aktif'))).orderBy(users.name),
    ]);
    if (!classItem[0]) return c.json({ error: 'Kelas tidak ditemukan.' }, 404);
    const studentIds = studentRows.map((student) => student.id);
    const [profileRows, checkpointRows] = studentIds.length ? await Promise.all([
      db.select().from(studentLearningProfiles).where(inArray(studentLearningProfiles.studentId, studentIds)),
      db.select().from(studentLearningCheckpoints).where(inArray(studentLearningCheckpoints.studentId, studentIds)),
    ]) : [[], []];
    const profileMatches = (studentId: number) => profileRows.filter((item) => item.studentId === studentId && (!subject || item.subject === subject) && (!topic || item.topic === topic)).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const checkpointMatches = (studentId: number) => checkpointRows.filter((item) => item.studentId === studentId && (!subject || item.subject === subject) && (!topic || item.topic === topic)).sort((a, b) => `${b.date}-${b.id}`.localeCompare(`${a.date}-${a.id}`));
    return c.json({
      class: { id: classItem[0].id.toString(), name: classItem[0].name, academicYear: classItem[0].academicYear }, subject, topic,
      students: studentRows.map((student) => {
        const profile = profileMatches(student.id)[0];
        const checkpoint = checkpointMatches(student.id)[0];
        return {
          id: student.id.toString(), name: student.name, identifier: student.identifier, status: student.status,
          profile: profile ? { id: profile.id.toString(), subject: profile.subject, topic: profile.topic, conceptLevel: profile.conceptLevel, reasoningLevel: profile.reasoningLevel, literacyLevel: profile.literacyLevel, independenceLevel: profile.independenceLevel, updatedAt: formatCaseDate(profile.updatedAt) } : null,
          checkpoint: checkpoint ? serializeLearningCheckpoint(checkpoint, []) : null,
        };
      }),
    });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

const canViewSensitiveCase = (user: AuthUser, item: { visibility: string; ownerId: number }) =>
  user.roles.includes('admin') || user.roles.includes('counselor') || user.role === 'counselor' || item.ownerId === user.id;

const formatCaseDate = (value: Date | null | undefined) => value instanceof Date ? value.toISOString() : value || null;

async function serializeStudentCase(item: typeof studentCases.$inferSelect) {
  const [student, classItem, owner, creator] = await Promise.all([
    db.select({ id: users.id, name: users.name, identifier: users.identifier }).from(users).where(eq(users.id, item.studentId)).limit(1),
    db.select({ id: classes.id, name: classes.name, academicYear: classes.academicYear }).from(classes).where(eq(classes.id, item.classId)).limit(1),
    db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(eq(users.id, item.ownerId)).limit(1),
    db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(eq(users.id, item.createdBy)).limit(1),
  ]);
  return {
    id: item.id.toString(), studentId: item.studentId.toString(), classId: item.classId.toString(),
    title: item.title, category: item.category, priority: item.priority, status: item.status,
    summary: item.summary, visibility: item.visibility, ownerId: item.ownerId.toString(),
    dueDate: item.dueDate, closedAt: formatCaseDate(item.closedAt), createdAt: formatCaseDate(item.createdAt), updatedAt: formatCaseDate(item.updatedAt),
    student: student[0] ? { id: student[0].id.toString(), name: student[0].name, identifier: student[0].identifier } : null,
    class: classItem[0] ? { id: classItem[0].id.toString(), name: classItem[0].name, academicYear: classItem[0].academicYear } : null,
    owner: owner[0] ? { id: owner[0].id.toString(), name: owner[0].name, role: owner[0].role } : null,
    createdBy: creator[0] ? { id: creator[0].id.toString(), name: creator[0].name, role: creator[0].role } : null,
  };
}

app.get('/api/student-cases', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    if (!user || !canManageStudentCases(user)) return c.json({ error: 'Anda tidak memiliki akses ke pemantauan siswa.' }, 403);
    const requestedClassId = c.req.query('classId');
    const status = c.req.query('status');
    const priority = c.req.query('priority');
    const accessibleIds = await accessibleClassIds(user);
    const requestedId = requestedClassId ? Number(requestedClassId) : null;
    if (requestedId !== null && (!Number.isInteger(requestedId) || !(await mayAccessClass(user, requestedId)))) return c.json({ error: 'Anda tidak memiliki akses ke kelas ini.' }, 403);
    const rows = await db.select().from(studentCases);
    const visible = rows.filter((item) =>
      (requestedId === null || item.classId === requestedId) &&
      (accessibleIds === null || accessibleIds.includes(item.classId)) &&
      (!status || item.status === status) &&
      (!priority || item.priority === priority) &&
      (item.visibility !== 'sensitif' || canViewSensitiveCase(user, item))
    );
    const serialized = await Promise.all(visible.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).map(serializeStudentCase));
    return c.json(serialized);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.get('/api/student-cases/:id', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const id = Number(c.req.param('id'));
    if (!user || !canManageStudentCases(user) || !Number.isInteger(id)) return c.json({ error: 'Anda tidak memiliki akses ke kasus ini.' }, 403);
    const item = (await db.select().from(studentCases).where(eq(studentCases.id, id)).limit(1))[0];
    if (!item || !(await mayAccessClass(user, item.classId)) || (item.visibility === 'sensitif' && !canViewSensitiveCase(user, item))) return c.json({ error: 'Kasus tidak ditemukan.' }, 404);
    const updates = await db.select().from(caseUpdates).where(eq(caseUpdates.caseId, id));
    const visibleUpdates = updates
      .filter((update) => update.visibility !== 'sensitif' || canViewSensitiveCase(user, item))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const authors = await db.select({ id: users.id, name: users.name, role: users.role }).from(users);
    return c.json({
      ...(await serializeStudentCase(item)),
      updates: visibleUpdates.map((update) => ({
        id: update.id.toString(), note: update.note, visibility: update.visibility,
        nextFollowUpDate: update.nextFollowUpDate, createdAt: formatCaseDate(update.createdAt),
        author: authors.find((author) => author.id === update.authorId) ? {
          id: update.authorId.toString(), name: authors.find((author) => author.id === update.authorId)!.name,
        } : null,
      })),
    });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.post('/api/student-cases', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    if (!user || !canManageStudentCases(user)) return c.json({ error: 'Anda tidak memiliki akses ke pemantauan siswa.' }, 403);
    const body = await c.req.json();
    const studentId = Number(body.studentId);
    const classId = Number(body.classId);
    const ownerId = body.ownerId ? Number(body.ownerId) : user.id;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
    const category = typeof body.category === 'string' ? body.category : '';
    const priority = typeof body.priority === 'string' ? body.priority : 'sedang';
    const visibility = typeof body.visibility === 'string' ? body.visibility : 'ringkasan';
    const dueDate = typeof body.dueDate === 'string' && body.dueDate ? body.dueDate : null;
    if (!Number.isInteger(studentId) || !Number.isInteger(classId) || !Number.isInteger(ownerId) || !title || !summary || !CASE_CATEGORIES.includes(category as typeof CASE_CATEGORIES[number]) || !CASE_PRIORITIES.includes(priority as typeof CASE_PRIORITIES[number]) || !CASE_VISIBILITIES.includes(visibility as typeof CASE_VISIBILITIES[number]) || (dueDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))) return c.json({ error: 'Data kasus belum lengkap atau tidak valid.' }, 400);
    if (!(await mayAccessClass(user, classId))) return c.json({ error: 'Anda tidak memiliki akses ke kelas ini.' }, 403);
    const student = (await db.select({ id: users.id, classId: users.classId }).from(users).where(and(eq(users.id, studentId), eq(users.role, 'student'), eq(users.status, 'Aktif'))).limit(1))[0];
    if (!student || student.classId !== classId) return c.json({ error: 'Siswa tidak sesuai dengan kelas yang dipilih.' }, 400);
    const owner = (await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, ownerId)).limit(1))[0];
    if (!owner || owner.role === 'student') return c.json({ error: 'Penanggung jawab tidak valid.' }, 400);
    const inserted = await db.insert(studentCases).values({ studentId, classId, title, category, priority: priority as typeof CASE_PRIORITIES[number], status: 'terbuka', summary, visibility: visibility as typeof CASE_VISIBILITIES[number], ownerId, dueDate, createdBy: user.id, updatedAt: new Date() }).returning();
    return c.json(await serializeStudentCase(inserted[0]), 201);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.patch('/api/student-cases/:id', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const id = Number(c.req.param('id'));
    if (!user || !canManageStudentCases(user) || !Number.isInteger(id)) return c.json({ error: 'Anda tidak memiliki akses ke kasus ini.' }, 403);
    const current = (await db.select().from(studentCases).where(eq(studentCases.id, id)).limit(1))[0];
    if (!current || !(await mayAccessClass(user, current.classId))) return c.json({ error: 'Kasus tidak ditemukan.' }, 404);
    const body = await c.req.json();
    const updates: Partial<typeof studentCases.$inferInsert> = { updatedAt: new Date() };
    if (typeof body.status === 'string' && CASE_STATUSES.includes(body.status as typeof CASE_STATUSES[number])) { updates.status = body.status as typeof CASE_STATUSES[number]; updates.closedAt = body.status === 'selesai' ? new Date() : null; }
    if (typeof body.priority === 'string' && CASE_PRIORITIES.includes(body.priority as typeof CASE_PRIORITIES[number])) updates.priority = body.priority as typeof CASE_PRIORITIES[number];
    if (typeof body.visibility === 'string' && CASE_VISIBILITIES.includes(body.visibility as typeof CASE_VISIBILITIES[number])) updates.visibility = body.visibility as typeof CASE_VISIBILITIES[number];
    if (typeof body.dueDate === 'string' || body.dueDate === null) updates.dueDate = body.dueDate || null;
    if (body.ownerId !== undefined) {
      const ownerId = Number(body.ownerId);
      const owner = (await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, ownerId)).limit(1))[0];
      if (!owner || owner.role === 'student') return c.json({ error: 'Penanggung jawab tidak valid.' }, 400);
      updates.ownerId = ownerId;
    }
    const updated = (await db.update(studentCases).set(updates).where(eq(studentCases.id, id)).returning())[0];
    return c.json(await serializeStudentCase(updated));
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.post('/api/student-cases/:id/updates', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const id = Number(c.req.param('id'));
    if (!user || !canManageStudentCases(user) || !Number.isInteger(id)) return c.json({ error: 'Anda tidak memiliki akses ke kasus ini.' }, 403);
    const item = (await db.select().from(studentCases).where(eq(studentCases.id, id)).limit(1))[0];
    if (!item || !(await mayAccessClass(user, item.classId))) return c.json({ error: 'Kasus tidak ditemukan.' }, 404);
    const body = await c.req.json();
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    const visibility = body.visibility === 'sensitif' ? 'sensitif' : 'ringkasan';
    const nextFollowUpDate = typeof body.nextFollowUpDate === 'string' && body.nextFollowUpDate ? body.nextFollowUpDate : null;
    if (!note || note.length > 5000 || (nextFollowUpDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(nextFollowUpDate))) return c.json({ error: 'Catatan tindak lanjut tidak valid.' }, 400);
    const inserted = await db.insert(caseUpdates).values({ caseId: id, authorId: user.id, note, visibility, nextFollowUpDate }).returning();
    await db.update(studentCases).set({ updatedAt: new Date(), dueDate: nextFollowUpDate || item.dueDate }).where(eq(studentCases.id, id));
    return c.json({ id: inserted[0].id.toString(), success: true }, 201);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.get('/api/student-case-warnings', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    if (!user || !canManageStudentCases(user)) return c.json({ error: 'Anda tidak memiliki akses ke pemantauan siswa.' }, 403);
    const requestedClassId = c.req.query('classId');
    const classId = requestedClassId ? Number(requestedClassId) : null;
    const accessibleIds = await accessibleClassIds(user);
    if (classId !== null && (!Number.isInteger(classId) || !(await mayAccessClass(user, classId)))) return c.json({ error: 'Anda tidak memiliki akses ke kelas ini.' }, 403);
    const students = await db.select({ id: users.id, name: users.name, classId: users.classId }).from(users).where(and(eq(users.role, 'student'), eq(users.status, 'Aktif')));
    const scopedStudents = students.filter((student) => (classId === null || student.classId === classId) && student.classId !== null && (accessibleIds === null || accessibleIds.includes(student.classId)));
    const studentIds = scopedStudents.map((student) => student.id);
    if (!studentIds.length) return c.json([]);
    const month = new Date().toISOString().slice(0, 7);
    const [attendanceRows, gradeRows, behaviorRows, assignmentRows, submissionRows] = await Promise.all([
      db.select().from(attendance).where(and(like(attendance.date, `${month}-%`), inArray(attendance.userId, studentIds))),
      db.select().from(grades).where(inArray(grades.userId, studentIds)),
      db.select().from(behaviorRecords).where(and(like(behaviorRecords.date, `${month}-%`), inArray(behaviorRecords.studentId, studentIds))),
      db.select({ id: assignments.id, dueDate: assignments.dueDate }).from(assignments),
      db.select({ assignmentId: submissions.assignmentId, userId: submissions.userId }).from(submissions).where(inArray(submissions.userId, studentIds)),
    ]);
    const overdueAssignments = assignmentRows.filter((assignment) => assignment.dueDate && assignment.dueDate.getTime() < Date.now());
    const warnings: Array<{ id: string; studentId: string; studentName: string; classId: string; kind: string; priority: string; reason: string; value: number }> = [];
    for (const student of scopedStudents) {
      const studentAttendance = attendanceRows.filter((record) => record.userId === student.id && record.type === 'harian');
      const alfaCount = studentAttendance.filter((record) => record.status === 'Alfa').length;
      const attendanceRate = studentAttendance.length ? Math.round((studentAttendance.filter((record) => record.status === 'Hadir').length / studentAttendance.length) * 100) : 100;
      const studentGrades = gradeRows.filter((grade) => grade.userId === student.id);
      const averageGrade = studentGrades.length ? Math.round(studentGrades.reduce((total, grade) => total + grade.score, 0) / studentGrades.length) : 100;
      const negativeBehavior = behaviorRows.filter((record) => record.studentId === student.id && record.type === 'negatif').length;
      const pendingAssignments = overdueAssignments.filter((assignment) => !submissionRows.some((submission) => submission.userId === student.id && submission.assignmentId === assignment.id)).length;
      if (studentAttendance.length >= 5 && attendanceRate < 75) warnings.push({ id: `attendance-rate-${student.id}`, studentId: student.id.toString(), studentName: student.name, classId: student.classId!.toString(), kind: 'presensi', priority: 'tinggi', reason: `Tingkat hadir ${attendanceRate}% dari ${studentAttendance.length} catatan harian.`, value: attendanceRate });
      if (alfaCount >= 3) warnings.push({ id: `alfa-${student.id}`, studentId: student.id.toString(), studentName: student.name, classId: student.classId!.toString(), kind: 'presensi', priority: 'tinggi', reason: `${alfaCount} kali Alfa pada bulan berjalan.`, value: alfaCount });
      if (studentGrades.length >= 2 && averageGrade < 75) warnings.push({ id: `grade-${student.id}`, studentId: student.id.toString(), studentName: student.name, classId: student.classId!.toString(), kind: 'akademik', priority: 'sedang', reason: `Nilai rata-rata ${averageGrade} dari ${studentGrades.length} penilaian.`, value: averageGrade });
      if (negativeBehavior >= 3) warnings.push({ id: `behavior-${student.id}`, studentId: student.id.toString(), studentName: student.name, classId: student.classId!.toString(), kind: 'sikap', priority: 'sedang', reason: `${negativeBehavior} catatan perilaku negatif bulan berjalan.`, value: negativeBehavior });
      if (pendingAssignments >= 2) warnings.push({ id: `assignment-${student.id}`, studentId: student.id.toString(), studentName: student.name, classId: student.classId!.toString(), kind: 'akademik', priority: 'sedang', reason: `${pendingAssignments} tugas melewati tenggat dan belum dikumpulkan.`, value: pendingAssignments });
    }
    return c.json(warnings);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

// GET all grades
app.get('/api/subjects', async (c) => {
  try {
    return c.json(await db.select().from(subjects).orderBy(subjects.name));
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/subjects', async (c) => {
  try {
    const name = String((await c.req.json()).name || '').trim();
    if (!name) return c.json({ error: 'Nama mata pelajaran wajib diisi' }, 400);
    const inserted = await db.insert(subjects).values({ name }).returning();
    return c.json(inserted[0], 201);
  } catch (err: any) {
    return c.json({ error: 'Mata pelajaran sudah ada atau data tidak valid' }, 400);
  }
});

app.put('/api/subjects/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const name = String((await c.req.json()).name || '').trim();
    const existing = await db.select().from(subjects).where(eq(subjects.id, id)).limit(1);
    if (!existing[0] || !name) return c.json({ error: 'Mata pelajaran tidak ditemukan atau nama tidak valid' }, 400);
    await db.update(subjects).set({ name }).where(eq(subjects.id, id));
    await db.update(grades).set({ subject: name }).where(eq(grades.subject, existing[0].name));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: 'Nama mata pelajaran sudah digunakan' }, 400);
  }
});

app.delete('/api/subjects/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const existing = await db.select().from(subjects).where(eq(subjects.id, id)).limit(1);
    if (!existing[0]) return c.json({ error: 'Mata pelajaran tidak ditemukan' }, 404);
    const relatedGrades = await db.select().from(grades).where(eq(grades.subject, existing[0].name)).limit(1);
    if (relatedGrades.length) return c.json({ error: 'Hapus seluruh penilaian mata pelajaran ini terlebih dahulu' }, 409);
    await db.delete(subjects).where(eq(subjects.id, id));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get('/api/grades', async (c) => {
  try {
    const classId = Number(c.req.query('classId'));
    if (!Number.isInteger(classId)) return c.json({ error: 'Missing classId' }, 400);
    const authenticatedUser = getAuthenticatedUser(c);
    if (authenticatedUser && !(await mayAccessClass(authenticatedUser, classId))) return c.json({ error: 'Anda tidak memiliki akses ke kelas ini.' }, 403);
    const classStudents = await db.select({ id: users.id }).from(users).where(and(eq(users.role, 'student'), eq(users.classId, classId)));
    const studentIds = classStudents.map((student) => student.id);
    let list = studentIds.length ? await db.select().from(grades).where(inArray(grades.userId, studentIds)) : [];
    if (authenticatedUser?.roles.includes('teacher') && !canManageClass(authenticatedUser)) {
      const assignmentsForTeacher = await db.select({ subjectId: teachingAssignments.subjectId }).from(teachingAssignments).where(and(eq(teachingAssignments.teacherId, authenticatedUser.id), eq(teachingAssignments.classId, classId)));
      const allowedSubjectIds = assignmentsForTeacher.map((item) => item.subjectId);
      const allowedSubjects = allowedSubjectIds.length ? await db.select({ name: subjects.name }).from(subjects).where(inArray(subjects.id, allowedSubjectIds)) : [];
      const allowedNames = new Set(allowedSubjects.map((item) => item.name));
      list = list.filter((item) => allowedNames.has(item.subject));
    }
    return c.json(list);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST save / bulk upsert grades
app.post('/api/grades', async (c) => {
  try {
    const body = await c.req.json();
    const { subject, type, name, scores } = body;
    const classId = Number(body.classId);
    if (!subject || !type || !name || !Array.isArray(scores) || !Number.isInteger(classId)) {
      return c.json({ error: 'Invalid payload parameters' }, 400);
    }
    const authenticatedUser = getAuthenticatedUser(c);
    if (!authenticatedUser || authenticatedUser.role === 'student') return c.json({ error: 'Silakan masuk sebagai guru.' }, 401);
    if (!(await mayAccessClass(authenticatedUser, classId))) return c.json({ error: 'Anda tidak memiliki akses ke kelas ini.' }, 403);
    if (authenticatedUser.roles.includes('teacher') && !canManageClass(authenticatedUser)) {
      const subjectRow = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.name, subject)).limit(1);
      const permitted = subjectRow[0] && await db.select({ id: teachingAssignments.id }).from(teachingAssignments).where(and(eq(teachingAssignments.teacherId, authenticatedUser.id), eq(teachingAssignments.classId, classId), eq(teachingAssignments.subjectId, subjectRow[0].id))).limit(1);
      if (!permitted?.length) return c.json({ error: 'Mata pelajaran ini tidak ada dalam penugasan Anda.' }, 403);
    }

    const classStudents = await db.select({ id: users.id }).from(users).where(and(eq(users.role, 'student'), eq(users.classId, classId)));
    const studentIds = classStudents.map((student) => student.id);
    if (scores.some((item: any) => !studentIds.includes(Number(item.userId)))) return c.json({ error: 'Siswa harus berasal dari kelas aktif.' }, 400);
    for (const item of scores) {
      const existing = await db.select().from(grades).where(
        and(
          eq(grades.userId, item.userId),
          eq(grades.subject, subject),
          eq(grades.type, type),
          eq(grades.name, name)
        )
      ).limit(1);

      if (existing.length > 0) {
        await db.update(grades).set({ score: item.score }).where(eq(grades.id, existing[0].id));
      } else {
        await db.insert(grades).values({
          userId: item.userId,
          subject,
          type,
          name,
          score: item.score
        });
      }
    }

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// DELETE an entire assessment column
app.delete('/api/grades/assessment', async (c) => {
  try {
    const subject = c.req.query('subject');
    const type = c.req.query('type');
    const name = c.req.query('name');
    const classId = Number(c.req.query('classId'));
    if (!subject || !type || !name || !Number.isInteger(classId)) {
      return c.json({ error: 'Missing subject, type, or name parameters' }, 400);
    }

    const classStudents = await db.select({ id: users.id }).from(users).where(and(eq(users.role, 'student'), eq(users.classId, classId)));
    const studentIds = classStudents.map((student) => student.id);
    if (studentIds.length) await db.delete(grades).where(
      and(
        eq(grades.subject, subject),
        eq(grades.type, type),
        eq(grades.name, name),
        inArray(grades.userId, studentIds)
      )
    );

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET all assignments/materials
app.get('/api/assignments', async (c) => {
  try {
    const authenticatedUser = getAuthenticatedUser(c);
    if (!authenticatedUser) return c.json({ error: 'Silakan masuk terlebih dahulu.' }, 401);
    const permittedClassIds = await accessibleClassIds(authenticatedUser);
    const list = await db.select().from(assignments);
    const targetMap = await getAssignmentTargetMap(list.map((item) => item.id));
    const visibleItems = list.filter((item) => {
      const targets = targetMap.get(item.id) || [];
      return (authenticatedUser.role !== 'student' || item.status === 'published') && (permittedClassIds === null || targets.some((target) => permittedClassIds.includes(target.id)));
    });
    return c.json(visibleItems.map((item) => ({
      ...item,
      targetClassIds: (targetMap.get(item.id) || []).map((target) => target.id),
      targetClasses: targetMap.get(item.id) || [],
      fileName: assignmentFileName(item),
      fileDownloadUrl: assignmentDownloadUrl(item.id, item.filePath),
    })));
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST create assignment/material
app.post('/api/assignments', async (c) => {
  try {
    const authenticatedUser = getAuthenticatedUser(c);
    if (!authenticatedUser || !(authenticatedUser.roles.includes('teacher') || canManageClass(authenticatedUser))) {
      return c.json({ error: 'Anda tidak memiliki hak untuk membagikan materi atau tugas.' }, 403);
    }
    const body = await c.req.json();
    const { title, description, type, filePath, dueDate } = body;
    const status: 'draft' | 'published' | 'archived' = ['draft', 'published', 'archived'].includes(body.status) ? body.status : 'published';
    const targetClassIds = parseTargetClassIds(body.targetClassIds);
    if (typeof title !== 'string' || !title.trim() || !['tugas', 'materi'].includes(type)) return c.json({ error: 'Judul dan tipe materi/tugas wajib diisi.' }, 400);
    if (!await canManageAssignmentTargets(authenticatedUser, targetClassIds)) return c.json({ error: 'Pilih kelas tujuan yang berada dalam kewenangan Anda.' }, 403);
    
    const inserted = await db.insert(assignments).values({
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() || null : null,
      type,
      status,
      filePath: typeof filePath === 'string' ? filePath.trim() || null : null,
      dueDate: type === 'tugas' && dueDate ? new Date(dueDate) : null,
      publishedAt: status === 'published' ? new Date() : null,
    }).returning();
    if (!inserted[0]) return c.json({ error: 'Materi atau tugas gagal dibuat.' }, 500);
    await db.insert(assignmentClasses).values(targetClassIds.map((classId) => ({ assignmentId: inserted[0].id, classId })));
    return c.json((await serializeAssignments(inserted))[0]);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// PUT update assignment/material and its target classes
app.put('/api/assignments/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const authenticatedUser = getAuthenticatedUser(c);
    if (!authenticatedUser || !(authenticatedUser.roles.includes('teacher') || canManageClass(authenticatedUser))) return c.json({ error: 'Anda tidak memiliki hak untuk mengubah materi atau tugas.' }, 403);
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'ID materi atau tugas tidak valid.' }, 400);
    const existing = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1);
    if (!existing[0]) return c.json({ error: 'Materi atau tugas tidak ditemukan.' }, 404);
    const currentTargetRows = await db.select({ classId: assignmentClasses.classId }).from(assignmentClasses).where(eq(assignmentClasses.assignmentId, id));
    if (!currentTargetRows.length || !await canManageAssignmentTargets(authenticatedUser, currentTargetRows.map((row) => row.classId))) return c.json({ error: 'Anda tidak memiliki akses ke kelas tujuan item ini.' }, 403);
    const body = await c.req.json();
    const targetClassIds = parseTargetClassIds(body.targetClassIds);
    const status: 'draft' | 'published' | 'archived' = ['draft', 'published', 'archived'].includes(body.status) ? body.status : (existing[0].status as 'draft' | 'published' | 'archived');
    if (typeof body.title !== 'string' || !body.title.trim() || !['tugas', 'materi'].includes(body.type)) return c.json({ error: 'Judul dan tipe materi/tugas wajib diisi.' }, 400);
    if (!await canManageAssignmentTargets(authenticatedUser, targetClassIds)) return c.json({ error: 'Pilih kelas tujuan yang berada dalam kewenangan Anda.' }, 403);
    await db.update(assignments).set({
      title: body.title.trim(),
      description: typeof body.description === 'string' ? body.description.trim() || null : null,
      type: body.type,
      status,
      filePath: typeof body.filePath === 'string' ? body.filePath.trim() || null : null,
      dueDate: body.type === 'tugas' && body.dueDate ? new Date(body.dueDate) : null,
      publishedAt: status === 'published' ? (existing[0].publishedAt || new Date()) : null,
    }).where(eq(assignments.id, id));
    await db.delete(assignmentClasses).where(eq(assignmentClasses.assignmentId, id));
    await db.insert(assignmentClasses).values(targetClassIds.map((classId) => ({ assignmentId: id, classId })));
    const updated = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1);
    return c.json((await serializeAssignments(updated))[0]);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Upload a PDF supporting file for an assignment/material.
app.post('/api/assignments/:id/file', async (c) => {
  let uploadedReference: string | null = null;
  try {
    const id = Number(c.req.param('id'));
    const authenticatedUser = getAuthenticatedUser(c);
    if (!authenticatedUser || !(authenticatedUser.roles.includes('teacher') || canManageClass(authenticatedUser))) return c.json({ error: 'Anda tidak memiliki hak untuk mengunggah file materi.' }, 403);
    const existing = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1);
    if (!existing[0]) return c.json({ error: 'Materi atau tugas tidak ditemukan.' }, 404);
    const targetRows = await db.select({ classId: assignmentClasses.classId }).from(assignmentClasses).where(eq(assignmentClasses.assignmentId, id));
    if (!targetRows.length || !(await canManageAssignmentTargets(authenticatedUser, targetRows.map((row) => row.classId)))) return c.json({ error: 'Anda tidak memiliki akses ke kelas tujuan item ini.' }, 403);
    const { file, originalName } = await readPdfUpload((await c.req.raw.formData()).get('file'), 'pendukung');
    const key = `assignments/${new Date().getFullYear()}/${id}/${crypto.randomUUID()}.pdf`;
    uploadedReference = await uploadPdf(key, file, originalName);
    await db.update(assignments).set({ filePath: uploadedReference, fileOriginalName: originalName, fileMimeType: 'application/pdf', fileSizeBytes: file.size }).where(eq(assignments.id, id));
    if (existing[0].filePath && isRustFsReference(existing[0].filePath)) await deleteObject(existing[0].filePath).catch((error) => console.error('Error deleting replaced assignment file:', error));
    uploadedReference = null;
    const updated = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1);
    return c.json((await serializeAssignments(updated))[0]);
  } catch (error: any) {
    if (uploadedReference) await deleteObject(uploadedReference).catch((cleanupError) => console.error('Error cleaning assignment upload:', cleanupError));
    const storageResponse = storageFailure(c, error);
    if (storageResponse) return storageResponse;
    return c.json({ error: error.message || 'File materi gagal diunggah.' }, 400);
  }
});

// Download an authorized assignment/material file.
app.get('/api/assignments/:id/file', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const authenticatedUser = getAuthenticatedUser(c);
    if (!authenticatedUser || !Number.isInteger(id) || id <= 0) return c.json({ error: 'File materi tidak ditemukan.' }, 404);
    const assignment = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1);
    if (!assignment[0] || !assignment[0].filePath) return c.json({ error: 'File materi tidak ditemukan.' }, 404);
    if (authenticatedUser.role === 'student' && assignment[0].status !== 'published') return c.json({ error: 'File materi tidak ditemukan.' }, 404);
    const targetRows = await db.select({ classId: assignmentClasses.classId }).from(assignmentClasses).where(eq(assignmentClasses.assignmentId, id));
    if (!targetRows.length || !(await Promise.all(targetRows.map((row) => mayAccessClass(authenticatedUser, row.classId)))).some(Boolean)) return c.json({ error: 'Anda tidak memiliki akses ke file ini.' }, 403);
    if (!isRustFsReference(assignment[0].filePath)) return /^https?:\/\//i.test(assignment[0].filePath) ? c.redirect(assignment[0].filePath) : c.json({ error: 'File materi tidak tersedia.' }, 404);
    const object = await readObject(assignment[0].filePath);
    const body = new Uint8Array(object.body.byteLength);
    body.set(object.body);
    return new Response(body.buffer, { headers: { 'Content-Type': object.contentType, 'Content-Disposition': `inline; filename="${(assignment[0].fileOriginalName || 'materi.pdf').replace(/["\\\r\n]/g, '_')}"`, 'Cache-Control': 'private, no-store' } });
  } catch (error: any) {
    const storageResponse = storageFailure(c, error);
    if (storageResponse) return storageResponse;
    console.error('Error downloading assignment file:', error);
    return c.json({ error: 'File materi tidak dapat diambil.' }, 404);
  }
});

// DELETE assignment/material
app.delete('/api/assignments/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const authenticatedUser = getAuthenticatedUser(c);
    if (!authenticatedUser || !(authenticatedUser.roles.includes('teacher') || canManageClass(authenticatedUser))) return c.json({ error: 'Anda tidak memiliki hak untuk menghapus materi atau tugas.' }, 403);
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'ID materi atau tugas tidak valid.' }, 400);
    const targetRows = await db.select({ classId: assignmentClasses.classId }).from(assignmentClasses).where(eq(assignmentClasses.assignmentId, id));
    if (!targetRows.length || !await canManageAssignmentTargets(authenticatedUser, targetRows.map((row) => row.classId))) return c.json({ error: 'Anda tidak memiliki akses ke kelas tujuan item ini.' }, 403);
    const assignment = await db.select({ filePath: assignments.filePath }).from(assignments).where(eq(assignments.id, id)).limit(1);
    // Delete associated submissions first
    await db.delete(submissions).where(eq(submissions.assignmentId, id));
    await db.delete(assignmentClasses).where(eq(assignmentClasses.assignmentId, id));
    // Delete assignment
    await db.delete(assignments).where(eq(assignments.id, id));
    if (assignment[0]?.filePath && isRustFsReference(assignment[0].filePath)) await deleteObject(assignment[0].filePath).catch((error) => console.error('Error deleting assignment file:', error));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET submissions for an assignment
app.get('/api/assignments/:id/submissions', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const classId = Number(c.req.query('classId'));
    const authenticatedUser = getAuthenticatedUser(c);
    if (!Number.isInteger(classId) || classId <= 0) return c.json({ error: 'Kelas wajib dipilih.' }, 400);
    if (!authenticatedUser || !(await mayAccessClass(authenticatedUser, classId))) return c.json({ error: 'Anda tidak memiliki akses ke kelas ini.' }, 403);
    const target = await db.select({ id: assignmentClasses.id }).from(assignmentClasses).where(and(
      eq(assignmentClasses.assignmentId, id),
      eq(assignmentClasses.classId, classId),
    )).limit(1);
    if (!target[0]) return c.json({ error: 'Tugas tidak ditujukan ke kelas ini.' }, 403);
    const assignment = await db.select({ dueDate: assignments.dueDate }).from(assignments).where(eq(assignments.id, id)).limit(1);

    const allStudents = await db.select().from(users).where(and(eq(users.role, 'student'), eq(users.classId, classId)));
    const allSubmissions = await db.select().from(submissions).where(eq(submissions.assignmentId, id));
    
    const result = allStudents.map(student => {
      const sub = allSubmissions.find(s => s.userId === student.id);
      return {
        studentId: student.id,
        studentName: student.name,
        studentNisn: student.identifier,
        hasSubmitted: !!sub && sub.filePath !== 'N/A',
        submissionId: sub?.id ?? null,
        filePath: sub?.filePath ?? null,
        downloadUrl: submissionDownloadUrl(sub?.id, sub?.filePath),
        originalName: submissionFileName(sub),
        grade: sub?.grade ?? null,
        submittedAt: sub?.submittedAt ?? null,
        late: Boolean(sub?.submittedAt && assignment[0]?.dueDate && sub.submittedAt.getTime() > assignment[0].dueDate.getTime()),
      };
    });
    
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Download a submission through an authorized WebKelas session
app.get('/api/submissions/:id/download', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const authenticatedUser = getAuthenticatedUser(c);
    if (!authenticatedUser || !Number.isInteger(id) || id <= 0) return c.json({ error: 'File pengumpulan tidak ditemukan.' }, 404);
    const submission = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
    if (!submission[0]) return c.json({ error: 'File pengumpulan tidak ditemukan.' }, 404);
    if (authenticatedUser.role === 'student') {
      if (submission[0].userId !== authenticatedUser.id) return c.json({ error: 'Anda tidak memiliki akses ke file ini.' }, 403);
    } else {
      const targetRows = await db.select({ classId: assignmentClasses.classId }).from(assignmentClasses).where(eq(assignmentClasses.assignmentId, submission[0].assignmentId));
      if (!targetRows.length || !(await Promise.all(targetRows.map((row) => mayAccessClass(authenticatedUser, row.classId)))).some(Boolean)) return c.json({ error: 'Anda tidak memiliki akses ke file ini.' }, 403);
    }
    if (!isRustFsReference(submission[0].filePath)) {
      if (/^https?:\/\//i.test(submission[0].filePath)) return c.redirect(submission[0].filePath);
      return c.json({ error: 'File pengumpulan tidak tersedia.' }, 404);
    }
    const object = await readObject(submission[0].filePath);
    const responseBody = new Uint8Array(object.body.byteLength);
    responseBody.set(object.body);
    return new Response(responseBody.buffer, { headers: {
      'Content-Type': object.contentType,
      'Content-Disposition': `attachment; filename="${(submission[0].originalName || 'tugas.pdf').replace(/["\\\r\n]/g, '_')}"`,
      'Cache-Control': 'private, no-store',
    } });
  } catch (err: any) {
    console.error('Error downloading submission:', err);
    return c.json({ error: 'File pengumpulan tidak dapat diambil.' }, 404);
  }
});

// POST grade a student's assignment submission
app.post('/api/assignments/:assignmentId/student/:studentId/grade', async (c) => {
  try {
    const assignmentId = parseInt(c.req.param('assignmentId'));
    const studentId = parseInt(c.req.param('studentId'));
    const authenticatedUser = getAuthenticatedUser(c);
    const student = await db.select({ classId: users.classId }).from(users).where(eq(users.id, studentId)).limit(1);
    const target = student[0]?.classId ? await db.select({ id: assignmentClasses.id }).from(assignmentClasses).where(and(
      eq(assignmentClasses.assignmentId, assignmentId),
      eq(assignmentClasses.classId, student[0].classId),
    )).limit(1) : [];
    if (!authenticatedUser || !student[0]?.classId || !target[0] || !(await mayAccessClass(authenticatedUser, student[0].classId))) return c.json({ error: 'Anda tidak memiliki akses untuk menilai siswa ini.' }, 403);
    const body = await c.req.json();
    const { grade } = body;
    
    const existing = await db.select().from(submissions).where(
      and(
        eq(submissions.assignmentId, assignmentId),
        eq(submissions.userId, studentId)
      )
    ).limit(1);
    
    if (existing.length > 0) {
      await db.update(submissions).set({ grade }).where(eq(submissions.id, existing[0].id));
    } else {
      await db.insert(submissions).values({
        assignmentId,
        userId: studentId,
        filePath: 'N/A',
        grade
      });
    }
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET assignments & submission status for a student
app.get('/api/student/:studentId/assignments', async (c) => {
  try {
    const studentId = parseInt(c.req.param('studentId'));
    const authenticatedUser = getAuthenticatedUser(c);
    if (!authenticatedUser || authenticatedUser.role !== 'student' || authenticatedUser.id !== studentId) return c.json({ error: 'Anda tidak memiliki akses ke data siswa ini.' }, 403);
    const student = await db.select({ classId: users.classId }).from(users).where(eq(users.id, studentId)).limit(1);
    if (!student[0]?.classId) return c.json({ error: 'Kelas siswa belum ditentukan.' }, 403);
    const allAssignments = await db.select().from(assignments);
    const targetMap = await getAssignmentTargetMap(allAssignments.map((item) => item.id));
    const studentSubmissions = await db.select().from(submissions).where(eq(submissions.userId, studentId));
    const visibleAssignments = allAssignments.filter((item) => item.status === 'published' && (targetMap.get(item.id) || []).some((target) => target.id === student[0].classId));
    const result = visibleAssignments.map(item => {
      const sub = studentSubmissions.find(s => s.assignmentId === item.id);
      return {
        ...item,
        targetClassIds: (targetMap.get(item.id) || []).map((target) => target.id),
        targetClasses: targetMap.get(item.id) || [],
        fileName: assignmentFileName(item),
        fileDownloadUrl: assignmentDownloadUrl(item.id, item.filePath),
        submission: sub ? {
          id: sub.id,
          filePath: sub.filePath,
          downloadUrl: submissionDownloadUrl(sub.id, sub.filePath),
          originalName: submissionFileName(sub),
          grade: sub.grade,
          submittedAt: sub.submittedAt
        } : null
      };
    });
    
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST submit assignment by a student
app.post('/api/student/:studentId/submissions', async (c) => {
  let uploadedReference: string | null = null;
  try {
    const studentId = parseInt(c.req.param('studentId'));
    const authenticatedUser = getAuthenticatedUser(c);
    if (!authenticatedUser || authenticatedUser.role !== 'student' || authenticatedUser.id !== studentId) return c.json({ error: 'Anda tidak memiliki akses untuk mengumpulkan tugas ini.' }, 403);
    const formData = await c.req.raw.formData();
    const assignmentId = Number(formData.get('assignmentId'));
    const uploadedFile = formData.get('file');
    if (!Number.isInteger(assignmentId) || assignmentId <= 0 || !(uploadedFile instanceof File)) return c.json({ error: 'Pilih file PDF untuk dikumpulkan.' }, 400);
    if (uploadedFile.size <= 0 || uploadedFile.size > MAX_SUBMISSION_FILE_SIZE) return c.json({ error: 'Ukuran PDF harus lebih dari 0 dan maksimal 10 MB.' }, 400);
    const originalName = uploadedFile.name.trim().replace(/[\\/\r\n]/g, '_') || 'tugas.pdf';
    if (!originalName.toLowerCase().endsWith('.pdf')) return c.json({ error: 'File tugas harus berformat PDF.' }, 400);
    if (uploadedFile.type && !['application/pdf', 'application/octet-stream'].includes(uploadedFile.type)) return c.json({ error: 'Tipe file yang diizinkan hanya PDF.' }, 400);
    const signature = new TextDecoder().decode(new Uint8Array(await uploadedFile.slice(0, 4).arrayBuffer()));
    if (signature !== '%PDF') return c.json({ error: 'Isi file tidak dikenali sebagai PDF.' }, 400);

    const student = await db.select({ classId: users.classId }).from(users).where(eq(users.id, studentId)).limit(1);
    const assignment = await db.select({ title: assignments.title, type: assignments.type, status: assignments.status }).from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
    if (!assignment[0] || assignment[0].type !== 'tugas' || assignment[0].status !== 'published') return c.json({ error: 'Tugas tidak ditemukan.' }, 404);
    if (!student[0]?.classId) return c.json({ error: 'Kelas siswa belum ditentukan.' }, 403);
    const target = student[0]?.classId ? await db.select({ id: assignmentClasses.id }).from(assignmentClasses).where(and(
      eq(assignmentClasses.assignmentId, assignmentId),
      eq(assignmentClasses.classId, student[0].classId),
    )).limit(1) : [];
    if (!target[0]) return c.json({ error: 'Tugas tidak ditujukan ke kelas siswa ini.' }, 403);

    const key = `submissions/${new Date().getFullYear()}/${student[0].classId}/${assignmentId}/${studentId}/${crypto.randomUUID()}.pdf`;
    uploadedReference = await uploadPdf(key, uploadedFile, originalName);
    const existing = await db.select().from(submissions).where(
      and(
        eq(submissions.assignmentId, assignmentId),
        eq(submissions.userId, studentId)
      )
    ).limit(1);
    
    if (existing.length > 0) {
      await db.update(submissions).set({ 
        filePath: uploadedReference,
        originalName,
        mimeType: 'application/pdf',
        sizeBytes: uploadedFile.size,
        submittedAt: new Date()
      }).where(eq(submissions.id, existing[0].id));
    } else {
      await db.insert(submissions).values({
        assignmentId,
        userId: studentId,
        filePath: uploadedReference,
        originalName,
        mimeType: 'application/pdf',
        sizeBytes: uploadedFile.size,
        submittedAt: new Date()
      });
    }
    if (existing[0]?.filePath && isRustFsReference(existing[0].filePath)) {
      await deleteObject(existing[0].filePath).catch((error) => console.error('Error deleting replaced submission:', error));
    }
    uploadedReference = null;

    const token = getCookie(c as any, 'webkelas_session');
    const authSession = token ? activeSessions.get(token) : undefined;
    if (authSession?.activitySessionId) {
      const activitySession = await touchActivitySession(authSession.activitySessionId, studentId);
      if (activitySession.active) await recordActivityEvent(authSession.activitySessionId, studentId, 'assignment_submitted', { page: 'assignments', resourceType: 'assignment', resourceId: assignmentId.toString(), resourceTitle: assignment[0].title });
    }
    
    return c.json({ success: true });
  } catch (err: any) {
    if (uploadedReference) await deleteObject(uploadedReference).catch((cleanupError) => console.error('Error cleaning failed submission upload:', cleanupError));
    const storageResponse = storageFailure(c, err);
    if (storageResponse) return storageResponse;
    return c.json({ error: err.message }, 500);
  }
});

app.get('/api/schedule-change-requests', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    if (!user || (!user.roles.includes('teacher') && !canManageClass(user))) return c.json({ error: 'Anda tidak memiliki akses ke permintaan perubahan jadwal.' }, 403);
    const [requestRows, scheduleRows, classRows, teacherRows, reviewerRows] = await Promise.all([
      db.select().from(scheduleChangeRequests).orderBy(scheduleChangeRequests.createdAt),
      db.select().from(schedules), db.select().from(classes), db.select().from(users), db.select().from(users),
    ]);
    const visibleRows = user.roles.includes('teacher') && !canManageClass(user)
      ? requestRows.filter((item) => item.teacherId === user.id)
      : requestRows;
    return c.json(visibleRows.map((item) => ({
      id: item.id.toString(), scheduleId: item.scheduleId.toString(), teacherId: item.teacherId.toString(),
      teacherName: teacherRows.find((teacher) => teacher.id === item.teacherId)?.name || 'Guru',
      classId: item.classId.toString(), className: classRows.find((classItem) => classItem.id === item.classId)?.name || 'Kelas', subject: item.subject,
      current: (() => { const schedule = scheduleRows.find((row) => row.id === item.scheduleId); return schedule ? { day: schedule.day, timeStart: schedule.timeStart, timeEnd: schedule.timeEnd } : null; })(),
      requested: { day: item.requestedDay, timeStart: item.requestedTimeStart, timeEnd: item.requestedTimeEnd },
      reason: item.reason, status: item.status, reviewNote: item.reviewNote || null,
      reviewerName: reviewerRows.find((reviewer) => reviewer.id === item.reviewedBy)?.name || null,
      createdAt: item.createdAt.toISOString(), reviewedAt: item.reviewedAt?.toISOString() || null,
    })));
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.post('/api/schedule-change-requests', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    if (!user || !user.roles.includes('teacher')) return c.json({ error: 'Hanya guru pengajar yang dapat mengajukan perubahan jadwal.' }, 403);
    const body = await c.req.json();
    const scheduleId = Number(body.scheduleId);
    const requestedDay = typeof body.day === 'string' ? body.day.trim() : '';
    const requestedTimeStart = typeof body.timeStart === 'string' ? body.timeStart.trim() : '';
    const requestedTimeEnd = typeof body.timeEnd === 'string' ? body.timeEnd.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!Number.isInteger(scheduleId) || scheduleId <= 0 || !TEACHING_DAYS.has(requestedDay) || !Number.isFinite(timeToMinutes(requestedTimeStart)) || !Number.isFinite(timeToMinutes(requestedTimeEnd)) || timeToMinutes(requestedTimeStart) >= timeToMinutes(requestedTimeEnd)) return c.json({ error: 'Jadwal, hari, dan jam usulan tidak valid.' }, 400);
    if (reason.length < 3 || reason.length > 500) return c.json({ error: 'Alasan wajib diisi (3–500 karakter).' }, 400);
    const schedule = await db.select().from(schedules).where(eq(schedules.id, scheduleId)).limit(1);
    if (!schedule[0] || schedule[0].teacherId !== user.id) return c.json({ error: 'Jadwal ini bukan bagian dari penugasan Anda.' }, 403);
    const pending = await db.select({ id: scheduleChangeRequests.id }).from(scheduleChangeRequests).where(and(eq(scheduleChangeRequests.scheduleId, scheduleId), eq(scheduleChangeRequests.status, 'pending'))).limit(1);
    if (pending[0]) return c.json({ error: 'Masih ada pengajuan perubahan yang menunggu persetujuan.' }, 409);
    const conflicts = await db.select().from(schedules).where(eq(schedules.day, requestedDay));
    if (conflicts.some((item) => item.id !== scheduleId && (item.classId === schedule[0].classId || item.teacherId === user.id) && schedulesOverlap(requestedTimeStart, requestedTimeEnd, item.timeStart, item.timeEnd))) return c.json({ error: 'Usulan jadwal bertabrakan dengan jadwal lain.' }, 409);
    const inserted = await db.insert(scheduleChangeRequests).values({ scheduleId, teacherId: user.id, classId: schedule[0].classId, subject: schedule[0].subject, requestedDay, requestedTimeStart, requestedTimeEnd, reason }).returning({ id: scheduleChangeRequests.id });
    return c.json({ id: inserted[0].id.toString() }, 201);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.patch('/api/schedule-change-requests/:id', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    if (!user || !canManageClass(user)) return c.json({ error: 'Hanya admin atau wali kelas yang dapat meninjau pengajuan.' }, 403);
    const id = Number(c.req.param('id'));
    const body = await c.req.json();
    const status = body.status === 'approved' || body.status === 'rejected' ? body.status : '';
    const reviewNote = typeof body.reviewNote === 'string' ? body.reviewNote.trim().slice(0, 500) : '';
    if (!Number.isInteger(id) || !status) return c.json({ error: 'Status peninjauan tidak valid.' }, 400);
    const request = await db.select().from(scheduleChangeRequests).where(eq(scheduleChangeRequests.id, id)).limit(1);
    if (!request[0]) return c.json({ error: 'Pengajuan tidak ditemukan.' }, 404);
    if (request[0].status !== 'pending') return c.json({ error: 'Pengajuan ini sudah ditinjau.' }, 409);
    const reviewedAt = new Date();
    if (status === 'approved') {
      const schedule = await db.select().from(schedules).where(eq(schedules.id, request[0].scheduleId)).limit(1);
      if (!schedule[0]) return c.json({ error: 'Jadwal asal sudah tidak tersedia.' }, 409);
      const conflicts = await db.select().from(schedules).where(eq(schedules.day, request[0].requestedDay));
      if (conflicts.some((item) => item.id !== schedule[0].id && (item.classId === schedule[0].classId || item.teacherId === schedule[0].teacherId) && schedulesOverlap(request[0].requestedTimeStart, request[0].requestedTimeEnd, item.timeStart, item.timeEnd))) return c.json({ error: 'Perubahan ditolak karena jadwal bertabrakan.' }, 409);
      await db.update(schedules).set({ day: request[0].requestedDay, timeStart: request[0].requestedTimeStart, timeEnd: request[0].requestedTimeEnd }).where(eq(schedules.id, schedule[0].id));
    }
    await db.update(scheduleChangeRequests).set({ status, reviewNote: reviewNote || null, reviewedBy: user.id, reviewedAt }).where(eq(scheduleChangeRequests.id, id));
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

// GET all schedules
app.get('/api/schedules', async (c) => {
  try {
    const classId = Number(c.req.query('classId'));
    const authenticatedUser = getAuthenticatedUser(c);
    if (!Number.isInteger(classId) || classId <= 0) return c.json({ error: 'Kelas wajib dipilih.' }, 400);
    if (!authenticatedUser || !(await mayAccessClass(authenticatedUser, classId))) return c.json({ error: 'Anda tidak memiliki akses ke kelas ini.' }, 403);
    const list = await db.select().from(schedules).where(eq(schedules.classId, classId));
    return c.json(list.filter((item) => TEACHING_DAYS.has(item.day)));
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST create/update schedule
app.post('/api/schedules', async (c) => {
  try {
    const body = await c.req.json();
    const { id, classId, day, subject, timeStart, timeEnd, color } = body;
    const normalizedClassId = Number(classId);
    const normalizedTeacherId = Number(body.teacherId);
    const authenticatedUser = getAuthenticatedUser(c);
    if (!Number.isInteger(normalizedClassId) || normalizedClassId <= 0 || !Number.isInteger(normalizedTeacherId) || normalizedTeacherId <= 0 || !TEACHING_DAYS.has(day) || !subject || !/^\d{2}:\d{2}$/.test(timeStart) || !/^\d{2}:\d{2}$/.test(timeEnd)) {
      return c.json({ error: 'Kelas, guru, mata pelajaran, dan jam yang valid wajib diisi.' }, 400);
    }
    if (!authenticatedUser || !(await mayAccessClass(authenticatedUser, normalizedClassId))) return c.json({ error: 'Anda tidak memiliki akses ke kelas ini.' }, 403);
    const [teacher, classItem, subjectRow] = await Promise.all([
      db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.id, normalizedTeacherId), eq(users.role, 'teacher'), eq(users.status, 'Aktif'))).limit(1),
      db.select({ id: classes.id, academicYear: classes.academicYear }).from(classes).where(eq(classes.id, normalizedClassId)).limit(1),
      db.select({ id: subjects.id }).from(subjects).where(eq(subjects.name, subject.trim())).limit(1),
    ]);
    if (!teacher[0] || !classItem[0] || !subjectRow[0]) return c.json({ error: 'Guru, kelas, atau mata pelajaran tidak ditemukan.' }, 400);
    const teachingAssignment = await db.select({ id: teachingAssignments.id }).from(teachingAssignments).where(and(
      eq(teachingAssignments.teacherId, normalizedTeacherId), eq(teachingAssignments.classId, normalizedClassId), eq(teachingAssignments.subjectId, subjectRow[0].id), eq(teachingAssignments.academicYear, classItem[0].academicYear),
    )).limit(1);
    if (!teachingAssignment[0]) return c.json({ error: 'Guru belum memiliki penugasan pada kelas dan mata pelajaran ini.' }, 400);

    if (id) {
      // Update
      await db.update(schedules).set({
        teacherId: normalizedTeacherId,
        day,
        subject: subject.trim(),
        timeStart,
        timeEnd,
        teacherName: teacher[0].name,
        color: color || 'blue'
      }).where(and(eq(schedules.id, id), eq(schedules.classId, normalizedClassId)));
      return c.json({ success: true, id });
    } else {
      // Insert
      const inserted = await db.insert(schedules).values({
        classId: normalizedClassId,
        teacherId: normalizedTeacherId,
        day,
        subject: subject.trim(),
        timeStart,
        timeEnd,
        teacherName: teacher[0].name,
        color: color || 'blue'
      }).returning();
      return c.json({ success: true, item: inserted[0] });
    }
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// DELETE schedule
app.delete('/api/schedules/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const classId = Number(c.req.query('classId'));
    const authenticatedUser = getAuthenticatedUser(c);
    if (!Number.isInteger(classId) || classId <= 0) return c.json({ error: 'Kelas wajib dipilih.' }, 400);
    if (!authenticatedUser || !(await mayAccessClass(authenticatedUser, classId))) return c.json({ error: 'Anda tidak memiliki akses ke kelas ini.' }, 403);
    await db.delete(schedules).where(and(eq(schedules.id, id), eq(schedules.classId, classId)));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST behavior record
app.post('/api/behavior', async (c) => {
  try {
    const body = await c.req.json();
    const { studentId, type, points, category, description, date } = body;
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    if (!studentId || !type || !points || !category || !description || !date) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    const user = getAuthenticatedUser(c);
    const student = await db.select({ classId: users.classId }).from(users).where(and(eq(users.id, Number(studentId)), eq(users.role, 'student'))).limit(1);
    if (!student[0] || !student[0].classId) return c.json({ error: 'Siswa tidak ditemukan.' }, 404);
    if (!(await mayAccessClass(user, student[0].classId))) return c.json({ error: 'Anda tidak memiliki akses ke siswa ini.' }, 403);
    if (user?.roles.includes('teacher') && !canManageClass(user)) {
      const subjectRow = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.name, subject)).limit(1);
      const assignment = subjectRow[0] && await db.select({ id: teachingAssignments.id }).from(teachingAssignments).where(and(eq(teachingAssignments.teacherId, user.id), eq(teachingAssignments.classId, student[0].classId), eq(teachingAssignments.subjectId, subjectRow[0].id))).limit(1);
      if (!assignment?.length) return c.json({ error: 'Mata pelajaran ini tidak ada dalam penugasan Anda.' }, 403);
    }
    const inserted = await db.insert(behaviorRecords).values({
      studentId: parseInt(studentId),
      type,
      points: parseInt(points),
      category,
      description,
      date,
      subject: subject || null,
      recordedBy: user?.id || null,
    }).returning();
    return c.json({ 
      success: true, 
      item: { 
        ...inserted[0], 
        id: inserted[0].id.toString(), 
        studentId: inserted[0].studentId.toString() 
      } 
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// DELETE behavior record
app.delete('/api/behavior/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const user = getAuthenticatedUser(c);
    const record = await db.select().from(behaviorRecords).where(eq(behaviorRecords.id, id)).limit(1);
    if (!record[0]) return c.json({ error: 'Catatan sikap tidak ditemukan.' }, 404);
    const student = await db.select({ classId: users.classId }).from(users).where(eq(users.id, record[0].studentId)).limit(1);
    if (!student[0]?.classId || !(await mayAccessClass(user, student[0].classId))) return c.json({ error: 'Anda tidak memiliki akses ke catatan ini.' }, 403);
    if (user?.roles.includes('teacher') && !canManageClass(user)) {
      const subjectRow = record[0].subject ? await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.name, record[0].subject)).limit(1) : [];
      const assignment = subjectRow[0] && await db.select({ id: teachingAssignments.id }).from(teachingAssignments).where(and(eq(teachingAssignments.teacherId, user.id), eq(teachingAssignments.classId, student[0].classId), eq(teachingAssignments.subjectId, subjectRow[0].id))).limit(1);
      if (!assignment?.length) return c.json({ error: 'Catatan ini bukan bagian dari mata pelajaran Anda.' }, 403);
    }
    await db.delete(behaviorRecords).where(eq(behaviorRecords.id, id));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST achievement
app.post('/api/achievements', async (c) => {
  try {
    const body = await c.req.json();
    const { studentId, title, level, rank, date, description } = body;
    if (!studentId || !title || !level || !rank || !date) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    const inserted = await db.insert(achievements).values({
      studentId: parseInt(studentId),
      title,
      level,
      rank,
      date,
      description: description || null
    }).returning();
    return c.json({ 
      success: true, 
      item: { 
        ...inserted[0], 
        id: inserted[0].id.toString(), 
        studentId: inserted[0].studentId.toString(), 
        description: inserted[0].description || '' 
      } 
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// DELETE achievement
app.delete('/api/achievements/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    await db.delete(achievements).where(eq(achievements.id, id));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.use('/*', serveStatic({ root: './dist' }));
app.get('*', async (c) => c.html(await Bun.file('./dist/index.html').text()));

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
