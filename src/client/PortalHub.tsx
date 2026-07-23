import React, { useState } from 'react';
import { BookOpen, GraduationCap, Calendar, ArrowRight, Sun, Moon } from 'lucide-react';

interface PortalHubProps {
  onSelectClass: (className: string, academicYear: string) => void;
}

const PortalHub = ({ onSelectClass }: PortalHubProps) => {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [isDark, setIsDark] = useState(true);

  const classes = [
    'X TKJ A',
    'X TKJ B',
    'XI TKJ A',
    'XII TKJ A',
    'X RPL A',
    'XI RPL A',
    'XII RPL A'
  ];

  const academicYears = [
    '2024-2025',
    '2025-2026',
    '2026-2027'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClass && selectedYear) {
      onSelectClass(selectedClass, selectedYear);
    }
  };

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen font-sans flex flex-col justify-between items-center relative overflow-hidden bg-slate-50 dark:bg-[#0A1118] text-slate-800 dark:text-slate-200 transition-colors duration-500 p-6">
        {/* Background Decorative Gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-500/10 dark:bg-cyan-500/5 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-orange-500/10 dark:bg-orange-500/5 blur-[120px] pointer-events-none"></div>

        {/* Top Navbar */}
        <header className="w-full max-w-7xl mx-auto flex justify-between items-center z-10 py-4">
          <div className="flex items-center gap-3 text-slate-900 dark:text-white">
            <BookOpen className="h-8 w-8 text-cyan-600 dark:text-cyan-400 transition-colors" />
            <span className="font-extrabold text-xl tracking-wide">WEBKELAS</span>
          </div>
          <button 
            onClick={() => setIsDark(!isDark)} 
            className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors border border-slate-200 dark:border-slate-700/50"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5 text-slate-600" />}
          </button>
        </header>

        {/* Main Selection Card */}
        <main className="w-full max-w-md my-auto z-10 animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl dark:shadow-[0_0_50px_rgba(6,182,212,0.15)] border border-slate-200/50 dark:border-slate-800 transition-all duration-300">
            <div className="text-center mb-8">
              <div className="inline-flex p-3.5 bg-cyan-100 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 rounded-2xl mb-4 border border-cyan-200/30 dark:border-cyan-800/30">
                <GraduationCap className="h-8 w-8" />
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Selamat Datang 👋</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Silakan pilih kelas dan tahun ajaran untuk masuk ke portal kelas Anda.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Select Class */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-cyan-500" />
                  Pilih Kelas
                </label>
                <div className="relative">
                  <select
                    required
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all cursor-pointer appearance-none"
                  >
                    <option value="" disabled className="text-slate-400 dark:bg-[#0F172A]">-- Pilih Kelas --</option>
                    {classes.map((cls) => (
                      <option key={cls} value={cls} className="text-slate-800 dark:bg-[#0F172A]">{cls}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>

              {/* Select Academic Year */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-orange-500" />
                  Tahun Ajaran
                </label>
                <div className="relative">
                  <select
                    required
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all cursor-pointer appearance-none"
                  >
                    <option value="" disabled className="text-slate-400 dark:bg-[#0F172A]">-- Pilih Tahun Ajaran --</option>
                    {academicYears.map((year) => (
                      <option key={year} value={year} className="text-slate-800 dark:bg-[#0F172A]">{year}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={!selectedClass || !selectedYear}
                className="w-full py-4 px-6 rounded-xl text-white font-bold transition-all mt-6 flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 dark:from-cyan-500 dark:to-blue-500 dark:hover:from-cyan-400 dark:hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] transform hover:-translate-y-0.5 active:translate-y-0 duration-200"
              >
                Masuk ke Kelas <ArrowRight className="h-5 w-5" />
              </button>
            </form>
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full text-center text-slate-400 dark:text-slate-500 text-xs py-4">
          &copy; {new Date().getFullYear()} WebKelas. Hak Cipta Dilindungi.
        </footer>
      </div>
    </div>
  );
};

export default PortalHub;
