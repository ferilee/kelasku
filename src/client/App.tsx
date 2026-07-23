import { useState } from 'react';
import Dashboard from './Dashboard';
import StudentDashboard from './StudentDashboard';
import LandingPage from './LandingPage';
import LoginPage from './LoginPage';
import { ClassProvider, useClassData } from './ClassContext';

const AppContent = () => {
  // Simple state-based routing/role management for demo purposes
  const [role, setRole] = useState<'landing' | 'login_admin' | 'admin' | 'student'>('landing');
  const [userSession, setUserSession] = useState<'admin' | 'student' | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userSession') as 'admin' | 'student' | null;
    }
    return null;
  });

  const { selectedClass, selectedYear, setSelectedClass, setSelectedYear } = useClassData();

  const handleLoginSuccess = (newRole: 'admin' | 'student') => {
    setUserSession(newRole);
    localStorage.setItem('userSession', newRole);
    setRole(newRole);
  };

  const handleLogout = () => {
    setUserSession(null);
    localStorage.removeItem('userSession');
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
          onLoginSuccess={() => handleLoginSuccess('admin')} 
          onBack={() => setRole('landing')} 
        />
      )}
      {role === 'admin' && <Dashboard />}
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
