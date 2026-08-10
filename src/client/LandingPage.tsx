import { useState, useEffect } from 'react';
import { BookOpen, Users, Clock, Award, Star, CalendarDays, Megaphone, TrendingUp, Medal, Quote, ImageIcon, Book, Sun, Moon, X, Lock, Globe, MessageCircle, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useClassData } from './ClassContext';

const LandingPage = ({ 
  onLoginSuccess,
  userSession,
  onLogout
}: { 
  onLoginSuccess: (role: 'admin' | 'teacher' | 'student') => void;
  userSession: 'admin' | 'teacher' | 'student' | null;
  onLogout: () => void;
}) => {
  const [isDark, setIsDark] = useState(false);
  const { announcements, agenda, quote, stats, schedules, achievements, officers, officerDuties, academicLeaderboard, gradeTrend, galleryItems, heroImage, homeroomTeacherPhoto, selectedClass, selectedYear, setSelectedClass, setSelectedYear } = useClassData();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState('beranda');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [showAllGallery, setShowAllGallery] = useState(false);
  const [selectedOfficerDuty, setSelectedOfficerDuty] = useState<{ role: string; description: string } | null>(null);

  const getOfficerDutyKey = (role: string) => {
    const normalized = role.toLowerCase();
    if (normalized.includes('wakil')) return 'wakil';
    if (normalized.includes('ketua')) return 'ketua';
    if (normalized.includes('sekretaris')) return 'sekretaris';
    if (normalized.includes('bendahara')) return 'bendahara';
    return null;
  };

  const tabClass = (tabName: string) => {
    return activeMobileTab === tabName ? 'block' : 'hidden md:block';
  };

  const toggleTheme = () => setIsDark(!isDark);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: username, password }) });
    const result = await response.json();
    if (!response.ok) return alert(result.error || 'Username atau password salah.');
    setShowLoginModal(false);
    onLoginSuccess(result.user.role);
  };

  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
  const todayName = dayNames[new Date().getDay()];
  const todaySchedules = schedules.filter((schedule) => schedule.day === todayName);
  const parseAgendaDate = (value: string) => {
    const [dayValue, monthValue] = value.trim().split(/\s+/);
    const day = Number(dayValue);
    const month = monthShortNames.findIndex((monthName) => monthName.toLowerCase() === (monthValue || '').slice(0, 3).toLowerCase());
    if (!Number.isInteger(day) || day < 1 || month < 0) return new Date(Number.NaN);
    const now = new Date();
    const date = new Date(now.getFullYear(), month, day);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (date < today) date.setFullYear(date.getFullYear() + 1);
    return date;
  };
  const agendaWithDates = agenda.map((item) => ({ item, date: parseAgendaDate(item.date) })).filter((entry) => !Number.isNaN(entry.date.getTime()));
  const calendarDays = Array.from({ length: new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate() }, (_, index) => index + 1);
  const calendarLeadingDays = Array.from({ length: new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay() }, () => null);
  const openFullCalendar = () => {
    const nearestAgenda = [...agendaWithDates].sort((first, second) => first.date.getTime() - second.date.getTime())[0];
    setCalendarDate(nearestAgenda?.date || new Date());
    setShowCalendarModal(true);
  };

  return (
    <div className={`${isDark ? 'dark' : ''}`}>
      <div className="min-h-screen font-sans text-slate-600 dark:text-slate-300 selection:bg-cyan-200 selection:text-cyan-900 dark:selection:bg-cyan-900 dark:selection:text-cyan-100 bg-slate-50 dark:bg-[#0A1118] transition-colors duration-500 pb-24 md:pb-12">
        
        {/* 1. Mading Pengumuman Berjalan (Marquee Ticker) */}
        <div className="w-full bg-cyan-100/80 dark:bg-cyan-950/30 border-b border-cyan-200 dark:border-cyan-900/50 py-2.5 relative overflow-hidden flex items-center transition-colors">
          <div className="absolute left-0 bg-gradient-to-r from-slate-50 via-slate-50 dark:from-[#0A1118] dark:via-[#0A1118] to-transparent w-32 h-full z-10 flex items-center px-6 transition-colors">
            <Megaphone className="h-4 w-4 text-cyan-600 dark:text-cyan-400 mr-2" />
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">INFO</span>
          </div>
          
          <style>{`
            @keyframes marquee {
              0% { transform: translateX(100vw); }
              100% { transform: translateX(-100%); }
            }
            .animate-marquee-scroll {
              animation: marquee 25s linear infinite;
            }
          `}</style>
          
          <div className="whitespace-nowrap animate-marquee-scroll flex gap-24 text-xs font-medium text-cyan-900 dark:text-cyan-100 pl-40">
            {announcements.map((ann) => (
              <span key={ann.id} className="flex items-center gap-2">
                <span className={`font-bold ${ann.type === 'PENTING' ? 'text-orange-600 dark:text-orange-400' : ann.type === 'INFO' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {ann.type === 'PENTING' ? '⚠️ PENTING:' : ann.type === 'INFO' ? '📢 INFO:' : '🏆 SELAMAT:'}
                </span> 
                {ann.text}
              </span>
            ))}
          </div>
        </div>

        {/* Navbar */}
        <nav className="w-full z-40 top-0 py-6 relative">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
            <div className="flex items-center gap-3 text-slate-900 dark:text-white">
              <BookOpen className="h-8 w-8 text-cyan-600 dark:text-cyan-400 transition-colors animate-pulse" />
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                <span className="font-extrabold text-xl tracking-wide">WEBKELAS</span>
                <span className="hidden md:inline text-slate-300 dark:text-slate-700">|</span>
                <span className="text-xs md:text-sm font-semibold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 px-3 py-1 rounded-full border border-cyan-200/50 dark:border-cyan-800/50 shadow-sm">
                  {selectedClass} ({selectedYear})
                </span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
              <a href="#" className="text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Beranda</a>
              <a href="#statistik" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Statistik</a>
              <a href="#galeri" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Galeri</a>
              <a href="#agenda" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Agenda</a>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              {userSession && (
                <button 
                  onClick={onLogout}
                  className="px-3 sm:px-4 py-2 text-xs font-bold text-red-500 hover:text-white border border-red-200 dark:border-red-900/50 hover:bg-red-500 dark:hover:bg-red-650 rounded-full transition-all"
                >
                  Keluar
                </button>
              )}
              {/* Theme Toggle Button */}
              <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5 text-slate-600" />}
              </button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <main className={`max-w-7xl mx-auto px-6 pt-4 pb-16 relative ${tabClass('beranda')}`}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
            <div className="flex-1 space-y-8 animate-in slide-in-from-left-8 duration-700">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 dark:text-white tracking-tight leading-[1.15] transition-colors">
                {selectedClass} <br /> <span className="text-cyan-600 dark:text-cyan-400">Kelas Interaktif</span>
              </h1>
              
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-lg leading-relaxed font-light transition-colors">
                Portal resmi {selectedClass} tahun ajaran {selectedYear}. Pantau pengumuman, jadwal, agenda, prestasi, dan aktivitas kelas dalam satu tempat.
              </p>

              <div className="pt-4 flex gap-4">
                {userSession ? (
                  <button 
                    onClick={() => onLoginSuccess(userSession)}
                    className="inline-flex items-center justify-center bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-650 hover:to-teal-650 text-white px-8 py-3.5 rounded-full font-bold text-sm transition-all shadow-lg dark:shadow-[0_0_25px_rgba(16,185,129,0.5)] tracking-wide"
                  >
                    Kembali ke Dashboard ({userSession === 'student' ? 'Siswa' : 'Guru'})
                  </button>
                ) : (
                  <button 
                    onClick={() => setShowLoginModal(true)}
                    className="inline-flex items-center justify-center bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-500 dark:hover:from-orange-400 dark:hover:to-orange-300 text-white px-8 py-3.5 rounded-full font-bold text-sm transition-all shadow-lg dark:shadow-[0_0_25px_rgba(249,115,22,0.5)] tracking-wide"
                  >
                    Masuk ke Dashboard
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex-1 flex justify-center md:justify-end animate-in fade-in duration-1000 delay-300 w-full mt-10 md:mt-0">
              <div className="relative w-full max-w-sm aspect-square">
                <div className="absolute inset-0 bg-cyan-500 blur-[80px] dark:blur-[120px] opacity-30 dark:opacity-20 rounded-full transition-opacity"></div>
                <img 
                  src={heroImage}
                  alt={`Suasana ${selectedClass}`}
                  className="relative z-10 w-full h-full object-cover rounded-[100px] shadow-2xl dark:shadow-[0_0_60px_rgba(6,182,212,0.4)] border-4 border-white dark:border-[#0A1118] transition-colors"
                  style={{ clipPath: 'circle(50% at 50% 50%)' }}
                />
              </div>
            </div>
          </div>
        </main>

        <section className={`max-w-7xl mx-auto px-6 pb-14 ${tabClass('beranda')}`} aria-labelledby="wali-kelas-title">
          <div className="relative overflow-hidden rounded-3xl border border-cyan-200/70 dark:border-cyan-900/50 bg-white dark:bg-[#121C28] p-5 sm:p-7 shadow-lg shadow-cyan-950/5 dark:shadow-none">
            <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-cyan-100 dark:bg-cyan-950/30 blur-3xl" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
              <img src={homeroomTeacherPhoto} alt="Feri Dwi Hermawan, S.Pd" className="h-24 w-24 shrink-0 rounded-full border-4 border-white dark:border-slate-700 bg-slate-100 object-cover shadow-lg" onError={(event) => { event.currentTarget.src = '/wali-kelas-placeholder.svg'; }} />
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-400">Wali Kelas</p>
                <h2 id="wali-kelas-title" className="text-xl font-bold text-slate-900 dark:text-white">Feri Dwi Hermawan, S.Pd</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">Mendampingi proses belajar, perkembangan, dan aktivitas siswa {selectedClass}.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a href="https://ferilee.gurumuda.eu.org" target="_blank" rel="noreferrer" aria-label="Kunjungi website Feri Dwi Hermawan" title="Website" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition-colors"><Globe className="h-5 w-5" /></a>
                <a href="https://wa.me/6285174244128" target="_blank" rel="noreferrer" className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-colors"><MessageCircle className="h-4 w-4" /> Hubungi Saya</a>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content Dashboard-like Section */}
        <section id="statistik" className={`py-12 px-6 bg-white dark:bg-[#0E1621] relative z-20 border-t border-slate-200 dark:border-slate-800 transition-colors duration-500 ${activeMobileTab !== 'beranda' ? 'block' : 'hidden md:block'}`}>
          <div className="max-w-7xl mx-auto">
            
            {/* Top Stats Cards */}
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-6 mb-8 ${activeMobileTab === 'statistik' ? 'grid' : 'hidden md:grid'}`}>
              {[
                { label: "Rata-rata Hadir", value: stats.attendance, icon: Users, color: "text-cyan-600 dark:text-cyan-400" },
                { label: "Rata-rata Nilai", value: stats.averageGrade, icon: Award, color: "text-orange-500 dark:text-orange-400" },
                { label: "Total Siswa", value: stats.totalStudents, icon: BookOpen, color: "text-emerald-500 dark:text-emerald-400" },
                { label: "Agenda Tersisa", value: agenda.length.toString(), icon: Clock, color: "text-purple-500 dark:text-purple-400" },
              ].map((stat, idx) => (
                <div key={idx} className="bg-slate-50 dark:bg-[#121C28] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-[#162232] transition-colors group cursor-default shadow-sm dark:shadow-none">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">{stat.label}</span>
                    <stat.icon className={`h-5 w-5 ${stat.color} group-hover:scale-110 transition-transform`} />
                  </div>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white transition-colors">{stat.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Analytics, Wall of Fame, Leaderboard */}
              <div className={`lg:col-span-2 space-y-8 ${activeMobileTab === 'statistik' || activeMobileTab === 'galeri' ? 'block' : 'hidden md:block'}`}>
                
                <div className={`space-y-8 ${tabClass('statistik')}`}>
                {/* 2. Grafik Tren (Analytics Chart) */}
                <div className="bg-slate-50 dark:bg-[#121C28] p-8 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none transition-colors">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 transition-colors">
                      <TrendingUp className="h-6 w-6 text-emerald-500 dark:text-emerald-400" />
                      Tren Nilai Kelas
                    </h3>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">6 bulan terakhir</span>
                  </div>
                  
                  {/* CSS Bar Chart */}
                  <div className="h-48 flex items-end justify-between gap-2 px-2">
                    {gradeTrend.map((data, i) => (
                      <div key={i} className="flex flex-col items-center flex-1 group">
                        <div className="w-full bg-slate-200 dark:bg-[#0A1118] border border-transparent dark:border-slate-800 rounded-t-lg flex items-end justify-center relative overflow-hidden transition-colors" style={{ height: '160px' }}>
                          <div 
                            className="w-full bg-gradient-to-t from-cyan-400 to-cyan-300 dark:from-cyan-600 dark:to-cyan-400 group-hover:from-cyan-500 group-hover:to-cyan-400 transition-all rounded-t-lg shadow-sm dark:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                            style={{ height: `${data.average ?? 0}%` }}
                          ></div>
                          <span className="absolute bottom-3 text-xs font-bold text-slate-800 dark:text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity">{data.average ?? '—'}</span>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-medium">{data.month}</span>
                      </div>
                    ))}
                  </div>
                  {!gradeTrend.some((data) => data.average !== null) && <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">Belum ada nilai dalam enam bulan terakhir.</p>}
                </div>

                {/* Leaderboard & 3. Wall of Fame */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Leaderboard */}
                  <div className="bg-slate-50 dark:bg-[#121C28] p-8 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none transition-colors">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6 transition-colors">
                      <Star className="h-5 w-5 text-orange-500 dark:text-orange-400" />
                      Top Akademik
                    </h3>
                    <div className="space-y-4">
                      {academicLeaderboard.length === 0 ? <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Belum ada nilai untuk menentukan peringkat akademik.</p> : academicLeaderboard.map((student, index) => {
                        const rank = index + 1;
                        return <div key={student.studentId} className="flex items-center justify-between p-3 bg-white dark:bg-[#0A1118] rounded-xl border border-slate-200 dark:border-slate-800 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-xs ${rank === 1 ? 'bg-orange-500 text-white' : rank === 2 ? 'bg-slate-200 dark:bg-slate-300 text-slate-700 dark:text-slate-900' : 'bg-amber-600 dark:bg-amber-700 text-white'}`}>
                              {rank}
                            </div>
                            <div className="font-medium text-sm text-slate-700 dark:text-white transition-colors">{student.name}</div>
                          </div>
                          <div className="text-cyan-600 dark:text-cyan-400 font-bold text-sm">{student.average.toFixed(1)}</div>
                        </div>;
                      })}
                    </div>
                  </div>

                  {/* 4. Wall of Fame */}
                  <div className="bg-slate-50 dark:bg-[#121C28] p-8 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none transition-colors">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6 transition-colors">
                      <Medal className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                      Apresiasi Siswa
                    </h3>
                    <div className="space-y-4">
                    {achievements.slice(0, 3).map((award, i) => (
                      <div key={i} className="flex flex-col p-3 bg-white dark:bg-[#0A1118] rounded-xl border border-slate-200 dark:border-slate-800 transition-colors">
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5 transition-colors">
                            <span>🏆</span> {award.title}
                          </div>
                          <div className="font-semibold text-sm text-cyan-700 dark:text-cyan-100 transition-colors">{award.rank} · {award.level}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                </div>
                
                {/* 5. Galeri Momen Kelas */}
                <div id="galeri" className={`bg-slate-50 dark:bg-[#121C28] p-8 rounded-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden shadow-sm dark:shadow-none transition-colors ${tabClass('galeri')}`}>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 transition-colors">
                      <ImageIcon className="h-6 w-6 text-pink-500 dark:text-pink-400" />
                      Momen Kelas
                    </h3>
                    {galleryItems.length > 3 && <button onClick={() => setShowAllGallery(true)} className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline">Lihat Semua</button>}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {galleryItems.length === 0 ? <p className="col-span-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">Belum ada momen kelas yang ditambahkan.</p> : galleryItems.slice(0, 3).map((item) => <button key={item.id} onClick={() => setShowAllGallery(true)} className="aspect-square overflow-hidden rounded-xl border border-slate-300 bg-slate-200 text-left dark:border-slate-800 dark:bg-[#0A1118]"><img src={item.imageUrl} className="h-full w-full object-cover opacity-90 transition-all hover:scale-110 hover:opacity-100" alt={item.title} onError={(event) => { event.currentTarget.style.display = 'none'; }} /></button>)}
                  </div>
                </div>

              </div>

              {/* Right Column: Jadwal, Agenda, Struktur */}
              <div className={`space-y-8 ${activeMobileTab === 'jadwal' || activeMobileTab === 'agenda' ? 'block' : 'hidden md:block'}`}>
                
                {/* 6. Jadwal Pelajaran Hari Ini */}
                <div id="jadwal" className={`bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-[#0C3243] dark:to-[#121C28] p-8 rounded-2xl border border-cyan-200 dark:border-cyan-800/40 shadow-sm dark:shadow-[0_0_20px_rgba(6,182,212,0.05)] relative overflow-hidden transition-colors ${tabClass('jadwal')}`}>
                  <div className="absolute -right-6 -top-6 opacity-10">
                    <Clock className="h-40 w-40 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1 relative z-10 transition-colors">
                    <Book className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                    Jadwal Hari Ini
                  </h3>
                  <p className="text-xs font-semibold text-cyan-700 dark:text-cyan-300 mb-6 relative z-10 uppercase tracking-widest transition-colors">{todayName}</p>
                  
                  <div className="space-y-4 relative z-10">
                    {todaySchedules.length ? todaySchedules.map((sched, idx) => (
                      <div key={sched.id} className={`flex gap-4 items-start ${idx === 0 ? 'bg-white/60 dark:bg-cyan-950/50 p-3 -mx-3 rounded-xl border border-white dark:border-cyan-800/50 shadow-sm dark:shadow-none transition-colors' : 'px-0 transition-colors'}`}>
                        <div className={`w-12 font-mono text-xs pt-0.5 ${idx === 0 ? 'text-cyan-700 dark:text-cyan-300 font-bold' : 'text-slate-500'}`}>{sched.timeStart}</div>
                        <div className="flex-1">
                          <div className={`text-sm font-semibold transition-colors ${idx === 0 ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{sched.subject}</div>
                          {sched.teacherName && <div className={`text-xs mt-0.5 transition-colors ${idx === 0 ? 'text-cyan-700 dark:text-cyan-200' : 'text-slate-500'}`}>{sched.teacherName}</div>}
                        </div>
                        {idx === 0 && (
                           <div className="h-2 w-2 rounded-full bg-cyan-500 dark:bg-cyan-400 animate-pulse mt-1.5"></div>
                        )}
                      </div>
                    )) : <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada jadwal untuk hari ini.</p>}
                  </div>
                </div>

                {/* Agenda & Struktur */}
                <div className={`space-y-8 ${tabClass('agenda')}`}>
                <div id="agenda" className="bg-slate-50 dark:bg-[#121C28] p-8 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none transition-colors">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6 transition-colors">
                    <CalendarDays className="h-5 w-5 text-orange-500 dark:text-orange-400" />
                    Agenda Terdekat
                  </h3>
                  <div className="space-y-5">
                    {agenda.map((item) => (
                      <div key={item.id} className="flex items-start gap-4">
                        <div className="w-12 text-center shrink-0">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.date.split(' ')[1]}</div>
                          <div className="text-lg font-black text-cyan-600 dark:text-cyan-400">{item.date.split(' ')[0]}</div>
                        </div>
                        <div className="pt-1">
                          <div className="font-medium text-slate-800 dark:text-white text-sm leading-tight transition-colors">{item.title}</div>
                          <div className="text-xs text-slate-500 mt-1">{item.type}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={openFullCalendar} className="w-full mt-6 py-2.5 rounded-xl bg-white dark:bg-[#0A1118] text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none">
                    Lihat Kalender Penuh
                  </button>
                </div>

                {/* Struktur Kelas */}
                <div className="bg-slate-50 dark:bg-[#121C28] p-8 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none transition-colors">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6 transition-colors">
                    <Users className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                    Pengurus Kelas
                  </h3>
                  <div className="space-y-3">
                    {officers.map((person) => {
                      const duty = officerDuties.find((item) => item.key === getOfficerDutyKey(person.role));
                      return (
                      <div key={person.id} className="flex items-center gap-2 bg-white dark:bg-[#0A1118] px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors">
                        <span className="min-w-0 flex-1 text-xs text-slate-500 dark:text-slate-400">{person.role}</span>
                        <span className="text-right text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors">{person.name}</span>
                        {duty && <button onClick={() => setSelectedOfficerDuty({ role: person.role, description: duty.description })} className="shrink-0 rounded-lg p-1.5 text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950/40" title={`Lihat tugas ${person.role}`} aria-label={`Lihat tugas ${person.role}`}><Info className="h-4 w-4" /></button>}
                      </div>
                    )})}
                  </div>
                </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Kutipan Motivasi (Quote of the Day) */}
        <section className={`py-16 bg-white dark:bg-[#0A1118] border-t border-slate-200 dark:border-slate-800 transition-colors duration-500 ${tabClass('beranda')}`}>
          <div className="max-w-3xl mx-auto px-6 text-center">
            <Quote className="h-8 w-8 text-cyan-200 dark:text-cyan-900 mx-auto mb-6 transition-colors" />
            <p className="text-xl md:text-2xl font-serif text-slate-700 dark:text-slate-300 italic mb-6 leading-relaxed transition-colors">
              "{quote.text}"
            </p>
            <p className="text-cyan-600 dark:text-cyan-500 font-bold tracking-widest text-xs uppercase transition-colors">— {quote.author}</p>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 bg-slate-50 dark:bg-[#05080C] border-t border-slate-200 dark:border-slate-800 text-center text-slate-500 text-xs font-medium transition-colors duration-500">
          <div className="flex items-center justify-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-slate-400" />
            <span className="font-bold text-slate-500 tracking-widest uppercase">WEBKELAS</span>
          </div>
          <span>&copy; {new Date().getFullYear()} Kelas Anda. Hak Cipta Dilindungi.</span>
        </footer>
        
        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-[#0A1118]/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 pb-safe shadow-[0_-5px_15px_rgba(0,0,0,0.05)] dark:shadow-[0_-5px_15px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-around p-3">
            <button onClick={() => setActiveMobileTab('beranda')} className={`flex flex-col items-center gap-1 transition-colors ${activeMobileTab === 'beranda' ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400'}`}>
              <BookOpen className="h-5 w-5" />
              <span className="text-[10px] font-bold">Beranda</span>
            </button>
            <button onClick={() => setActiveMobileTab('statistik')} className={`flex flex-col items-center gap-1 transition-colors ${activeMobileTab === 'statistik' ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400'}`}>
              <TrendingUp className="h-5 w-5" />
              <span className="text-[10px] font-medium">Statistik</span>
            </button>
            <button onClick={() => setActiveMobileTab('galeri')} className={`flex flex-col items-center gap-1 transition-colors ${activeMobileTab === 'galeri' ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400'}`}>
              <ImageIcon className="h-5 w-5" />
              <span className="text-[10px] font-medium">Galeri</span>
            </button>
            <button onClick={() => setActiveMobileTab('jadwal')} className={`flex flex-col items-center gap-1 transition-colors ${activeMobileTab === 'jadwal' ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400'}`}>
              <Clock className="h-5 w-5" />
              <span className="text-[10px] font-medium">Jadwal</span>
            </button>
            <button onClick={() => setActiveMobileTab('agenda')} className={`flex flex-col items-center gap-1 transition-colors ${activeMobileTab === 'agenda' ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400'}`}>
              <CalendarDays className="h-5 w-5" />
              <span className="text-[10px] font-medium">Agenda</span>
            </button>
          </div>
        </div>
      </div>

      {showCalendarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={() => setShowCalendarModal(false)}>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-[#121C28] sm:p-7" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="calendar-title">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-500">Agenda Kelas</p><h2 id="calendar-title" className="text-xl font-bold text-slate-900 dark:text-white">Kalender Penuh</h2></div>
              <button onClick={() => setShowCalendarModal(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-white" aria-label="Tutup kalender"><X className="h-5 w-5" /></button>
            </div>
            <div className="mb-5 flex items-center justify-between rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/60">
              <button onClick={() => setCalendarDate((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))} className="rounded-xl p-2 text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700" aria-label="Bulan sebelumnya"><ChevronLeft className="h-5 w-5" /></button>
              <p className="font-bold text-slate-800 dark:text-white">{monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}</p>
              <button onClick={() => setCalendarDate((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))} className="rounded-xl p-2 text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700" aria-label="Bulan berikutnya"><ChevronRight className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500 dark:text-slate-400">{dayNames.map((day) => <span key={day} className="py-2">{day.slice(0, 3)}</span>)}</div>
            <div className="grid grid-cols-7 gap-1">{[...calendarLeadingDays, ...calendarDays].map((day, index) => {
              if (!day) return <div key={`blank-${index}`} className="min-h-20 rounded-xl" />;
              const events = agendaWithDates.filter(({ date }) => date.getFullYear() === calendarDate.getFullYear() && date.getMonth() === calendarDate.getMonth() && date.getDate() === day);
              const isToday = new Date().getFullYear() === calendarDate.getFullYear() && new Date().getMonth() === calendarDate.getMonth() && new Date().getDate() === day;
              return <div key={day} className={`min-h-20 rounded-xl border p-1.5 text-left ${events.length ? 'border-orange-200 bg-orange-50 dark:border-orange-900/60 dark:bg-orange-950/20' : 'border-slate-100 dark:border-slate-800'} ${isToday ? 'ring-2 ring-cyan-400 dark:ring-cyan-500' : ''}`}><p className="mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">{day}</p>{events.map(({ item }) => <p key={item.id} title={item.title} className="mb-1 truncate rounded bg-white px-1 py-0.5 text-[9px] font-semibold text-orange-700 shadow-sm dark:bg-slate-800 dark:text-orange-300">{item.title}</p>)}</div>;
            })}</div>
            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-700"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Agenda pada bulan ini</p>{agendaWithDates.filter(({ date }) => date.getFullYear() === calendarDate.getFullYear() && date.getMonth() === calendarDate.getMonth()).length === 0 ? <p className="text-sm text-slate-500">Tidak ada agenda pada bulan ini.</p> : <div className="space-y-2">{agendaWithDates.filter(({ date }) => date.getFullYear() === calendarDate.getFullYear() && date.getMonth() === calendarDate.getMonth()).map(({ item, date }) => <div key={item.id} className="flex justify-between gap-4 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900/60"><span className="font-semibold text-slate-800 dark:text-slate-100">{item.title}</span><span className="shrink-0 text-slate-500">{date.getDate()} {monthShortNames[date.getMonth()]} · {item.type}</span></div>)}</div>}</div>
          </div>
        </div>
      )}

      {showAllGallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={() => setShowAllGallery(false)}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#121C28]" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="gallery-title">
            <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-pink-500">Dokumentasi</p><h2 id="gallery-title" className="text-xl font-bold text-slate-900 dark:text-white">Galeri Momen Kelas</h2></div><button onClick={() => setShowAllGallery(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Tutup galeri"><X className="h-5 w-5" /></button></div>
            {galleryItems.length === 0 ? <p className="py-12 text-center text-slate-500">Belum ada foto galeri.</p> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">{galleryItems.map((item) => <figure key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"><img src={item.imageUrl} alt={item.title} className="aspect-square w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} /><figcaption className="p-3"><p className="font-semibold text-slate-800 dark:text-slate-100">{item.title}</p>{item.description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.description}</p>}</figcaption></figure>)}</div>}
          </div>
        </div>
      )}

      {selectedOfficerDuty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={() => setSelectedOfficerDuty(null)}>
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-[#121C28]" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="officer-duty-title">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-500">Pengurus Kelas</p><h2 id="officer-duty-title" className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Tugas {selectedOfficerDuty.role}</h2></div><button onClick={() => setSelectedOfficerDuty(null)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Tutup penjelasan tugas"><X className="h-5 w-5" /></button></div>
            <ul className="mt-5 space-y-3">{selectedOfficerDuty.description.split('\n').filter(Boolean).map((item, index) => <li key={index} className="flex gap-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />{item}</li>)}</ul>
          </div>
        </div>
      )}

      {/* Unified Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 pb-0 flex justify-between items-center">
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-bold">
                <BookOpen className="h-6 w-6" /> WebKelas
              </div>
              <button onClick={() => setShowLoginModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-8 pt-4">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Selamat Datang 👋</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">Silakan masuk menggunakan kredensial Anda.</p>

              <form onSubmit={handleLoginSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">
                    Username / NISN
                  </label>
                  <input 
                    type="text" 
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                    placeholder="Contoh: Ferilee atau 10029381"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">Password</label>
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                    placeholder="Masukkan kata sandi"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full py-3.5 rounded-xl text-white font-bold transition-all mt-4 flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-600 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                >
                  <Lock className="h-4 w-4" /> Masuk ke Dasbor
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
