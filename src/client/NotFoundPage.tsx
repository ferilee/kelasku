import { BookOpen, Home } from 'lucide-react';

// Shown when the app is opened on a path it does not know (see
// initialRoute.ts). The server still answers such paths with the SPA
// shell and HTTP 200 — that fallback must stay, or direct visits to real
// paths would break — so the "404" is expressed here, in the client: a
// clear dead end with a way back, instead of the landing page silently
// pretending the address was fine.
const NotFoundPage = () => {
  return (
    <div className="min-h-screen font-sans bg-slate-50 dark:bg-[#0A1118] text-slate-600 dark:text-slate-300 selection:bg-cyan-200 selection:text-cyan-900 dark:selection:bg-cyan-900 dark:selection:text-cyan-100 flex items-center justify-center p-6 transition-colors duration-500">
      <div className="w-full max-w-md text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="flex items-center justify-center gap-2 text-cyan-600 dark:text-cyan-400 font-bold mb-8">
          <BookOpen className="h-6 w-6" /> WebKelas
        </div>
        <p className="text-7xl font-black text-slate-900 dark:text-white tracking-tight">404</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-800 dark:text-white">Halaman tidak ditemukan</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Alamat yang Anda buka tidak tersedia di WebKelas. Periksa kembali alamatnya, atau kembali ke beranda.
        </p>
        <a
          href="/"
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-3.5 font-bold text-sm transition-all shadow-lg shadow-cyan-500/20"
        >
          <Home className="h-4 w-4" /> Kembali ke Beranda
        </a>
      </div>
    </div>
  );
};

export default NotFoundPage;
