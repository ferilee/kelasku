import { useEffect, useState } from 'react';
import Dashboard from './Dashboard';
import StudentDashboard from './StudentDashboard';
import LandingPage from './LandingPage';
import LoginPage from './LoginPage';
import NotFoundPage from './NotFoundPage';
import { classifyInitialPath } from './initialRoute';
import { ClassProvider, useClassData } from './ClassContext';
import { NotificationProvider } from './NotificationCenter';
import { ThemeProvider } from './ThemeContext';

const AppContent = () => {
  // Simple state-based routing/role management for demo purposes
  const [role, setRole] = useState<'landing' | 'login_admin' | 'admin' | 'teacher' | 'counselor' | 'student'>('landing');
  const [userSession, setUserSession] = useState<'admin' | 'teacher' | 'counselor' | 'student' | null>(null);
  // The path the app was opened on, classified once (see initialRoute.ts).
  // In-app navigation stays state-based; this only decides what an
  // incoming address means, so /login, /dashboard and /admin no longer
  // silently render the landing page and unknown paths get a real 404.
  const [initialPathKind] = useState(() => classifyInitialPath(window.location.pathname));
  const [sessionChecked, setSessionChecked] = useState(false);
  const [autoOpenLogin, setAutoOpenLogin] = useState(false);
  const classData = useClassData();

  useEffect(() => {
    fetch('/api/auth/me').then(async (response) => response.ok ? response.json() : null).then((result) => {
      if (result?.user?.role) {
        setUserSession(result.user.role);
        if (result.user.role === 'student') classData.selectClass('').catch(() => undefined);
      }
      setSessionChecked(true);
    }).catch(() => setSessionChecked(true));
  }, [classData.selectClass]);

  const handleLoginSuccess = (newRole: 'admin' | 'teacher' | 'counselor' | 'student') => {
    setUserSession(newRole);
    setRole(newRole);
    if (newRole === 'student') {
      // A student must always use the class assigned to the authenticated account.
      // Do not reuse a teacher/default class from the URL or the previous session.
      classData.selectClass('').catch(() => undefined);
      return;
    }
    const requestedClassId = new URLSearchParams(window.location.search).get('classId');
    classData.selectClass(requestedClassId || classData.classId || '').catch(() => undefined);
  };

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUserSession(null);
    setRole('landing');
  };

  // Explicit behaviour for the address the app was opened on, decided
  // once the session check has answered. '/' changes nothing. On
  // '/login', '/dashboard' or '/admin' a signed-in visitor goes straight
  // to their dashboard (the same thing the landing page's "Kembali ke
  // Dashboard" button does) and a signed-out visitor gets the login
  // modal opened for them — the address is honoured, not ignored.
  useEffect(() => {
    if (!sessionChecked || role !== 'landing') return;
    if (initialPathKind !== 'login' && initialPathKind !== 'dashboard') return;
    if (userSession) {
      handleLoginSuccess(userSession);
    } else {
      setAutoOpenLogin(true);
    }
    // handleLoginSuccess is re-created every render; this decision only
    // depends on the three values above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionChecked, initialPathKind, userSession, role]);

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
      {role === 'landing' && initialPathKind === 'not-found' && <NotFoundPage />}
      {role === 'landing' && initialPathKind !== 'not-found' && (
        <LandingPage
          onLoginSuccess={handleLoginSuccess}
          userSession={userSession}
          onLogout={handleLogout}
          autoOpenLogin={autoOpenLogin}
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
    <ThemeProvider>
      <NotificationProvider>
        <ClassProvider>
          <AppContent />
        </ClassProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
};

export default App;
