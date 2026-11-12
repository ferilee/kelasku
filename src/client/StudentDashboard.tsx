import { useState, useEffect } from 'react';
import { BookOpen, Calendar, CheckSquare, Bell, FileText, User, X, Clock, CalendarDays, Award, ThumbsUp, ThumbsDown, ClipboardCheck, Key, ChevronRight, ExternalLink } from 'lucide-react';
import { useClassData, BehaviorRecord, Achievement } from './ClassContext';
import { useNotifications } from './NotificationCenter';
import { ThemePicker } from './ThemeContext';
import { useStudentActivity } from './studentActivity';
import { useModalAccessibility } from './useModalAccessibility';

type DailyAttendanceStats = { Hadir: number; Sakit: number; Izin: number; Alfa: number; total: number };
type StudentAttendanceSummary = {
  today: string;
  gender: 'L' | 'P';
  subjectAttendance: Array<{ subject: string; status: string | null; timeStart: string | null; timeEnd: string | null }>;
  todayStatus: { harian: string | null; dhuha: string | null; dzuhur: string | null; jumat: string | null };
  daily: DailyAttendanceStats;
  weekly: DailyAttendanceStats;
  monthly: DailyAttendanceStats;
};
type StudentProfile = {
  id: number;
  name: string;
  identifier: string;
  gender: 'L' | 'P';
  status: 'Aktif' | 'Nonaktif';
  classId: string | null;
  className: string;
  academicYear: string | null;
  behaviorRecords: BehaviorRecord[];
  achievements: Achievement[];
};

const SIMAK_URL = 'https://simak.smkpasirian-lmj.sch.id';

const SimakBridgeCard = () => (
  <div className="rounded-3xl border border-blue-100/70 bg-white p-6 shadow-lg shadow-blue-100/60 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none sm:p-8">
    <p className="text-xs font-extrabold uppercase tracking-wider text-[#2F8CFF] dark:text-[#5DA9FF]">SIMAK · Sumber Informasi, Materi, dan Aktivitas Kelas</p>
    <h3 className="mt-2 text-2xl font-black text-slate-800 dark:text-slate-100">Belajar di SIMAK</h3>
    <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-500 dark:text-slate-300">
      Materi pelajaran, LKPD, dan tugas sekarang dikelola di SIMAK. Buka SIMAK untuk membaca materi, mengerjakan LKPD, dan mengumpulkan tugas dari gurumu — semua kegiatan belajarmu tercatat di sana.
    </p>
    <a
      href={SIMAK_URL}
      target="_blank"
      rel="noreferrer"
      className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#2F8CFF] px-6 py-3 text-sm font-extrabold text-white shadow-md shadow-blue-200 transition hover:bg-[#1D7BE0] dark:shadow-none"
    >
      Buka SIMAK <ExternalLink className="h-4 w-4" aria-hidden="true" />
    </a>
    <p className="mt-3 text-xs font-semibold text-slate-400">SIMAK terbuka di tab baru. Jadwal, presensi, serta sikap &amp; prestasi tetap bisa kamu lihat di WebKelas.</p>
  </div>
);

const getTimeGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return 'Selamat pagi';
  if (hour >= 11 && hour < 15) return 'Selamat siang';
  if (hour >= 15 && hour < 19) return 'Selamat sore';
  return 'Selamat malam';
};

const AttendanceRing = ({ percent }: { percent: number | null }) => {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const value = percent ?? 0;
  return (
    <div className="relative h-20 w-20 shrink-0" role="img" aria-label={percent === null ? 'Kehadiran belum tersedia' : `Kehadiran ${percent} persen`}>
      <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
        <circle cx="40" cy="40" r={radius} fill="none" strokeWidth="9" className="stroke-[#DCEBFD] dark:stroke-slate-700" />
        <circle cx="40" cy="40" r={radius} fill="none" strokeWidth="9" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)} className="stroke-[#2F8CFF] transition-all duration-700 dark:stroke-[#5DA9FF]" />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-base font-black text-slate-800 dark:text-slate-100">{percent === null ? '—' : `${percent}%`}</span>
    </div>
  );
};


const StudentAvatar = ({ gender }: { gender?: 'L' | 'P' | null }) => {
  const isFemale = gender === 'P';
  return (
    <div className={`grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white/40 shadow-lg ${isFemale ? 'bg-fuchsia-200/80' : gender === 'L' ? 'bg-sky-200/80' : 'bg-violet-200/80'}`} aria-hidden="true">
      <svg viewBox="0 0 80 80" className="h-full w-full" role="img">
        <path d="M15 78c2-17 13-25 25-25s23 8 25 25" fill={isFemale ? '#c026d3' : '#2563eb'} />
        <path d="M25 49c1-10 7-16 15-16s14 6 15 16c-4 5-9 8-15 8s-11-3-15-8Z" fill="#f6c7a8" />
        <circle cx="40" cy="29" r="16" fill="#f6c7a8" />
        {isFemale ? <path d="M23 31c-2-17 7-25 18-25 13 0 19 10 16 27l-7-10c-7 4-15 5-23 2l-4 6Z" fill="#4c1d95" /> : <path d="M24 28c0-14 7-22 17-22 11 0 17 7 16 20-5-5-10-8-16-8-6 0-11 3-17 10Z" fill="#1e293b" />}
        <circle cx="34" cy="30" r="1.7" fill="#1e293b" /><circle cx="46" cy="30" r="1.7" fill="#1e293b" />
        <path d="M36 38c2 2 6 2 8 0" fill="none" stroke="#9a4d45" strokeLinecap="round" strokeWidth="1.5" />
        {isFemale && <path d="M24 27c-4 7-3 20 2 26" fill="none" stroke="#4c1d95" strokeLinecap="round" strokeWidth="5" />}
      </svg>
    </div>
  );
};

