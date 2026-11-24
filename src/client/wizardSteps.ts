// Definisi shell Wizard Hibrida WebKelas (Tahap 1).
//
// Berkas ini hanya memuat metadata langkah/subpanel dan fungsi murni untuk:
// - memetakan keadaan navigasi lama (tab + substate) ke posisi wizard,
// - membaca parameter URL kanonik `step`/`sub`/`utility` menjadi keadaan
//   navigasi awal.
//
// State lama (activeTab dan kawan-kawan) tetap menjadi adapter internal di
// Dashboard.tsx; tidak ada logika panel yang tinggal di sini. Indikator
// langkah pada Tahap 1 bersifat navigasi (aktif/terkunjungi) — status
// kelengkapan dari data adalah pekerjaan Tahap 2 dan sengaja tidak
// didefinisikan di berkas ini.

export type WizardMode = 'homeroom' | 'teaching';

export interface WizardNavState {
  tab: string;
  workspaceView: 'overview' | 'schedule' | 'journal' | 'reminders';
  studentView: 'roster' | 'progress' | 'followup';
  settingsView: 'overview' | 'teaching' | 'landing' | 'gallery' | 'officers' | 'profile';
  academicSubTab: 'grades' | 'schedule';
  behaviorSubTab: 'sikap' | 'prestasi';
  monitoringSubTab: 'cases' | 'activity';
  reportCategory: 'attendance' | 'grades' | 'behavior';
  teachingReportCategory: 'grades' | 'behavior' | 'attendance';
}

export type WizardNavPatch = Partial<WizardNavState>;

// Gerbang visibilitas subpanel, dievaluasi di Dashboard terhadap peran/mode:
// - always: selalu tampil pada shell mode pemiliknya
// - admin: hanya peran admin
// - staff: peran yang boleh melihat profil belajar (admin/guru/BK)
// - staffNotTeacher: staff selain guru pengajar (Kasus Pembinaan)
// - manageStudents: pengelola siswa (admin) — gerbang Panel Pantauan RUAS
// - teachingOnly: hanya saat Mode Pengajar aktif
export type WizardSubGate = 'always' | 'admin' | 'staff' | 'staffNotTeacher' | 'manageStudents' | 'teachingOnly';

export interface WizardSub {
  id: string;
  label: string;
  target: WizardNavPatch;
  anchor?: string;
  gate: WizardSubGate;
}

export interface WizardStep {
  id: string;
  label: string;
  description: string;
  subs: WizardSub[];
}

export const KNOWN_TABS = [
  'workspace',
  'dashboard',
  'students',
  'attendance',
  'reports',
  'monitoring',
  'academic',
  'teaching-attendance',
  'teaching-reports',
  'behavior',
  'settings',
] as const;

