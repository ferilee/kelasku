import { createContext, useState, ReactNode, useContext, useEffect, useCallback, useRef } from 'react';

export interface Announcement {
  id: string;
  text: string;
  type: 'PENTING' | 'INFO' | 'SELAMAT';
}

export interface TeachingAnnouncement extends Announcement {
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  createdAt: string;
}

export interface AgendaItem {
  id: string;
  date: string;
  title: string;
  type: string;
}

export interface Student {
  id: string;
  nisn: string;
  name: string;
  gender: 'L' | 'P';
  status: 'Aktif' | 'Nonaktif';
  classId?: string;
  className?: string;
  academicYear?: string;
}

export interface ScheduleItem {
  id: string;
  teacherId: string | null;
  day: string;
  subject: string;
  timeStart: string;
  timeEnd: string;
  teacherName: string;
  color: string;
}

export interface BehaviorRecord {
  id: string;
  studentId: string;
  type: 'positif' | 'negatif';
  points: number;
  category: string;
  description: string;
  date: string;
  subject?: string;
}

export interface Achievement {
  id: string;
  studentId: string;
  title: string;
  level: string;
  rank: string;
  date: string;
  description: string;
}

export interface ClassOfficer {
  id: string;
  userId: string;
  role: string;
  name: string;
}

export interface AcademicLeaderboardEntry {
  studentId: string;
  name: string;
  average: number;
}

export interface GradeTrendEntry {
  month: string;
  average: number | null;
}

export interface GalleryItem { id: string; title: string; imageUrl: string; description: string; }
export interface ClassRoom { id: string; name: string; academicYear: string; status: 'Aktif' | 'Nonaktif'; }
export interface OfficerDuty { key: 'ketua' | 'wakil' | 'sekretaris' | 'bendahara'; label: string; description: string; }

export interface ClassData {
  announcements: Announcement[];
  teachingAnnouncements: TeachingAnnouncement[];
  agenda: AgendaItem[];
  schedules: ScheduleItem[];
  students: Student[];
  behaviorRecords: BehaviorRecord[];
  achievements: Achievement[];
  officers: ClassOfficer[];
  officerDuties: OfficerDuty[];
  academicLeaderboard: AcademicLeaderboardEntry[];
  gradeTrend: GradeTrendEntry[];
  galleryItems: GalleryItem[];
  heroImage: string;
  homeroomTeacherPhoto: string;
  quote: { text: string; author: string };
  stats: { attendance: string; averageGrade: string; totalStudents: string; };
  classId: string | null;
  classes: ClassRoom[];
  isLoading: boolean;
  loadError: boolean;
  selectedClass: string | null;
  selectedYear: string | null;
  selectClass: (classId: string) => Promise<void>;
  setSelectedClass: (cls: string | null) => void;
  setSelectedYear: (yr: string | null) => void;
  updateQuote: (text: string, author: string) => void;
  updateHeroImage: (imageUrl: string) => Promise<void>;
  resetHeroImage: () => Promise<void>;
  updateHomeroomTeacherPhoto: (imageUrl: string) => Promise<void>;
  resetHomeroomTeacherPhoto: () => Promise<void>;
  updateClassProfile: (className: string, academicYear: string) => Promise<void>;
  saveClassOfficer: (userId: string, role: string) => Promise<void>;
  removeClassOfficer: (id: string) => Promise<void>;
  updateOfficerDuties: (duties: OfficerDuty[]) => Promise<void>;
  addGalleryItem: (item: Omit<GalleryItem, 'id'>) => Promise<void>;
  removeGalleryItem: (id: string) => Promise<void>;
  addAnnouncement: (ann: Announcement) => void;
  removeAnnouncement: (id: string) => void;
  addAgenda: (item: AgendaItem) => void;
  removeAgenda: (id: string) => void;
  addSchedule: (item: Omit<ScheduleItem, 'id'> & { id?: string }) => Promise<void>;
  removeSchedule: (id: string) => Promise<void>;
  addStudent: (student: Student) => void;
  removeStudent: (id: string) => void;
  permanentlyDeleteStudent: (id: string) => Promise<void>;
  updateStudent: (student: Student) => void;
  addBehaviorRecord: (record: Omit<BehaviorRecord, 'id'>) => Promise<void>;
  removeBehaviorRecord: (id: string) => Promise<void>;
  addAchievement: (achievement: Omit<Achievement, 'id'>) => Promise<void>;
  removeAchievement: (id: string) => Promise<void>;
}

