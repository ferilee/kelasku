import { createContext, useState, ReactNode, useContext, useEffect, useCallback } from 'react';

export interface Announcement {
  id: string;
  text: string;
  type: 'PENTING' | 'INFO' | 'SELAMAT';
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
}

export interface ScheduleItem {
  id: string;
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

export interface ClassData {
  announcements: Announcement[];
  agenda: AgendaItem[];
  schedules: ScheduleItem[];
  students: Student[];
  behaviorRecords: BehaviorRecord[];
  achievements: Achievement[];
  officers: ClassOfficer[];
  heroImage: string;
  quote: { text: string; author: string };
  stats: { attendance: string; averageGrade: string; totalStudents: string; };
  selectedClass: string | null;
  selectedYear: string | null;
  setSelectedClass: (cls: string | null) => void;
  setSelectedYear: (yr: string | null) => void;
  updateQuote: (text: string, author: string) => void;
  updateHeroImage: (imageUrl: string) => Promise<void>;
  resetHeroImage: () => Promise<void>;
  saveClassOfficer: (userId: string, role: string) => Promise<void>;
  removeClassOfficer: (id: string) => Promise<void>;
  addAnnouncement: (ann: Announcement) => void;
  removeAnnouncement: (id: string) => void;
  addAgenda: (item: AgendaItem) => void;
  removeAgenda: (id: string) => void;
  addSchedule: (item: Omit<ScheduleItem, 'id'> & { id?: string }) => Promise<void>;
  removeSchedule: (id: string) => Promise<void>;
  addStudent: (student: Student) => void;
  removeStudent: (id: string) => void;
  updateStudent: (student: Student) => void;
  addBehaviorRecord: (record: Omit<BehaviorRecord, 'id'>) => Promise<void>;
  removeBehaviorRecord: (id: string) => Promise<void>;
  addAchievement: (achievement: Omit<Achievement, 'id'>) => Promise<void>;
  removeAchievement: (id: string) => Promise<void>;
}

const defaultData = {
  announcements: [
    { id: '1', type: 'PENTING' as const, text: 'Batas pengumpulan Tugas Akhir Fisika adalah hari Jumat, pukul 23:59 WIB.' },
    { id: '2', type: 'INFO' as const, text: 'Jadwal Olahraga besok, jangan lupa membawa baju ganti dan air minum.' },
    { id: '3', type: 'SELAMAT' as const, text: 'Kepada Tim Futsal Kelas atas raihan Juara 1 Antar Kelas!' }
  ],
  agenda: [
    { id: '1', date: "15 Okt", title: "Ujian Tengah Semester", type: "Ujian" },
    { id: '2', date: "20 Okt", title: "Tugas Praktikum", type: "Tugas" },
  ],
  students: [
    { id: '1', nisn: '10029381', name: 'Ahmad Fauzi', gender: 'L' as const, status: 'Aktif' as const },
    { id: '2', nisn: '10029382', name: 'Citra Kirana', gender: 'P' as const, status: 'Aktif' as const },
    { id: '3', nisn: '10029383', name: 'Budi Santoso', gender: 'L' as const, status: 'Aktif' as const },
    { id: '4', nisn: '10029384', name: 'Dewi Lestari', gender: 'P' as const, status: 'Aktif' as const },
  ],
  quote: {
    text: "Pendidikan adalah senjata paling mematikan di dunia, karena dengan pendidikan, Anda dapat mengubah dunia.",
    author: "Nelson Mandela"
  },
  stats: {
    attendance: "—",
    averageGrade: "—",
    totalStudents: "4"
  },
  schedules: [],
  behaviorRecords: [],
  achievements: [],
  officers: [
    { id: '1', userId: '1', role: 'Ketua Kelas', name: 'Ahmad Fauzi' },
    { id: '2', userId: '2', role: 'Wakil Ketua', name: 'Citra Kirana' },
    { id: '3', userId: '3', role: 'Sekretaris', name: 'Budi Santoso' },
    { id: '4', userId: '4', role: 'Bendahara', name: 'Dewi Lestari' },
  ],
  heroImage: '/hero-default.svg'
};

export const ClassContext = createContext<ClassData | undefined>(undefined);

export const ClassProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState(defaultData);
  const [selectedClass, setSelectedClass] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedClass') || 'XII RPL A';
    }
    return 'XII RPL A';
  });
  const [selectedYear, setSelectedYear] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedYear') || '2024-2025';
    }
    return '2024-2025';
  });

  const handleSetSelectedClass = (cls: string | null) => {
    setSelectedClass(cls);
    if (cls) {
      localStorage.setItem('selectedClass', cls);
    } else {
      localStorage.removeItem('selectedClass');
    }
  };

  const handleSetSelectedYear = (yr: string | null) => {
    setSelectedYear(yr);
    if (yr) {
      localStorage.setItem('selectedYear', yr);
    } else {
      localStorage.removeItem('selectedYear');
    }
  };

  const fetchClassData = useCallback(async () => {
    try {
      const res = await fetch('/api/class-data');
      if (res.ok) {
        const json = await res.json();
        setData({
          announcements: json.announcements,
          agenda: json.agenda,
          schedules: json.schedules || [],
          students: json.students,
          behaviorRecords: json.behaviorRecords || [],
          achievements: json.achievements || [],
          officers: json.officers || [],
          heroImage: json.heroImage || '/hero-default.svg',
          quote: json.quote,
          stats: json.stats,
        });
      }
    } catch (err) {
      console.error('Error fetching class data:', err);
    }
  }, []);

  useEffect(() => {
    fetchClassData();
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

  const addAnnouncement = async (ann: Announcement) => {
    try {
      await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: ann.type, text: ann.text })
      });
      fetchClassData();
    } catch (err) {
      console.error('Error adding announcement:', err);
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
      await fetch('/api/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: item.date, title: item.title, type: item.type })
      });
      fetchClassData();
    } catch (err) {
      console.error('Error adding agenda:', err);
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
      await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      fetchClassData();
    } catch (err) {
      console.error('Error adding schedule:', err);
    }
  };

  const removeSchedule = async (id: string) => {
    try {
      await fetch(`/api/schedules/${id}`, {
        method: 'DELETE'
      });
      fetchClassData();
    } catch (err) {
      console.error('Error removing schedule:', err);
    }
  };

  const addStudent = async (student: Student) => {
    try {
      await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: student.name, nisn: student.nisn, gender: student.gender, status: student.status })
      });
      fetchClassData();
    } catch (err) {
      console.error('Error adding student:', err);
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

  const updateStudent = async (student: Student) => {
    try {
      await fetch(`/api/students/${student.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: student.name, nisn: student.nisn, gender: student.gender, status: student.status })
      });
      fetchClassData();
    } catch (err) {
      console.error('Error updating student:', err);
    }
  };

  const addBehaviorRecord = async (record: Omit<BehaviorRecord, 'id'>) => {
    try {
      await fetch('/api/behavior', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      fetchClassData();
    } catch (err) {
      console.error('Error adding behavior record:', err);
    }
  };

  const removeBehaviorRecord = async (id: string) => {
    try {
      await fetch(`/api/behavior/${id}`, {
        method: 'DELETE'
      });
      fetchClassData();
    } catch (err) {
      console.error('Error removing behavior record:', err);
    }
  };

  const addAchievement = async (achievement: Omit<Achievement, 'id'>) => {
    try {
      await fetch('/api/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(achievement)
      });
      fetchClassData();
    } catch (err) {
      console.error('Error adding achievement:', err);
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
      selectedClass,
      selectedYear,
      setSelectedClass: handleSetSelectedClass,
      setSelectedYear: handleSetSelectedYear,
      updateQuote,
      updateHeroImage,
      resetHeroImage,
      saveClassOfficer,
      removeClassOfficer,
      addAnnouncement,
      removeAnnouncement,
      addAgenda,
      removeAgenda,
      addSchedule,
      removeSchedule,
      addStudent,
      removeStudent,
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