export const HOMEROOM_STEPS: WizardStep[] = [
  {
    id: 'ringkasan',
    label: 'Ringkasan Kelas',
    description: 'Kondisi kelas dan pekerjaan berikutnya',
    subs: [
      { id: 'beranda', label: 'Beranda', target: { tab: 'workspace', workspaceView: 'overview' }, gate: 'always' },
      { id: 'ringkasan', label: 'Ringkasan Kelas', target: { tab: 'dashboard' }, gate: 'always' },
      { id: 'pengingat', label: 'Pengingat', target: { tab: 'workspace', workspaceView: 'reminders' }, gate: 'always' },
    ],
  },
  {
    id: 'siswa',
    label: 'Siswa & Akun',
    description: 'Data siswa dan keterhubungan akun RUAS',
    subs: [
      { id: 'daftar', label: 'Daftar Siswa', target: { tab: 'students', studentView: 'roster' }, gate: 'always' },
      { id: 'pantauan-ruas', label: 'Pantauan RUAS', target: { tab: 'students', studentView: 'roster' }, anchor: 'pantauan-login-ruas', gate: 'manageStudents' },
    ],
  },
  {
    id: 'perkembangan',
    label: 'Presensi & Perkembangan',
    description: 'Presensi harian, pembinaan, dan perkembangan belajar',
    subs: [
      { id: 'presensi', label: 'Presensi', target: { tab: 'attendance' }, gate: 'admin' },
      { id: 'perkembangan', label: 'Perkembangan Belajar', target: { tab: 'students', studentView: 'progress' }, gate: 'staff' },
      { id: 'tindak-lanjut', label: 'Tindak Lanjut', target: { tab: 'students', studentView: 'followup' }, gate: 'staff' },
      { id: 'kasus', label: 'Kasus Pembinaan', target: { tab: 'monitoring', monitoringSubTab: 'cases' }, gate: 'staffNotTeacher' },
      { id: 'aktivitas', label: 'Aktivitas Belajar', target: { tab: 'monitoring', monitoringSubTab: 'activity' }, gate: 'staff' },
      { id: 'sikap', label: 'Sikap', target: { tab: 'behavior', behaviorSubTab: 'sikap' }, gate: 'admin' },
      { id: 'prestasi', label: 'Prestasi', target: { tab: 'behavior', behaviorSubTab: 'prestasi' }, gate: 'admin' },
    ],
  },
  {
    id: 'nilai',
    label: 'Nilai & Laporan',
    description: 'Rekap nilai rapor dan laporan kelas',
    subs: [
      { id: 'rekap-rapor', label: 'Rekap Nilai Rapor', target: { tab: 'academic', academicSubTab: 'grades' }, gate: 'always' },
      { id: 'laporan-presensi', label: 'Laporan Presensi', target: { tab: 'reports', reportCategory: 'attendance' }, gate: 'admin' },
      { id: 'laporan-nilai', label: 'Laporan Nilai', target: { tab: 'reports', reportCategory: 'grades' }, gate: 'admin' },
      { id: 'laporan-sikap', label: 'Laporan Sikap', target: { tab: 'reports', reportCategory: 'behavior' }, gate: 'admin' },
    ],
  },
  {
    id: 'publik',
    label: 'Halaman Publik & Pengaturan Kelas',
    description: 'Profil, jadwal, pengumuman, dan konten halaman publik',
    subs: [
      { id: 'pengaturan', label: 'Aksi Cepat', target: { tab: 'settings', settingsView: 'overview' }, gate: 'admin' },
      { id: 'profil', label: 'Profil Kelas', target: { tab: 'settings', settingsView: 'profile' }, gate: 'admin' },
      { id: 'jadwal', label: 'Jadwal & Kalender Kelas', target: { tab: 'academic', academicSubTab: 'schedule' }, gate: 'admin' },
      { id: 'pengumuman', label: 'Pengumuman', target: { tab: 'settings', settingsView: 'landing' }, anchor: 'settings-announcements', gate: 'admin' },
      { id: 'konten', label: 'Konten Utama', target: { tab: 'settings', settingsView: 'landing' }, anchor: 'settings-hero', gate: 'admin' },
      { id: 'agenda', label: 'Agenda', target: { tab: 'settings', settingsView: 'landing' }, anchor: 'settings-agenda', gate: 'admin' },
      { id: 'pengurus', label: 'Pengurus Kelas', target: { tab: 'settings', settingsView: 'officers' }, gate: 'admin' },
      { id: 'galeri', label: 'Galeri', target: { tab: 'settings', settingsView: 'gallery' }, gate: 'admin' },
    ],
  },
];

export const TEACHING_STEPS: WizardStep[] = [
  {
    id: 'konteks',
    label: 'Konteks & Jadwal',
    description: 'Kelas, mata pelajaran, dan jadwal mengajar',
    subs: [
      { id: 'beranda', label: 'Beranda', target: { tab: 'workspace', workspaceView: 'overview' }, gate: 'always' },
      { id: 'jadwal', label: 'Jadwal Mengajar', target: { tab: 'workspace', workspaceView: 'schedule' }, gate: 'always' },
      { id: 'ringkasan', label: 'Ringkasan Kelas', target: { tab: 'dashboard' }, gate: 'always' },
    ],
  },
  {
    id: 'kelas',
    label: 'Kelas Berlangsung',
    description: 'Jembatan SIMAK, presensi, dan pendampingan kelas',
    subs: [
      { id: 'simak', label: 'Jembatan SIMAK', target: { tab: 'academic', academicSubTab: 'grades' }, gate: 'always' },
      { id: 'info-siswa', label: 'Informasi untuk Siswa', target: { tab: 'dashboard' }, anchor: 'panel-informasi-siswa', gate: 'always' },
      { id: 'siswa', label: 'Daftar Siswa', target: { tab: 'students', studentView: 'roster' }, gate: 'always' },
      { id: 'presensi-mapel', label: 'Presensi Mapel', target: { tab: 'teaching-attendance' }, gate: 'always' },
      { id: 'sikap', label: 'Penilaian Sikap', target: { tab: 'behavior', behaviorSubTab: 'sikap' }, gate: 'always' },
      { id: 'perkembangan', label: 'Perkembangan Belajar', target: { tab: 'students', studentView: 'progress' }, gate: 'staff' },
      { id: 'tindak-lanjut', label: 'Tindak Lanjut', target: { tab: 'students', studentView: 'followup' }, gate: 'staff' },
      { id: 'aktivitas', label: 'Aktivitas Belajar', target: { tab: 'monitoring', monitoringSubTab: 'activity' }, gate: 'staff' },
      { id: 'jadwal-kelas', label: 'Jadwal & Kalender Kelas', target: { tab: 'academic', academicSubTab: 'schedule' }, gate: 'always' },
    ],
  },
  {
    id: 'dokumentasi',
    label: 'Dokumentasi & Laporan',
    description: 'Jurnal mengajar dan laporan pembelajaran',
    subs: [
      { id: 'jurnal', label: 'Jurnal Mengajar', target: { tab: 'workspace', workspaceView: 'journal' }, gate: 'always' },
      { id: 'laporan-simak', label: 'Nilai Proses di SIMAK', target: { tab: 'teaching-reports', teachingReportCategory: 'grades' }, gate: 'always' },
      { id: 'laporan-sikap', label: 'Laporan Sikap', target: { tab: 'teaching-reports', teachingReportCategory: 'behavior' }, gate: 'always' },
      { id: 'laporan-presensi', label: 'Rekap Presensi', target: { tab: 'teaching-reports', teachingReportCategory: 'attendance' }, gate: 'always' },
    ],
  },
];

