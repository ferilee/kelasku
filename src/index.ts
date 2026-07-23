import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { db } from './server/db';
import { announcements, agenda, quotes, users, attendance, grades, subjects, classOfficers, assignments, submissions, schedules, behaviorRecords, achievements, pageSettings } from './server/db/schema';
import { eq, and, like } from 'drizzle-orm';

const app = new Hono();

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

// Get unified class data
app.get('/api/class-data', async (c) => {
  try {
    const allAnnouncements = await db.select().from(announcements);
    const allAgenda = await db.select().from(agenda);
    const allStudents = await db.select().from(users).where(eq(users.role, 'student'));
    const currentQuote = await db.select().from(quotes).limit(1);
    const allSchedules = await db.select().from(schedules);
    const allBehavior = await db.select().from(behaviorRecords);
    const allAchievements = await db.select().from(achievements);
    const allOfficers = await db.select().from(classOfficers);
    const heroImageSetting = await db.select().from(pageSettings).where(eq(pageSettings.key, 'hero_image')).limit(1);
    const homeroomPhotoSetting = await db.select().from(pageSettings).where(eq(pageSettings.key, 'homeroom_teacher_photo')).limit(1);
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
      students: studentList,
      behaviorRecords: allBehavior.map(b => ({
        id: b.id.toString(),
        studentId: b.studentId.toString(),
        type: b.type,
        points: b.points,
        category: b.category,
        description: b.description,
        date: b.date
      })),
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
      heroImage: heroImageSetting[0]?.value || '/hero-default.svg',
      homeroomTeacherPhoto: homeroomPhotoSetting[0]?.value || '/wali-kelas-placeholder.svg',
      quote: { text: quoteVal.text, author: quoteVal.author },
      stats
    });
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
    await db.insert(users).values({
      name: body.name,
      role: 'student',
      identifier: body.nisn || ('10' + Math.floor(Math.random() * 1000000)),
      passwordHash: '123456',
      gender: body.gender || 'L',
      status: body.status || 'Aktif'
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
    if (!date || !type) {
      return c.json({ error: 'Missing date or type' }, 400);
    }
    const records = await db.select().from(attendance).where(
      and(eq(attendance.date, date), eq(attendance.type, type))
    );
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
    if (!date || !type || !Array.isArray(records)) {
      return c.json({ error: 'Invalid payload' }, 400);
    }
    
    // Delete existing records for this date and type
    await db.delete(attendance).where(
      and(eq(attendance.date, date), eq(attendance.type, type))
    );
    
    // Insert new ones
    if (records.length > 0) {
      await db.insert(attendance).values(
        records.map((r: any) => ({
          userId: parseInt(r.studentId),
          date,
          type,
          status: r.status
        }))
      );
    }
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Get monthly attendance summary
app.get('/api/attendance/summary', async (c) => {
  try {
    const month = c.req.query('month'); // Expecting 'YYYY-MM'
    if (!month) {
      return c.json({ error: 'Missing month parameter' }, 400);
    }
    
    // Fetch all students
    const studentsList = await db.select().from(users).where(eq(users.role, 'student'));
    
    // Fetch all attendance records for this month
    const records = await db.select().from(attendance).where(
      like(attendance.date, `${month}-%`)
    );
    
    const summary = studentsList.map(s => {
      const studentRecords = records.filter(r => r.userId === s.id);
      
      const harian = { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0, total: 0 };
      const dhuha = { Berjamaah: 0, Munfarid: 0, Berhalangan: 0, Alfa: 0, total: 0 };
      const dzuhur = { Berjamaah: 0, Munfarid: 0, Berhalangan: 0, Alfa: 0, total: 0 };
      
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
        dzuhur
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
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Get start of week (7 days ago)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    
    // Get start of month
    const currentMonthPrefix = todayStr.slice(0, 8); // e.g. '2026-07-'
    
    // Fetch all attendance records
    const allRecords = await db.select().from(attendance);
    
    const createEmptyStats = () => ({
      harian: { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0, total: 0 },
      dhuha: { Berjamaah: 0, Munfarid: 0, Berhalangan: 0, Alfa: 0, total: 0 },
      dzuhur: { Berjamaah: 0, Munfarid: 0, Berhalangan: 0, Alfa: 0, total: 0 }
    });

    const daily = createEmptyStats();
    const weekly = createEmptyStats();
    const monthly = createEmptyStats();

    const processRecord = (r: any, target: any) => {
      const t = r.type as 'harian' | 'dhuha' | 'dzuhur';
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
    const list = await db.select().from(grades);
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
    if (!subject || !type || !name || !Array.isArray(scores)) {
      return c.json({ error: 'Invalid payload parameters' }, 400);
    }

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
    if (!subject || !type || !name) {
      return c.json({ error: 'Missing subject, type, or name parameters' }, 400);
    }

    await db.delete(grades).where(
      and(
        eq(grades.subject, subject),
        eq(grades.type, type),
        eq(grades.name, name)
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
    if (!studentId || !type || !points || !category || !description || !date) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    const inserted = await db.insert(behaviorRecords).values({
      studentId: parseInt(studentId),
      type,
      points: parseInt(points),
      category,
      description,
      date
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