// Generic role descriptions for class officers. These are not class data:
// they only describe what each role does, so they are safe as a fallback
// when the API does not provide customised duties yet.
const defaultOfficerDuties: OfficerDuty[] = [
  { key: 'ketua' as const, label: 'Ketua Kelas', description: 'Memimpin koordinasi kegiatan kelas.\nMenyampaikan informasi dari wali kelas kepada teman-teman.\nMenjaga ketertiban dan menjadi teladan bagi kelas.' },
  { key: 'wakil' as const, label: 'Wakil Ketua Kelas', description: 'Mendampingi ketua kelas dalam menjalankan tugas.\nMenggantikan ketua kelas saat berhalangan.\nMembantu menjaga koordinasi dan ketertiban kelas.' },
  { key: 'sekretaris' as const, label: 'Sekretaris', description: 'Mencatat hasil rapat dan administrasi kelas.\nMembantu pencatatan kehadiran serta informasi kelas.\nMenyimpan dokumen penting kelas dengan rapi.' },
  { key: 'bendahara' as const, label: 'Bendahara', description: 'Mencatat pemasukan dan pengeluaran kas kelas.\nMenyampaikan laporan kas secara terbuka dan berkala.\nMenjaga bukti transaksi serta saldo kas kelas.' },
];

// Initial state before the first /api/class-data response arrives.
// This MUST stay empty: visitors must never see placeholder/sample class
// data (names, student counts, officers, schedules) that is not real.
// Components render skeletons while `isLoading` is true and an honest
// error message when `loadError` is true instead.
const emptyData = {
  announcements: [] as Announcement[],
  teachingAnnouncements: [] as TeachingAnnouncement[],
  agenda: [] as AgendaItem[],
  students: [] as Student[],
  quote: {
    text: "",
    author: ""
  },
  stats: {
    attendance: "—",
    averageGrade: "—",
    totalStudents: "—"
  },
  schedules: [] as ScheduleItem[],
  behaviorRecords: [] as BehaviorRecord[],
  achievements: [] as Achievement[],
  officers: [] as ClassOfficer[],
  officerDuties: defaultOfficerDuties,
  academicLeaderboard: [] as AcademicLeaderboardEntry[],
  gradeTrend: [] as GradeTrendEntry[],
  galleryItems: [] as GalleryItem[],
  heroImage: '',
  homeroomTeacherPhoto: ''
};

export const ClassContext = createContext<ClassData | undefined>(undefined);