// Utilitas Pengaturan Sistem berada di luar stepper karena mengelola data
// lintas kelas (Master Kelas, Guru & BK, Penugasan Mengajar).
export const UTILITY_STEP: WizardStep = {
  id: 'sistem',
  label: 'Pengaturan Sistem',
  description: 'Master kelas, akun guru & BK, dan penugasan mengajar',
  subs: [
    { id: 'kelas-guru', label: 'Kelas & Guru', target: { tab: 'settings', settingsView: 'teaching' }, gate: 'admin' },
    { id: 'pengaturan', label: 'Pengaturan Kelas', target: { tab: 'settings', settingsView: 'overview' }, gate: 'teachingOnly' },
  ],
};

export function wizardStepsForMode(mode: WizardMode): WizardStep[] {
  return mode === 'teaching' ? TEACHING_STEPS : HOMEROOM_STEPS;
}

export function findWizardSub(step: WizardStep | undefined, subId: string | null | undefined): WizardSub | undefined {
  if (!step || !subId) return undefined;
  return step.subs.find((sub) => sub.id === subId);
}

export function findWizardStep(mode: WizardMode, stepId: string): WizardStep | undefined {
  if (stepId === UTILITY_STEP.id) return UTILITY_STEP;
  return wizardStepsForMode(mode).find((step) => step.id === stepId);
}

export interface WizardPosition {
  area: 'wizard' | 'utility';
  stepId: string;
  subId: string | null;
}

