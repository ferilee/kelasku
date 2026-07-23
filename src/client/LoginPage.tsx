import { useState } from 'react';
import { BookOpen, AlertCircle, ArrowLeft } from 'lucide-react';

const LoginPage = ({ onLoginSuccess, onBack }: { onLoginSuccess: () => void, onBack: () => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'Ferilee' && password === 'F3r!-lee') {
      onLoginSuccess();
    } else {
      setError('Username atau password salah');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A1118] flex items-center justify-center p-6 selection:bg-cyan-900 selection:text-cyan-100 font-sans relative">
      <button 
        onClick={onBack}
        className="absolute top-6 left-6 text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
      >
        <ArrowLeft className="h-5 w-5" /> Kembali
      </button>

      <div className="w-full max-w-md bg-[#121C28] p-8 rounded-3xl border border-slate-700/50 shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        {/* Glow effect */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
        
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 bg-[#0E1621] rounded-2xl flex items-center justify-center border border-slate-700/50 shadow-[0_0_20px_rgba(6,182,212,0.15)] mb-4">
            <BookOpen className="h-8 w-8 text-cyan-400" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Login Guru</h2>
          <p className="text-slate-400 text-sm mt-1">Masuk untuk mengelola kelas Anda</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm animate-in shake">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#0E1621] border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder-slate-600"
              placeholder="Masukkan username"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0E1621] border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder-slate-600"
              placeholder="••••••••"
              required
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-3.5 rounded-xl transition-colors mt-4 shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)]"
          >
            Masuk
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
