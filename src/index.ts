import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { db } from './server/db';
import { announcements, agenda, quotes, users, attendance, grades, subjects, classOfficers, assignments, submissions, schedules, behaviorRecords, achievements, pageSettings, galleryItems, classes, teachingAssignments, userRoles } from './server/db/schema';
import { eq, and, like, isNull, inArray } from 'drizzle-orm';

const app = new Hono();

type AuthUser = { id: number; name: string; role: 'admin' | 'teacher' | 'student'; roles: Array<'admin' | 'homeroom' | 'teacher'> };
const activeSessions = new Map<string, { user: AuthUser; expiresAt: number }>();

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

async function accessibleClassIds(user: AuthUser) {
  if (user.roles.includes('admin')) return null;
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

async function mayAccessClass(user: AuthUser | null, classId: number) {
  if (!user) return true;
  const ids = await accessibleClassIds(user);
  return ids === null || ids.includes(classId);
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
    if (existingSchedules.length === 0) {
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
      ]);
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
    }
    if (primaryClass[0]) {
      const admin = allAccounts.find((account) => account.role === 'admin');
      if (admin) await db.update(classes).set({ homeroomTeacherId: admin.id }).where(and(eq(classes.id, primaryClass[0].id), isNull(classes.homeroomTeacherId)));
    }

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
    const roles = roleRows.map((item) => item.role as AuthUser['roles'][number]);
    const sessionUser: AuthUser = { id: user.id, name: user.name, role: user.role as AuthUser['role'], roles };
    activeSessions.set(token, { user: sessionUser, expiresAt: Date.now() + 1000 * 60 * 60 * 12 });
    setCookie(c, 'webkelas_session', token, { httpOnly: true, sameSite: 'Lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 12 });
    return c.json({ user: sessionUser });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.get('/api/auth/me', (c) => {
  const user = getAuthenticatedUser(c);
  if (!user) return c.json({ error: 'Sesi tidak ditemukan.' }, 401);
  return c.json({ user });
});

app.post('/api/auth/logout', (c) => {
  const token = getCookie(c, 'webkelas_session');
  if (token) activeSessions.delete(token);
  deleteCookie(c, 'webkelas_session', { path: '/' });
  return c.json({ success: true });
});

app.use('/api/*', async (c, next) => {
  if (c.req.method === 'GET' && c.req.path === '/api/class-data') return next();
  const user = getAuthenticatedUser(c);
  if (!user) return c.json({ error: 'Silakan masuk terlebih dahulu.' }, 401);
  const teacherWritePath = (c.req.method === 'POST' && (c.req.path === '/api/grades' || c.req.path === '/api/behavior' || c.req.path === '/api/attendance')) || (c.req.method === 'DELETE' && c.req.path.startsWith('/api/behavior/'));
  if (!canManageClass(user) && user.roles.includes('teacher') && c.req.method !== 'GET' && !teacherWritePath) {
    return c.json({ error: 'Fitur ini hanya dapat dikelola wali kelas.' }, 403);
  }
  if (user.role === 'student' && c.req.method !== 'GET') return c.json({ error: 'Siswa tidak memiliki akses untuk mengubah data ini.' }, 403);
  return next();
});

app.get('/api/my-workspace', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    if (!user) return c.json({ error: 'Silakan masuk terlebih dahulu.' }, 401);
    const [homeroomClasses, assignmentsForTeacher, classRows, subjectRows, studentRows, gradeRows] = await Promise.all([
      db.select().from(classes).where(eq(classes.homeroomTeacherId, user.id)).orderBy(classes.name),
      db.select().from(teachingAssignments).where(eq(teachingAssignments.teacherId, user.id)).orderBy(teachingAssignments.id),
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
    if (!name || !identifier) return c.json({ error: 'Nama dan identitas guru wajib diisi.' }, 400);
    const inserted = await db.insert(users).values({ name, role: 'teacher', identifier, passwordHash: await Bun.password.hash('123456'), gender: body.gender === 'P' ? 'P' : 'L', status: 'Aktif' }).returning();
    await db.insert(userRoles).values({ userId: inserted[0].id, role: 'teacher' }).onConflictDoNothing();
    return c.json({ id: inserted[0].id.toString() }, 201);
  } catch (err: any) { return c.json({ error: 'Identitas guru sudah digunakan atau data tidak valid.' }, 400); }
});

app.delete('/api/teachers/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const linked = await db.select({ id: teachingAssignments.id }).from(teachingAssignments).where(eq(teachingAssignments.teacherId, id)).limit(1);
    if (linked.length) return c.json({ error: 'Guru masih memiliki penugasan mengajar.' }, 409);
    await db.delete(users).where(and(eq(users.id, id), eq(users.role, 'teacher')));
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
    const currentQuote = await db.select().from(quotes).limit(1);
    const allSchedules = await db.select().from(schedules);
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
      agenda: allAgenda.map(g => ({ id: g.id.toString(), date: g.date, title: g.title, type: g.type })),
      schedules: allSchedules.map(s => ({
        id: s.id.toString(),
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
    if (!date || !type || !Array.isArray(records) || !Number.isInteger(classId)) {
      return c.json({ error: 'Invalid payload' }, 400);
    }
    const authenticatedUser = getAuthenticatedUser(c);
    if (!authenticatedUser || authenticatedUser.role === 'student') return c.json({ error: 'Silakan masuk sebagai guru.' }, 401);
    if (!(await mayAccessClass(authenticatedUser, classId))) return c.json({ error: 'Anda tidak memiliki akses ke kelas ini.' }, 403);
    if (!canManageClass(authenticatedUser)) {
      if (type !== 'mapel' || !subject || !(await mayTeachSubject(authenticatedUser, classId, subject))) return c.json({ error: 'Presensi hanya dapat dicatat untuk mata pelajaran yang Anda ampu.' }, 403);
    }
    
    const classStudents = await db.select({ id: users.id, gender: users.gender }).from(users).where(and(eq(users.role, 'student'), eq(users.classId, classId)));
    const studentIds = classStudents.map((student) => student.id);
    if (studentIds.length) await db.delete(attendance).where(and(eq(attendance.date, date), eq(attendance.type, type), ...(type === 'mapel' ? [eq(attendance.subject, subject)] : []), inArray(attendance.userId, studentIds)));
    
    // Insert new ones
    if (records.length > 0) {
      if (records.some((record: any) => !studentIds.includes(Number(record.studentId)))) return c.json({ error: 'Siswa harus berasal dari kelas aktif.' }, 400);
      if (type === 'jumat') {
        const maleStudentIds = new Set(classStudents.filter((student) => student.gender === 'L').map((student) => student.id));
        if (records.some((record: any) => !maleStudentIds.has(Number(record.studentId)))) return c.json({ error: 'Presensi Sholat Jumat hanya untuk siswa laki-laki.' }, 400);
      }
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
    const list = await db.select().from(assignments);
    return c.json(list);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST create assignment/material
app.post('/api/assignments', async (c) => {
  try {
    const body = await c.req.json();
    const { title, description, type, filePath, dueDate } = body;
    if (!title || !type) {
      return c.json({ error: 'Title and Type are required' }, 400);
    }
    
    const inserted = await db.insert(assignments).values({
      title,
      description,
      type,
      filePath,
      dueDate: dueDate ? new Date(dueDate) : null
    }).returning();
    
    return c.json(inserted[0] || { success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// DELETE assignment/material
app.delete('/api/assignments/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    // Delete associated submissions first
    await db.delete(submissions).where(eq(submissions.assignmentId, id));
    // Delete assignment
    await db.delete(assignments).where(eq(assignments.id, id));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET submissions for an assignment
app.get('/api/assignments/:id/submissions', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const allStudents = await db.select().from(users).where(eq(users.role, 'student'));
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
        grade: sub?.grade ?? null,
        submittedAt: sub?.submittedAt ?? null
      };
    });
    
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST grade a student's assignment submission
app.post('/api/assignments/:assignmentId/student/:studentId/grade', async (c) => {
  try {
    const assignmentId = parseInt(c.req.param('assignmentId'));
    const studentId = parseInt(c.req.param('studentId'));
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
    const allAssignments = await db.select().from(assignments);
    const studentSubmissions = await db.select().from(submissions).where(eq(submissions.userId, studentId));
    
    const result = allAssignments.map(item => {
      const sub = studentSubmissions.find(s => s.assignmentId === item.id);
      return {
        ...item,
        submission: sub ? {
          id: sub.id,
          filePath: sub.filePath,
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
  try {
    const studentId = parseInt(c.req.param('studentId'));
    const body = await c.req.json();
    const { assignmentId, filePath } = body;
    if (!assignmentId || !filePath) {
      return c.json({ error: 'assignmentId and filePath are required' }, 400);
    }
    
    const existing = await db.select().from(submissions).where(
      and(
        eq(submissions.assignmentId, assignmentId),
        eq(submissions.userId, studentId)
      )
    ).limit(1);
    
    if (existing.length > 0) {
      await db.update(submissions).set({ 
        filePath,
        submittedAt: new Date()
      }).where(eq(submissions.id, existing[0].id));
    } else {
      await db.insert(submissions).values({
        assignmentId,
        userId: studentId,
        filePath,
        submittedAt: new Date()
      });
    }
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET all schedules
app.get('/api/schedules', async (c) => {
  try {
    const list = await db.select().from(schedules);
    return c.json(list);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST create/update schedule
app.post('/api/schedules', async (c) => {
  try {
    const body = await c.req.json();
    const { id, day, subject, timeStart, timeEnd, teacherName, color } = body;
    if (!day || !subject || !timeStart || !timeEnd) {
      return c.json({ error: 'day, subject, timeStart, timeEnd are required' }, 400);
    }

    if (id) {
      // Update
      await db.update(schedules).set({
        day,
        subject,
        timeStart,
        timeEnd,
        teacherName: teacherName || null,
        color: color || 'blue'
      }).where(eq(schedules.id, id));
      return c.json({ success: true, id });
    } else {
      // Insert
      const inserted = await db.insert(schedules).values({
        day,
        subject,
        timeStart,
        timeEnd,
        teacherName: teacherName || null,
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
    await db.delete(schedules).where(eq(schedules.id, id));
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
