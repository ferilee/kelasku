import { useEffect, useState } from 'react';
import Dashboard from './Dashboard';
import StudentDashboard from './StudentDashboard';
import LandingPage from './LandingPage';
import LoginPage from './LoginPage';
import { ClassProvider, useClassData } from './ClassContext';

const AppContent = () => {
  // Simple state-based routing/role management for demo purposes
  const [role, setRole] = useState<'landing' | 'login_admin' | 'admin' | 'teacher' | 'counselor' | 'student'>('landing');
  const [userSession, setUserSession] = useState<'admin' | 'teacher' | 'counselor' | 'student' | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(async (response) => response.ok ? response.json() : null).then((result) => {
      if (result?.user?.role) setUserSession(result.user.role);
    }).catch(() => undefined);
  }, []);

  const classData = useClassData();

  const handleLoginSuccess = (newRole: 'admin' | 'teacher' | 'counselor' | 'student') => {
    setUserSession(newRole);
    setRole(newRole);
    classData.selectClass('').catch(() => undefined);
  };

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUserSession(null);
    setRole('landing');
  };

  return (
    <div className="relative">
      {/* Floating Demo Role Switcher (only show if not in landing or login) */}
      {role !== 'landing' && role !== 'login_admin' && (
        <div className="fixed bottom-20 md:bottom-4 right-4 z-50 bg-white dark:bg-slate-800 p-2 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 flex gap-2">
          <button 
            onClick={() => setRole('landing')}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors hover:bg-slate-100 text-slate-600 dark:text-slate-300`}
          >
            Home
          </button>
          {userSession === 'admin' && (
            <button 
              onClick={() => handleLoginSuccess('admin')}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${role === 'admin' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-600 dark:text-slate-300'}`}
            >
              Wali Kelas
            </button>
          )}
          {userSession === 'teacher' && (
            <button onClick={() => handleLoginSuccess('teacher')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${role === 'teacher' ? 'bg-violet-600 text-white' : 'hover:bg-slate-100 text-slate-600 dark:text-slate-300'}`}>Guru Pengajar</button>
          )}
          {userSession === 'counselor' && (
            <button onClick={() => handleLoginSuccess('counselor')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${role === 'counselor' ? 'bg-amber-600 text-white' : 'hover:bg-slate-100 text-slate-600 dark:text-slate-300'}`}>BK</button>
          )}
          {userSession === 'student' && (
            <button 
              onClick={() => handleLoginSuccess('student')}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${role === 'student' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-100 text-slate-600 dark:text-slate-300'}`}
            >
              Siswa
            </button>
          )}
        </div>
      )}

      {/* Render Active View */}
      {role === 'landing' && (
        <LandingPage 
          onLoginSuccess={handleLoginSuccess}
          userSession={userSession}
          onLogout={handleLogout}
        />
      )}
      {role === 'login_admin' && (
        <LoginPage 
          onLoginSuccess={handleLoginSuccess}
          onBack={() => setRole('landing')} 
        />
      )}
      {(role === 'admin' || role === 'teacher' || role === 'counselor') && <Dashboard userRole={role} />}
      {role === 'student' && <StudentDashboard />}
    </div>
  );
};

const App = () => {
  return (
    <ClassProvider>
      <AppContent />
    </ClassProvider>
  );
};

export default App;