export const ClassProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState(emptyData);
  const [classId, setClassId] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const classIdRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  const handleSetSelectedClass = (cls: string | null) => {
    setSelectedClass(cls);
  };

  const handleSetSelectedYear = (yr: string | null) => {
    setSelectedYear(yr);
  };

  const fetchClassData = useCallback(async (requestedClassId?: string | null) => {
    const requestId = ++requestIdRef.current;
    const classIdForRequest = requestedClassId === undefined ? classIdRef.current : requestedClassId || null;
    const query = classIdForRequest ? `?classId=${encodeURIComponent(classIdForRequest)}` : '';
    setIsLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/class-data${query}`);
      if (!res.ok) {
        if (requestId === requestIdRef.current) setLoadError(true);
        return;
      }
      const json = await res.json();
      if (requestId !== requestIdRef.current) return;
      setData({
        announcements: json.announcements || [],
        teachingAnnouncements: json.teachingAnnouncements || [],
        agenda: json.agenda || [],
        schedules: json.schedules || [],
        students: json.students || [],
        behaviorRecords: json.behaviorRecords || [],
        achievements: json.achievements || [],
        officers: json.officers || [],
        officerDuties: json.officerDuties || defaultOfficerDuties,
        academicLeaderboard: json.academicLeaderboard || [],
        gradeTrend: json.gradeTrend || [],
        galleryItems: json.galleryItems || [],
        heroImage: json.heroImage || '/hero-default.svg',
        homeroomTeacherPhoto: json.homeroomTeacherPhoto || '/wali-kelas-placeholder.svg',
        quote: json.quote || { text: '', author: '' },
        stats: json.stats || { attendance: '—', averageGrade: '—', totalStudents: '—' },
      });
      setClasses(json.classes || []);
      classIdRef.current = json.classId || null;
      setClassId(json.classId || null);
      setSelectedClass(json.className || null);
      setSelectedYear(json.academicYear || null);
    } catch (err) {
      console.error('Error fetching class data:', err);
      if (requestId === requestIdRef.current) setLoadError(true);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const requestedClassId = new URLSearchParams(window.location.search).get('classId');
    fetchClassData(requestedClassId);
  }, [fetchClassData]);

  const selectClass = useCallback(async (nextClassId: string) => {
    await fetchClassData(nextClassId);
  }, [fetchClassData]);

  const updateQuote = async (text: string, author: string) => {
    // Optimistic UI update
    setData(prev => ({ ...prev, quote: { text, author } }));
    try {
      await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, author })
      });
      fetchClassData();
    } catch (err) {
      console.error('Error updating quote:', err);
    }
  };

  const updateHeroImage = async (imageUrl: string) => {
    const response = await fetch('/api/page-settings/hero-image', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl }),
    });
    if (!response.ok) {
      throw new Error((await response.json()).error || 'Gagal menyimpan gambar hero');
    }
    await fetchClassData();
  };

  const resetHeroImage = async () => {
    const response = await fetch('/api/page-settings/hero-image', { method: 'DELETE' });
    if (!response.ok) throw new Error('Gagal mengembalikan gambar default');
    await fetchClassData();
  };

  const updateHomeroomTeacherPhoto = async (imageUrl: string) => {
    const response = await fetch('/api/page-settings/homeroom-teacher-photo', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl }) });
    if (!response.ok) throw new Error((await response.json()).error || 'Gagal menyimpan foto wali kelas');
    await fetchClassData();
  };

  const resetHomeroomTeacherPhoto = async () => {
    const response = await fetch('/api/page-settings/homeroom-teacher-photo', { method: 'DELETE' });
    if (!response.ok) throw new Error('Gagal mengembalikan foto placeholder');
    await fetchClassData();
  };

  const updateClassProfile = async (className: string, academicYear: string) => {
    const response = await fetch('/api/page-settings/class-profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classId, className, academicYear })
    });
    if (!response.ok) throw new Error((await response.json()).error || 'Gagal menyimpan pengaturan kelas');
    await fetchClassData();
  };

  const saveClassOfficer = async (userId: string, role: string) => {
    const response = await fetch('/api/class-officers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, role })
    });
    if (!response.ok) throw new Error((await response.json()).error || 'Gagal menyimpan pengurus kelas');
    await fetchClassData();
  };

  const removeClassOfficer = async (id: string) => {
    const response = await fetch(`/api/class-officers/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Gagal menghapus pengurus kelas');
    await fetchClassData();
  };

  const updateOfficerDuties = async (duties: OfficerDuty[]) => {
    const response = await fetch('/api/page-settings/officer-duties', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ duties })
    });
    if (!response.ok) throw new Error((await response.json()).error || 'Gagal menyimpan tugas pengurus kelas');
    await fetchClassData();
  };

  const addGalleryItem = async (item: Omit<GalleryItem, 'id'>) => {
    const response = await fetch('/api/gallery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
    if (!response.ok) throw new Error((await response.json()).error || 'Gagal menambah foto galeri');
    await fetchClassData();
  };

  const removeGalleryItem = async (id: string) => {
    const response = await fetch(`/api/gallery/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Gagal menghapus foto galeri');
    await fetchClassData();
  };

  const addAnnouncement = async (ann: Announcement) => {
    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: ann.type, text: ann.text })
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Gagal menampilkan informasi');
      await fetchClassData();
    } catch (err) {
      console.error('Error adding announcement:', err);
      throw err;
    }
  };

  const removeAnnouncement = async (id: string) => {
    try {
      await fetch(`/api/announcements/${id}`, {
        method: 'DELETE'
      });
      fetchClassData();
    } catch (err) {
      console.error('Error removing announcement:', err);
    }
  };

  const addAgenda = async (item: AgendaItem) => {
    try {
      const response = await fetch('/api/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: item.date, title: item.title, type: item.type })
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Gagal menyimpan agenda');
      await fetchClassData();
    } catch (err) {
      console.error('Error adding agenda:', err);
      throw err;
    }
  };

  const removeAgenda = async (id: string) => {
    try {
      await fetch(`/api/agenda/${id}`, {
        method: 'DELETE'
      });
      fetchClassData();
    } catch (err) {
      console.error('Error removing agenda:', err);
    }
  };
  const addSchedule = async (item: Omit<ScheduleItem, 'id'> & { id?: string }) => {
    try {
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, classId })
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Gagal menyimpan jadwal');
      await fetchClassData();
    } catch (err) {
      console.error('Error adding schedule:', err);
      throw err;
    }
  };

  const removeSchedule = async (id: string) => {
    try {
      if (!classId) return;
      await fetch(`/api/schedules/${id}?classId=${encodeURIComponent(classId)}`, {
        method: 'DELETE'
      });
      fetchClassData();
    } catch (err) {
      console.error('Error removing schedule:', err);
    }
  };

  const addStudent = async (student: Student) => {
    try {
      const response = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: student.name, nisn: student.nisn, gender: student.gender, status: student.status, classId: student.classId || classId })
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Gagal menambahkan siswa');
      await fetchClassData();
    } catch (err) {
      console.error('Error adding student:', err);
      throw err;
    }
  };

  const removeStudent = async (id: string) => {
    try {
      const response = await fetch(`/api/students/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error((await response.json()).error || 'Gagal menonaktifkan siswa');
      }
      fetchClassData();
    } catch (err) {
      console.error('Error removing student:', err);
      throw err;
    }
  };

  const permanentlyDeleteStudent = async (id: string) => {
    const response = await fetch(`/api/students/${id}/permanent`, { method: 'DELETE' });
    if (!response.ok) throw new Error((await response.json()).error || 'Gagal menghapus siswa');
    await fetchClassData();
  };

  const updateStudent = async (student: Student) => {
    try {
      const response = await fetch(`/api/students/${student.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: student.name, nisn: student.nisn, gender: student.gender, status: student.status, classId: student.classId || classId })
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Gagal memperbarui siswa');
      await fetchClassData();
    } catch (err) {
      console.error('Error updating student:', err);
      throw err;
    }
  };

  const addBehaviorRecord = async (record: Omit<BehaviorRecord, 'id'>) => {
    try {
      const response = await fetch('/api/behavior', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Gagal menyimpan catatan sikap');
      await fetchClassData(classId);
    } catch (err) {
      console.error('Error adding behavior record:', err);
      throw err;
    }
  };

  const removeBehaviorRecord = async (id: string) => {
    try {
      await fetch(`/api/behavior/${id}`, {
        method: 'DELETE'
      });
      await fetchClassData(classId);
    } catch (err) {
      console.error('Error removing behavior record:', err);
    }
  };

  const addAchievement = async (achievement: Omit<Achievement, 'id'>) => {
    try {
      const response = await fetch('/api/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(achievement)
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Gagal menyimpan prestasi');
      await fetchClassData();
    } catch (err) {
      console.error('Error adding achievement:', err);
      throw err;
    }
  };

  const removeAchievement = async (id: string) => {
    try {
      await fetch(`/api/achievements/${id}`, {
        method: 'DELETE'
      });
      fetchClassData();
    } catch (err) {
      console.error('Error removing achievement:', err);
    }
  };

  return (
    <ClassContext.Provider value={{
      ...data,
      classId,
      classes,
      isLoading,
      loadError,
      selectedClass,
      selectedYear,
      selectClass,
      setSelectedClass: handleSetSelectedClass,
      setSelectedYear: handleSetSelectedYear,
      updateQuote,
      updateHeroImage,
      resetHeroImage,
      updateHomeroomTeacherPhoto,
      resetHomeroomTeacherPhoto,
      updateClassProfile,
      saveClassOfficer,
    removeClassOfficer, updateOfficerDuties,
      addGalleryItem,
      removeGalleryItem,
      addAnnouncement,
      removeAnnouncement,
      addAgenda,
      removeAgenda,
      addSchedule,
      removeSchedule,
      addStudent,
      removeStudent,
      permanentlyDeleteStudent,
      updateStudent,
      addBehaviorRecord,
      removeBehaviorRecord,
      addAchievement,
      removeAchievement
    }}>
      {children}
    </ClassContext.Provider>
  );
};

export const useClassData = () => {
  const context = useContext(ClassContext);
  if (!context) throw new Error("useClassData must be used within a ClassProvider");
  return context;
};
