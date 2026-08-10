import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Calendar, CheckSquare, Bell, FileText, User, Sun, Moon, X, Clock, CalendarDays, Award, ThumbsUp, ThumbsDown, ClipboardCheck, Key } from 'lucide-react';
import { useClassData } from './ClassContext';

type DailyAttendanceStats = { Hadir: number; Sakit: number; Izin: number; Alfa: number; total: number };
type StudentAttendanceSummary = {
  today: string;
  gender: 'L' | 'P';
  todayStatus: { harian: string | null; dhuha: string | null; dzuhur: string | null; jumat: string | null };
  daily: DailyAttendanceStats;
  weekly: DailyAttendanceStats;
  monthly: DailyAttendanceStats;
};

const StudentDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { selectedClass, selectedYear, students, schedules, agenda, announcements, behaviorRecords, achievements } = useClassData();
  const [authenticatedStudent, setAuthenticatedStudent] = useState<{ id: number; name: string } | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<StudentAttendanceSummary | null>(null);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(true);
  const currentStudentId = authenticatedStudent?.id.toString() || '';
  const dbStudentId = currentStudentId;

  useEffect(() => {
    const loadStudentDashboard = async () => {
      setIsLoadingAttendance(true);
      try {
        const [authResponse, attendanceResponse] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/student/attendance-summary'),
        ]);
        if (authResponse.ok) {
          const authData = await authResponse.json();
          if (authData.user?.role === 'student') setAuthenticatedStudent(authData.user);
        }
        if (attendanceResponse.ok) setAttendanceSummary(await attendanceResponse.json());
      } catch (error) {
        console.error('Error fetching student attendance:', error);
      } finally {
        setIsLoadingAttendance(false);
      }
    };
    loadStudentDashboard();
  }, []);

  // Assignments & submissions state
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [submitFilePath, setSubmitFilePath] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fetchAssignments = useCallback(async () => {
    if (!currentStudentId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/student/${currentStudentId}/assignments`);
      if (res.ok) {
        const data = await res.json();
        setAssignments(data);
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentStudentId]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStudentId || !selectedAssignmentId || !submitFilePath.trim()) return;

    try {
      const res = await fetch(`/api/student/${currentStudentId}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: selectedAssignmentId,
          filePath: submitFilePath.trim()
        })
      });
      if (res.ok) {
        alert('Tugas berhasil dikumpulkan!');
        setShowSubmitModal(false);
        setSubmitFilePath('');
        fetchAssignments();
      } else {
        alert('Gagal mengumpulkan tugas.');
      }
    } catch (err) {
      console.error('Error submitting task:', err);
      alert('Terjadi kesalahan saat mengumpulkan tugas.');
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) return alert('Konfirmasi password baru tidak sama.');
    try {
      const response = await fetch('/api/auth/password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) });
      const data = await response.json();
      if (!response.ok) return alert(data.error || 'Gagal mengubah password.');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setShowPasswordModal(false);
      alert('Password berhasil diubah.');
    } catch (error) { console.error('Error changing password:', error); alert('Terjadi kesalahan saat mengubah password.'); }
  };

  // Dark mode state with persistence
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  // Apply dark mode theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Compute tasks summary
  const completedTasksCount = assignments.filter(a => a.type === 'tugas' && a.submission).length;
  const pendingTasksCount = assignments.filter(a => a.type === 'tugas' && !a.submission).length;

  const sRecords = (behaviorRecords || []).filter(r => r.studentId === dbStudentId);
  const posPoints = sRecords.filter(r => r.type === 'positif').reduce((sum, r) => sum + r.points, 0);
  const negPoints = sRecords.filter(r => r.type === 'negatif').reduce((sum, r) => sum + r.points, 0);
  const behaviorScore = 100 + posPoints - negPoints;

  const stats = [
    { title: "Tugas Selesai", value: `${completedTasksCount} Tugas`, icon: CheckSquare, color: "text-emerald-500" },
    { title: "Tugas Menunggu", value: `${pendingTasksCount} Tugas`, icon: FileText, color: "text-orange-500" },
    { title: "Skor Sikap", value: `${behaviorScore} Poin`, icon: Award, color: behaviorScore >= 100 ? "text-emerald-500" : "text-amber-500" },
  ];

  const attendanceStatusLabel = (status: string | null, prayer = false) => {
    if (!status) return 'Belum dicatat';
    if (prayer && (status === 'Berjamaah' || status === 'Munfarid')) return 'Sholat';
    return status;
  };

  const attendanceStatusClass = (status: string | null) => {
    if (status === 'Hadir' || status === 'Sholat' || status === 'Berjamaah' || status === 'Munfarid') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    if (status === 'Sakit' || status === 'Izin' || status === 'Berhalangan') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    if (status === 'Alfa') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
    return 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';
  };

  const todayDay = new Date().getDay();
  const isSchoolDay = todayDay >= 1 && todayDay <= 5;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const nearestPendingAssignment = assignments
    .filter((assignment) => assignment.type === 'tugas' && !assignment.submission && assignment.dueDate)
    .sort((first, second) => new Date(first.dueDate).getTime() - new Date(second.dueDate).getTime())[0];
  const attentionItems = [
    ...(!isLoading && nearestPendingAssignment ? [{
      id: 'assignment', icon: FileText, action: () => setActiveTab('assignments'),
      title: new Date(nearestPendingAssignment.dueDate).getTime() < startOfToday.getTime() ? 'Tugas melewati tenggat' : 'Ada tugas yang perlu dikerjakan',
      description: nearestPendingAssignment.title, tone: new Date(nearestPendingAssignment.dueDate).getTime() < startOfToday.getTime() ? 'rose' : 'amber'
    }] : []),
    ...(isSchoolDay && attendanceSummary?.todayStatus.harian === null ? [{ id: 'daily', icon: CheckSquare, title: 'Presensi kelas belum dicatat', description: 'Status kehadiran hari ini masih menunggu pencatatan wali kelas.', tone: 'amber' }] : []),
    ...(isSchoolDay && attendanceSummary?.todayStatus.dhuha === null ? [{ id: 'dhuha', icon: Clock, title: 'Status Sholat Dhuha belum dicatat', description: 'Tunggu pencatatan presensi dari wali kelas.', tone: 'blue' }] : []),
    ...(isSchoolDay && attendanceSummary?.todayStatus.dzuhur === null ? [{ id: 'dzuhur', icon: Clock, title: 'Status Sholat Dzuhur belum dicatat', description: 'Tunggu pencatatan presensi dari wali kelas.', tone: 'blue' }] : []),
    ...(todayDay === 5 && attendanceSummary?.gender === 'L' && attendanceSummary.todayStatus.jumat === null ? [{ id: 'jumat', icon: Clock, title: 'Status Sholat Jumat belum dicatat', description: 'Tunggu pencatatan presensi dari wali kelas.', tone: 'blue' }] : []),
    ...(announcements.length ? [{ id: 'announcement', icon: Bell, title: 'Informasi kelas', description: announcements[0].text, tone: 'slate' }] : []),
  ].slice(0, 3);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex-col shrink-0">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h1 className="text-2xl font-black bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent flex items-center gap-2">
            <User className="h-8 w-8 text-emerald-500" />
            Area Siswa
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'dashboard', label: 'Dashboard Siswa', icon: User },
            { id: 'assignments', label: 'Tugas Saya', icon: FileText },
            { id: 'materials', label: 'Materi Belajar', icon: BookOpen },
            { id: 'schedule', label: 'Jadwal', icon: Calendar },
            { id: 'behavior', label: 'Sikap & Prestasi', icon: Award },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === item.id 
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-semibold shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 md:px-8">
          <h2 className="text-base sm:text-xl font-semibold text-slate-800 dark:text-slate-100 truncate mr-2">
            {activeTab === 'dashboard' ? `Ringkasan (${selectedClass})` : 'Detail'}
          </h2>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Dark Mode Toggle */}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              title={isDarkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
            >
              {isDarkMode ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5" />}
            </button>
            <button onClick={() => { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setShowPasswordModal(true); }} className="p-2 text-slate-500 dark:text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-full transition-colors" title="Ubah password"><Key className="h-5 w-5" /></button>
            <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-200 dark:border-slate-700">
              <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold shrink-0">
                {(authenticatedStudent?.name || 'S').charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{authenticatedStudent?.name || 'Siswa'} (Siswa)</span>
                <span className="text-[10px] text-slate-400 font-mono leading-none mt-0.5">{selectedClass} ({selectedYear})</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Scrollable Area */}
        <div className="flex-1 overflow-auto p-4 md:p-8 pb-24 md:pb-8">
          {activeTab === 'dashboard' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6">
                <div className="mb-4 flex items-start justify-between gap-4"><div><h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Pusat Perhatian Hari Ini</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Informasi pribadi yang perlu Anda cek hari ini.</p></div><Bell className="h-5 w-5 text-emerald-500" /></div>
                {attentionItems.length ? <div className="space-y-3">{attentionItems.map((item) => <button key={item.id} onClick={item.action} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition hover:shadow-sm ${item.tone === 'rose' ? 'border-rose-100 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/15' : item.tone === 'amber' ? 'border-amber-100 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/15' : item.tone === 'blue' ? 'border-blue-100 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/15' : 'border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50'}`}>
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${item.tone === 'rose' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300' : item.tone === 'amber' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300' : item.tone === 'blue' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}><item.icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{item.title}</span><span className="mt-0.5 block line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{item.description}</span></span>{item.action && <span className="self-center text-xs font-bold text-emerald-600 dark:text-emerald-400">Buka →</span>}
                </button>)}</div> : <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/15 dark:text-emerald-300"><CheckSquare className="h-5 w-5 shrink-0" />Tidak ada hal mendesak. Terus pertahankan kebiasaan baik hari ini.</div>}
              </section>

              {/* Personal attendance: this endpoint is scoped to the logged-in student. */}
              <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <ClipboardCheck className="h-5 w-5 text-emerald-500" /> Status Presensi Hari Ini
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {attendanceSummary ? new Date(`${attendanceSummary.today}T12:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Memuat data presensi...'}
                      </p>
                    </div>
                    <span className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold ${attendanceStatusClass(attendanceSummary?.todayStatus.harian || null)}`}>
                      {isLoadingAttendance ? 'Memuat...' : attendanceStatusLabel(attendanceSummary?.todayStatus.harian || null)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Presensi Kelas', status: attendanceSummary?.todayStatus.harian || null, prayer: false },
                      { label: 'Sholat Dhuha', status: attendanceSummary?.todayStatus.dhuha || null, prayer: true },
                      { label: 'Sholat Dzuhur', status: attendanceSummary?.todayStatus.dzuhur || null, prayer: true },
                      ...(attendanceSummary?.gender === 'L' ? [{ label: 'Sholat Jumat', status: attendanceSummary.todayStatus.jumat, prayer: true }] : []),
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 px-3 py-3">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className={`mt-1 text-sm font-bold ${item.status ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>{attendanceStatusLabel(item.status, item.prayer)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-600 to-teal-600 p-5 sm:p-6 rounded-2xl shadow-sm text-white">
                  <p className="text-sm font-semibold text-emerald-50">Kehadiran Bulan Ini</p>
                  <p className="text-4xl font-black mt-2">{attendanceSummary?.monthly.Hadir ?? 0}<span className="text-lg font-bold text-emerald-100"> hari</span></p>
                  <p className="text-xs text-emerald-100 mt-2">Dari {attendanceSummary?.monthly.total ?? 0} presensi yang telah dicatat.</p>
                </div>
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Hari Ini', value: attendanceSummary?.daily },
                  { label: 'Minggu Ini', value: attendanceSummary?.weekly },
                  { label: 'Bulan Ini', value: attendanceSummary?.monthly },
                ].map((item) => (
                  <div key={item.label} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{item.label}</p>
                    <p className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">{item.value?.Hadir ?? 0} <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Hadir</span></p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] font-semibold">
                      <span className="rounded-md bg-amber-50 dark:bg-amber-950/30 py-1 text-amber-700 dark:text-amber-300">Sakit {item.value?.Sakit ?? 0}</span>
                      <span className="rounded-md bg-blue-50 dark:bg-blue-950/30 py-1 text-blue-700 dark:text-blue-300">Izin {item.value?.Izin ?? 0}</span>
                      <span className="rounded-md bg-rose-50 dark:bg-rose-950/30 py-1 text-rose-700 dark:text-rose-300">Alfa {item.value?.Alfa ?? 0}</span>
                    </div>
                  </div>
                ))}
              </section>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                  <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow group">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{stat.title}</p>
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{stat.value}</h3>
                      </div>
                      <div className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-700 group-hover:scale-110 transition-transform ${stat.color}`}>
                        <stat.icon className="h-6 w-6" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tasks & Announcements */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Pending Tasks */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-orange-500" />
                    Tugas Pending
                  </h3>
                  <div className="space-y-4">
                    {assignments.filter(a => a.type === 'tugas' && !a.submission).length === 0 ? (
                      <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs italic">
                        Tidak ada tugas tertunda. Luar biasa!
                      </div>
                    ) : (
                      assignments.filter(a => a.type === 'tugas' && !a.submission).slice(0, 3).map((item) => (
                        <div key={item.id} className="p-4 rounded-xl border border-orange-150 dark:border-orange-950/30 bg-orange-50/30 dark:bg-orange-950/10 flex gap-4 items-start">
                          <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{item.title}</h4>
                            <p className="text-xs text-slate-505 dark:text-slate-400 mt-1 line-clamp-2">{item.description || 'Tidak ada deskripsi.'}</p>
                            <div className="flex justify-between items-center mt-3">
                              <span className="text-[10px] font-semibold text-red-500">
                                {item.dueDate 
                                  ? `Tenggat: ${new Date(item.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` 
                                  : 'Tidak ada tenggat'
                                }
                              </span>
                              <button 
                                onClick={() => {
                                  setActiveTab('assignments');
                                  setSelectedAssignmentId(item.id);
                                  setSubmitFilePath('');
                                  setShowSubmitModal(true);
                                }}
                                className="text-[10px] bg-orange-650 hover:bg-orange-700 text-white font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                              >
                                Kumpulkan
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Announcements */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Bell className="h-5 w-5 text-blue-500" />
                    Pengumuman Kelas
                  </h3>
                  <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                    {(!announcements || announcements.length === 0) ? (
                      <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs italic">
                        Belum ada pengumuman dari wali kelas.
                      </div>
                    ) : (
                      announcements.slice(0, 4).map((ann) => (
                        <div key={ann.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/80 flex gap-4">
                          <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/70 flex items-center justify-center shrink-0">
                            <Bell className="h-5 w-5 text-blue-600 dark:text-blue-200" />
                          </div>
                          <div>
                            <span className={`font-bold text-[9px] px-2 py-0.5 rounded ${
                              ann.type === 'PENTING' ? 'bg-red-50 text-red-600 dark:bg-red-950/70 dark:text-red-200' : ann.type === 'SELAMAT' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-200' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/70 dark:text-blue-200'
                            }`}>{ann.type}</span>
                            <p className="text-xs text-slate-700 dark:text-slate-100 mt-2 leading-relaxed">{ann.text}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Today's Schedule */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Clock className="h-5 w-5 text-emerald-500" />
                      Jadwal Hari Ini
                    </h3>
                    <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                      {(() => {
                        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                        const todayIndex = new Date().getDay();
                        return days[todayIndex];
                      })()}
                    </span>
                  </div>

                  {(() => {
                    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                    const todayName = days[new Date().getDay()];
                    
                    const todaySchedules = (schedules || []).filter(s => s.day === todayName)
                      .sort((a, b) => a.timeStart.localeCompare(b.timeStart));

                    if (todaySchedules.length === 0) {
                      return (
                        <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                          <p className="text-xs text-slate-400 dark:text-slate-500 italic">Tidak ada jadwal hari ini</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        {todaySchedules.map((sched) => {
                          const borderColors: Record<string, string> = {
                            blue: 'border-l-blue-500',
                            emerald: 'border-l-emerald-500',
                            amber: 'border-l-amber-500',
                            rose: 'border-l-rose-500',
                            indigo: 'border-l-indigo-500',
                            violet: 'border-l-violet-500',
                          };
                          const colorStyle = borderColors[sched.color] || borderColors.blue;

                          return (
                            <div key={sched.id} className={`p-3 rounded-r-xl border-l-4 border bg-slate-50/50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-700/50 ${colorStyle} flex justify-between items-center`}>
                              <div>
                                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">{sched.subject}</h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-450 mt-0.5">{sched.timeStart} - {sched.timeEnd}</p>
                              </div>
                              {sched.teacherName && (
                                <span className="text-[9px] font-medium text-slate-500 bg-slate-200 dark:bg-slate-750 dark:text-slate-400 px-2 py-0.5 rounded-full max-w-[110px] truncate" title={sched.teacherName}>
                                  {sched.teacherName.split(',')[0]}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <button 
                    onClick={() => setActiveTab('schedule')}
                    className="w-full text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline pt-1 block"
                  >
                    Lihat Selengkapnya &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'assignments' && (
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Tugas Saya</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Daftar tugas mandiri dan kelompok yang harus dikerjakan.</p>
              </div>

              {isLoading ? (
                <div className="text-center py-12 text-slate-450">Memuat tugas...</div>
              ) : assignments.filter(a => a.type === 'tugas').length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-770">
                  <FileText className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <h4 className="font-semibold text-slate-600 dark:text-slate-400">Tidak ada tugas baru</h4>
                  <p className="text-sm text-slate-400 mt-1">Selamat! Semua tugas Anda telah selesai atau belum ada tugas yang dipublish.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {assignments.filter(a => a.type === 'tugas').map((item) => {
                    const hasSubmitted = !!item.submission;
                    const grade = item.submission?.grade;
                    const subDate = item.submission?.submittedAt;

                    return (
                      <div key={item.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                              hasSubmitted 
                                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-250 dark:border-emerald-900/50' 
                                : 'bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 border border-orange-250 dark:border-orange-900/50'
                            }`}>
                              {hasSubmitted ? 'Terkumpul' : 'Belum Dikumpulkan'}
                            </span>

                            {grade !== null && grade !== undefined && (
                              <span className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-3 py-1 rounded-lg border border-blue-200 dark:border-blue-900/50">
                                Nilai: {grade}
                              </span>
                            )}
                          </div>

                          <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">{item.title}</h4>
                          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 mb-4">{item.description || 'Tidak ada deskripsi.'}</p>
                          
                          {item.filePath && (
                            <div className="flex items-center gap-2 mb-4 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                              <FileText className="h-4 w-4 text-blue-600" />
                              <span className="text-xs font-mono text-slate-650 dark:text-slate-400 truncate max-w-[200px]" title={item.filePath}>
                                {item.filePath.split('/').pop()}
                              </span>
                              <a 
                                href={item.filePath} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-xs text-blue-600 hover:underline font-bold ml-auto"
                              >
                                Lihat File Pendukung
                              </a>
                            </div>
                          )}
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-700/50 pt-4 mt-2 flex justify-between items-center text-xs">
                          <div>
                            <span className="text-slate-400 block">Tenggat Waktu</span>
                            <span className="font-semibold text-red-500">
                              {item.dueDate 
                                ? new Date(item.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                                : '-'
                              }
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedAssignmentId(item.id);
                              setSubmitFilePath(item.submission?.filePath || '');
                              setShowSubmitModal(true);
                            }}
                            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${
                              hasSubmitted 
                                ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200' 
                                : 'bg-orange-600 hover:bg-orange-700 text-white shadow-sm'
                            }`}
                          >
                            {hasSubmitted ? 'Edit Pengumpulan' : 'Kumpulkan Tugas'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'materials' && (
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Materi Belajar</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Unduh modul, slide, dan referensi pelajaran yang dibagikan guru.</p>
              </div>

              {isLoading ? (
                <div className="text-center py-12 text-slate-450">Memuat materi...</div>
              ) : assignments.filter(a => a.type === 'materi').length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-770">
                  <BookOpen className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <h4 className="font-semibold text-slate-600 dark:text-slate-400">Belum ada materi belajar</h4>
                  <p className="text-sm text-slate-400 mt-1">Guru Anda belum membagikan modul atau materi pelajaran.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {assignments.filter(a => a.type === 'materi').map((item) => (
                    <div key={item.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between hover:shadow-md transition-shadow">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-250 dark:border-indigo-900/50">
                            Materi
                          </span>
                        </div>

                        <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">{item.title}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 mb-4">{item.description || 'Tidak ada deskripsi.'}</p>
                        
                        {item.filePath && (
                          <div className="flex items-center gap-2 mb-4 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate max-w-[200px]" title={item.filePath}>
                              {item.filePath.split('/').pop()}
                            </span>
                            <a 
                              href={item.filePath} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:underline font-bold ml-auto"
                            >
                              Lihat Modul / Slide
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-100 dark:border-slate-700/50 pt-4 mt-2 flex justify-between items-center text-xs">
                        <div>
                          <span className="text-slate-400 block">Dibagikan Pada</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-emerald-600" />
                  Jadwal & Kalender Akademik
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Lihat jadwal pelajaran mingguan dan agenda kegiatan akademik kelas {selectedClass || 'aktif'}.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Weekly Timetable */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2 border-b border-slate-105 dark:border-slate-700 pb-3">
                      <Clock className="h-5 w-5 text-blue-500" />
                      Jadwal Pelajaran Mingguan
                    </h4>

                    <div className="space-y-6">
                      {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].map((day) => {
                        const daySchedules = (schedules || []).filter(s => s.day === day)
                          .sort((a, b) => a.timeStart.localeCompare(b.timeStart));

                        return (
                          <div key={day} className="border-b border-slate-100 dark:border-slate-750 pb-5 last:border-0 last:pb-0">
                            <h5 className="font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
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
                                    <div key={sched.id} className={`p-4 rounded-xl border flex flex-col justify-between hover:shadow-sm transition-all ${colorStyle}`}>
                                      <div>
                                        <span className="font-bold text-sm block">{sched.subject}</span>
                                        <span className="text-xs font-medium flex items-center gap-1.5 opacity-80 mt-1">
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
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2 border-b border-slate-105 dark:border-slate-700 pb-3">
                      <CalendarDays className="h-5 w-5 text-emerald-500" />
                      Agenda Akademik
                    </h4>

                    <div className="space-y-3">
                      {(!agenda || agenda.length === 0) ? (
                        <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-6">Belum ada agenda akademik.</p>
                      ) : (
                        agenda.map((item) => (
                          <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-750">
                            <div className="flex flex-col items-center justify-center text-blue-600 dark:text-blue-400 min-w-10 bg-blue-50 dark:bg-blue-950/40 p-1.5 rounded-lg">
                              <span className="text-[9px] font-bold uppercase">{item.date.split(' ')[1] || 'AGS'}</span>
                              <span className="text-lg font-extrabold leading-none">{item.date.split(' ')[0] || '1'}</span>
                            </div>
                            <div>
                              <h5 className="font-semibold text-xs text-slate-800 dark:text-slate-200">{item.title}</h5>
                              <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-650 dark:text-slate-400 uppercase">{item.type}</span>
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

          {activeTab === 'behavior' && (
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Award className="h-5 w-5 text-emerald-600" />
                  Catatan Sikap & Prestasi Saya
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Pantau perkembangan karakter, skor perilaku harian, serta daftar pencapaian luar biasa Anda.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left side: Behavior Log (2/3 width) */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Score overview */}
                  <div className="grid grid-cols-3 rounded-2xl border border-slate-200 bg-white p-2 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-4">
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/30 sm:p-4">
                      <span className="mb-1 block text-[10px] text-slate-400 sm:text-xs">Skor Sikap</span>
                      <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 sm:text-3xl">{behaviorScore}</span>
                      <span className="mt-1 block text-[9px] text-slate-500 sm:text-[10px]">Dasar 100</span>
                    </div>
                    <div className="rounded-xl border-l border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/30 sm:p-4">
                      <span className="mb-1 block text-[10px] text-slate-400 sm:text-xs">Positif</span>
                      <span className="text-2xl font-black text-emerald-650 sm:text-3xl">+{posPoints}</span>
                      <span className="mt-1 block text-[9px] text-slate-500 sm:text-[10px]">Apresiasi</span>
                    </div>
                    <div className="rounded-xl border-l border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/30 sm:p-4">
                      <span className="mb-1 block text-[10px] text-slate-400 sm:text-xs">Negatif</span>
                      <span className="text-2xl font-black text-rose-500 sm:text-3xl">-{negPoints}</span>
                      <span className="mt-1 block text-[9px] text-slate-500 sm:text-[10px]">Evaluasi</span>
                    </div>
                  </div>

                  {/* Behavior Timeline */}
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
                      <Clock className="h-5 w-5 text-emerald-600" />
                      Riwayat Catatan Sikap & Evaluasi
                    </h4>

                    <div className="space-y-4">
                      {sRecords.length === 0 ? (
                        <p className="text-sm text-slate-400 italic text-center py-8">Belum ada catatan perilaku. Terus pertahankan sikap yang baik!</p>
                      ) : (
                        sRecords.map((rec) => (
                          <div key={rec.id} className={`p-4 rounded-xl border flex gap-4 items-start ${
                            rec.type === 'positif' 
                              ? 'bg-emerald-50/20 dark:bg-emerald-950/5 border-emerald-100 dark:border-emerald-900/30' 
                              : 'bg-rose-50/20 dark:bg-rose-950/5 border-rose-100 dark:border-rose-900/30'
                          }`}>
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                              rec.type === 'positif' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700' : 'bg-rose-100 dark:bg-rose-900/40 text-rose-705'
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
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
                      <Award className="h-5 w-5 text-amber-500" />
                      Prestasi & Piala Saya
                    </h4>

                    <div className="space-y-4">
                      {((achievements || []).filter(a => a.studentId === dbStudentId)).length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                          <Award className="h-12 w-12 mx-auto text-slate-200 mb-3" />
                          <p className="text-xs italic">Belum ada catatan prestasi yang terdaftar.</p>
                          <p className="text-[10px] mt-1">Ayo tunjukkan bakatmu dan raih prestasi gemilang!</p>
                        </div>
                      ) : (
                        (achievements || []).filter(a => a.studentId === dbStudentId).map((item) => (
                          <div key={item.id} className="p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/20 dark:bg-amber-950/5 flex gap-3 items-start">
                            <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                              <Award className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                              <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200">{item.title}</h5>
                              <div className="flex gap-1.5 items-center mt-1.5">
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
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

          {/* Submit Task Modal */}
          {showSubmitModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div 
                onClick={() => setShowSubmitModal(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
              ></div>
              
              <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 animate-in zoom-in-95 duration-200 relative">
                <button 
                  onClick={() => setShowSubmitModal(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
                >
                  <X className="h-5 w-5" />
                </button>

                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-emerald-600" />
                  Kumpulkan Hasil Tugas
                </h3>
                
                <form onSubmit={handleSubmitTask} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Link/Path Tugas Anda</label>
                    <input 
                      type="text" 
                      value={submitFilePath}
                      onChange={(e) => setSubmitFilePath(e.target.value)}
                      placeholder="Masukkan link Google Drive, GitHub, atau file path tugas Anda" 
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Pastikan link dapat diakses oleh guru Anda.</p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={() => setShowSubmitModal(false)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl transition-all"
                    >
                      Batal
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all"
                    >
                      Kumpulkan
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation for Mobile */}
      {showPasswordModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Keamanan Akun</p><h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Ubah Password</h3></div><button onClick={() => setShowPasswordModal(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Tutup"><X className="h-5 w-5" /></button></div><form onSubmit={handleChangePassword} className="space-y-4"><div><label className="mb-1.5 block text-xs font-bold text-slate-500">Password saat ini</label><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></div><div><label className="mb-1.5 block text-xs font-bold text-slate-500">Password baru</label><input type="password" autoComplete="new-password" minLength={6} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" /><p className="mt-1 text-[11px] text-slate-400">Minimal 6 karakter.</p></div><div><label className="mb-1.5 block text-xs font-bold text-slate-500">Konfirmasi password baru</label><input type="password" autoComplete="new-password" minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></div><button type="submit" className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700">Simpan Password Baru</button></form></div></div>}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 flex justify-around items-center py-2 px-1 shadow-lg">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: User },
          { id: 'assignments', label: 'Tugas Saya', icon: FileText },
          { id: 'materials', label: 'Materi', icon: BookOpen },
          { id: 'schedule', label: 'Jadwal', icon: Calendar },
          { id: 'behavior', label: 'Sikap', icon: Award },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-200 ${
              activeTab === item.id 
              ? 'text-emerald-600 dark:text-emerald-400 font-medium' 
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
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