const StudentDashboard = () => {
  useModalAccessibility();
  const [activeTab, setActiveTab] = useState('dashboard');
  const { selectedClass, selectedYear, schedules, agenda, announcements, teachingAnnouncements } = useClassData();
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<StudentAttendanceSummary | null>(null);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(true);
  const authenticatedStudent = studentProfile;
  const studentClassName = studentProfile?.className || selectedClass;
  const studentAcademicYear = studentProfile?.academicYear || selectedYear;
  const currentStudentId = studentProfile?.id.toString() || '';
  const dbStudentId = currentStudentId;
  const { notify } = useNotifications();

  useStudentActivity(currentStudentId, activeTab);

  useEffect(() => {
    const loadStudentDashboard = async () => {
      setIsLoadingAttendance(true);
      try {
        const [profileResponse, attendanceResponse] = await Promise.all([
          fetch('/api/student/profile'),
          fetch('/api/student/attendance-summary'),
        ]);
        if (profileResponse.ok) setStudentProfile(await profileResponse.json());
        if (attendanceResponse.ok) setAttendanceSummary(await attendanceResponse.json());
      } catch (error) {
        console.error('Error fetching student attendance:', error);
      } finally {
        setIsLoadingAttendance(false);
      }
    };
    loadStudentDashboard();
  }, []);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showBehaviorModal, setShowBehaviorModal] = useState(false);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showScheduleModal) setShowScheduleModal(false);
      if (event.key === 'Escape' && showBehaviorModal) setShowBehaviorModal(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showScheduleModal, showBehaviorModal]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) return notify('Konfirmasi password baru tidak sama.', 'warning');
    try {
      const response = await fetch('/api/auth/password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) });
      const data = await response.json();
      if (!response.ok) return notify(data.error || 'Gagal mengubah password.', 'error');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setShowPasswordModal(false);
      notify('Password berhasil diubah.', 'success');
    } catch (error) { console.error('Error changing password:', error); notify('Terjadi kesalahan saat mengubah password.', 'error'); }
  };

  const sRecords = (studentProfile?.behaviorRecords || []).filter(r => r.studentId === dbStudentId);
  const posPoints = sRecords.filter(r => r.type === 'positif').reduce((sum, r) => sum + r.points, 0);
  const negPoints = sRecords.filter(r => r.type === 'negatif').reduce((sum, r) => sum + r.points, 0);
  const behaviorScore = 100 + posPoints - negPoints;

  const attendanceStatusLabel = (status: string | null, prayer = false) => {
    if (!status) return 'Belum dicatat';
    if (prayer && (status === 'Berjamaah' || status === 'Munfarid')) return 'Sholat';
    return status;
  };

  const subjectAttendance = attendanceSummary?.subjectAttendance || [];
  const pendingSubjectAttendance = subjectAttendance.filter((item) => !item.status);

  const todayDay = new Date().getDay();
  const isSchoolDay = todayDay >= 1 && todayDay <= 5;
  const attentionItems = [
    ...(isSchoolDay && attendanceSummary?.todayStatus.harian === null ? [{ id: 'daily', icon: CheckSquare, title: 'Presensi kelas belum dicatat', description: 'Status kehadiran hari ini masih menunggu pencatatan wali kelas.', tone: 'amber' }] : []),
    ...(isSchoolDay && subjectAttendance.length ? [{
      id: 'subject-attendance', icon: ClipboardCheck,
      action: () => setShowScheduleModal(true),
      title: pendingSubjectAttendance.length ? 'Presensi mata pelajaran belum lengkap' : 'Presensi mata pelajaran tercatat',
      description: pendingSubjectAttendance.length
        ? `${pendingSubjectAttendance.length} dari ${subjectAttendance.length} mata pelajaran belum dicatat guru.`
        : subjectAttendance.map((item) => `${item.subject}: ${attendanceStatusLabel(item.status)}`).join(' · '),
      tone: pendingSubjectAttendance.length ? 'amber' : 'blue'
    }] : []),
    ...(announcements.length ? [{ id: 'announcement', icon: Bell, title: 'Informasi kelas', description: announcements[0].text, tone: 'slate' }] : []),
  ].slice(0, 3);

  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const todayName = days[todayDay];
  const todaySchedules = (schedules || []).filter((schedule) => schedule.day === todayName)
    .sort((first, second) => first.timeStart.localeCompare(second.timeStart));
  const studentAchievements = (studentProfile?.achievements || []).filter((achievement) => achievement.studentId === dbStudentId);
  const nextSchedule = todaySchedules[0];
  const attendancePercent = attendanceSummary?.monthly.total ? Math.round((attendanceSummary.monthly.Hadir / attendanceSummary.monthly.total) * 100) : null;

  const openBehaviorDetails = () => {
    if (window.matchMedia('(max-width: 767px)').matches) setShowBehaviorModal(true);
    else setActiveTab('behavior');
  };

  return (
    <div className="student-dashboard flex h-screen bg-[#E8F3FE] font-sans dark:bg-slate-950">
      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-blue-100/80 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 md:px-8">
          <h2 className="mr-2 truncate text-base font-extrabold text-slate-800 dark:text-slate-100 sm:text-xl">
            {activeTab === 'dashboard' ? `Ringkasan (${studentClassName})` : 'Detail'}
          </h2>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Dark Mode Toggle */}
            <ThemePicker />
            <button onClick={() => { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setShowPasswordModal(true); }} className="rounded-full p-2 text-slate-500 transition-colors hover:bg-blue-50 hover:text-[#2F8CFF] dark:text-slate-400 dark:hover:bg-slate-800" title="Ubah password"><Key className="h-5 w-5" /></button>
            <div className="flex items-center gap-2 border-l border-blue-100 pl-2 dark:border-slate-700 sm:gap-3 sm:pl-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2F8CFF] font-extrabold text-white shadow-md shadow-blue-200 dark:shadow-none">
                {(authenticatedStudent?.name || 'S').charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{authenticatedStudent?.name || 'Siswa'} (Siswa)</span>
                <span className="mt-0.5 text-[10px] font-semibold leading-none text-slate-400">{studentClassName} ({studentAcademicYear})</span>
              </div>
            </div>
          </div>
        </header>

        <nav className="hidden items-center justify-center gap-2 px-4 py-3 md:flex">
          {[
            { id: 'dashboard', label: 'Beranda', icon: User },
            { id: 'assignments', label: 'Tugas', icon: FileText },
            { id: 'materials', label: 'Materi', icon: BookOpen },
            { id: 'schedule', label: 'Jadwal', icon: Calendar },
            { id: 'behavior', label: 'Sikap & Prestasi', icon: Award },
          ].map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${activeTab === item.id ? 'bg-[#DCEBFD] font-extrabold text-[#1668C4] shadow-sm shadow-blue-100 dark:bg-blue-950/70 dark:text-blue-300 dark:shadow-none' : 'font-bold text-slate-500 hover:bg-white hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'}`}>
              <item.icon className="h-4 w-4" />{item.label}
            </button>
          ))}
        </nav>

        {/* Content Scrollable Area */}
        <div className="flex-1 overflow-auto p-4 md:p-8 pb-24 md:pb-8">
          {teachingAnnouncements.length > 0 && (
            <div className="mx-auto mb-4 max-w-5xl overflow-hidden rounded-3xl border border-cyan-200/70 bg-cyan-100/80 py-2.5 dark:border-cyan-900/50 dark:bg-cyan-950/30">
              <style>{`@keyframes student-teaching-marquee { 0% { transform: translateX(100vw); } 100% { transform: translateX(-100%); } } .student-teaching-marquee { animation: student-teaching-marquee 25s linear infinite; }`}</style>
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="z-10 flex shrink-0 items-center gap-2 bg-gradient-to-r from-[#E8F3FE] via-[#E8F3FE] to-transparent px-4 text-xs font-extrabold uppercase tracking-wider text-cyan-700 dark:from-slate-950 dark:via-slate-950 dark:text-cyan-300"><Bell className="h-4 w-4" /> INFO GURU</div>
                <div className="student-teaching-marquee flex min-w-max gap-16 whitespace-nowrap text-xs font-medium text-cyan-900 dark:text-cyan-100">
                  {teachingAnnouncements.map((announcement) => <span key={announcement.id}><span className={`mr-2 font-bold ${announcement.type === 'PENTING' ? 'text-orange-600 dark:text-orange-400' : announcement.type === 'SELAMAT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>{announcement.type === 'PENTING' ? '⚠️ PENTING:' : announcement.type === 'SELAMAT' ? '🏆 SELAMAT:' : '📢 INFO:'}</span>{announcement.text} <span className="ml-2 text-cyan-700/70 dark:text-cyan-300/70">— {announcement.teacherName} · {announcement.subjectName}</span></span>)}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'dashboard' && (
            <div className="mx-auto max-w-5xl space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#7FC4FF] via-[#4AA8FF] to-[#2F8CFF] p-6 text-white shadow-xl shadow-blue-200/80 dark:from-[#14467C] dark:via-[#1D5FA8] dark:to-[#2F8CFF] dark:shadow-none sm:p-8">
                <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/15" />
                <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-32 h-48 w-48 rounded-full bg-white/10" />
                <div aria-hidden="true" className="pointer-events-none absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-[#BEE3FF]/30" />
                <div aria-hidden="true" className="pointer-events-none absolute right-24 top-8 hidden h-16 w-16 rounded-full border-[10px] border-white/20 lg:block" />
                <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <StudentAvatar gender={attendanceSummary?.gender} />
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-wider text-blue-50">Beranda Siswa</p>
                      <h3 className="mt-1 text-2xl font-black sm:text-3xl">{getTimeGreeting()}, {authenticatedStudent?.name?.split(' ')[0] || 'Siswa'}!</h3>
                      <p className="mt-1 text-sm font-bold text-blue-50">{studentClassName} · {studentAcademicYear}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-xs font-bold backdrop-blur-sm">
                      <ClipboardCheck className="h-4 w-4" />
                      Presensi hari ini: {isLoadingAttendance ? 'Memuat...' : attendanceStatusLabel(attendanceSummary?.todayStatus.harian || null)}
                    </span>
                    <a href={SIMAK_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[#1668C4] shadow-lg shadow-blue-900/10 transition hover:bg-blue-50">
                      Buka SIMAK <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div><h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">Prioritas hari ini</h3><p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Hal yang paling perlu kamu cek sekarang.</p></div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#FFE9D6] text-[#FF8A3D] dark:bg-orange-950/40"><Bell className="h-5 w-5" /></span>
                </div>
                {attentionItems.length ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    {attentionItems.map((item) => (
                      <button key={item.id} onClick={item.action} className={`flex min-h-[92px] items-start gap-3 rounded-3xl border p-4 text-left shadow-md shadow-blue-100/50 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-100 dark:shadow-none ${item.tone === 'rose' ? 'border-rose-100/80 bg-white dark:border-rose-900/40 dark:bg-slate-800' : item.tone === 'amber' ? 'border-amber-100/80 bg-white dark:border-amber-900/40 dark:bg-slate-800' : item.tone === 'blue' ? 'border-blue-100/80 bg-white dark:border-blue-900/40 dark:bg-slate-800' : 'border-blue-100/60 bg-white dark:border-slate-700 dark:bg-slate-800'}`}>
                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${item.tone === 'rose' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300' : item.tone === 'amber' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300' : item.tone === 'blue' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}><item.icon className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-slate-800 dark:text-slate-100">{item.title}</span><span className="mt-1 block line-clamp-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{item.description}</span></span>
                        {item.action && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#2F8CFF]" />}
                      </button>
                    ))}
                  </div>
                ) : <div className="flex items-center gap-3 rounded-3xl border border-emerald-100/80 bg-white p-4 text-sm font-bold text-emerald-700 shadow-md shadow-blue-100/50 dark:border-emerald-900/40 dark:bg-slate-800 dark:text-emerald-300 dark:shadow-none"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50"><CheckSquare className="h-5 w-5" /></span>Tidak ada hal mendesak. Semangat belajar hari ini!</div>}
              </section>

              {isSchoolDay && subjectAttendance.length > 0 && (
                <section className="rounded-3xl border border-blue-100/70 bg-white p-5 shadow-lg shadow-blue-100/60 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div><h3 className="font-extrabold text-slate-800 dark:text-slate-100">Presensi mata pelajaran hari ini</h3><p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Status dicatat oleh guru pengajar masing-masing.</p></div>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#DCEBFD] text-[#2F8CFF] dark:bg-blue-950/50"><ClipboardCheck className="h-5 w-5" /></span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {subjectAttendance.map((item) => {
                      const status = attendanceStatusLabel(item.status);
                      const statusTone = status === 'Hadir'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : status === 'Belum dicatat'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300';
                      return <div key={`${item.subject}-${item.timeStart || 'recorded'}`} className="flex items-center justify-between gap-3 rounded-2xl border border-blue-50 bg-[#F4FAFF] px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40"><div className="min-w-0"><p className="truncate text-sm font-extrabold text-slate-800 dark:text-slate-100">{item.subject}</p><p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{item.timeStart && item.timeEnd ? `${item.timeStart}–${item.timeEnd}` : 'Presensi tercatat'}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${statusTone}`}>{status}</span></div>;
                    })}
                  </div>
                </section>
              )}

              <section className="grid gap-3 md:grid-cols-3">
                <a href={SIMAK_URL} target="_blank" rel="noreferrer" className="block rounded-3xl border border-blue-100/70 bg-white p-5 text-left shadow-lg shadow-blue-100/60 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
                  <div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#DCEBFD] text-[#2F8CFF] dark:bg-blue-950/50"><BookOpen className="h-5 w-5" /></span><ExternalLink className="h-4 w-4 text-slate-300" /></div>
                  <p className="mt-4 text-base font-black text-slate-800 dark:text-slate-100">Belajar di SIMAK</p><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Materi, LKPD &amp; tugas ada di SIMAK</p>
                </a>
                <button onClick={() => setShowScheduleModal(true)} className="rounded-3xl border border-blue-100/70 bg-white p-5 text-left shadow-lg shadow-blue-100/60 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
                  <div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#EFEAFE] text-[#8B7CF6] dark:bg-violet-950/50"><Calendar className="h-5 w-5" /></span><ChevronRight className="h-4 w-4 text-slate-300" /></div>
                  <p className="mt-4 truncate text-base font-black text-slate-800 dark:text-slate-100">{nextSchedule?.subject || 'Tidak ada jadwal'}</p><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{nextSchedule ? `${nextSchedule.timeStart}–${nextSchedule.timeEnd}` : `Jadwal ${todayName}`}</p>
                </button>
                <div className="rounded-3xl border border-blue-100/70 bg-white p-5 shadow-lg shadow-blue-100/60 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
                  <div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#E4F8EE] text-[#34C77B] dark:bg-emerald-950/50"><ClipboardCheck className="h-5 w-5" /></span><span className="rounded-full bg-[#E4F8EE] px-2.5 py-1 text-[11px] font-extrabold text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">Bulan ini</span></div>
                  <p className="mt-4 text-3xl font-black text-slate-800 dark:text-slate-100">{attendanceSummary?.monthly.Hadir ?? 0} <span className="text-sm font-extrabold text-slate-400">hari</span></p><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Presensi hadir</p>
                </div>
              </section>

              <section>
                <SimakBridgeCard />
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between"><div><h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">Ringkasan perkembangan</h3><p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Pantau kebiasaan belajar kamu.</p></div><button onClick={openBehaviorDetails} className="rounded-full bg-white px-3.5 py-1.5 text-xs font-extrabold text-[#2F8CFF] shadow-md shadow-blue-100/60 transition hover:bg-blue-50 dark:bg-slate-800 dark:shadow-none">Detail</button></div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex items-center gap-4 rounded-3xl border border-blue-100/70 bg-white p-5 shadow-lg shadow-blue-100/60 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
                    <AttendanceRing percent={attendancePercent} />
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Kehadiran</p>
                      <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">{attendanceSummary?.monthly.total ? `Hadir ${attendanceSummary.monthly.Hadir} dari ${attendanceSummary.monthly.total} hari bulan ini` : 'Belum ada data bulan ini'}</p>
                    </div>
                  </div>
                  <button onClick={openBehaviorDetails} className="flex items-center gap-4 rounded-3xl border border-blue-100/70 bg-white p-5 text-left shadow-lg shadow-blue-100/60 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#EFEAFE] text-[#8B7CF6] dark:bg-violet-950/50"><ThumbsUp className="h-6 w-6" /></span>
                    <div className="min-w-0">
                      <p className="text-3xl font-black leading-none text-slate-800 dark:text-slate-100">{behaviorScore}</p>
                      <p className="mt-1.5 text-xs font-extrabold text-slate-500 dark:text-slate-400">Skor sikap</p>
                    </div>
                  </button>
                  <button onClick={openBehaviorDetails} className="flex items-center gap-4 rounded-3xl border border-blue-100/70 bg-white p-5 text-left shadow-lg shadow-blue-100/60 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#FFF3D6] text-[#E8A100] dark:bg-amber-950/50 dark:text-amber-400"><Award className="h-6 w-6" /></span>
                    <div className="min-w-0">
                      <p className="text-3xl font-black leading-none text-slate-800 dark:text-slate-100">{studentAchievements.length}</p>
                      <p className="mt-1.5 text-xs font-extrabold text-slate-500 dark:text-slate-400">Prestasi</p>
                    </div>
                  </button>
                </div>
              </section>
            </div>
          )}
          
          {activeTab === 'assignments' && (
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-3xl border border-blue-100/70 bg-white p-6 shadow-lg shadow-blue-100/60 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Tugas Saya</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Tugas sekarang dikerjakan dan dikumpulkan lewat SIMAK.</p>
              </div>
              <SimakBridgeCard />
            </div>
          )}

          {activeTab === 'materials' && (
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-3xl border border-blue-100/70 bg-white p-6 shadow-lg shadow-blue-100/60 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Materi Belajar</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Modul, slide, dan referensi pelajaran sekarang dibagikan lewat SIMAK.</p>
              </div>
              <SimakBridgeCard />
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-3xl border border-blue-100/70 bg-white p-6 shadow-lg shadow-blue-100/60 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
                <h3 className="flex items-center gap-2 text-xl font-black text-slate-800 dark:text-slate-100">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[#EFEAFE] text-[#8B7CF6] dark:bg-violet-950/50"><Calendar className="h-5 w-5" /></span>
                  Jadwal & Kalender Akademik
                </h3>
                <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Lihat jadwal pelajaran mingguan dan agenda kegiatan akademik kelas {studentClassName || 'aktif'}.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Weekly Timetable */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="rounded-3xl border border-blue-100/70 bg-white p-6 shadow-lg shadow-blue-100/60 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
                    <h4 className="mb-6 flex items-center gap-2 border-b border-blue-50 pb-3 text-lg font-extrabold text-slate-800 dark:border-slate-700 dark:text-slate-100">
                      <Clock className="h-5 w-5 text-[#2F8CFF]" />
                      Jadwal Pelajaran Mingguan
                    </h4>

                    <div className="space-y-6">
                      {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].map((day, dayIndex) => {
                        const daySchedules = (schedules || []).filter(s => s.day === day)
                          .sort((a, b) => a.timeStart.localeCompare(b.timeStart));
                        const dayDots = ['bg-[#2F8CFF]', 'bg-[#FF8A3D]', 'bg-[#34C77B]', 'bg-[#8B7CF6]', 'bg-[#FF7BAC]'];

                        return (
                          <div key={day} className="border-b border-blue-50 pb-5 last:border-0 last:pb-0 dark:border-slate-700">
                            <h5 className="mb-3 flex items-center gap-2 font-extrabold text-slate-700 dark:text-slate-200">
                              <span className={`h-2.5 w-2.5 rounded-full ${dayDots[dayIndex]}`} />
                              {day}
                            </h5>
                            {daySchedules.length === 0 ? (
                              <p className="text-xs text-slate-400 dark:text-slate-500 italic ml-4">Tidak ada jadwal pelajaran.</p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-4">
                                {daySchedules.map((sched) => {
                                  const colorClasses: Record<string, string> = {
                                    blue: 'bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/50',
                                    emerald: 'bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50',
                                    amber: 'bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/50',
                                    rose: 'bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-900/50',
                                    indigo: 'bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50',
                                    violet: 'bg-violet-50/50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-400 border-violet-100 dark:border-violet-900/50',
                                  };
                                  const colorStyle = colorClasses[sched.color] || colorClasses.blue;

                                  return (
                                    <div key={sched.id} className={`flex flex-col justify-between rounded-3xl border p-4 transition-all hover:shadow-md hover:shadow-blue-100/60 ${colorStyle}`}>
                                      <div>
                                        <span className="block text-sm font-extrabold">{sched.subject}</span>
                                        <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-extrabold dark:bg-slate-900/40">
                                          <Clock className="h-3 w-3" />
                                          {sched.timeStart} - {sched.timeEnd}
                                        </span>
                                      </div>
                                      {sched.teacherName && (
                                        <div className="text-xs opacity-75 italic mt-3 pt-2 border-t border-current/10">
                                          Guru: {sched.teacherName}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Academic Agenda (1/3 width) */}
                <div className="space-y-6">
                  <div className="rounded-3xl border border-blue-100/70 bg-white p-6 shadow-lg shadow-blue-100/60 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
                    <h4 className="mb-6 flex items-center gap-2 border-b border-blue-50 pb-3 text-lg font-extrabold text-slate-800 dark:border-slate-700 dark:text-slate-100">
                      <CalendarDays className="h-5 w-5 text-[#FF8A3D]" />
                      Agenda Akademik
                    </h4>

                    <div className="space-y-3">
                      {(!agenda || agenda.length === 0) ? (
                        <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-6">Belum ada agenda akademik.</p>
                      ) : (
                        agenda.map((item, itemIndex) => {
                          const dateChipStyles = ['bg-[#DCEBFD] text-[#1668C4] dark:bg-blue-950/50 dark:text-blue-300', 'bg-[#FFE9D6] text-[#D96C1E] dark:bg-orange-950/50 dark:text-orange-300', 'bg-[#E4F8EE] text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300', 'bg-[#EFEAFE] text-[#8B7CF6] dark:bg-violet-950/50 dark:text-violet-300', 'bg-[#FFE3EE] text-[#E14E8C] dark:bg-pink-950/50 dark:text-pink-300'];
                          return (
                          <div key={item.id} className="flex items-start gap-3 rounded-3xl border border-blue-50 bg-[#F8FCFF] p-3 dark:border-slate-700 dark:bg-slate-900/30">
                            <div className={`flex min-w-11 flex-col items-center justify-center rounded-2xl p-1.5 ${dateChipStyles[itemIndex % dateChipStyles.length]}`}>
                              <span className="text-[9px] font-extrabold uppercase">{item.date.split(' ')[1] || 'AGS'}</span>
                              <span className="text-lg font-black leading-none">{item.date.split(' ')[0] || '1'}</span>
                            </div>
                            <div>
                              <h5 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{item.title}</h5>
                              <span className="mt-1 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-extrabold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">{item.type}</span>
                            </div>
                          </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'behavior' && (
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-3xl border border-blue-100/70 bg-white p-6 shadow-lg shadow-blue-100/60 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
                <h3 className="flex items-center gap-2 text-xl font-black text-slate-800 dark:text-slate-100">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[#EFEAFE] text-[#8B7CF6] dark:bg-violet-950/50"><Award className="h-5 w-5" /></span>
                  Catatan Sikap & Prestasi Saya
                </h3>
                <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Pantau perkembangan karakter, skor perilaku harian, serta daftar pencapaian luar biasa Anda.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left side: Behavior Log (2/3 width) */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Score overview */}
                  <div className="grid grid-cols-3 gap-2 rounded-3xl border border-blue-100/70 bg-white p-2 text-center shadow-lg shadow-blue-100/60 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none sm:gap-3 sm:p-4">
                    <div className="rounded-3xl bg-[#EFEAFE] p-3 dark:bg-violet-950/30 sm:p-4">
                      <span className="mb-1 block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 sm:text-xs">Skor Sikap</span>
                      <span className="text-2xl font-black text-[#8B7CF6] sm:text-3xl">{behaviorScore}</span>
                      <span className="mt-1 block text-[9px] font-semibold text-slate-500 sm:text-[10px]">Dasar 100</span>
                    </div>
                    <div className="rounded-3xl bg-[#E4F8EE] p-3 dark:bg-emerald-950/30 sm:p-4">
                      <span className="mb-1 block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 sm:text-xs">Positif</span>
                      <span className="text-2xl font-black text-[#22A35E] dark:text-emerald-400 sm:text-3xl">+{posPoints}</span>
                      <span className="mt-1 block text-[9px] font-semibold text-slate-500 sm:text-[10px]">Apresiasi</span>
                    </div>
                    <div className="rounded-3xl bg-[#FFE3EE] p-3 dark:bg-rose-950/30 sm:p-4">
                      <span className="mb-1 block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 sm:text-xs">Negatif</span>
                      <span className="text-2xl font-black text-[#E14E8C] dark:text-rose-400 sm:text-3xl">-{negPoints}</span>
                      <span className="mt-1 block text-[9px] font-semibold text-slate-500 sm:text-[10px]">Evaluasi</span>
                    </div>
                  </div>

                  {/* Behavior Timeline */}
                  <div className="rounded-3xl border border-blue-100/70 bg-white p-6 shadow-lg shadow-blue-100/60 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
                    <h4 className="mb-6 flex items-center gap-2 border-b border-blue-50 pb-3 text-lg font-extrabold text-slate-800 dark:border-slate-700 dark:text-slate-100">
                      <Clock className="h-5 w-5 text-[#8B7CF6]" />
                      Riwayat Catatan Sikap & Evaluasi
                    </h4>

                    <div className="space-y-4">
                      {sRecords.length === 0 ? (
                        <p className="text-sm text-slate-400 italic text-center py-8">Belum ada catatan perilaku. Terus pertahankan sikap yang baik!</p>
                      ) : (
                        sRecords.map((rec) => (
                          <div key={rec.id} className={`flex items-start gap-4 rounded-3xl border p-4 ${
                            rec.type === 'positif' 
                              ? 'bg-emerald-50/20 dark:bg-emerald-950/5 border-emerald-100 dark:border-emerald-900/30' 
                              : 'bg-rose-50/20 dark:bg-rose-950/5 border-rose-100 dark:border-rose-900/30'
                          }`}>
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                              rec.type === 'positif' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700' : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700'
                            }`}>
                              {rec.type === 'positif' ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  rec.type === 'positif'
                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30'
                                    : 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-400 border-rose-200 dark:border-rose-800/30'
                                }`}>
                                  {rec.category} ({rec.type === 'positif' ? `+${rec.points}` : `-${rec.points}`})
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">{rec.date}</span>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">{rec.description}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: Achievements Gallery (1/3 width) */}
                <div className="space-y-6">
                  <div className="rounded-3xl border border-blue-100/70 bg-white p-6 shadow-lg shadow-blue-100/60 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
                    <h4 className="mb-6 flex items-center gap-2 border-b border-blue-50 pb-3 text-lg font-extrabold text-slate-800 dark:border-slate-700 dark:text-slate-100">
                      <Award className="h-5 w-5 text-[#FFC531]" />
                      Prestasi & Piala Saya
                    </h4>

                    <div className="space-y-4">
                      {studentAchievements.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                          <Award className="h-12 w-12 mx-auto text-slate-200 mb-3" />
                          <p className="text-xs italic">Belum ada catatan prestasi yang terdaftar.</p>
                          <p className="text-[10px] mt-1">Ayo tunjukkan bakatmu dan raih prestasi gemilang!</p>
                        </div>
                      ) : (
                        studentAchievements.map((item) => (
                          <div key={item.id} className="flex items-start gap-3 rounded-3xl border border-amber-100 bg-amber-50/20 p-4 dark:border-amber-900/30 dark:bg-amber-950/5">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF3D6] dark:bg-amber-900/50">
                              <Award className="h-5 w-5 text-[#E8A100] dark:text-amber-400" />
                            </div>
                            <div>
                              <h5 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{item.title}</h5>
                              <div className="flex gap-1.5 items-center mt-1.5">
                                <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[9px] font-extrabold text-blue-700 dark:border-blue-900/30 dark:bg-blue-900/30 dark:text-blue-400">
                                  {item.level}
                                </span>
                                <span className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400">{item.rank}</span>
                              </div>
                              {item.description && <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 italic">"{item.description}"</p>}
                              <span className="text-[9px] text-slate-400 font-mono block mt-2">{item.date}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showScheduleModal && (
            <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
              <button aria-label="Tutup jadwal dan kalender" onClick={() => setShowScheduleModal(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
              <div role="dialog" aria-modal="true" aria-labelledby="student-schedule-modal-title" className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border border-blue-100 bg-[#F4FAFF] p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-w-2xl sm:rounded-3xl sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-wider text-[#2F8CFF] dark:text-[#5DA9FF]">Informasi akademik</p><h3 id="student-schedule-modal-title" className="mt-1 text-xl font-black text-slate-800 dark:text-slate-100">Jadwal & Kalender Akademik</h3><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{studentClassName} · {studentAcademicYear}</p></div><button onClick={() => setShowScheduleModal(false)} className="rounded-full p-2 text-slate-400 hover:bg-blue-100 dark:hover:bg-slate-800" aria-label="Tutup"><X className="h-5 w-5" /></button></div>
                <section className="rounded-3xl border border-blue-100/70 bg-white p-4 shadow-md shadow-blue-100/50 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none"><div className="mb-3 flex items-center justify-between"><h4 className="font-extrabold text-slate-800 dark:text-slate-100">Jadwal hari ini</h4><span className="rounded-full bg-[#DCEBFD] px-3 py-1 text-xs font-extrabold text-[#1668C4] dark:bg-blue-950/50 dark:text-blue-300">{todayName}</span></div>{todaySchedules.length ? <div className="grid gap-2 sm:grid-cols-2">{todaySchedules.map((schedule) => <div key={schedule.id} className="rounded-2xl border border-blue-50 border-l-4 border-l-[#2F8CFF] bg-[#F8FCFF] p-3 dark:border-slate-700 dark:bg-slate-900/50"><p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{schedule.subject}</p><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{schedule.timeStart}–{schedule.timeEnd}{schedule.teacherName ? ` · ${schedule.teacherName.split(',')[0]}` : ''}</p></div>)}</div> : <p className="text-xs italic text-slate-400">Tidak ada jadwal hari ini.</p>}</section>
                <section className="mt-4 rounded-3xl border border-blue-100/70 bg-white p-4 shadow-md shadow-blue-100/50 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none"><h4 className="mb-3 font-extrabold text-slate-800 dark:text-slate-100">Jadwal mingguan</h4><div className="grid gap-2 sm:grid-cols-2">{['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].map((day, dayIndex) => { const daySchedules = (schedules || []).filter((schedule) => schedule.day === day).sort((first, second) => first.timeStart.localeCompare(second.timeStart)); const dayAccents = ['text-[#2F8CFF]', 'text-[#FF8A3D]', 'text-[#22A35E]', 'text-[#8B7CF6]', 'text-[#E14E8C]']; const dayBorders = ['border-[#2F8CFF]', 'border-[#FF8A3D]', 'border-[#34C77B]', 'border-[#8B7CF6]', 'border-[#FF7BAC]']; return <div key={day} className="rounded-2xl bg-[#F8FCFF] p-3 dark:bg-slate-900/50"><p className={`text-xs font-extrabold ${dayAccents[dayIndex]}`}>{day}</p>{daySchedules.length ? daySchedules.map((schedule) => <div key={schedule.id} className={`mt-2 border-l-2 pl-2 ${dayBorders[dayIndex]}`}><p className="text-xs font-bold text-slate-700 dark:text-slate-200">{schedule.subject}</p><p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{schedule.timeStart}–{schedule.timeEnd}</p></div>) : <p className="mt-2 text-[10px] italic text-slate-400">Tidak ada jadwal</p>}</div>; })}</div></section>
                <section className="mt-4 rounded-3xl border border-blue-100/70 bg-white p-4 shadow-md shadow-blue-100/50 dark:border-slate-700 dark:bg-slate-800 dark:shadow-none"><div className="mb-3 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#FF8A3D]" /><h4 className="font-extrabold text-slate-800 dark:text-slate-100">Agenda akademik</h4></div>{agenda?.length ? <div className="space-y-2">{agenda.slice(0, 5).map((item) => <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-[#F8FCFF] p-3 dark:bg-slate-900/50"><span className="min-w-12 rounded-full bg-[#DCEBFD] px-2 py-1 text-center text-xs font-extrabold text-[#1668C4] dark:bg-blue-950/50 dark:text-blue-300">{item.date}</span><div><p className="text-xs font-bold text-slate-800 dark:text-slate-100">{item.title}</p><p className="mt-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">{item.type}</p></div></div>)}</div> : <p className="text-xs italic text-slate-400">Belum ada agenda akademik.</p>}</section>
              </div>
            </div>
          )}

          {showBehaviorModal && (
            <div className="fixed inset-0 z-50 flex items-end justify-center p-0 md:hidden">
              <button aria-label="Tutup sikap dan prestasi" onClick={() => setShowBehaviorModal(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
              <div role="dialog" aria-modal="true" aria-labelledby="student-behavior-modal-title" className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border border-blue-100 bg-[#F4FAFF] p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-wider text-[#8B7CF6]">Perkembangan siswa</p><h3 id="student-behavior-modal-title" className="mt-1 text-xl font-black text-slate-800 dark:text-slate-100">Sikap & Prestasi</h3><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Ringkasan perkembangan kamu.</p></div><button onClick={() => setShowBehaviorModal(false)} className="rounded-full p-2 text-slate-400 hover:bg-blue-100 dark:hover:bg-slate-800" aria-label="Tutup"><X className="h-5 w-5" /></button></div>
                <div className="grid grid-cols-3 gap-2 rounded-3xl border border-blue-100/70 bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-800"><div className="rounded-2xl bg-[#EFEAFE] py-2 dark:bg-violet-950/30"><p className="text-2xl font-black text-[#8B7CF6]">{behaviorScore}</p><p className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400">Skor sikap</p></div><div className="rounded-2xl bg-[#E4F8EE] py-2 dark:bg-emerald-950/30"><p className="text-2xl font-black text-[#22A35E] dark:text-emerald-400">+{posPoints}</p><p className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400">Catatan positif</p></div><div className="rounded-2xl bg-[#FFF3D6] py-2 dark:bg-amber-950/30"><p className="text-2xl font-black text-[#E8A100] dark:text-amber-400">{studentAchievements.length}</p><p className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400">Prestasi</p></div></div>
                <section className="mt-4 rounded-3xl border border-blue-100/70 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><h4 className="mb-3 flex items-center gap-2 font-extrabold text-slate-800 dark:text-slate-100"><Clock className="h-4 w-4 text-[#8B7CF6]" />Catatan sikap terbaru</h4>{sRecords.length ? <div className="space-y-2">{sRecords.slice(0, 4).map((record) => <div key={record.id} className={`rounded-2xl border p-3 ${record.type === 'positif' ? 'border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/15' : 'border-rose-100 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/15'}`}><div className="flex items-start justify-between gap-2"><p className="text-xs font-bold text-slate-800 dark:text-slate-100">{record.category} <span className={record.type === 'positif' ? 'text-emerald-600' : 'text-rose-600'}>({record.type === 'positif' ? '+' : '-'}{record.points})</span></p><span className="text-[10px] text-slate-400">{record.date}</span></div><p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">{record.description}</p></div>)}</div> : <p className="text-xs italic text-slate-400">Belum ada catatan sikap.</p>}</section>
                <section className="mt-4 rounded-3xl border border-blue-100/70 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><h4 className="mb-3 flex items-center gap-2 font-extrabold text-slate-800 dark:text-slate-100"><Award className="h-4 w-4 text-[#FFC531]" />Prestasi terbaru</h4>{studentAchievements.length ? <div className="space-y-2">{studentAchievements.slice(0, 4).map((achievement) => <div key={achievement.id} className="rounded-2xl border border-amber-100 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/15"><p className="text-xs font-bold text-slate-800 dark:text-slate-100">{achievement.title}</p><p className="mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">{achievement.level} · {achievement.rank} · {achievement.date}</p></div>)}</div> : <p className="text-xs italic text-slate-400">Belum ada prestasi yang tercatat.</p>}</section>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Bottom Navigation for Mobile */}
      {showPasswordModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-extrabold uppercase tracking-wider text-[#2F8CFF]">Keamanan Akun</p><h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Ubah Password</h3></div><button onClick={() => setShowPasswordModal(false)} className="rounded-full p-2 text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-700" aria-label="Tutup"><X className="h-5 w-5" /></button></div><form onSubmit={handleChangePassword} className="space-y-4"><div><label className="mb-1.5 block text-xs font-extrabold text-slate-500">Password saat ini</label><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required className="w-full rounded-2xl border border-blue-100 bg-[#F8FCFF] px-4 py-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-900" /></div><div><label className="mb-1.5 block text-xs font-extrabold text-slate-500">Password baru</label><input type="password" autoComplete="new-password" minLength={6} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required className="w-full rounded-2xl border border-blue-100 bg-[#F8FCFF] px-4 py-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-900" /><p className="mt-1 text-[11px] font-semibold text-slate-400">Minimal 6 karakter.</p></div><div><label className="mb-1.5 block text-xs font-extrabold text-slate-500">Konfirmasi password baru</label><input type="password" autoComplete="new-password" minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required className="w-full rounded-2xl border border-blue-100 bg-[#F8FCFF] px-4 py-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-900" /></div><button type="submit" className="w-full rounded-full bg-[#2F8CFF] py-3 text-sm font-extrabold text-white shadow-md shadow-blue-200 transition hover:bg-[#1D7BE0] dark:shadow-none">Simpan Password Baru</button></form></div></div>}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-blue-100 bg-white/95 px-1 py-2 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 md:hidden">
        {[
          { id: 'dashboard', label: 'Beranda', icon: User },
          { id: 'assignments', label: 'Tugas', icon: FileText },
          { id: 'materials', label: 'Materi', icon: BookOpen },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 rounded-full px-6 py-1.5 transition-all duration-200 ${
              activeTab === item.id
              ? 'bg-[#DCEBFD] font-extrabold text-[#1668C4] dark:bg-blue-950/70 dark:text-blue-300' 
              : 'font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] tracking-tight">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default StudentDashboard;
