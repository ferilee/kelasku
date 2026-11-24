// Navigasi datar Mode Pengajar berbasis "Hari Ini" (rancangan ulang
// Mode Pengajar, Keputusan K11). Berkas ini hanya memuat tipe lokasi baru
// dan fungsi murni untuk menerjemahkan seluruh alamat lama Mode Pengajar
// (kanonis wizard step/sub dan alias warisan tab=) ke rumah barunya.
//
// Skema kanonis baru yang ditulis aplikasi: ?view=hari-ini|jadwal|kelas-saya|laporan
// ditemani parameter tampilan/kategori/bagian sesuai tujuan. Mode Perwalian
// tidak memakai berkas ini sama sekali — parsernya aditif untuk Mode
// Pengajar saja.

import { parseWizardLocation, type WizardNavState } from './wizardSteps';

export type TeachingView = 'hari-ini' | 'jadwal' | 'kelas-saya' | 'laporan';
export type TeachingJadwalView = 'saya' | 'kelas';
export type TeachingLaporanCategory = 'jurnal' | 'grades' | 'attendance' | 'behavior';
export type KelasSayaSection = 'ringkasan' | 'informasi' | 'siswa' | 'perkembangan' | 'tindak-lanjut' | 'aktivitas' | 'sikap';

export interface TeachingLocation {
  view: TeachingView;
  jadwalView: TeachingJadwalView;
  laporanCategory: TeachingLaporanCategory;
  kelasSection: KelasSayaSection;
  /** Panel Presensi Mapel terbuka di atas tujuan `view` (bukan tujuan menu). */
  presensiOpen: boolean;
  /** Mendarat di Hari Ini langsung pada jangkar bagian Pengingat. */
  pengingatAnchor: boolean;
  /** Tiba lewat alias Jembatan SIMAK: tombol Buka SIMAK ditonjolkan di kepala konteks Kelas Saya. */
  simakHighlight: boolean;
}

export const DEFAULT_TEACHING_LOCATION: TeachingLocation = {
  view: 'hari-ini',
  jadwalView: 'saya',
  laporanCategory: 'jurnal',
  kelasSection: 'ringkasan',
  presensiOpen: false,
  pengingatAnchor: false,
  simakHighlight: false,
};

const TEACHING_VIEWS: readonly string[] = ['hari-ini', 'jadwal', 'kelas-saya', 'laporan'];
const KELAS_SAYA_SECTIONS: readonly string[] = ['ringkasan', 'informasi', 'siswa', 'perkembangan', 'tindak-lanjut', 'aktivitas', 'sikap'];

const LAPORAN_PARAM_BY_CATEGORY: Record<TeachingLaporanCategory, string> = {
  jurnal: 'jurnal',
  grades: 'nilai',
  attendance: 'presensi',
  behavior: 'sikap',
};

export function laporanCategoryParam(category: TeachingLaporanCategory): string {
  return LAPORAN_PARAM_BY_CATEGORY[category];
}

function laporanCategoryFromParam(value: string | null): TeachingLaporanCategory | null {
  switch (value) {
    case 'jurnal': return 'jurnal';
    case 'nilai': return 'grades';
    case 'presensi': return 'attendance';
    case 'sikap': return 'behavior';
    default: return null;
  }
}

/** Membaca skema kanonis baru ?view=... (mengembalikan null bila bukan nilai Mode Pengajar). */
export function parseTeachingViewLocation(search: string): TeachingLocation | null {
  const params = new URLSearchParams(search);
  const view = params.get('view');
  if (!view || !TEACHING_VIEWS.includes(view)) return null;
  const location: TeachingLocation = { ...DEFAULT_TEACHING_LOCATION, view: view as TeachingView };
  const tampilan = params.get('tampilan');
  if (tampilan === 'saya' || tampilan === 'kelas') location.jadwalView = tampilan;
  const kategori = laporanCategoryFromParam(params.get('kategori'));
  if (kategori) location.laporanCategory = kategori;
  const bagian = params.get('bagian');
  if (bagian && KELAS_SAYA_SECTIONS.includes(bagian)) location.kelasSection = bagian as KelasSayaSection;
  return location;
}

