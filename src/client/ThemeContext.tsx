import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock3, Moon, Sun } from 'lucide-react';

export type ThemeMode = 'light' | 'dark' | 'automatic';

type ThemeContextValue = {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDarkMode: boolean;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const getInitialThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';
  const savedMode = localStorage.getItem('theme-mode');
  if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'automatic') return savedMode;

  // Keep the existing preference when upgrading from the previous two-mode toggle.
  return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
};

const isAutomaticDark = (date: Date) => {
  const hour = date.getHours();
  return hour < 6 || hour >= 18;
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const isDarkMode = themeMode === 'dark' || (themeMode === 'automatic' && isAutomaticDark(currentTime));

  useEffect(() => {
    const refreshTime = () => setCurrentTime(new Date());
    refreshTime();
    const timer = window.setInterval(refreshTime, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme-mode', themeMode);
    // Keep the legacy key synchronized for older pages or cached bundles.
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode, themeMode]);

  const value = useMemo(() => ({ themeMode, setThemeMode, isDarkMode }), [themeMode, isDarkMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

const themeOptions: Array<{ mode: ThemeMode; label: string; icon: typeof Sun }> = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
  { mode: 'automatic', label: 'Automatic', icon: Clock3 },
];

export const ThemePicker = () => {
  const { themeMode, setThemeMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const selectedOption = themeOptions.find((option) => option.mode === themeMode) || themeOptions[0];
  const SelectedIcon = selectedOption.icon;

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isOpen]);

  return (
    <div ref={pickerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex items-center gap-1.5 rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 sm:px-3"
        title={`Mode tampilan: ${selectedOption.label}`}
        aria-label={`Mode tampilan: ${selectedOption.label}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <SelectedIcon className="h-5 w-5" />
        <span className="hidden text-xs font-semibold sm:inline">{selectedOption.label}</span>
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800" role="menu" aria-label="Pilihan mode tampilan">
          <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Mode tampilan</p>
          {themeOptions.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => { setThemeMode(mode); setIsOpen(false); }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${themeMode === mode ? 'bg-cyan-50 font-semibold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'}`}
              role="menuitemradio"
              aria-checked={themeMode === mode}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              {themeMode === mode && <Check className="h-4 w-4" />}
            </button>
          ))}
          <p className="px-3 pb-1 pt-2 text-[10px] leading-relaxed text-slate-400">Automatic: light 06.00–18.00, dark di luar waktu tersebut.</p>
        </div>
      )}
    </div>
  );
};
