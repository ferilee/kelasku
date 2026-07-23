import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Calendar, CheckSquare, Bell, FileText, User, Sun, Moon, Plus, X, Save, Clock, CalendarDays, Award, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useClassData } from './ClassContext';

const StudentDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { selectedClass, selectedYear, students, schedules, agenda, announcements, behaviorRecords, achievements } = useClassData();
  
  // Find database studentId matching Andi/Ahmad Fauzi
  const studentObj = (students || []).find(s => s.name.toLowerCase().includes('ahmad') || s.name.toLowerCase().includes('andi')) || students[0];
  const dbStudentId = studentObj ? studentObj.id : '2';
  const currentStudentId = '1'; // Andi/Ahmad Fauzi is first student (id: 1)

  // Assignments & submissions state
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [submitFilePath, setSubmitFilePath] = useState('');

  const fetchAssignments = useCallback(async () => {
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
    if (!selectedAssignmentId || !submitFilePath.trim()) return;

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

  // Dark mode state with persistence
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || 
             localStorage.getItem('theme') === 'dark';
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
            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-200 dark:border-slate-700">
              <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold shrink-0">
                A
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Andi (Siswa)</span>
                <span className="text-[10px] text-slate-400 font-mono leading-none mt-0.5">{selectedClass} ({selectedYear})</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Scrollable Area */}
        <div className="flex-1 overflow-auto p-4 md:p-8 pb-24 md:pb-8">
          {activeTab === 'dashboard' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30">
                      <span className="text-xs text-slate-400 block mb-1">Skor Sikap Anda</span>
                      <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{behaviorScore}</span>
                      <span className="text-[10px] text-slate-500 block mt-1">Standar Awal: 100</span>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30">
                      <span className="text-xs text-slate-400 block mb-1">Poin Positif</span>
                      <span className="text-3xl font-black text-emerald-650">+{posPoints}</span>
                      <span className="text-[10px] text-slate-500 block mt-1">Apresiasi Karakter</span>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30">
                      <span className="text-xs text-slate-400 block mb-1">Poin Negatif</span>
                      <span className="text-3xl font-black text-rose-500">-{negPoints}</span>
                      <span className="text-[10px] text-slate-500 block mt-1">Pelanggaran/Evaluasi</span>
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