/** Memetakan lokasi kanonis wizard Mode Pengajar (step/sub) ke rumah baru — tabel alias 3.5. */
export function teachingLocationFromWizardStep(stepId: string | null | undefined, subId: string | null | undefined): TeachingLocation | null {
  if (!stepId) return null;
  const base = { ...DEFAULT_TEACHING_LOCATION };
  if (stepId === 'konteks') {
    switch (subId) {
      case 'jadwal': return { ...base, view: 'jadwal', jadwalView: 'saya' };
      case 'jadwal-kelas': return { ...base, view: 'jadwal', jadwalView: 'kelas' };
      case 'ringkasan': return { ...base, view: 'kelas-saya', kelasSection: 'ringkasan' };
      case 'pengingat': return { ...base, view: 'hari-ini', pengingatAnchor: true };
      default: return { ...base, view: 'hari-ini' };
    }
  }
  if (stepId === 'kelas') {
    switch (subId) {
      case 'simak': return { ...base, view: 'kelas-saya', kelasSection: 'ringkasan', simakHighlight: true };
      case 'siswa': return { ...base, view: 'kelas-saya', kelasSection: 'siswa' };
      case 'perkembangan': return { ...base, view: 'kelas-saya', kelasSection: 'perkembangan' };
      case 'tindak-lanjut': return { ...base, view: 'kelas-saya', kelasSection: 'tindak-lanjut' };
      case 'aktivitas': return { ...base, view: 'kelas-saya', kelasSection: 'aktivitas' };
      case 'sikap': return { ...base, view: 'kelas-saya', kelasSection: 'sikap' };
      case 'presensi-mapel': return { ...base, view: 'hari-ini', presensiOpen: true };
      // Alias posisi lama sebelum perampingan: jadwal-kelas sempat milik langkah kelas.
      case 'jadwal-kelas': return { ...base, view: 'jadwal', jadwalView: 'kelas' };
      default: return { ...base, view: 'kelas-saya', kelasSection: 'ringkasan' };
    }
  }
  if (stepId === 'dokumentasi') {
    switch (subId) {
      case 'laporan-simak': return { ...base, view: 'laporan', laporanCategory: 'grades' };
      case 'laporan-sikap': return { ...base, view: 'laporan', laporanCategory: 'behavior' };
      case 'laporan-presensi': return { ...base, view: 'laporan', laporanCategory: 'attendance' };
      default: return { ...base, view: 'laporan', laporanCategory: 'jurnal' };
    }
  }
  return null;
}

/** Memetakan keadaan navigasi lama (tab + substate) ke rumah baru — alias warisan pra-wizard. */
export function teachingLocationFromNavState(nav: WizardNavState): TeachingLocation | null {
  const base = { ...DEFAULT_TEACHING_LOCATION };
  switch (nav.tab) {
    case 'workspace':
      if (nav.workspaceView === 'schedule') return { ...base, view: 'jadwal', jadwalView: 'saya' };
      if (nav.workspaceView === 'journal') return { ...base, view: 'laporan', laporanCategory: 'jurnal' };
      if (nav.workspaceView === 'reminders') return { ...base, view: 'hari-ini', pengingatAnchor: true };
      return { ...base, view: 'hari-ini' };
    case 'dashboard':
      return { ...base, view: 'kelas-saya', kelasSection: 'ringkasan' };
    case 'students':
      if (nav.studentView === 'progress') return { ...base, view: 'kelas-saya', kelasSection: 'perkembangan' };
      if (nav.studentView === 'followup') return { ...base, view: 'kelas-saya', kelasSection: 'tindak-lanjut' };
      return { ...base, view: 'kelas-saya', kelasSection: 'siswa' };
    case 'monitoring':
      return { ...base, view: 'kelas-saya', kelasSection: 'aktivitas' };
    case 'behavior':
      return { ...base, view: 'kelas-saya', kelasSection: 'sikap' };
    case 'teaching-attendance':
      return { ...base, view: 'hari-ini', presensiOpen: true };
    case 'academic':
      if (nav.academicSubTab === 'schedule') return { ...base, view: 'jadwal', jadwalView: 'kelas' };
      return { ...base, view: 'kelas-saya', kelasSection: 'ringkasan', simakHighlight: true };
    case 'teaching-reports':
      if (nav.teachingReportCategory === 'behavior') return { ...base, view: 'laporan', laporanCategory: 'behavior' };
      if (nav.teachingReportCategory === 'attendance') return { ...base, view: 'laporan', laporanCategory: 'attendance' };
      return { ...base, view: 'laporan', laporanCategory: 'grades' };
    default:
      return null;
  }
}

function navStateFromLegacyParams(params: URLSearchParams): WizardNavState {
  const view = params.get('view');
  const studentView = params.get('studentView');
  const academicSubTab = params.get('academicSubTab');
  return {
    tab: params.get('tab') || 'workspace',
    workspaceView: (['overview', 'schedule', 'journal', 'reminders'].includes(view || '') ? view : 'overview') as WizardNavState['workspaceView'],
    studentView: (['roster', 'progress', 'followup'].includes(studentView || '') ? studentView : 'roster') as WizardNavState['studentView'],
    settingsView: 'overview',
    academicSubTab: academicSubTab === 'schedule' ? 'schedule' : 'grades',
    behaviorSubTab: 'sikap',
    monitoringSubTab: 'activity',
    reportCategory: 'attendance',
    teachingReportCategory: 'grades',
  };
}

/**
 * Menyelesaikan lokasi Mode Pengajar dari query string saat aplikasi dibuka.
 * Urutan: skema kanonis ?view= → kanonis wizard step/sub Mode Pengajar →
 * alias warisan ?tab=. Mengembalikan null bila alamat itu bukan alamat
 * Mode Pengajar (mis. alamat Mode Perwalian atau utilitas) agar pemanggil
 * membiarkan alur lama bekerja apa adanya.
 */
export function resolveTeachingLocationFromSearch(search: string): TeachingLocation | null {
  const canonical = parseTeachingViewLocation(search);
  if (canonical) return canonical;
  const wizard = parseWizardLocation(search);
  if (wizard?.stepId) {
    const fromWizard = teachingLocationFromWizardStep(wizard.stepId, wizard.subId);
    if (fromWizard) return fromWizard;
    // Langkah milik Mode Perwalian atau utilitas: bukan urusan parser ini.
    return null;
  }
  const params = new URLSearchParams(search);
  if (!params.get('tab')) return null;
  return teachingLocationFromNavState(navStateFromLegacyParams(params));
}