// Menurunkan posisi wizard dari keadaan navigasi lama. Fungsi ini murni
// presentasi: ia tidak mengubah state dan tidak menilai kelengkapan data.
export function deriveWizardPosition(mode: WizardMode, nav: WizardNavState): WizardPosition {
  if (nav.tab === 'settings' && nav.settingsView === 'teaching') {
    return { area: 'utility', stepId: 'sistem', subId: 'kelas-guru' };
  }
  if (mode === 'teaching') {
    switch (nav.tab) {
      case 'workspace':
        if (nav.workspaceView === 'schedule') return { area: 'wizard', stepId: 'konteks', subId: 'jadwal' };
        if (nav.workspaceView === 'journal') return { area: 'wizard', stepId: 'dokumentasi', subId: 'jurnal' };
        return { area: 'wizard', stepId: 'konteks', subId: 'beranda' };
      case 'dashboard':
        return { area: 'wizard', stepId: 'konteks', subId: 'ringkasan' };
      case 'students':
        if (nav.studentView === 'progress') return { area: 'wizard', stepId: 'kelas', subId: 'perkembangan' };
        if (nav.studentView === 'followup') return { area: 'wizard', stepId: 'kelas', subId: 'tindak-lanjut' };
        return { area: 'wizard', stepId: 'kelas', subId: 'siswa' };
      case 'teaching-attendance':
        return { area: 'wizard', stepId: 'kelas', subId: 'presensi-mapel' };
      case 'behavior':
        return { area: 'wizard', stepId: 'kelas', subId: 'sikap' };
      case 'monitoring':
        return nav.monitoringSubTab === 'activity'
          ? { area: 'wizard', stepId: 'kelas', subId: 'aktivitas' }
          : { area: 'wizard', stepId: 'kelas', subId: null };
      case 'academic':
        return nav.academicSubTab === 'schedule'
          ? { area: 'wizard', stepId: 'kelas', subId: 'jadwal-kelas' }
          : { area: 'wizard', stepId: 'kelas', subId: 'simak' };
      case 'teaching-reports':
        if (nav.teachingReportCategory === 'behavior') return { area: 'wizard', stepId: 'dokumentasi', subId: 'laporan-sikap' };
        if (nav.teachingReportCategory === 'attendance') return { area: 'wizard', stepId: 'dokumentasi', subId: 'laporan-presensi' };
        return { area: 'wizard', stepId: 'dokumentasi', subId: 'laporan-simak' };
      case 'settings':
        return { area: 'utility', stepId: 'sistem', subId: 'pengaturan' };
      default:
        return { area: 'wizard', stepId: 'konteks', subId: null };
    }
  }
  switch (nav.tab) {
    case 'workspace':
      if (nav.workspaceView === 'reminders') return { area: 'wizard', stepId: 'ringkasan', subId: 'pengingat' };
      if (nav.workspaceView === 'schedule') return { area: 'wizard', stepId: 'publik', subId: 'jadwal' };
      // Tampilan jurnal pada Mode Perwalian adalah pantauan dari Beranda;
      // pekerjaan jurnalnya sendiri berada pada shell Pengajar.
      return { area: 'wizard', stepId: 'ringkasan', subId: 'beranda' };
    case 'dashboard':
      return { area: 'wizard', stepId: 'ringkasan', subId: 'ringkasan' };
    case 'students':
      if (nav.studentView === 'progress') return { area: 'wizard', stepId: 'perkembangan', subId: 'perkembangan' };
      if (nav.studentView === 'followup') return { area: 'wizard', stepId: 'perkembangan', subId: 'tindak-lanjut' };
      return { area: 'wizard', stepId: 'siswa', subId: 'daftar' };
    case 'attendance':
      return { area: 'wizard', stepId: 'perkembangan', subId: 'presensi' };
    case 'monitoring':
      return nav.monitoringSubTab === 'activity'
        ? { area: 'wizard', stepId: 'perkembangan', subId: 'aktivitas' }
        : { area: 'wizard', stepId: 'perkembangan', subId: 'kasus' };
    case 'behavior':
      return nav.behaviorSubTab === 'prestasi'
        ? { area: 'wizard', stepId: 'perkembangan', subId: 'prestasi' }
        : { area: 'wizard', stepId: 'perkembangan', subId: 'sikap' };
    case 'academic':
      return nav.academicSubTab === 'schedule'
        ? { area: 'wizard', stepId: 'publik', subId: 'jadwal' }
        : { area: 'wizard', stepId: 'nilai', subId: 'rekap-rapor' };
    case 'reports':
      if (nav.reportCategory === 'grades') return { area: 'wizard', stepId: 'nilai', subId: 'laporan-nilai' };
      if (nav.reportCategory === 'behavior') return { area: 'wizard', stepId: 'nilai', subId: 'laporan-sikap' };
      return { area: 'wizard', stepId: 'nilai', subId: 'laporan-presensi' };
    case 'settings':
      if (nav.settingsView === 'profile') return { area: 'wizard', stepId: 'publik', subId: 'profil' };
      if (nav.settingsView === 'gallery') return { area: 'wizard', stepId: 'publik', subId: 'galeri' };
      if (nav.settingsView === 'officers') return { area: 'wizard', stepId: 'publik', subId: 'pengurus' };
      if (nav.settingsView === 'landing') return { area: 'wizard', stepId: 'publik', subId: 'konten' };
      return { area: 'wizard', stepId: 'publik', subId: 'pengaturan' };
    default:
      return { area: 'wizard', stepId: 'ringkasan', subId: null };
  }
}

// Membaca parameter kanonik `step`/`sub`/`utility` dari query string.
// Mengembalikan null bila tidak ada parameter kanonik yang sah, agar
// pemanggil jatuh kembali ke alias lama (tab/view/studentView).
export function parseWizardLocation(search: string): { mode?: WizardMode; nav: WizardNavPatch; stepId?: string; subId?: string } | null {
  const params = new URLSearchParams(search);
  const utility = params.get('utility');
  const stepId = params.get('step');
  const subId = params.get('sub');
  if (utility === UTILITY_STEP.id) {
    const sub = findWizardSub(UTILITY_STEP, subId) ?? UTILITY_STEP.subs[0];
    return { nav: { ...sub.target }, stepId: UTILITY_STEP.id, subId: sub.id };
  }
  if (!stepId) return null;
  const modes: WizardMode[] = ['homeroom', 'teaching'];
  for (const mode of modes) {
    const step = wizardStepsForMode(mode).find((item) => item.id === stepId);
    if (step) {
      const sub = findWizardSub(step, subId) ?? step.subs[0];
      return { mode, nav: { ...sub.target }, stepId: step.id, subId: sub.id };
    }
  }
  return null;
}

export function readWizardUrlNav(): { mode?: WizardMode; nav: WizardNavPatch; stepId?: string; subId?: string } | null {
  if (typeof window === 'undefined') return null;
  return parseWizardLocation(window.location.search);
}
