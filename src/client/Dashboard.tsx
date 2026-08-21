import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Users, Calendar, CheckSquare, Settings, LayoutDashboard, Plus, Trash2, Save, Megaphone, Upload, Edit2, Key, Lock, Sun, Moon, X, Download, Ban, FileText, Printer, FileSpreadsheet, Search, Clock, CalendarDays, Award, Menu, ThumbsUp, ThumbsDown, ImageIcon, Thermometer, ShieldAlert, AlertTriangle, MessageSquare } from 'lucide-react';
import { useClassData, Announcement, AgendaItem, Student } from './ClassContext';

const BEHAVIOR_DESCRIPTION_EXAMPLES: Record<'positif' | 'negatif', Record<string, string[]>> = {
  positif: {
    'Sopan Santun': ['Berbicara santun kepada guru dan teman.'],
    Kedisiplinan: ['Hadir tepat waktu dan mengikuti pembelajaran dengan tertib.'],
    'Tanggung Jawab': ['Menyelesaikan tugas sesuai batas waktu.'],
    Kejujuran: ['Mengerjakan evaluasi secara mandiri dan jujur.'],
    Kerjasama: ['Aktif membantu kelompok menyelesaikan tugas.'],
    Kepedulian: ['Membantu teman yang mengalami kesulitan belajar.'],
  },
  negatif: {
    Kedisiplinan: ['Datang terlambat tanpa keterangan.'],
    Kerapian: ['Seragam belum sesuai ketentuan sekolah.'],
    'Sopan Santun': ['Perlu diingatkan untuk menggunakan bahasa yang santun.'],
    Ketertiban: ['Mengganggu proses pembelajaran di kelas.'],
    Kejujuran: ['Perlu pembinaan terkait kemandirian saat mengerjakan tugas.'],
  },
};

const attendanceStatusIcon = (status: string) => {
  if (status === 'Hadir' || status === 'Sholat') return <CheckSquare className="h-5 w-5" aria-hidden="true" />;
  if (status === 'Sakit') return <Thermometer className="h-5 w-5" aria-hidden="true" />;
  if (status === 'Izin') return <CalendarDays className="h-5 w-5" aria-hidden="true" />;
  if (status === 'Berhalangan') return <Ban className="h-5 w-5" aria-hidden="true" />;
  return <X className="h-5 w-5" aria-hidden="true" />;
};

type DashboardRole = 'admin' | 'teacher' | 'counselor';
type CaseStatus = 'terbuka' | 'ditangani' | 'selesai';
type CasePriority = 'rendah' | 'sedang' | 'tinggi' | 'mendesak';
type CaseVisibility = 'ringkasan' | 'sensitif';
type CaseCategory = 'akademik' | 'presensi' | 'sikap' | 'sosial-emosional' | 'kesehatan' | 'keluarga-lingkungan' | 'lainnya';

interface StudentCase {
  id: string;
  studentId: string;
  classId: string;
  title: string;
  category: CaseCategory;
  priority: CasePriority;
  status: CaseStatus;
  summary: string;
  visibility: CaseVisibility;
  ownerId: string;
  dueDate: string | null;
  student: { name: string } | null;
  class: { name: string; academicYear: string } | null;
  owner: { name: string; role: string } | null;
}

interface CaseDetail extends StudentCase {
  updates: Array<{ id: string; note: string; visibility: CaseVisibility; nextFollowUpDate: string | null; createdAt: string | null; author: { name: string } | null }>;
}

interface StudentWarning {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  kind: string;
  priority: CasePriority;
  reason: string;
  value: number;
}

const Dashboard = ({ userRole = 'admin' }: { userRole?: DashboardRole }) => {
  const [activeTab, setActiveTab] = useState('workspace');
  const classData = useClassData();
  const [workspaceMode, setWorkspaceMode] = useState<'homeroom' | 'teaching'>(userRole === 'teacher' ? 'teaching' : 'homeroom');
  const [activeTeachingSubject, setActiveTeachingSubject] = useState<string | null>(null);
  const canManageStudents = userRole === 'admin';
  const [workspace, setWorkspace] = useState<{ user: { name: string; roles: string[] }; homeroomClasses: { id: string; name: string; academicYear: string }[]; subjectGroups: { subjectId: string; subjectName: string; classes: { assignmentId: string; classId: string; className: string; academicYear: string; studentCount: number; gradeCount: number }[] }[] } | null>(null);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Dark mode state with persistence
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  // Apply dark mode theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        const response = await fetch('/api/my-workspace');
        if (response.ok) setWorkspace(await response.json());
      } finally { setIsLoadingWorkspace(false); }
    };
    fetchWorkspace();
  }, []);

  const openTeachingClass = async (classId: string, subjectName: string) => {
    await classData.selectClass(classId);
    setWorkspaceMode('teaching');
    setActiveTeachingSubject(subjectName);
    setBehaviorSubTab('sikap');
    setSelectedSubject(subjectName);
    setActiveTab('academic');
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) return alert('Konfirmasi password baru tidak sama.');
    try {
      const response = await fetch('/api/auth/password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) });
      const data = await response.json();
      if (!response.ok) return alert(data.error || 'Gagal mengubah password.');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setShowPasswordModal(false);
      alert('Password berhasil diubah.');
    } catch (error) { console.error('Error changing password:', error); alert('Terjadi kesalahan saat mengubah password.'); }
  };

  // Local state for the settings form to avoid immediate re-renders while typing
  const [quoteText, setQuoteText] = useState(classData.quote.text);
  const [quoteAuthor, setQuoteAuthor] = useState(classData.quote.author);
  const [heroImageUrl, setHeroImageUrl] = useState(classData.heroImage);
  const [homeroomTeacherPhotoUrl, setHomeroomTeacherPhotoUrl] = useState(classData.homeroomTeacherPhoto);
  const [galleryTitle, setGalleryTitle] = useState('');
  const [galleryImageUrl, setGalleryImageUrl] = useState('');
  const [galleryDescription, setGalleryDescription] = useState('');
  const [officerRole, setOfficerRole] = useState('Ketua Kelas');
  const [officerStudentId, setOfficerStudentId] = useState('');
  const [teachers, setTeachers] = useState<{ id: string; name: string; identifier: string; status: string; primaryRole?: string }[]>([]);
  const [newAccountRole, setNewAccountRole] = useState<'teacher' | 'counselor'>('teacher');
  const [caseOwners, setCaseOwners] = useState<{ id: string; name: string; primaryRole?: string }[]>([]);
  const [teachingAssignments, setTeachingAssignments] = useState<{ id: string; teacherId: string; classId: string; subjectId: string; academicYear: string; teacherName: string; className: string; subjectName: string }[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [newClassYear, setNewClassYear] = useState('');
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherIdentifier, setNewTeacherIdentifier] = useState('');
  const [assignmentTeacherId, setAssignmentTeacherId] = useState('');
  const [assignmentClassId, setAssignmentClassId] = useState('');
  const [assignmentSubjectId, setAssignmentSubjectId] = useState('');
  type SettingsPanel = 'overview' | 'teaching' | 'landing' | 'gallery' | 'officers' | 'profile';
  const [settingsView, setSettingsView] = useState<SettingsPanel>('overview');

  const openSettingsSection = (panel: Exclude<SettingsPanel, 'overview'>) => {
    setSettingsView(panel);
  };

  useEffect(() => {
    setHeroImageUrl(classData.heroImage);
  }, [classData.heroImage]);

  useEffect(() => {
    setHomeroomTeacherPhotoUrl(classData.homeroomTeacherPhoto);
  }, [classData.homeroomTeacherPhoto]);

  useEffect(() => {
    const activeStudents = classData.students.filter((student) => student.status === 'Aktif');
    if (!activeStudents.some((student) => student.id === officerStudentId)) {
      setOfficerStudentId(activeStudents[0]?.id || '');
    }
  }, [classData.students, officerStudentId]);
  
  const [newAnnType, setNewAnnType] = useState<'PENTING' | 'INFO' | 'SELAMAT'>('INFO');
  const [newAnnText, setNewAnnText] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [manualNisn, setManualNisn] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualGender, setManualGender] = useState<'L' | 'P'>('L');
  const [manualStatus, setManualStatus] = useState<'Aktif' | 'Nonaktif'>('Aktif');

  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [attendanceType, setAttendanceType] = useState<'harian' | 'dhuha' | 'dzuhur' | 'jumat'>('harian');
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [isSavingTeachingAttendance, setIsSavingTeachingAttendance] = useState(false);
  const [teachingAttendanceDate, setTeachingAttendanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [teachingAttendanceMap, setTeachingAttendanceMap] = useState<Record<string, string>>({});
  const [teachingAttendanceMonth, setTeachingAttendanceMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [teachingAttendanceReport, setTeachingAttendanceReport] = useState<any[]>([]);
  const [mobileDashboardPanel, setMobileDashboardPanel] = useState<'schedule' | 'agenda'>('schedule');
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [reportData, setReportData] = useState<any[]>([]);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportCategory, setReportCategory] = useState<'attendance' | 'grades' | 'behavior'>('attendance');
  const [teachingReportCategory, setTeachingReportCategory] = useState<'grades' | 'behavior' | 'attendance'>('grades');
  const [teachingReportPeriod, setTeachingReportPeriod] = useState('Semester Ganjil');
  const [dashboardSummary, setDashboardSummary] = useState<any[]>([]);
  const [classInsights, setClassInsights] = useState<any | null>(null);
  const [studentCases, setStudentCases] = useState<StudentCase[]>([]);
  const [studentWarnings, setStudentWarnings] = useState<StudentWarning[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseDetail | null>(null);
  const [monitoringClassFilter, setMonitoringClassFilter] = useState('all');
  const [monitoringStatusFilter, setMonitoringStatusFilter] = useState<'all' | CaseStatus>('all');
  const [monitoringPriorityFilter, setMonitoringPriorityFilter] = useState<'all' | CasePriority>('all');
  const [monitoringSearch, setMonitoringSearch] = useState('');
  const [isLoadingMonitoring, setIsLoadingMonitoring] = useState(false);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [showCaseUpdateModal, setShowCaseUpdateModal] = useState(false);
  const [caseTitle, setCaseTitle] = useState('');
  const [caseCategory, setCaseCategory] = useState<CaseCategory>('akademik');
  const [casePriority, setCasePriority] = useState<CasePriority>('sedang');
  const [caseSummary, setCaseSummary] = useState('');
  const [caseClassId, setCaseClassId] = useState('');
  const [caseStudentId, setCaseStudentId] = useState('');
  const [caseOwnerId, setCaseOwnerId] = useState('');
  const [caseDueDate, setCaseDueDate] = useState('');
  const [caseVisibility, setCaseVisibility] = useState<CaseVisibility>('ringkasan');
  const [caseUpdateNote, setCaseUpdateNote] = useState('');
  const [caseUpdateVisibility, setCaseUpdateVisibility] = useState<CaseVisibility>('ringkasan');
  const [caseNextFollowUpDate, setCaseNextFollowUpDate] = useState('');

  useEffect(() => {
    const fetchDashboardSummary = async () => {
      try {
        const currentMonth = new Date().toISOString().slice(0, 7);
        if (!classData.classId) return;
        const res = await fetch(`/api/attendance/summary?month=${currentMonth}&classId=${classData.classId}`);
        if (res.ok) {
          const json = await res.json();
          setDashboardSummary(json);
        }
      } catch (err) {
        console.error('Error fetching dashboard summary:', err);
      }
    };
    fetchDashboardSummary();
  }, [classData.students, classData.classId]);

  useEffect(() => {
    const fetchClassInsights = async () => {
      if (!classData.classId || userRole !== 'admin') return;
      try {
        const month = new Date().toISOString().slice(0, 7);
        const response = await fetch(`/api/class-insights?classId=${classData.classId}&month=${month}`);
        if (response.ok) setClassInsights(await response.json());
        else setClassInsights(null);
      } catch (error) {
        console.error('Error fetching class insights:', error);
        setClassInsights(null);
      }
    };
    fetchClassInsights();
  }, [classData.classId, userRole]);

  const fetchMonitoring = useCallback(async () => {
    if (userRole !== 'admin' && userRole !== 'counselor') return;
    setIsLoadingMonitoring(true);
    try {
      const query = monitoringClassFilter === 'all' ? '' : `?classId=${encodeURIComponent(monitoringClassFilter)}`;
      const [casesResponse, warningsResponse, ownersResponse] = await Promise.all([
        fetch(`/api/student-cases${query}`),
        fetch(`/api/student-case-warnings${query}`),
        fetch('/api/teachers'),
      ]);
      if (casesResponse.ok) setStudentCases(await casesResponse.json());
      if (warningsResponse.ok) setStudentWarnings(await warningsResponse.json());
      if (ownersResponse.ok) setCaseOwners(await ownersResponse.json());
    } catch (error) {
      console.error('Error fetching student monitoring:', error);
    } finally {
      setIsLoadingMonitoring(false);
    }
  }, [monitoringClassFilter, userRole]);

  useEffect(() => {
    if (activeTab === 'monitoring') fetchMonitoring();
  }, [activeTab, fetchMonitoring]);

  const openNewCaseModal = () => {
    setCaseClassId(classData.classId || '');
    setCaseStudentId(classData.students[0]?.id || '');
    setCaseOwnerId(caseOwners[0]?.id || '');
    setCaseTitle('');
    setCaseCategory('akademik');
    setCasePriority('sedang');
    setCaseSummary('');
    setCaseDueDate('');
    setCaseVisibility('ringkasan');
    setShowCaseModal(true);
  };

  const openCaseFromWarning = async (warning: StudentWarning) => {
    await classData.selectClass(warning.classId);
    setMonitoringClassFilter(warning.classId);
    setCaseClassId(warning.classId);
    setCaseStudentId(warning.studentId);
    setCaseOwnerId(caseOwners[0]?.id || '');
    setCaseTitle(`Perlu perhatian: ${warning.kind}`);
    setCaseCategory(warning.kind === 'presensi' ? 'presensi' : warning.kind === 'sikap' ? 'sikap' : 'akademik');
    setCasePriority(warning.priority);
    setCaseSummary(warning.reason);
    setCaseDueDate('');
    setCaseVisibility('ringkasan');
    setShowCaseModal(true);
  };

  const handleCreateStudentCase = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!caseClassId || !caseStudentId || !caseTitle.trim() || !caseSummary.trim()) return;
    const response = await fetch('/api/student-cases', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: caseStudentId, classId: caseClassId, title: caseTitle, category: caseCategory, priority: casePriority, summary: caseSummary, ownerId: caseOwnerId || undefined, dueDate: caseDueDate || null, visibility: caseVisibility }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) return alert(result?.error || 'Gagal membuat kasus pembinaan.');
    setShowCaseModal(false);
    await fetchMonitoring();
    alert('Kasus pembinaan berhasil dibuat.');
  };

  const openCaseDetail = async (caseId: string) => {
    const response = await fetch(`/api/student-cases/${caseId}`);
    if (!response.ok) return alert((await response.json().catch(() => null))?.error || 'Gagal memuat detail kasus.');
    setSelectedCase(await response.json());
  };

  const updateStudentCase = async (caseId: string, payload: Record<string, unknown>) => {
    const response = await fetch(`/api/student-cases/${caseId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => null);
    if (!response.ok) return alert(result?.error || 'Gagal memperbarui kasus.');
    setSelectedCase((current) => current ? { ...current, ...result } : current);
    await fetchMonitoring();
  };

  const handleAddCaseUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCase || !caseUpdateNote.trim()) return;
    const response = await fetch(`/api/student-cases/${selectedCase.id}/updates`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: caseUpdateNote, visibility: caseUpdateVisibility, nextFollowUpDate: caseNextFollowUpDate || null }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) return alert(result?.error || 'Gagal menyimpan tindak lanjut.');
    setCaseUpdateNote('');
    setCaseNextFollowUpDate('');
    setShowCaseUpdateModal(false);
    await openCaseDetail(selectedCase.id);
    await fetchMonitoring();
  };

  const fetchReportData = useCallback(async () => {
    setIsLoadingReport(true);
    try {
      if (!classData.classId) return;
      const res = await fetch(`/api/attendance/summary?month=${selectedMonth}&classId=${classData.classId}`);
      if (res.ok) {
        const json = await res.json();
        setReportData(json);
      }
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setIsLoadingReport(false);
    }
  }, [selectedMonth, classData.classId]);

  useEffect(() => {
    if (activeTab === 'reports' && reportCategory === 'attendance') {
      fetchReportData();
    }
  }, [activeTab, reportCategory, fetchReportData]);

  const [reportSubTab, setReportSubTab] = useState<'harian' | 'dhuha' | 'dzuhur' | 'jumat'>('harian');
  const [statsTab, setStatsTab] = useState<'harian' | 'mingguan' | 'bulanan'>('bulanan');
  const [classStats, setClassStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const fetchClassStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      if (!classData.classId) return;
      const res = await fetch(`/api/attendance/stats?classId=${classData.classId}`);
      if (res.ok) {
        const json = await res.json();
        setClassStats(json);
      }
    } catch (err) {
      console.error('Error fetching class stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  }, [classData.classId]);

  useEffect(() => {
    fetchClassStats();
  }, [fetchClassStats, classData.students]);

  // Academic & Gradebook states
  const [gradesList, setGradesList] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<{ id: number; name: string }[]>([]);
  const [isLoadingGrades, setIsLoadingGrades] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('Matematika');
  const [showSubjectManager, setShowSubjectManager] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [showAddModalAcademic, setShowAddModalAcademic] = useState(false);
  const [newAssessmentName, setNewAssessmentName] = useState('');
  const [newAssessmentType, setNewAssessmentType] = useState<'Tugas' | 'Ulangan' | 'PTS' | 'PAS'>('Tugas');
  const [academicSearch, setAcademicSearch] = useState('');
  const [tempScores, setTempScores] = useState<Record<string, number>>({});
  const [sessionAssessments, setSessionAssessments] = useState<{ name: string; type: string }[]>([]);

  useEffect(() => {
    if (workspaceMode === 'teaching' && activeTeachingSubject) {
      setSelectedSubject(activeTeachingSubject);
    }
  }, [workspaceMode, activeTeachingSubject]);

  const fetchGrades = useCallback(async () => {
    setIsLoadingGrades(true);
    try {
      if (!classData.classId) return;
      const res = await fetch(`/api/grades?classId=${classData.classId}`);
      if (res.ok) {
        const data = await res.json();
        setGradesList(data);
        
        // Build initial tempScores map
        const initialTempScores: Record<string, number> = {};
        data.forEach((g: any) => {
          initialTempScores[`${g.userId}_${g.name}`] = g.score;
        });
        setTempScores(initialTempScores);
      }
    } catch (err) {
      console.error('Error fetching grades:', err);
    } finally {
      setIsLoadingGrades(false);
    }
  }, [classData.classId]);

  const fetchSubjects = useCallback(async () => {
    try {
      const res = await fetch('/api/subjects');
      if (res.ok) {
        const data = await res.json();
        setSubjects(data);
        if (data.length && !data.some((subject: { name: string }) => subject.name === selectedSubject)) {
          setSelectedSubject(data[0].name);
        }
      }
    } catch (err) {
      console.error('Error fetching subjects:', err);
    }
  }, [selectedSubject]);

  const fetchTeachingSetup = useCallback(async () => {
    try {
      const [teachersResponse, assignmentsResponse, subjectsResponse] = await Promise.all([
        fetch('/api/teachers'), fetch('/api/teaching-assignments'), fetch('/api/subjects'),
      ]);
      if (teachersResponse.ok) setTeachers(await teachersResponse.json());
      if (assignmentsResponse.ok) setTeachingAssignments(await assignmentsResponse.json());
      if (subjectsResponse.ok) setSubjects(await subjectsResponse.json());
    } catch (error) { console.error('Gagal memuat pengaturan mengajar:', error); }
  }, []);

  useEffect(() => {
    if (activeTab === 'settings') fetchTeachingSetup();
  }, [activeTab, fetchTeachingSetup]);

  useEffect(() => {
    if (activeTab === 'academic' || activeTab === 'reports') {
      fetchGrades();
      fetchSubjects();
    }
  }, [activeTab, fetchGrades, fetchSubjects]);

  const handleSaveSubject = async () => {
    const name = subjectName.trim();
    if (!name) return;
    const url = editingSubjectId ? `/api/subjects/${editingSubjectId}` : '/api/subjects';
    const res = await fetch(url, { method: editingSubjectId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (!res.ok) return alert((await res.json()).error || 'Gagal menyimpan mata pelajaran.');
    setSelectedSubject(name);
    setSubjectName('');
    setEditingSubjectId(null);
    fetchSubjects();
    fetchGrades();
  };

  const handleDeleteSubject = async (subject: { id: number; name: string }) => {
    if (!window.confirm(`Hapus mata pelajaran "${subject.name}"?`)) return;
    const res = await fetch(`/api/subjects/${subject.id}`, { method: 'DELETE' });
    if (!res.ok) return alert((await res.json()).error || 'Gagal menghapus mata pelajaran.');
    fetchSubjects();
  };

  useEffect(() => {
    const distinct = gradesList
      .filter(g => g.subject === selectedSubject)
      .reduce((acc: { name: string; type: string }[], current) => {
        const exists = acc.some(item => item.name === current.name && item.type === current.type);
        if (!exists) {
          acc.push({ name: current.name, type: current.type });
        }
        return acc;
      }, []);
    setSessionAssessments(distinct);
  }, [gradesList, selectedSubject]);

  const handleSaveGrades = async () => {
    try {
      for (const assessment of sessionAssessments) {
        const scores = classData.students.map(s => {
          const score = tempScores[`${s.id}_${assessment.name}`] ?? 0;
          return { userId: s.id, score };
        });
        
        await fetch('/api/grades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: selectedSubject,
            type: assessment.type,
            name: assessment.name,
            scores,
            classId: classData.classId
          })
        });
      }
      alert('Nilai berhasil disimpan!');
      fetchGrades();
    } catch (err) {
      console.error('Error saving grades:', err);
      alert('Gagal menyimpan nilai.');
    }
  };

  const handleDeleteAssessment = async (assessmentName: string, assessmentType: string) => {
    const isConfirmed = window.confirm(`Apakah Anda yakin ingin menghapus kolom penilaian "${assessmentName}"?`);
    if (!isConfirmed) return;
    try {
      const res = await fetch(`/api/grades/assessment?subject=${encodeURIComponent(selectedSubject)}&type=${assessmentType}&name=${encodeURIComponent(assessmentName)}&classId=${classData.classId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert('Kolom penilaian berhasil dihapus!');
        fetchGrades();
      }
    } catch (err) {
      console.error('Error deleting assessment:', err);
      alert('Gagal menghapus kolom penilaian.');
    }
  };

  // Academic Sub-tabs & Bank Materi / Tugas States
  const [academicSubTab, setAcademicSubTab] = useState<'grades' | 'materials' | 'schedule'>('grades');
  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false);
  const [newScheduleDay, setNewScheduleDay] = useState('Senin');
  const [newScheduleSubject, setNewScheduleSubject] = useState('');
  const [newScheduleTimeStart, setNewScheduleTimeStart] = useState('07:30');
  const [newScheduleTimeEnd, setNewScheduleTimeEnd] = useState('09:00');
  const [newScheduleTeacher, setNewScheduleTeacher] = useState('');
  const [newScheduleColor, setNewScheduleColor] = useState('blue');

  // Behavior & Achievements States
  const [behaviorSubTab, setBehaviorSubTab] = useState<'sikap' | 'prestasi'>('sikap');
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState<string | null>(null);
  
  const [showAddBehaviorModal, setShowAddBehaviorModal] = useState(false);
  const [behaviorStudentId, setBehaviorStudentId] = useState('');
  const [behaviorType, setBehaviorType] = useState<'positif' | 'negatif'>('positif');
  const [behaviorPoints, setBehaviorPoints] = useState(10);
  const [behaviorCategory, setBehaviorCategory] = useState('Kedisiplinan');
  const [behaviorDescription, setBehaviorDescription] = useState('');
  const [behaviorDate, setBehaviorDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [showAddAchievementModal, setShowAddAchievementModal] = useState(false);
  const [achievementStudentId, setAchievementStudentId] = useState('');
  const [achievementTitle, setAchievementTitle] = useState('');
  const [achievementLevel, setAchievementLevel] = useState('Kabupaten');
  const [achievementRank, setAchievementRank] = useState('Juara 1');
  const [achievementDate, setAchievementDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [achievementDescription, setAchievementDescription] = useState('');

  const [assignmentsList, setAssignmentsList] = useState<any[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [showAddAssignmentModal, setShowAddAssignmentModal] = useState(false);
  const [newAssignmentTitle, setNewAssignmentTitle] = useState('');
  const [newAssignmentDesc, setNewAssignmentDesc] = useState('');
  const [newAssignmentType, setNewAssignmentType] = useState<'tugas' | 'materi'>('tugas');
  const [newAssignmentDueDate, setNewAssignmentDueDate] = useState('');
  const [newAssignmentFilePath, setNewAssignmentFilePath] = useState('');
  
  const [viewSubmissionsAssignmentId, setViewSubmissionsAssignmentId] = useState<number | null>(null);
  const [submissionsList, setSubmissionsList] = useState<any[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [tempSubGrades, setTempSubGrades] = useState<Record<number, number>>({});
  const [submissionSearch, setSubmissionSearch] = useState('');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<'all' | 'submitted' | 'pending'>('all');

  const filteredSubmissions = submissionsList.filter((submission) => {
    const query = submissionSearch.trim().toLowerCase();
    const matchesSearch = !query || submission.studentName.toLowerCase().includes(query) || String(submission.studentNisn || '').includes(query);
    const matchesStatus = submissionStatusFilter === 'all'
      || (submissionStatusFilter === 'submitted' && submission.hasSubmitted)
      || (submissionStatusFilter === 'pending' && !submission.hasSubmitted);
    return matchesSearch && matchesStatus;
  });

  const fetchAssignments = useCallback(async () => {
    setIsLoadingAssignments(true);
    try {
      const res = await fetch('/api/assignments');
      if (res.ok) {
        const data = await res.json();
        setAssignmentsList(data);
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
    } finally {
      setIsLoadingAssignments(false);
    }
  }, []);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssignmentTitle.trim()) {
      alert('Judul tidak boleh kosong!');
      return;
    }

    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newAssignmentTitle.trim(),
          description: newAssignmentDesc.trim(),
          type: newAssignmentType,
          filePath: newAssignmentFilePath.trim() || null,
          dueDate: newAssignmentType === 'tugas' && newAssignmentDueDate ? newAssignmentDueDate : null
        })
      });

      if (res.ok) {
        alert(newAssignmentType === 'tugas' ? 'Tugas berhasil dibuat!' : 'Materi berhasil dibagikan!');
        setShowAddAssignmentModal(false);
        fetchAssignments();
      } else {
        const payload = await res.json().catch(() => null) as { error?: string } | null;
        alert(payload?.error || 'Gagal menyimpan.');
      }
    } catch (err) {
      console.error('Error creating assignment:', err);
      alert('Terjadi kesalahan saat menyimpan.');
    }
  };

  const handleDeleteAssignment = async (id: number) => {
    const isConfirmed = window.confirm('Apakah Anda yakin ingin menghapus item ini?');
    if (!isConfirmed) return;
    try {
      const res = await fetch(`/api/assignments/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert('Berhasil dihapus!');
        fetchAssignments();
      }
    } catch (err) {
      console.error('Error deleting assignment:', err);
      alert('Gagal menghapus.');
    }
  };

  const fetchSubmissions = useCallback(async (assignmentId: number) => {
    if (!classData.classId) {
      setSubmissionsList([]);
      return;
    }
    setIsLoadingSubmissions(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/submissions?classId=${encodeURIComponent(classData.classId)}`);
      if (res.ok) {
        const data = await res.json();
        setSubmissionsList(data);
        
        // Build temp grades map
        const initialTempGrades: Record<number, number> = {};
        data.forEach((s: any) => {
          if (s.grade !== null) {
            initialTempGrades[s.studentId] = s.grade;
          }
        });
        setTempSubGrades(initialTempGrades);
      }
    } catch (err) {
      console.error('Error fetching submissions:', err);
    } finally {
      setIsLoadingSubmissions(false);
    }
  }, [classData.classId]);

  const handleSaveSubmissionGrade = async (studentId: number, gradeVal: number) => {
    if (viewSubmissionsAssignmentId === null) return;
    try {
      const res = await fetch(`/api/assignments/${viewSubmissionsAssignmentId}/student/${studentId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: gradeVal })
      });
      if (res.ok) {
        fetchSubmissions(viewSubmissionsAssignmentId);
      }
    } catch (err) {
      console.error('Error grading submission:', err);
      alert('Gagal menyimpan nilai.');
    }
  };

  useEffect(() => {
    if (activeTab === 'academic') {
      fetchAssignments();
    }
  }, [activeTab, fetchAssignments]);

  useEffect(() => {
    if (viewSubmissionsAssignmentId !== null) {
      fetchSubmissions(viewSubmissionsAssignmentId);
    }
  }, [viewSubmissionsAssignmentId, fetchSubmissions]);

  const getSholatCount = (prayerAttendance: { Berjamaah: number; Munfarid: number }) =>
    prayerAttendance.Berjamaah + prayerAttendance.Munfarid;

  const handleExportCSV = () => {
    if (reportData.length === 0) return;
    const printableRows = reportSubTab === 'jumat' ? reportData.filter((row) => row.gender === 'L') : reportData;
    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (reportSubTab === 'harian') {
      csvContent += "No,Nama,L/P,Hadir (H),Sakit (S),Izin (I),Alfa (A)\n";
      printableRows.forEach((row, index) => {
        csvContent += `${index + 1},"${row.name}",${row.gender},${row.harian.Hadir},${row.harian.Sakit},${row.harian.Izin},${row.harian.Alfa}\n`;
      });
    } else if (reportSubTab === 'dhuha') {
      csvContent += "No,Nama,L/P,Sholat (S),Berhalangan (BH),Alfa (A)\n";
      printableRows.forEach((row, index) => {
        csvContent += `${index + 1},"${row.name}",${row.gender},${getSholatCount(row.dhuha)},${row.dhuha.Berhalangan || 0},${row.dhuha.Alfa}\n`;
      });
    } else {
      csvContent += "No,Nama,L/P,Sholat (S),Berhalangan (BH),Alfa (A)\n";
      printableRows.forEach((row, index) => {
        const prayer = reportSubTab === 'dzuhur' ? row.dzuhur : row.jumat;
        csvContent += `${index + 1},"${row.name}",${row.gender},${getSholatCount(prayer)},${prayer.Berhalangan || 0},${prayer.Alfa}\n`;
      });
    }
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Presensi_${reportSubTab.toUpperCase()}_${classData.selectedClass}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    if (reportData.length === 0) return;
    const printableRows = reportSubTab === 'jumat' ? reportData.filter((row) => row.gender === 'L') : reportData;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const [year, month] = selectedMonth.split('-');
    const formattedMonth = `${monthNames[parseInt(month) - 1]} ${year}`;
    
    const titleText = reportSubTab === 'harian' 
      ? 'LAPORAN PRESENSI HARIAN SISWA' 
      : reportSubTab === 'dhuha'
        ? 'LAPORAN PRESENSI SHOLAT DHUHA SISWA'
        : reportSubTab === 'dzuhur' ? 'LAPORAN PRESENSI SHOLAT DZUHUR SISWA' : 'LAPORAN PRESENSI SHOLAT JUMAT SISWA';

    const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
    const dateColumns = Array.from({ length: daysInMonth }, (_, index) => index + 1)
      .filter((day) => {
        const dayOfWeek = new Date(Number(year), Number(month) - 1, day).getDay();
        return reportSubTab === 'jumat' ? dayOfWeek === 5 : dayOfWeek !== 0 && dayOfWeek !== 6;
      })
      .map((day) => {
        const label = String(day).padStart(2, '0');
        return { label, date: `${selectedMonth}-${label}` };
      })
      .filter(({ date }) => printableRows.some((row) => Boolean(row.attendanceByDate?.[date]?.[reportSubTab])));
    const isPrayerReport = reportSubTab !== 'harian';
    const statusCodes: Record<string, string> = {
      Hadir: '✓',
      Sakit: 'S',
      Izin: 'I',
      Alfa: 'A',
      Sholat: isPrayerReport ? '✓' : 'S',
      Berjamaah: isPrayerReport ? '✓' : 'S',
      Munfarid: isPrayerReport ? '✓' : 'S',
      Berhalangan: isPrayerReport ? 'H' : 'BH',
    };
    const statusLegend = reportSubTab === 'harian'
      ? '✓ = Hadir &nbsp;&nbsp; S = Sakit &nbsp;&nbsp; I = Izin &nbsp;&nbsp; A = Alfa'
      : '✓ = Sholat (Berjamaah/Munfarid) &nbsp;&nbsp; H = Halangan &nbsp;&nbsp; A = Alfa';
    const summaryColumns = reportSubTab === 'harian'
      ? ['S', 'I', 'A']
      : ['H', 'A'];
    const tableHeaders = `
      <tr>
        <th class="number">No</th>
        <th class="name">Nama Siswa</th>
        <th class="gender">L/P</th>
        ${dateColumns.map(({ label }) => `<th class="date">${label}</th>`).join('')}
        ${summaryColumns.map((statusCode) => `<th class="total ${statusCode === 'A' ? 'alfa' : ''}">${statusCode}</th>`).join('')}
      </tr>
    `;

    let tableRows = '';
    const studentsNeedingAttention: Array<{ name: string; sakit: number; izin: number; alfa: number }> = [];
    printableRows.forEach((row, index) => {
      const statusCodesByDate = dateColumns.map(({ date }) => {
        const status = row.attendanceByDate?.[date]?.[reportSubTab];
        return status ? statusCodes[status] ?? status : '';
      });
      const statusCells = statusCodesByDate
        .map((statusCode) => `<td class="status ${statusCode === 'A' ? 'alfa' : ''}">${statusCode}</td>`)
        .join('');
      const summaryCounts = Object.fromEntries(summaryColumns.map((summaryCode) => [summaryCode, statusCodesByDate.filter((statusCode) => statusCode === summaryCode).length]));
      if (reportSubTab === 'harian' && (summaryCounts.S > 3 || summaryCounts.I > 3 || summaryCounts.A > 3)) {
        studentsNeedingAttention.push({ name: row.name, sakit: summaryCounts.S, izin: summaryCounts.I, alfa: summaryCounts.A });
      }
      const summaryCells = summaryColumns
        .map((summaryCode) => {
          const count = summaryCounts[summaryCode];
          const attentionClass = reportSubTab === 'harian' && count > 3
            ? summaryCode === 'A' ? 'attention-alfa' : 'attention-absence'
            : '';
          return `<td class="total ${summaryCode === 'A' ? 'alfa' : ''} ${attentionClass}">${count}</td>`;
        })
        .join('');
      tableRows += `
        <tr>
          <td>${index + 1}</td>
          <td class="name">${row.name}</td>
          <td>${row.gender}</td>
          ${statusCells}
          ${summaryCells}
        </tr>
      `;
    });
    const attentionSection = reportSubTab === 'harian' ? `
      <section class="attention-section">
        <h2>Perlu Perhatian Guru</h2>
        ${studentsNeedingAttention.length
          ? `<p>Siswa berikut memiliki total Sakit, Izin, atau Alfa lebih dari 3 kali pada bulan ini.</p>
             <ul>${studentsNeedingAttention.map((student) => `<li><strong>${student.name}</strong> — Sakit: ${student.sakit}, Izin: ${student.izin}, Alfa: ${student.alfa}</li>`).join('')}</ul>`
          : '<p>Tidak ada siswa dengan total Sakit, Izin, atau Alfa lebih dari 3 kali pada bulan ini.</p>'}
      </section>
    ` : '';

    let html = `
      <html>
        <head>
          <title>${titleText} - ${classData.selectedClass}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: 'Inter', system-ui, sans-serif; color: #1e293b; padding: 0; }
            .header { text-align: center; margin-bottom: 14px; border-bottom: 3px double #cbd5e1; padding-bottom: 10px; }
            .header h1 { margin: 0; font-size: 18px; color: #1e3a8a; }
            .header p { margin: 4px 0 0 0; font-size: 11px; color: #64748b; }
            .info-table { width: 100%; margin-bottom: 12px; font-size: 11px; }
            .info-table td { padding: 4px 0; }
            .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 7px; }
            .data-table th, .data-table td { border: 1px solid #94a3b8; padding: 4px 2px; text-align: center; }
            .data-table th { background-color: #f1f5f9; font-weight: bold; color: #0f172a; }
            .data-table th.number { width: 18px; }
            .data-table th.name, .data-table td.name { width: 150px; text-align: left; font-weight: 500; }
            .data-table th.gender { width: 22px; }
            .data-table th.date, .data-table td.status { width: 17px; }
            .data-table th.total, .data-table td.total { width: 28px; font-weight: bold; }
            .data-table td.alfa { color: #dc2626; font-weight: bold; }
            .data-table td.attention-absence { background: #fef3c7; color: #92400e; }
            .data-table td.attention-alfa { background: #fee2e2; color: #b91c1c; }
            .status-legend { margin-top: 8px; font-size: 9px; color: #475569; }
            .status-legend strong { color: #1e293b; }
            .attention-section { margin-top: 12px; border: 1px solid #f59e0b; background: #fffbeb; padding: 8px 10px; font-size: 9px; }
            .attention-section h2 { margin: 0 0 4px; font-size: 10px; color: #92400e; }
            .attention-section p { margin: 0; color: #78350f; }
            .attention-section ul { margin: 5px 0 0; padding-left: 16px; color: #78350f; }
            .attention-section li { margin: 2px 0; }
            .footer-sig { margin-top: 28px; float: right; text-align: center; font-size: 11px; width: 220px; }
            .footer-sig-space { height: 50px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${titleText}</h1>
            <p>Sistem Manajemen Kelas Modern - WebKelas</p>
          </div>
          
          <table class="info-table">
            <tr>
              <td style="width: 15%; font-weight: bold;">Kelas</td>
              <td style="width: 2%; text-align: center;">:</td>
              <td style="width: 33%;">${classData.selectedClass}</td>
              <td style="width: 15%; font-weight: bold;">Periode</td>
              <td style="width: 2%; text-align: center;">:</td>
              <td style="width: 33%;">${formattedMonth}</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">Tahun Ajaran</td>
              <td style="text-align: center;">:</td>
              <td>${classData.selectedYear}</td>
              <td style="font-weight: bold;">Total Siswa</td>
              <td style="text-align: center;">:</td>
              <td>${reportData.length} Orang</td>
            </tr>
          </table>
          
          <table class="data-table">
            <thead>
              ${tableHeaders}
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <p class="status-legend"><strong>Keterangan:</strong> ${statusLegend}</p>
          ${attentionSection}
          
          <div class="footer-sig">
            <p>Wali Kelas,</p>
            <div class="footer-sig-space"></div>
            <p><strong>Feri Dwi Hermawan, S.Pd.</strong></p>
            <p>NIP. 198012042023211005</p>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const printReportDocument = (title: string, content: string, landscape = false) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>${title}</title><style>
        @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 12mm; }
        body { font-family: Inter, system-ui, sans-serif; color: #1e293b; font-size: 11px; }
        h1 { margin: 0; color: #1e3a8a; font-size: 18px; text-align: center; }
        .subtitle { margin: 5px 0 16px; text-align: center; color: #64748b; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #94a3b8; padding: 6px 5px; text-align: center; }
        th { background: #f1f5f9; } td.name { text-align: left; }
        .meta { margin: 0 0 12px; font-weight: 600; } .footer { margin-top: 28px; text-align: right; }
      </style></head><body>${content}<script>window.onload=()=>window.print()</script></body></html>
    `);
    printWindow.document.close();
  };

  const handlePrintTeachingAttendancePDF = () => {
    if (!activeTeachingSubject || !teachingAttendanceReport.length) return alert('Belum ada data presensi pembelajaran pada periode ini.');
    const dates = [...new Set(teachingAttendanceReport.flatMap((student) => Object.keys(student.attendanceByDate || {})))].sort();
    if (!dates.length) return alert('Belum ada presensi pembelajaran yang tersimpan pada bulan ini.');
    const statusCode: Record<string, string> = { Hadir: 'H', Sakit: 'S', Izin: 'I', Alfa: 'A' };
    const dateHeaders = dates.map((date) => `<th>${new Date(`${date}T00:00:00`).getDate()}</th>`).join('');
    const rows = teachingAttendanceReport.map((student, index) => `<tr><td>${index + 1}</td><td class="name">${student.name}</td><td>${student.gender}</td>${dates.map((date) => `<td>${statusCode[student.attendanceByDate?.[date]] || '-'}</td>`).join('')}<td>${student.Hadir}</td><td>${student.Sakit}</td><td>${student.Izin}</td><td>${student.Alfa}</td></tr>`).join('');
    printReportDocument(`Presensi ${activeTeachingSubject}`, `
      <h1>REKAP PRESENSI PEMBELAJARAN</h1><p class="subtitle">${activeTeachingSubject} — ${classData.selectedClass}</p>
      <p class="meta">Guru Pengajar: ${workspace?.user.name || 'Guru Pengajar'}<br>Bulan: ${teachingAttendanceMonth} &nbsp; | &nbsp; Tahun Ajaran: ${classData.selectedYear}</p>
      <table><thead><tr><th>No</th><th>Nama Siswa</th><th>L/P</th>${dateHeaders}<th>H</th><th>S</th><th>I</th><th>A</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="meta">Keterangan: H = Hadir, S = Sakit, I = Izin, A = Alfa.</p>
      <p class="footer">${new Date().toLocaleDateString('id-ID')}<br>Guru Mata Pelajaran,<br><br><br><b>${workspace?.user.name || 'Guru Pengajar'}</b></p>
    `, true);
  };

  const handlePrintGradesPDF = () => {
    if (sessionAssessments.length === 0) {
      alert('Belum ada data penilaian untuk mata pelajaran ini.');
      return;
    }
    const headers = sessionAssessments.map((assessment) => `<th>${assessment.type}<br>${assessment.name}</th>`).join('');
    const rows = classData.students.map((student, index) => {
      const scores = sessionAssessments.map((assessment) =>
        gradesList.find((grade) => grade.userId === Number(student.id) && grade.subject === selectedSubject && grade.type === assessment.type && grade.name === assessment.name)?.score
      );
      const filledScores = scores.filter((score) => score !== undefined);
      const average = filledScores.length ? Math.round(filledScores.reduce((sum, score) => sum + score, 0) / filledScores.length) : '-';
      return `<tr><td>${index + 1}</td><td class="name">${student.name}</td><td>${student.nisn}</td>${scores.map((score) => `<td>${score ?? '-'}</td>`).join('')}<td><b>${average}</b></td></tr>`;
    }).join('');
    printReportDocument(`Buku Nilai ${selectedSubject}`, `
      <h1>LAPORAN BUKU NILAI</h1><p class="subtitle">${selectedSubject} — ${classData.selectedClass}</p>
      <p class="meta">Tahun Ajaran: ${classData.selectedYear} &nbsp; | &nbsp; KKM: 75</p>
      <table><thead><tr><th>No</th><th>Nama Siswa</th><th>NISN</th>${headers}<th>Rata-rata</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="footer">Wali Kelas,<br><br><br><b>Feri Dwi Hermawan, S.Pd.</b></p>
    `, true);
  };

  const handlePrintBehaviorPDF = () => {
    const rows = classData.students.map((student, index) => {
      const records = (classData.behaviorRecords || []).filter((record) => record.studentId === student.id);
      const positive = records.filter((record) => record.type === 'positif').reduce((sum, record) => sum + record.points, 0);
      const negative = records.filter((record) => record.type === 'negatif').reduce((sum, record) => sum + record.points, 0);
      const score = 100 + positive - negative;
      const predicate = score >= 100 ? 'Sangat Baik' : score >= 85 ? 'Baik' : score >= 75 ? 'Cukup' : 'Perlu Pembinaan';
      return `<tr><td>${index + 1}</td><td class="name">${student.name}</td><td>${student.gender}</td><td>+${positive}</td><td>-${negative}</td><td><b>${score}</b></td><td>${predicate}</td></tr>`;
    }).join('');
    printReportDocument('Laporan Nilai Sikap', `
      <h1>LAPORAN NILAI SIKAP</h1><p class="subtitle">${classData.selectedClass}</p>
      <p class="meta">Tahun Ajaran: ${classData.selectedYear}</p>
      <table><thead><tr><th>No</th><th>Nama Siswa</th><th>L/P</th><th>Poin Positif</th><th>Poin Negatif</th><th>Skor Akhir</th><th>Predikat</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="footer">Wali Kelas,<br><br><br><b>Feri Dwi Hermawan, S.Pd.</b></p>
    `);
  };

  const handlePrintTeachingGradesPDF = () => {
    if (!activeTeachingSubject) return alert('Pilih kelas dan mata pelajaran dari Dashboard Saya terlebih dahulu.');
    const assessments = teachingAssessments;
    if (!assessments.length) return alert('Belum ada data penilaian untuk mata pelajaran ini.');

    const headers = assessments.map((assessment: { name: string; type: string }) => `<th>${assessment.type}<br>${assessment.name}</th>`).join('');
    const rows = classData.students.map((student, index) => {
      const scores: (number | undefined)[] = assessments.map((assessment: { name: string; type: string }) => gradesList.find((grade: any) =>
        grade.userId === Number(student.id) && grade.subject === activeTeachingSubject && grade.type === assessment.type && grade.name === assessment.name
      )?.score);
      const filledScores = scores.filter((score): score is number => score !== undefined);
      const average = filledScores.length ? Math.round(filledScores.reduce((sum, score) => sum + score, 0) / filledScores.length) : '-';
      const predicate = typeof average === 'number' ? (average >= 90 ? 'Sangat Baik' : average >= 75 ? 'Baik' : 'Perlu Bimbingan') : '-';
      return `<tr><td>${index + 1}</td><td class="name">${student.name}</td><td>${student.nisn}</td>${scores.map((score: number | undefined) => `<td>${score ?? '-'}</td>`).join('')}<td><b>${average}</b></td><td>${predicate}</td></tr>`;
    }).join('');

    printReportDocument(`Rekap Nilai ${activeTeachingSubject}`, `
      <h1>REKAP NILAI MATA PELAJARAN</h1>
      <p class="subtitle">${activeTeachingSubject} — ${classData.selectedClass}</p>
      <p class="meta">Guru Pengajar: ${workspace?.user.name || 'Guru Pengajar'}<br>Periode: ${teachingReportPeriod} &nbsp; | &nbsp; Tahun Ajaran: ${classData.selectedYear} &nbsp; | &nbsp; KKM: 75</p>
      <table><thead><tr><th>No</th><th>Nama Siswa</th><th>NISN</th>${headers}<th>Rata-rata</th><th>Predikat</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="footer">${new Date().toLocaleDateString('id-ID')}<br>Guru Mata Pelajaran,<br><br><br><b>${workspace?.user.name || 'Guru Pengajar'}</b></p>
    `, true);
  };

  const handlePrintTeachingBehaviorPDF = () => {
    if (!activeTeachingSubject) return alert('Pilih kelas dan mata pelajaran dari Dashboard Saya terlebih dahulu.');
    const subjectRecords = (classData.behaviorRecords || []).filter((record) => record.subject === activeTeachingSubject);
    const rows = classData.students.map((student, index) => {
      const records = subjectRecords.filter((record) => record.studentId === student.id);
      const positive = records.filter((record) => record.type === 'positif').reduce((sum, record) => sum + record.points, 0);
      const negative = records.filter((record) => record.type === 'negatif').reduce((sum, record) => sum + record.points, 0);
      const score = 100 + positive - negative;
      const predicate = score >= 100 ? 'Sangat Baik' : score >= 85 ? 'Baik' : score >= 75 ? 'Cukup' : 'Perlu Pembinaan';
      return `<tr><td>${index + 1}</td><td class="name">${student.name}</td><td>${student.gender}</td><td>+${positive}</td><td>-${negative}</td><td><b>${score}</b></td><td>${predicate}</td></tr>`;
    }).join('');
    const notes = subjectRecords.length
      ? subjectRecords.map((record) => `<tr><td class="name">${classData.students.find((student) => student.id === record.studentId)?.name || '-'}</td><td>${record.date}</td><td>${record.category}</td><td>${record.type === 'positif' ? 'Positif' : 'Perlu Pembinaan'}</td><td class="name">${record.description}</td></tr>`).join('')
      : '<tr><td colspan="5">Belum ada catatan sikap untuk mata pelajaran ini.</td></tr>';
    printReportDocument(`Laporan Sikap ${activeTeachingSubject}`, `
      <h1>LAPORAN SIKAP & KARAKTER MAPEL</h1>
      <p class="subtitle">${activeTeachingSubject} — ${classData.selectedClass}</p>
      <p class="meta">Guru Pengajar: ${workspace?.user.name || 'Guru Pengajar'}<br>Periode: ${teachingReportPeriod} &nbsp; | &nbsp; Tahun Ajaran: ${classData.selectedYear}</p>
      <table><thead><tr><th>No</th><th>Nama Siswa</th><th>L/P</th><th>Positif</th><th>Negatif</th><th>Skor</th><th>Predikat</th></tr></thead><tbody>${rows}</tbody></table>
      <h3 style="margin:20px 0 8px">Rincian Catatan Observasi</h3>
      <table><thead><tr><th>Nama Siswa</th><th>Tanggal</th><th>Kategori</th><th>Status</th><th>Catatan</th></tr></thead><tbody>${notes}</tbody></table>
      <p class="footer">${new Date().toLocaleDateString('id-ID')}<br>Guru Mata Pelajaran,<br><br><br><b>${workspace?.user.name || 'Guru Pengajar'}</b></p>
    `, true);
  };

  const [newAgendaDate, setNewAgendaDate] = useState('');
  const [newAgendaTitle, setNewAgendaTitle] = useState('');
  const [newAgendaType, setNewAgendaType] = useState('Kegiatan');

  // Advanced search & filter states
  const [studentSearch, setStudentSearch] = useState('');
  const [studentGenderFilter, setStudentGenderFilter] = useState<'all' | 'L' | 'P'>('all');
  const [studentStatusFilter, setStudentStatusFilter] = useState<'all' | 'Aktif' | 'Nonaktif'>('all');
  const [studentSortField, setStudentSortField] = useState<'name-asc' | 'name-desc' | 'nisn-asc'>('name-asc');

  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceGenderFilter, setAttendanceGenderFilter] = useState<'all' | 'L' | 'P'>('all');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<'all' | 'Hadir' | 'Sakit' | 'Izin' | 'Alfa' | 'Sholat' | 'Berhalangan'>('all');

  const [reportSearch, setReportSearch] = useState('');
  const [reportGenderFilter, setReportGenderFilter] = useState<'all' | 'L' | 'P'>('all');
  const [reportAlfaFilter, setReportAlfaFilter] = useState<'all' | 'alfa-only' | 'no-alfa'>('all');

  let avgHadir = 0;
  let avgDhuha = 0;
  let avgDzuhur = 0;
  
  let totalHarian = 0;
  let totalHadirCount = 0;
  let totalDhuha = 0;
  let totalDhuhaBerjamaah = 0;
  let totalDzuhur = 0;
  let totalDzuhurBerjamaah = 0;

  dashboardSummary.forEach(s => {
    totalHarian += s.harian.total;
    totalHadirCount += s.harian.Hadir;
    totalDhuha += s.dhuha.total;
    totalDhuhaBerjamaah += s.dhuha.Berjamaah;
    totalDzuhur += s.dzuhur.total;
    totalDzuhurBerjamaah += s.dzuhur.Berjamaah;
  });

  if (totalHarian > 0) avgHadir = Math.round((totalHadirCount / totalHarian) * 100);
  if (totalDhuha > 0) avgDhuha = Math.round((totalDhuhaBerjamaah / totalDhuha) * 100);
  if (totalDzuhur > 0) avgDzuhur = Math.round((totalDzuhurBerjamaah / totalDzuhur) * 100);

  const stats = [
    { title: "Total Siswa", value: classData.stats.totalStudents, icon: Users, color: "text-blue-500" },
    { title: "Rata-rata Kehadiran", value: dashboardSummary.length > 0 ? `${avgHadir}%` : classData.stats.attendance, icon: CheckSquare, color: "text-green-500" },
    { title: "Rata-rata Nilai", value: classData.stats.averageGrade, icon: BookOpen, color: "text-orange-500" },
    { title: "Agenda Aktif", value: classData.agenda.length.toString(), icon: Calendar, color: "text-purple-500" },
  ];

  const handleSaveQuote = () => {
    classData.updateQuote(quoteText, quoteAuthor);
    alert('Kutipan berhasil diperbarui!');
  };

  const handleAddAnnouncement = () => {
    if (!newAnnText) return;
    classData.addAnnouncement({ id: Date.now().toString(), type: newAnnType, text: newAnnText });
    setNewAnnText('');
  };

  const handleAddAgenda = () => {
    if (!newAgendaTitle || !newAgendaDate) return;
    classData.addAgenda({ id: Date.now().toString(), date: newAgendaDate, title: newAgendaTitle, type: newAgendaType });
    setNewAgendaDate('');
    setNewAgendaTitle('');
  };

  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,nisn,name,gender,status\n10029385,Budi Utomo,L,Aktif\n10029386,Siti Aminah,P,Aktif";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "template_siswa.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      alert(`Memproses file: ${file.name}...`);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        if (text) {
          const lines = text.split('\n');
          let successCount = 0;
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
              const parts = line.split(',');
              const nisn = parts[0]?.trim();
              const name = parts[1]?.trim();
              const gender = parts[2]?.trim().toUpperCase() === 'P' ? 'P' : 'L';
              const status = parts[3]?.trim() === 'Nonaktif' ? 'Nonaktif' : 'Aktif';
              
              if (nisn && name) {
                await classData.addStudent({
                  id: '',
                  nisn,
                  name,
                  gender,
                  status
                });
                successCount++;
              }
            }
          }
          alert(`Sukses mengimpor ${successCount} data siswa!`);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleResetPassword = (studentName: string) => {
    const isConfirmed = window.confirm(`Apakah Anda yakin ingin mereset password milik ${studentName} menjadi '123456'?`);
    if (isConfirmed) {
      alert(`Sukses! Password untuk ${studentName} berhasil direset.`);
    }
  };

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        if (!classData.classId) return;
        const res = await fetch(`/api/attendance?date=${attendanceDate}&type=${attendanceType}&classId=${classData.classId}`);
        if (res.ok) {
          const json = await res.json();
          const map: Record<string, string> = {};
          json.forEach((r: any) => {
            map[r.studentId] = r.status === 'Berjamaah' || r.status === 'Munfarid'
              ? 'Sholat'
              : r.status;
          });
          
          classData.students.filter((student) => attendanceType !== 'jumat' || student.gender === 'L').forEach(s => {
            if (!map[s.id]) {
              map[s.id] = attendanceType === 'harian' ? 'Hadir' : 'Sholat';
            }
          });
          setAttendanceMap(map);
        }
      } catch (err) {
        console.error('Error fetching attendance:', err);
      }
    };
    
    if (classData.students.length > 0) {
      fetchAttendance();
    }
  }, [attendanceDate, attendanceType, classData.students, classData.classId]);

  const handleSaveAttendance = async () => {
    if (isSavingAttendance) return;
    if (!classData.classId || !Object.keys(attendanceMap).length) {
      return alert('Data kelas atau presensi belum siap. Muat ulang data lalu coba lagi.');
    }
    setIsSavingAttendance(true);
    try {
      const records = Object.entries(attendanceMap).filter(([studentId]) => attendanceType !== 'jumat' || classData.students.find((student) => student.id === studentId)?.gender === 'L').map(([studentId, status]) => ({
        studentId,
        status
      }));
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: attendanceDate,
          type: attendanceType,
          records,
          classId: classData.classId
        })
      });
      if (res.ok) {
        alert('Presensi berhasil disimpan!');
      } else {
        const result = await res.json().catch(() => null);
        alert(result?.error || `Gagal menyimpan presensi (${res.status}).`);
      }
    } catch (err) {
      console.error('Error saving attendance:', err);
      alert('Terjadi kesalahan saat menyimpan presensi.');
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const handleMarkAllPrayerAbsent = () => {
    const targetStudents = classData.students.filter((student) => attendanceType !== 'jumat' || student.gender === 'L');
    const targetLabel = attendanceType === 'jumat' ? 'semua siswa laki-laki' : 'semua siswa';
    const attendanceLabel = attendanceType === 'harian' ? 'presensi harian' : attendanceType === 'dhuha' ? 'Sholat Dhuha' : attendanceType === 'dzuhur' ? 'Sholat Dzuhur' : 'Sholat Jumat';
    if (!targetStudents.length || !window.confirm(`Jadikan ${targetLabel} berstatus Alfa untuk ${attendanceLabel}? Perubahan baru tersimpan setelah Anda menekan Simpan Presensi.`)) return;
    setAttendanceMap((current) => ({
      ...current,
      ...Object.fromEntries(targetStudents.map((student) => [student.id, 'Alfa']))
    }));
  };

  useEffect(() => {
    const fetchTeachingAttendance = async () => {
      if (activeTab !== 'teaching-attendance' || !classData.classId || !activeTeachingSubject) return;
      const res = await fetch(`/api/attendance?date=${teachingAttendanceDate}&type=mapel&subject=${encodeURIComponent(activeTeachingSubject)}&classId=${classData.classId}`);
      if (!res.ok) return;
      const map: Record<string, string> = {};
      (await res.json()).forEach((record: any) => { map[record.studentId] = record.status; });
      classData.students.forEach((student) => { if (!map[student.id]) map[student.id] = 'Hadir'; });
      setTeachingAttendanceMap(map);
    };
    fetchTeachingAttendance().catch((error) => console.error('Error fetching teaching attendance:', error));
  }, [activeTab, teachingAttendanceDate, activeTeachingSubject, classData.classId, classData.students]);

  const handleSaveTeachingAttendance = async () => {
    if (!classData.classId || !activeTeachingSubject) return alert('Pilih kartu kelas dan mata pelajaran dari Dashboard Saya terlebih dahulu.');
    if (isSavingTeachingAttendance) return;
    if (!Object.keys(teachingAttendanceMap).length) return alert('Data siswa belum siap. Muat ulang data lalu coba lagi.');
    setIsSavingTeachingAttendance(true);
    try {
      const res = await fetch('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        date: teachingAttendanceDate, type: 'mapel', subject: activeTeachingSubject, classId: classData.classId,
        records: Object.entries(teachingAttendanceMap).map(([studentId, status]) => ({ studentId, status })),
      }) });
      if (res.ok) alert('Presensi pembelajaran berhasil disimpan.');
      else {
        const result = await res.json().catch(() => null);
        alert(result?.error || `Gagal menyimpan presensi pembelajaran (${res.status}).`);
      }
    } catch (error) {
      console.error('Error saving teaching attendance:', error);
      alert('Terjadi kesalahan saat menyimpan presensi pembelajaran.');
    } finally {
      setIsSavingTeachingAttendance(false);
    }
  };

  const fetchTeachingAttendanceReport = useCallback(async () => {
    if (!classData.classId || !activeTeachingSubject) return;
    const res = await fetch(`/api/teaching-attendance/summary?month=${teachingAttendanceMonth}&subject=${encodeURIComponent(activeTeachingSubject)}&classId=${classData.classId}`);
    if (res.ok) setTeachingAttendanceReport(await res.json());
  }, [classData.classId, activeTeachingSubject, teachingAttendanceMonth]);

  useEffect(() => {
    if (activeTab === 'teaching-reports' && teachingReportCategory === 'attendance') fetchTeachingAttendanceReport();
  }, [activeTab, teachingReportCategory, fetchTeachingAttendanceReport]);

  // Advanced filters implementation
  const filteredStudents = classData.students
    .filter(student => {
      const matchSearch = student.name.toLowerCase().includes(studentSearch.toLowerCase()) || student.nisn.includes(studentSearch);
      const matchGender = studentGenderFilter === 'all' || student.gender === studentGenderFilter;
      const matchStatus = studentStatusFilter === 'all' || student.status === studentStatusFilter;
      return matchSearch && matchGender && matchStatus;
    })
    .sort((a, b) => {
      if (studentSortField === 'name-asc') {
        return a.name.localeCompare(b.name);
      } else if (studentSortField === 'name-desc') {
        return b.name.localeCompare(a.name);
      } else if (studentSortField === 'nisn-asc') {
        return a.nisn.localeCompare(b.nisn);
      }
      return 0;
    });

  const filteredAttendanceStudents = classData.students
    .filter(student => {
      if (attendanceType === 'jumat' && student.gender !== 'L') return false;
      const matchSearch = student.name.toLowerCase().includes(attendanceSearch.toLowerCase()) || student.nisn.includes(attendanceSearch);
      const matchGender = attendanceGenderFilter === 'all' || student.gender === attendanceGenderFilter;
      
      const currentStatus = attendanceMap[student.id] || (attendanceType === 'harian' ? 'Hadir' : 'Sholat');
      const matchStatus = attendanceStatusFilter === 'all' || currentStatus === attendanceStatusFilter;
      
      return matchSearch && matchGender && matchStatus;
    });

  const filteredReportData = reportData
    .filter(row => {
      const matchSearch = row.name.toLowerCase().includes(reportSearch.toLowerCase()) || row.studentId.includes(reportSearch);
      const matchGender = reportGenderFilter === 'all' || row.gender === reportGenderFilter;
      const matchFriday = reportSubTab !== 'jumat' || row.gender === 'L';
      
      let matchAlfa = true;
      if (reportAlfaFilter === 'alfa-only') {
        const item = reportSubTab === 'harian' ? row.harian : reportSubTab === 'dhuha' ? row.dhuha : reportSubTab === 'dzuhur' ? row.dzuhur : row.jumat;
        matchAlfa = item.Alfa > 0;
      } else if (reportAlfaFilter === 'no-alfa') {
        const item = reportSubTab === 'harian' ? row.harian : reportSubTab === 'dhuha' ? row.dhuha : reportSubTab === 'dzuhur' ? row.dzuhur : row.jumat;
        matchAlfa = item.Alfa === 0;
      }
      
      return matchSearch && matchGender && matchFriday && matchAlfa;
    });

  const filteredAcademicStudents = classData.students
    .filter(student => {
      const matchSearch = student.name.toLowerCase().includes(academicSearch.toLowerCase()) || student.nisn.includes(academicSearch);
      return matchSearch;
    });

  const visibleBehaviorRecords = (classData.behaviorRecords || []).filter((record) => workspaceMode !== 'teaching' || record.subject === activeTeachingSubject);
  const filteredStudentCases = studentCases.filter((item) => {
    const query = monitoringSearch.trim().toLowerCase();
    const matchesSearch = !query || item.student?.name.toLowerCase().includes(query) || item.title.toLowerCase().includes(query) || item.summary.toLowerCase().includes(query);
    const matchesStatus = monitoringStatusFilter === 'all' || item.status === monitoringStatusFilter;
    const matchesPriority = monitoringPriorityFilter === 'all' || item.priority === monitoringPriorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });
  const openStudentCases = studentCases.filter((item) => item.status !== 'selesai').length;
  const urgentStudentCases = studentCases.filter((item) => item.status !== 'selesai' && (item.priority === 'tinggi' || item.priority === 'mendesak')).length;
  const overdueStudentCases = studentCases.filter((item) => item.status !== 'selesai' && item.dueDate && item.dueDate < new Date().toISOString().slice(0, 10)).length;
  const teachingAssessments: { name: string; type: string }[] = gradesList
    .filter((grade: any) => grade.subject === activeTeachingSubject)
    .reduce((items: { name: string; type: string }[], grade: any) => (
      items.some((item) => item.name === grade.name && item.type === grade.type)
        ? items
        : [...items, { name: grade.name, type: grade.type }]
    ), []);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex-col shrink-0">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-blue-600" />
            WebKelas
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'workspace', label: 'Dashboard Saya', icon: LayoutDashboard },
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'students', label: 'Siswa', icon: Users },
            ...(userRole === 'admin' ? [{ id: 'attendance', label: 'Presensi', icon: CheckSquare }, { id: 'reports', label: 'Laporan', icon: FileText }] : []),
            ...((userRole === 'admin' || userRole === 'counselor') ? [{ id: 'monitoring', label: 'Pemantauan Siswa', icon: ShieldAlert }] : []),
            { id: 'academic', label: 'Akademik & Tugas', icon: BookOpen },
            ...(workspaceMode === 'teaching' ? [{ id: 'teaching-attendance', label: 'Presensi Mapel', icon: CheckSquare }] : []),
            ...((userRole === 'admin' || workspaceMode === 'teaching') ? [{ id: 'behavior', label: workspaceMode === 'teaching' ? 'Sikap & Karakter' : 'Sikap & Prestasi', icon: Award }] : []),
            ...(workspaceMode === 'teaching' ? [{ id: 'teaching-reports', label: 'Laporan Mengajar', icon: FileText }] : []),
            ...(userRole === 'admin' ? [{ id: 'settings', label: 'Pengaturan Halaman', icon: Settings }] : []),
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => { if (item.id === 'settings') setSettingsView('overview'); setActiveTab(item.id); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === item.id 
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="min-w-0 flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 md:px-8">
          <h2 className="text-base sm:text-xl font-semibold text-slate-800 dark:text-slate-100 truncate mr-2">
            {activeTab === 'workspace' ? 'Dashboard Saya' : activeTab === 'dashboard' ? `Ringkasan (${classData.selectedClass})` : activeTab === 'monitoring' ? 'Pemantauan Siswa' : activeTab === 'settings' ? 'Pengaturan Halaman' : activeTab === 'reports' ? 'Laporan Kelas' : activeTab === 'teaching-reports' ? 'Laporan Mengajar' : activeTab === 'teaching-attendance' ? 'Presensi Pembelajaran' : 'Manajemen Kelas'}
          </h2>
          <div className="flex items-center gap-2 sm:gap-4">
            <select
              value={classData.classId || ''}
              onChange={(event) => { if (event.target.value) classData.selectClass(event.target.value); }}
              aria-label="Pilih kelas aktif"
              className="max-w-[150px] sm:max-w-[220px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              {classData.classes.filter((item) => item.status === 'Aktif').map((item) => <option key={item.id} value={item.id}>{item.name} · {item.academicYear}</option>)}
            </select>
            {/* Dark Mode Toggle */}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              title={isDarkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
            >
              {isDarkMode ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5" />}
            </button>
            {workspaceMode === 'teaching' && <button onClick={() => { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setShowPasswordModal(true); }} className="p-2 text-slate-500 dark:text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30 rounded-full transition-colors" title="Ubah password"><Key className="h-5 w-5" /></button>}
            <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-200 dark:border-slate-700">
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold shrink-0">W</div>
              <div className="hidden sm:flex flex-col">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{userRole === 'admin' ? 'Wali Kelas' : userRole === 'counselor' ? 'BK' : 'Guru Pengajar'}</span>
                <span className="text-[10px] text-slate-400 font-mono leading-none mt-0.5">{classData.selectedClass} ({classData.selectedYear})</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Scrollable Area */}
        <div className="min-w-0 flex-1 overflow-auto p-4 pb-[calc(10rem+env(safe-area-inset-bottom))] md:p-8 md:pb-8">
          {activeTab === 'workspace' && (
            <div className="mx-auto max-w-6xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white shadow-lg dark:border-blue-900"><p className="text-sm font-semibold text-blue-100">RUANG KERJA GURU</p><h3 className="mt-1 text-2xl font-black">Selamat datang, {workspace?.user.name || 'Guru'}.</h3><p className="mt-2 max-w-2xl text-sm text-blue-100">Pilih kelas perwalian atau mata pelajaran yang Anda ampu untuk mulai bekerja.</p></div>
              {isLoadingWorkspace ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-400 dark:border-slate-700 dark:bg-slate-800">Memuat ruang kerja…</div> : <>
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold text-slate-800 dark:text-slate-100">Kelas Perwalian</h3><p className="text-xs text-slate-500">Akses penuh sebagai wali kelas.</p></div><Users className="h-5 w-5 text-blue-500" /></div>{workspace?.homeroomClasses.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{workspace.homeroomClasses.map((item) => <button key={item.id} onClick={async () => { await classData.selectClass(item.id); setWorkspaceMode('homeroom'); setActiveTeachingSubject(null); setActiveTab('dashboard'); }} className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-left transition hover:border-blue-300 hover:shadow-sm dark:border-blue-900/60 dark:bg-blue-950/20"><p className="font-bold text-slate-800 dark:text-slate-100">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.academicYear}</p><span className="mt-3 inline-block text-xs font-bold text-blue-600 dark:text-blue-400">Buka Dashboard Kelas →</span></button>)}</div> : <p className="py-4 text-sm text-slate-400">Belum ada kelas perwalian.</p>}</section>
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold text-slate-800 dark:text-slate-100">Kelas Mengajar</h3><p className="text-xs text-slate-500">Pilih kelas untuk membuka buku nilai mata pelajaran terkait.</p></div><BookOpen className="h-5 w-5 text-violet-500" /></div>{workspace?.subjectGroups.length ? <div className="space-y-5">{workspace.subjectGroups.map((group) => <div key={group.subjectId}><div className="mb-2 flex items-center gap-2"><span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">{group.subjectName}</span><span className="text-xs text-slate-400">{group.classes.length} kelas</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{group.classes.map((item) => <button key={item.assignmentId} onClick={() => openTeachingClass(item.classId, group.subjectName)} className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-violet-300 hover:shadow-sm dark:border-slate-700 dark:hover:border-violet-700"><div className="flex items-start justify-between gap-2"><p className="font-bold text-slate-800 dark:text-slate-100">{item.className}</p><span className="text-xs font-semibold text-violet-600 dark:text-violet-400">{item.academicYear}</span></div><p className="mt-2 text-xs text-slate-500">{item.studentCount} siswa · {item.gradeCount} nilai tercatat</p><span className="mt-3 inline-block text-xs font-bold text-violet-600 dark:text-violet-400">Buka Buku Nilai →</span></button>)}</div></div>)}</div> : <p className="py-5 text-sm text-slate-400">Belum ada penugasan mengajar. Tambahkan melalui Pengaturan Halaman.</p>}</section>
              </>}
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                  <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow group">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{stat.title}</p>
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{stat.value}</h3>
                      </div>
                      <div className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-700 group-hover:scale-110 transition-transform ${stat.color}`}>
                        <stat.icon className="h-6 w-6" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {userRole === 'admin' && classInsights && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6">
                  <div className="mb-5 flex items-start justify-between gap-4"><div><h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Ringkasan Pembinaan Bulan Ini</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Data membantu menentukan siswa yang perlu ditindaklanjuti dan diapresiasi.</p></div><span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">{classInsights.month}</span></div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: 'Perlu Tindak Lanjut: Alfa', item: classInsights.followUp.dailyAlfa, suffix: 'Alfa presensi harian', tone: 'rose', tab: 'attendance' },
                      { label: 'Perlu Tindak Lanjut: Ibadah', item: classInsights.followUp.prayerAlfa, suffix: 'Alfa sholat', tone: 'amber', tab: 'attendance' },
                      { label: 'Rajin Hadir', item: classInsights.appreciation.mostDiligent, suffix: 'kehadiran', tone: 'emerald', tab: 'attendance', format: (item: any) => `${item.attendanceRate}%` },
                      { label: 'Aktif & Positif', item: classInsights.appreciation.mostActive, suffix: 'poin sikap positif', tone: 'blue', tab: 'behavior', format: (item: any) => `${item.positivePoints} poin` },
                    ].map((card) => <button key={card.label} onClick={() => setActiveTab(card.tab)} className={`rounded-xl border p-4 text-left transition hover:shadow-sm ${card.tone === 'rose' ? 'border-rose-100 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/15' : card.tone === 'amber' ? 'border-amber-100 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/15' : card.tone === 'emerald' ? 'border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/15' : 'border-blue-100 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/15'}`}>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{card.label}</p>
                      {card.item ? <><p className="mt-2 truncate text-base font-bold text-slate-800 dark:text-slate-100">{card.item.name}</p><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{card.format ? card.format(card.item) : `${card.item[card.label.includes('Ibadah') ? 'prayerAlfa' : 'dailyAlfa']} ${card.suffix}`}</p></> : <p className="mt-2 text-sm font-medium text-slate-400">Belum ada data pembeda</p>}
                    </button>)}
                  </div>
                </section>
              )}

              <div className="md:hidden bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4"><div><h3 className="font-bold text-slate-800 dark:text-slate-100">Hari Ini</h3><p className="text-xs text-slate-400">Informasi kelas terkini</p></div><span className="text-xs font-bold px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">{['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date().getDay()]}</span></div>
                <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-700/50 rounded-xl mb-4"><button onClick={() => setMobileDashboardPanel('schedule')} className={`py-2 text-xs font-bold rounded-lg ${mobileDashboardPanel === 'schedule' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}>Jadwal</button><button onClick={() => setMobileDashboardPanel('agenda')} className={`py-2 text-xs font-bold rounded-lg ${mobileDashboardPanel === 'agenda' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}>Agenda</button></div>
                {mobileDashboardPanel === 'schedule' ? <div className="space-y-2">{(classData.schedules || []).filter((schedule) => schedule.day === ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date().getDay()]).sort((a, b) => a.timeStart.localeCompare(b.timeStart)).slice(0, 2).map((schedule) => <div key={schedule.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700"><span className="w-10 text-xs font-bold text-blue-600 dark:text-blue-400">{schedule.timeStart}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{schedule.subject}</p><p className="text-xs text-slate-400 truncate">{schedule.teacherName || 'Guru belum diatur'}</p></div></div>) || <p className="py-5 text-center text-sm text-slate-400">Tidak ada jadwal hari ini.</p>}<button onClick={() => { setActiveTab('academic'); setAcademicSubTab('schedule'); }} className="w-full pt-2 text-xs font-bold text-blue-600 dark:text-blue-400">Lihat semua jadwal →</button></div> : <div className="space-y-2">{classData.agenda.slice(0, 2).map((item) => <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700"><div className="w-10 text-center text-blue-600 dark:text-blue-400"><p className="text-[9px] font-bold uppercase">{item.date.split(' ')[1]}</p><p className="text-lg leading-none font-black">{item.date.split(' ')[0]}</p></div><div className="min-w-0"><p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{item.title}</p><p className="text-xs text-slate-400">{item.type}</p></div></div>)}<button onClick={() => setActiveTab('settings')} className="w-full pt-2 text-xs font-bold text-blue-600 dark:text-blue-400">Lihat semua agenda →</button></div>}
              </div>

              {/* Charts & Activity Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="col-span-2 space-y-6">
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex justify-between items-center">
                      Pengumuman Berjalan (Landing Page)
                    </h3>
                    <div className="space-y-4">
                      {classData.announcements.map((ann) => (
                        <div key={ann.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 flex gap-4">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <Megaphone className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <span className={`font-bold text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 ${ann.type === 'PENTING' ? 'text-orange-500' : ann.type === 'INFO' ? 'text-blue-500' : 'text-emerald-500'}`}>{ann.type}</span>
                            <p className="text-sm text-slate-700 dark:text-slate-300 mt-2">{ann.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Statistik Widget (Harian / Mingguan / Bulanan) */}
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                        Statistik Presensi Kelas
                      </h3>
                      
                      <div className="flex bg-slate-100 dark:bg-slate-700/50 p-1 rounded-xl w-fit">
                        {(['harian', 'mingguan', 'bulanan'] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setStatsTab(tab)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                              statsTab === tab
                                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                    </div>

                    {isLoadingStats || !classStats ? (
                      <div className="text-center py-6 text-slate-400 text-sm">Loading data statistik...</div>
                    ) : (
                      (() => {
                        const data = classStats[statsTab === 'harian' ? 'daily' : statsTab === 'mingguan' ? 'weekly' : 'monthly'];
                        
                        const harianTotal = data.harian.total;
                        const harianHadirPct = harianTotal > 0 ? Math.round((data.harian.Hadir / harianTotal) * 100) : 0;
                        const harianSakitPct = harianTotal > 0 ? Math.round((data.harian.Sakit / harianTotal) * 100) : 0;
                        const harianIzinPct = harianTotal > 0 ? Math.round((data.harian.Izin / harianTotal) * 100) : 0;
                        const harianAlfaPct = harianTotal > 0 ? Math.round((data.harian.Alfa / harianTotal) * 100) : 0;

                        const dhuhaTotal = data.dhuha.total;
                        const dhuhaSholat = data.dhuha.Berjamaah + data.dhuha.Munfarid;
                        const dhuhaSholatPct = dhuhaTotal > 0 ? Math.round((dhuhaSholat / dhuhaTotal) * 100) : 0;

                        const dzuhurTotal = data.dzuhur.total;
                        const dzuhurSholat = data.dzuhur.Berjamaah + data.dzuhur.Munfarid;
                        const dzuhurSholatPct = dzuhurTotal > 0 ? Math.round((dzuhurSholat / dzuhurTotal) * 100) : 0;

                        const jumatTotal = data.jumat.total;
                        const jumatSholat = data.jumat.Berjamaah + data.jumat.Munfarid;
                        const jumatSholatPct = jumatTotal > 0 ? Math.round((jumatSholat / jumatTotal) * 100) : 0;

                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                            {/* Harian Card */}
                            <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 space-y-3">
                              <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                <span>Presensi Harian</span>
                                <span className="text-xs text-slate-400 font-normal">Tot: {harianTotal}</span>
                              </h4>
                              
                              <div className="space-y-2">
                                {/* Hadir */}
                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Hadir</span>
                                    <span className="font-semibold text-emerald-600">{data.harian.Hadir} ({harianHadirPct}%)</span>
                                  </div>
                                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${harianHadirPct}%` }} />
                                  </div>
                                </div>
                                {/* Sakit */}
                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Sakit</span>
                                    <span className="font-semibold text-amber-500">{data.harian.Sakit} ({harianSakitPct}%)</span>
                                  </div>
                                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${harianSakitPct}%` }} />
                                  </div>
                                </div>
                                {/* Izin */}
                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Izin</span>
                                    <span className="font-semibold text-blue-500">{data.harian.Izin} ({harianIzinPct}%)</span>
                                  </div>
                                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${harianIzinPct}%` }} />
                                  </div>
                                </div>
                                {/* Alfa */}
                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Alfa</span>
                                    <span className="font-semibold text-red-500">{data.harian.Alfa} ({harianAlfaPct}%)</span>
                                  </div>
                                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500 rounded-full" style={{ width: `${harianAlfaPct}%` }} />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Sholat Dhuha Card */}
                            <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 space-y-3">
                              <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                <span>Sholat Dhuha</span>
                                <span className="text-xs text-slate-400 font-normal">Tot: {dhuhaTotal}</span>
                              </h4>
                              
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-500">Sholat</span>
                                  <span className="font-semibold text-emerald-600">{dhuhaSholat}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-500">Berhalangan</span>
                                  <span className="font-semibold text-purple-500">{data.dhuha.Berhalangan}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-500">Alfa</span>
                                  <span className="font-semibold text-red-500">{data.dhuha.Alfa}</span>
                                </div>
                                
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50 space-y-1">
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-400 font-medium">Tingkat Sholat</span>
                                    <span className="font-bold text-emerald-600">{dhuhaSholatPct}%</span>
                                  </div>
                                  <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${dhuhaSholatPct}%` }} />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Sholat Dzuhur Card */}
                            <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 space-y-3">
                              <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                <span>Sholat Dzuhur</span>
                                <span className="text-xs text-slate-400 font-normal">Tot: {dzuhurTotal}</span>
                              </h4>
                              
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-500">Sholat</span>
                                  <span className="font-semibold text-emerald-600">{dzuhurSholat}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-500">Berhalangan</span>
                                  <span className="font-semibold text-purple-500">{data.dzuhur.Berhalangan}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-500">Alfa</span>
                                  <span className="font-semibold text-red-500">{data.dzuhur.Alfa}</span>
                                </div>
                                
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50 space-y-1">
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-400 font-medium">Tingkat Sholat</span>
                                    <span className="font-bold text-purple-600">{dzuhurSholatPct}%</span>
                                  </div>
                                  <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${dzuhurSholatPct}%` }} />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Sholat Jumat Card (siswa laki-laki) */}
                            <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 space-y-3">
                              <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                <span>Sholat Jumat</span>
                                <span className="text-xs text-slate-400 font-normal">Tot: {jumatTotal}</span>
                              </h4>
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs"><span className="text-slate-500">Sholat</span><span className="font-semibold text-emerald-600">{jumatSholat}</span></div>
                                <div className="flex justify-between text-xs"><span className="text-slate-500">Alfa</span><span className="font-semibold text-red-500">{data.jumat.Alfa}</span></div>
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50 space-y-1"><div className="flex justify-between text-[11px]"><span className="text-slate-400 font-medium">Tingkat Sholat</span><span className="font-bold text-sky-600">{jumatSholatPct}%</span></div><div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-sky-500 rounded-full" style={{ width: `${jumatSholatPct}%` }} /></div></div>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>

                {/* Jadwal Pelajaran Hari Ini Widget */}
                <div className="hidden md:block col-span-1 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-600" />
                      Jadwal Pelajaran
                    </h3>
                    <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
                      {(() => {
                        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                        const todayIndex = new Date().getDay();
                        return days[todayIndex];
                      })()}
                    </span>
                  </div>

                  {(() => {
                    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                    const todayName = days[new Date().getDay()];
                    
                    // Filter schedules for today
                    const todaySchedules = (classData.schedules || []).filter(s => s.day === todayName)
                      .sort((a, b) => a.timeStart.localeCompare(b.timeStart));

                    if (todaySchedules.length === 0) {
                      return (
                        <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                          <p className="text-xs text-slate-400 dark:text-slate-500 italic">Tidak ada jadwal hari ini</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {todaySchedules.map((sched) => {
                          const borderColors: Record<string, string> = {
                            blue: 'border-l-blue-500',
                            emerald: 'border-l-emerald-500',
                            amber: 'border-l-amber-500',
                            rose: 'border-l-rose-500',
                            indigo: 'border-l-indigo-500',
                            violet: 'border-l-violet-500',
                          };
                          const colorStyle = borderColors[sched.color] || borderColors.blue;

                          return (
                            <div key={sched.id} className={`p-3 rounded-r-xl border-l-4 border bg-slate-50/50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-700/50 ${colorStyle} flex justify-between items-center`}>
                              <div>
                                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">{sched.subject}</h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-450 mt-0.5">{sched.timeStart} - {sched.timeEnd}</p>
                              </div>
                              {sched.teacherName && (
                                <span className="text-[9px] font-medium text-slate-500 bg-slate-200 dark:bg-slate-750 dark:text-slate-400 px-2 py-0.5 rounded-full max-w-[110px] truncate" title={sched.teacherName}>
                                  {sched.teacherName.split(',')[0]}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <button 
                    onClick={() => {
                      setActiveTab('academic');
                      setAcademicSubTab('schedule');
                    }}
                    className="w-full text-center text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline pt-1 block"
                  >
                    Lihat Selengkapnya &rarr;
                  </button>
                </div>

                <div className="hidden md:block col-span-1 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Agenda Terdekat</h3>
                  <div className="space-y-4">
                    {classData.agenda.map((item) => (
                      <div key={item.id} className="flex items-start gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                        <div className="flex flex-col items-center justify-center text-blue-600 dark:text-blue-400 min-w-10">
                          <span className="text-[10px] font-semibold uppercase">{item.date.split(' ')[1]}</span>
                          <span className="text-xl font-bold">{item.date.split(' ')[0]}</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-slate-800 dark:text-slate-200">{item.title}</h4>
                          <p className="text-xs text-slate-500">{item.type}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
              {settingsView === 'overview' ? <div className="space-y-6"><div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white shadow-lg dark:border-violet-900"><p className="text-xs font-bold uppercase tracking-wider text-violet-100">Pengaturan</p><h3 className="mt-1 text-2xl font-black">Aksi Cepat</h3><p className="mt-2 text-sm text-violet-100">Pilih bagian yang ingin dikelola tanpa memuat seluruh pengaturan sekaligus.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[
                { title: 'Kelas & Guru', description: `${classData.classes.length} kelas · ${teachers.length} guru · ${teachingAssignments.length} penugasan`, icon: Users, color: 'text-blue-600', action: () => openSettingsSection('teaching') },
                { title: 'Konten Landing Page', description: 'Hero, foto wali, kutipan, mading, dan agenda', icon: ImageIcon, color: 'text-cyan-600', action: () => openSettingsSection('landing') },
                { title: 'Galeri Kelas', description: `${classData.galleryItems.length} momen kelas`, icon: ImageIcon, color: 'text-pink-600', action: () => openSettingsSection('gallery') },
                { title: 'Pengurus Kelas', description: `${classData.officers.length} jabatan terisi dan tugas jabatan`, icon: Award, color: 'text-emerald-600', action: () => openSettingsSection('officers') },
                { title: 'Profil Kelas', description: 'Nama kelas dan tahun ajaran aktif', icon: Settings, color: 'text-indigo-600', action: () => openSettingsSection('profile') },
              ].map((item) => <button key={item.title} onClick={item.action} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800"><item.icon className={`h-6 w-6 ${item.color}`} /><h4 className="mt-4 font-bold text-slate-800 dark:text-slate-100">{item.title}</h4><p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{item.description}</p><span className="mt-4 inline-block text-xs font-bold text-violet-600 dark:text-violet-400">Buka pengaturan →</span></button>)}</div></div> : <><div className="flex items-center justify-between"><div><h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{({ teaching: 'Kelas & Guru', landing: 'Konten Landing Page', gallery: 'Galeri Kelas', officers: 'Pengurus Kelas', profile: 'Profil Kelas' } as const)[settingsView]}</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Kelola konfigurasi yang dipilih, lalu kembali ke aksi cepat.</p></div><button onClick={() => setSettingsView('overview')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">← Aksi Cepat</button></div><div id="settings-teaching" className={`${settingsView === 'teaching' ? '' : 'hidden '}bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-6 scroll-mt-6`}>
                <div><h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Kelas & Penugasan Mengajar</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Kelola rombel, guru pengajar, dan akses mata pelajaran per kelas.</p></div>
                <div className="grid gap-6 lg:grid-cols-2">
                  <section className="space-y-3"><h4 className="font-semibold text-slate-700 dark:text-slate-200">Master Kelas</h4><div className="grid grid-cols-2 gap-2"><input value={newClassName} onChange={(event) => setNewClassName(event.target.value)} placeholder="Contoh: XI TKJ B" className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600" /><input value={newClassYear} onChange={(event) => setNewClassYear(event.target.value)} placeholder={classData.selectedYear || '2026-2027'} className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600" /></div><button onClick={async () => { const name = newClassName.trim(), academicYear = newClassYear.trim() || classData.selectedYear || ''; if (!name || !academicYear) return; const response = await fetch('/api/classes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, academicYear }) }); if (!response.ok) return alert((await response.json()).error || 'Gagal menambah kelas.'); setNewClassName(''); setNewClassYear(''); await classData.selectClass(classData.classId || ''); }} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" />Tambah Kelas</button><div className="space-y-2">{classData.classes.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900/40"><button onClick={() => classData.selectClass(item.id)} className="text-left"><span className="font-medium text-slate-800 dark:text-slate-100">{item.name}</span><span className="ml-2 text-xs text-slate-400">{item.academicYear}</span></button>{item.id !== classData.classId && <button onClick={async () => { if (!confirm(`Hapus kelas ${item.name}?`)) return; const response = await fetch(`/api/classes/${item.id}`, { method: 'DELETE' }); if (!response.ok) return alert((await response.json()).error || 'Gagal menghapus kelas.'); await classData.selectClass(classData.classId || ''); }} className="text-red-500"><Trash2 className="h-4 w-4" /></button>}</div>)}</div></section>
                  <section className="space-y-3"><h4 className="font-semibold text-slate-700 dark:text-slate-200">Guru & BK</h4><div className="grid gap-2 sm:grid-cols-3"><input value={newTeacherName} onChange={(event) => setNewTeacherName(event.target.value)} placeholder="Nama akun" className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600" /><input value={newTeacherIdentifier} onChange={(event) => setNewTeacherIdentifier(event.target.value)} placeholder="NIP / username" className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600" /><select value={newAccountRole} onChange={(event) => setNewAccountRole(event.target.value as 'teacher' | 'counselor')} className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600"><option value="teacher">Guru Pengajar</option><option value="counselor">BK</option></select></div><button onClick={async () => { if (!newTeacherName.trim() || !newTeacherIdentifier.trim()) return; const response = await fetch('/api/teachers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newTeacherName, identifier: newTeacherIdentifier, accountRole: newAccountRole }) }); if (!response.ok) return alert((await response.json()).error || 'Gagal menambah akun.'); setNewTeacherName(''); setNewTeacherIdentifier(''); setNewAccountRole('teacher'); fetchTeachingSetup(); }} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" />Tambah Akun</button><div className="space-y-2">{teachers.length ? teachers.map((teacher) => <div key={teacher.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900/40"><span><span className="font-medium text-slate-800 dark:text-slate-100">{teacher.name}</span><span className="ml-2 text-xs text-slate-400">{teacher.identifier}</span><span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${teacher.primaryRole === 'counselor' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'}`}>{teacher.primaryRole === 'counselor' ? 'BK' : 'Guru'}</span></span><button onClick={async () => { if (!confirm(`Hapus akun ${teacher.name}?`)) return; const response = await fetch(`/api/teachers/${teacher.id}`, { method: 'DELETE' }); if (!response.ok) return alert((await response.json()).error || 'Gagal menghapus akun.'); fetchTeachingSetup(); }} className="text-red-500"><Trash2 className="h-4 w-4" /></button></div>) : <p className="py-3 text-center text-xs text-slate-400">Belum ada akun guru atau BK.</p>}</div></section>
                </div>
                <section className="border-t border-slate-100 pt-5 dark:border-slate-700"><h4 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Penugasan Mengajar</h4><div className="grid gap-2 md:grid-cols-4"><select value={assignmentTeacherId} onChange={(event) => setAssignmentTeacherId(event.target.value)} className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600"><option value="">Pilih guru</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select><select value={assignmentClassId} onChange={(event) => setAssignmentClassId(event.target.value)} className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600"><option value="">Pilih kelas</option>{classData.classes.filter((item) => item.status === 'Aktif').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={assignmentSubjectId} onChange={(event) => setAssignmentSubjectId(event.target.value)} className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600"><option value="">Pilih mapel</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select><button onClick={async () => { const currentClass = classData.classes.find((item) => item.id === assignmentClassId); if (!assignmentTeacherId || !assignmentClassId || !assignmentSubjectId || !currentClass) return; const response = await fetch('/api/teaching-assignments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId: assignmentTeacherId, classId: assignmentClassId, subjectId: assignmentSubjectId, academicYear: currentClass.academicYear }) }); if (!response.ok) return alert((await response.json()).error || 'Gagal menyimpan penugasan.'); setAssignmentTeacherId(''); setAssignmentClassId(''); setAssignmentSubjectId(''); fetchTeachingSetup(); }} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white"><Save className="mr-1 inline h-4 w-4" />Tetapkan</button></div><div className="mt-3 space-y-2">{teachingAssignments.length ? teachingAssignments.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-slate-700"><span className="text-slate-700 dark:text-slate-200"><b>{item.teacherName}</b> · {item.subjectName} · {item.className} <span className="text-xs text-slate-400">({item.academicYear})</span></span><button onClick={async () => { if (!confirm('Hapus penugasan ini?')) return; await fetch(`/api/teaching-assignments/${item.id}`, { method: 'DELETE' }); fetchTeachingSetup(); }} className="text-red-500"><Trash2 className="h-4 w-4" /></button></div>) : <p className="py-3 text-center text-xs text-slate-400">Belum ada penugasan mengajar.</p>}</div></section>
              </div>
              <div id="settings-hero" className={`${settingsView === 'landing' ? '' : 'hidden '}bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 scroll-mt-6`}>
                <div className="flex items-start gap-3 mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
                  <span className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"><ImageIcon className="h-5 w-5" /></span>
                  <div><h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Gambar Hero Landing Page</h3><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Gunakan URL gambar HTTPS atau path aset internal, misalnya <code>/gambar-kelas.jpg</code>.</p></div>
                </div>
                <div className="grid md:grid-cols-[180px_1fr] gap-5 items-start">
                  <div className="aspect-square rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900">
                    <img src={heroImageUrl || '/hero-default.svg'} alt="Pratinjau gambar hero" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.src = '/hero-default.svg'; }} />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400">URL Gambar</label>
                    <input value={heroImageUrl} onChange={(event) => setHeroImageUrl(event.target.value)} placeholder="https://contoh.sch.id/gambar-kelas.jpg" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-4 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                    <div className="flex flex-wrap gap-2">
                      <button onClick={async () => { try { await classData.updateHeroImage(heroImageUrl); alert('Gambar hero berhasil disimpan.'); } catch (error) { alert(error instanceof Error ? error.message : 'Gagal menyimpan gambar hero.'); } }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"><Save className="h-4 w-4" /> Simpan Gambar</button>
                      <button onClick={async () => { if (!confirm('Kembalikan gambar hero ke gambar default?')) return; try { await classData.resetHeroImage(); alert('Gambar hero dikembalikan ke default.'); } catch { alert('Gagal mengembalikan gambar default.'); } }} className="px-4 py-2 rounded-lg font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Gunakan Default</button>
                    </div>
                  </div>
                </div>
              </div>

              <div id="settings-gallery" className={`${settingsView === 'gallery' ? '' : 'hidden '}bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 scroll-mt-6`}>
                <div className="flex items-start gap-3 mb-4 border-b border-slate-100 dark:border-slate-700 pb-3"><span className="p-2 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400"><ImageIcon className="h-5 w-5" /></span><div><h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Galeri Momen Kelas</h3><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tambahkan dokumentasi kegiatan kelas melalui URL gambar.</p></div></div>
                <div className="grid gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-xs font-medium text-slate-500">Judul</label><input value={galleryTitle} onChange={(event) => setGalleryTitle(event.target.value)} placeholder="Contoh: Kegiatan Projek P5" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none" /></div><div><label className="mb-1 block text-xs font-medium text-slate-500">URL Gambar</label><input value={galleryImageUrl} onChange={(event) => setGalleryImageUrl(event.target.value)} placeholder="https://contoh.sch.id/kegiatan.jpg" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none" /></div><div className="sm:col-span-2"><label className="mb-1 block text-xs font-medium text-slate-500">Keterangan (opsional)</label><input value={galleryDescription} onChange={(event) => setGalleryDescription(event.target.value)} placeholder="Deskripsi singkat kegiatan" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none" /></div></div>
                <div className="mt-3 flex flex-wrap gap-3"><button disabled={!galleryTitle.trim() || !galleryImageUrl.trim()} onClick={async () => { try { await classData.addGalleryItem({ title: galleryTitle, imageUrl: galleryImageUrl, description: galleryDescription }); setGalleryTitle(''); setGalleryImageUrl(''); setGalleryDescription(''); alert('Foto galeri berhasil ditambahkan.'); } catch (error) { alert(error instanceof Error ? error.message : 'Gagal menambah foto galeri.'); } }} className="flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2 font-medium text-white transition-colors hover:bg-pink-700 disabled:opacity-50"><Plus className="h-4 w-4" /> Tambah Foto</button>{galleryImageUrl && <img src={galleryImageUrl} alt="Pratinjau galeri" className="h-10 w-10 rounded-lg object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}</div>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{classData.galleryItems.length === 0 ? <p className="col-span-full py-3 text-center text-sm text-slate-400">Belum ada foto galeri.</p> : classData.galleryItems.map((item) => <div key={item.id} className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"><img src={item.imageUrl} alt={item.title} className="aspect-square w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} /><div className="p-2"><p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{item.title}</p></div><button onClick={async () => { if (!confirm(`Hapus foto "${item.title}"?`)) return; try { await classData.removeGalleryItem(item.id); } catch { alert('Gagal menghapus foto galeri.'); } }} className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-red-500 opacity-0 shadow transition-opacity group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button></div>)}</div>
              </div>

              <div id="settings-homeroom-photo" className={`${settingsView === 'landing' ? '' : 'hidden '}bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 scroll-mt-6`}>
                <div className="flex items-start gap-3 mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
                  <span className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400"><ImageIcon className="h-5 w-5" /></span>
                  <div><h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Foto Wali Kelas</h3><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Foto ini tampil pada card wali kelas di landing page.</p></div>
                </div>
                <div className="grid md:grid-cols-[112px_1fr] gap-5 items-start">
                  <img src={homeroomTeacherPhotoUrl || '/wali-kelas-placeholder.svg'} alt="Pratinjau foto wali kelas" className="h-28 w-28 rounded-full border-4 border-slate-100 dark:border-slate-700 object-cover bg-slate-100 dark:bg-slate-900" onError={(event) => { event.currentTarget.src = '/wali-kelas-placeholder.svg'; }} />
                  <div className="space-y-3"><label className="block text-sm font-medium text-slate-600 dark:text-slate-400">URL Foto</label><input value={homeroomTeacherPhotoUrl} onChange={(event) => setHomeroomTeacherPhotoUrl(event.target.value)} placeholder="https://contoh.sch.id/foto-wali-kelas.jpg" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-4 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" /><div className="flex flex-wrap gap-2"><button onClick={async () => { try { await classData.updateHomeroomTeacherPhoto(homeroomTeacherPhotoUrl); alert('Foto wali kelas berhasil disimpan.'); } catch (error) { alert(error instanceof Error ? error.message : 'Gagal menyimpan foto wali kelas.'); } }} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"><Save className="h-4 w-4" /> Simpan Foto</button><button onClick={async () => { if (!confirm('Kembalikan ke foto placeholder?')) return; try { await classData.resetHomeroomTeacherPhoto(); alert('Foto placeholder digunakan kembali.'); } catch { alert('Gagal mengembalikan foto placeholder.'); } }} className="px-4 py-2 rounded-lg font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Gunakan Placeholder</button></div></div>
                </div>
              </div>

              <div id="settings-officers" className={`${settingsView === 'officers' ? '' : 'hidden '}bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700`}>
                <div className="flex items-start gap-3 mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
                  <span className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"><Users className="h-5 w-5" /></span>
                  <div><h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Pengurus Kelas</h3><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tetapkan siswa aktif sebagai pengurus. Memakai jabatan yang sama akan mengganti penugasannya.</p></div>
                </div>
                <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end mb-5">
                  <div><label className="block text-xs font-medium text-slate-500 mb-1">Jabatan</label><input value={officerRole} onChange={(event) => setOfficerRole(event.target.value)} placeholder="Contoh: Ketua Kelas" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="block text-xs font-medium text-slate-500 mb-1">Siswa Aktif</label><select value={officerStudentId} onChange={(event) => setOfficerStudentId(event.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500">{classData.students.filter((student) => student.status === 'Aktif').map((student) => <option key={student.id} value={student.id}>{student.name} — {student.nisn}</option>)}</select></div>
                  <button disabled={!officerRole.trim() || !officerStudentId} onClick={async () => { try { await classData.saveClassOfficer(officerStudentId, officerRole); alert('Pengurus kelas berhasil disimpan.'); } catch (error) { alert(error instanceof Error ? error.message : 'Gagal menyimpan pengurus kelas.'); } }} className="flex justify-center items-center gap-2 bg-emerald-600 disabled:opacity-50 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"><Save className="h-4 w-4" /> Simpan</button>
                </div>
                <div className="space-y-2">
                  {classData.officers.length === 0 ? <p className="py-4 text-center text-sm text-slate-400">Belum ada pengurus kelas.</p> : classData.officers.map((officer) => <div key={officer.id} className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-4 py-3"><div className="h-9 w-9 shrink-0 rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 grid place-items-center font-bold">{officer.name.slice(0, 1)}</div><div className="min-w-0 flex-1"><p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{officer.name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{officer.role}</p></div><button onClick={() => { setOfficerRole(officer.role); setOfficerStudentId(officer.userId); }} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg" title="Ubah penugasan"><Edit2 className="h-4 w-4" /></button><button onClick={async () => { if (!confirm(`Hapus jabatan ${officer.role}?`)) return; try { await classData.removeClassOfficer(officer.id); } catch { alert('Gagal menghapus pengurus kelas.'); } }} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg" title="Hapus jabatan"><Trash2 className="h-4 w-4" /></button></div>)}
                </div>
              </div>
              
              {/* Quote Settings */}
              <div id="settings-quote" className={`${settingsView === 'landing' ? '' : 'hidden '}bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700`}>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Kutipan Motivasi</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Teks Kutipan</label>
                    <textarea 
                      value={quoteText}
                      onChange={e => setQuoteText(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-4 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none h-24"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Tokoh / Penulis</label>
                    <input 
                      type="text"
                      value={quoteAuthor}
                      onChange={e => setQuoteAuthor(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-4 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <button onClick={handleSaveQuote} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                    <Save className="h-4 w-4" /> Simpan Kutipan
                  </button>
                </div>
              </div>

              {/* Announcements Settings */}
              <div id="settings-announcements" className={`${settingsView === 'landing' ? '' : 'hidden '}bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700`}>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Mading Pengumuman</h3>
                
                <div className="mb-6 flex gap-3 items-end">
                  <div className="w-1/4">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Tipe</label>
                    <select value={newAnnType} onChange={e => setNewAnnType(e.target.value as any)} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-slate-800 dark:text-slate-200 outline-none">
                      <option value="INFO">INFO</option>
                      <option value="PENTING">PENTING</option>
                      <option value="SELAMAT">SELAMAT</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Isi Pengumuman</label>
                    <input type="text" value={newAnnText} onChange={e => setNewAnnText(e.target.value)} placeholder="Tulis pengumuman baru..." className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-4 py-2 text-slate-800 dark:text-slate-200 outline-none" />
                  </div>
                  <button onClick={handleAddAnnouncement} className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-lg transition-colors">
                    <Plus className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-2">
                  {classData.announcements.map(ann => (
                    <div key={ann.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold px-2 py-1 rounded bg-slate-200 dark:bg-slate-700">{ann.type}</span>
                        <span className="text-sm text-slate-700 dark:text-slate-300">{ann.text}</span>
                      </div>
                      <button onClick={() => classData.removeAnnouncement(ann.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Agenda Settings */}
              <div id="settings-agenda" className={`${settingsView === 'landing' ? '' : 'hidden '}bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700`}>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Manajemen Agenda</h3>
                
                <div className="mb-6 flex gap-3 items-end">
                  <div className="w-1/4">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Tanggal (misal: 15 Okt)</label>
                    <input type="text" value={newAgendaDate} onChange={e => setNewAgendaDate(e.target.value)} placeholder="ex: 12 Nov" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-slate-800 dark:text-slate-200 outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Judul Agenda</label>
                    <input type="text" value={newAgendaTitle} onChange={e => setNewAgendaTitle(e.target.value)} placeholder="ex: Ujian Fisika" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-4 py-2 text-slate-800 dark:text-slate-200 outline-none" />
                  </div>
                  <div className="w-1/5">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Tipe</label>
                    <input type="text" value={newAgendaType} onChange={e => setNewAgendaType(e.target.value)} placeholder="Kegiatan" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-slate-800 dark:text-slate-200 outline-none" />
                  </div>
                  <button onClick={handleAddAgenda} className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-lg transition-colors">
                    <Plus className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-2">
                  {classData.agenda.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-sm text-blue-600 dark:text-blue-400 w-12">{item.date}</span>
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.title}</p>
                          <p className="text-xs text-slate-500">{item.type}</p>
                        </div>
                      </div>
                      <button onClick={() => classData.removeAgenda(item.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </>}</div>
          )}

          {activeTab === 'students' && (
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Daftar Siswa</h3><span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{classData.selectedClass} · {classData.selectedYear}</span></div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{workspaceMode === 'teaching' ? `Mode Mengajar${activeTeachingSubject ? ` · ${activeTeachingSubject}` : ''} — daftar siswa hanya dapat dilihat.` : 'Mode Wali Kelas — kelola data siswa pada kelas aktif.'}</p>
                </div>
                {canManageStudents && <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={handleDownloadTemplate}
                    aria-label="Unduh Template"
                    title="Unduh Template"
                    className="flex items-center justify-center gap-0 sm:gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-2.5 sm:px-3.5 py-2 rounded-lg font-medium text-xs transition-colors shadow-sm"
                  >
                    <Download className="h-4 w-4" /> <span className="hidden sm:inline">Unduh Template</span>
                  </button>
                  <label aria-label="Impor CSV" title="Impor CSV" className="flex items-center justify-center gap-0 sm:gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 sm:px-3.5 py-2 rounded-lg font-medium text-xs transition-colors cursor-pointer shadow-sm">
                    <Upload className="h-4 w-4" /> <span className="hidden sm:inline">Impor CSV</span>
                    <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
                  </label>
                  <button 
                    onClick={() => {
                      setManualNisn('');
                      setManualName('');
                      setManualGender('L');
                      setManualStatus('Aktif');
                      setEditingStudent(null);
                      setShowAddModal(true);
                    }}
                    aria-label="Tambah Manual"
                    title="Tambah Manual"
                    className="flex items-center justify-center gap-0 sm:gap-2 bg-blue-600 hover:bg-blue-700 text-white px-2.5 sm:px-3.5 py-2 rounded-lg font-medium text-xs transition-colors shadow-sm"
                  >
                    <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Tambah Manual</span>
                  </button>
                </div>}
              </div>

              {/* Search & Filter Bar for Students */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Cari berdasarkan nama atau NISN..."
                    className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Gender:</span>
                    <select
                      value={studentGenderFilter}
                      onChange={(e) => setStudentGenderFilter(e.target.value as any)}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="all">Semua</option>
                      <option value="L">Laki-laki (L)</option>
                      <option value="P">Perempuan (P)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Status:</span>
                    <select
                      value={studentStatusFilter}
                      onChange={(e) => setStudentStatusFilter(e.target.value as any)}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="all">Semua</option>
                      <option value="Aktif">Aktif</option>
                      <option value="Nonaktif">Nonaktif</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Urutan:</span>
                    <select
                      value={studentSortField}
                      onChange={(e) => setStudentSortField(e.target.value as any)}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="name-asc">Nama (A-Z)</option>
                      <option value="name-desc">Nama (Z-A)</option>
                      <option value="nisn-asc">NISN</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="min-w-0 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="block w-0 min-w-full max-w-full overflow-x-auto overscroll-x-contain touch-pan-x touch-pan-y [-webkit-overflow-scrolling:touch]">
                <table className="w-max min-w-[720px] text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4">NISN</th>
                      <th className="px-6 py-4">Nama Lengkap</th>
                      <th className="px-6 py-4">L/P</th>
                      <th className="px-6 py-4">Status</th>
                      {canManageStudents && <th className="px-6 py-4 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={canManageStudents ? 5 : 4} className="text-center py-8 text-slate-400">Tidak ada data siswa yang cocok dengan filter.</td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs">{student.nisn}</td>
                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{student.name}</td>
                        <td className="px-6 py-4">{student.gender}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${student.status === 'Aktif' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                            {student.status}
                          </span>
                        </td>
                        {canManageStudents && <td className="px-6 py-4 text-right">
                          <button onClick={() => handleResetPassword(student.name)} className="text-slate-400 hover:text-amber-500 p-1 mr-1" title="Reset Password"><Key className="h-4 w-4" /></button>
                          <button 
                            onClick={() => {
                              setManualNisn(student.nisn);
                              setManualName(student.name);
                              setManualGender(student.gender);
                              setManualStatus(student.status);
                              setEditingStudent(student);
                              setShowAddModal(true);
                            }}
                            className="text-slate-400 hover:text-blue-500 p-1" 
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={async () => {
                              const isConfirmed = window.confirm(`Nonaktifkan ${student.name}? Data presensi, nilai, sikap, dan prestasi tetap tersimpan.`);
                              if (isConfirmed) {
                                await classData.removeStudent(student.id);
                                alert('Status siswa berhasil diubah menjadi Nonaktif.');
                              }
                            }}
                            className="text-slate-400 hover:text-amber-500 p-1 ml-1"
                            title="Nonaktifkan siswa"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                          <button
                            onClick={async () => {
                              const isConfirmed = window.confirm(`Hapus permanen ${student.name}? Tindakan ini tidak dapat dibatalkan dan hanya tersedia bila siswa belum memiliki riwayat data.`);
                              if (!isConfirmed) return;
                              try {
                                await classData.permanentlyDeleteStudent(student.id);
                                alert('Siswa berhasil dihapus permanen.');
                              } catch (error) {
                                alert(error instanceof Error ? error.message : 'Gagal menghapus siswa.');
                              }
                            }}
                            className="text-slate-400 hover:text-red-500 p-1 ml-1"
                            title="Hapus permanen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>}
                      </tr>
                    )))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Presensi Kelas</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Kelola kehadiran harian dan ibadah siswa secara real-time.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <input 
                    type="date" 
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  />
                  
                  <div className="flex bg-slate-100 dark:bg-slate-700/50 p-1 rounded-xl">
                    {(['harian', 'dhuha', 'dzuhur', 'jumat'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setAttendanceType(type)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all ${
                          attendanceType === type
                            ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                      >
                        {type === 'harian' ? 'Harian' : type === 'dhuha' ? 'Dhuha' : type === 'dzuhur' ? 'Dzuhur' : 'Jumat'}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleMarkAllPrayerAbsent}
                    className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
                    title={attendanceType === 'jumat' ? 'Jadikan seluruh siswa laki-laki Alfa' : 'Jadikan seluruh siswa Alfa'}
                  >
                    <X className="h-4 w-4" /> Alfa Semua
                  </button>
                </div>
              </div>

              {/* Search & Filter Bar for Attendance */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={attendanceSearch}
                    onChange={(e) => setAttendanceSearch(e.target.value)}
                    placeholder="Cari nama siswa..."
                    className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Gender:</span>
                    <select
                      value={attendanceGenderFilter}
                      onChange={(e) => setAttendanceGenderFilter(e.target.value as any)}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="all">Semua</option>
                      <option value="L">Laki-laki (L)</option>
                      <option value="P">Perempuan (P)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Status Kehadiran:</span>
                    <select
                      value={attendanceStatusFilter}
                      onChange={(e) => setAttendanceStatusFilter(e.target.value as any)}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="all">Semua Status</option>
                      {attendanceType === 'harian' ? (
                        <>
                          <option value="Hadir">Hadir</option>
                          <option value="Sakit">Sakit</option>
                          <option value="Izin">Izin</option>
                          <option value="Alfa">Alfa</option>
                        </>
                      ) : (
                        <>
                          <option value="Sholat">Sholat</option>
                          <option value="Berhalangan">Berhalangan</option>
                          <option value="Alfa">Alfa</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              <div className="min-w-0 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="block w-0 min-w-full max-w-full h-[60vh] overflow-x-auto overflow-y-scroll overscroll-contain touch-pan-x touch-pan-y [-webkit-overflow-scrolling:touch] md:h-auto md:overflow-visible">
                <table className="w-full min-w-0 text-left text-sm text-slate-600 dark:text-slate-300 md:min-w-[640px]">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-700/95 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4">Nama Lengkap</th>
                      <th className="px-6 py-4">L/P</th>
                      <th className="px-6 py-4 text-center">Status Kehadiran</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {filteredAttendanceStudents.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center py-8 text-slate-400">Tidak ada data siswa yang cocok dengan filter.</td>
                      </tr>
                    ) : (
                      filteredAttendanceStudents.map((student) => {
                        const currentStatus = attendanceMap[student.id] || (attendanceType === 'harian' ? 'Hadir' : 'Sholat');
                      
                      return (
                        <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{student.name}</td>
                          <td className="px-6 py-4 font-mono text-xs">{student.gender}</td>
                          <td className="px-6 py-4">
                            <div className="flex min-w-max justify-center gap-2">
                              {attendanceType === 'harian' ? (
                                (['Hadir', 'Sakit', 'Izin', 'Alfa'] as const).map((status) => (
                                  <button
                                    key={status}
                                    onClick={() => setAttendanceMap(prev => ({ ...prev, [student.id]: status }))}
                                    aria-label={status}
                                    title={status}
                                    className={`flex h-10 w-10 items-center justify-center rounded-lg text-xs font-semibold transition-all border sm:h-auto sm:w-auto sm:px-3 sm:py-1.5 ${
                                      currentStatus === status
                                        ? status === 'Hadir'
                                          ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                          : status === 'Sakit'
                                            ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                            : status === 'Izin'
                                              ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                                              : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-250 dark:border-red-900/40'
                                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                    }`}
                                  >
                                    <span className="sm:hidden">{attendanceStatusIcon(status)}</span>
                                    <span className="hidden sm:inline">{status}</span>
                                  </button>
                                ))
                              ) : (
                                (attendanceType === 'jumat' ? ['Sholat', 'Alfa'] : ['Sholat', 'Berhalangan', 'Alfa']).map((status) => {
                                  const isDisabled = status === 'Berhalangan' && student.gender === 'L';
                                  
                                  return (
                                    <button
                                      key={status}
                                      disabled={isDisabled}
                                      onClick={() => setAttendanceMap(prev => ({ ...prev, [student.id]: status }))}
                                      className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                                        isDisabled
                                          ? 'opacity-30 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                                          : currentStatus === status
                                            ? status === 'Sholat'
                                              ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                              : status === 'Berhalangan'
                                                ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                                                : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-250 dark:border-red-900/40'
                                            : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                      }`}
                                      title={status}
                                    >
                                      {status === 'Sholat' && <Users className="h-4 w-4" />}
                                      {status === 'Berhalangan' && <Ban className="h-4 w-4" />}
                                      {status === 'Alfa' && <X className="h-4 w-4" />}
                                      <span className="hidden sm:inline">{status}</span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                  </tbody>
                </table>
                </div>
              </div>

              <div className="flex justify-end scroll-mb-40">
                <button
                  onClick={handleSaveAttendance}
                  disabled={isSavingAttendance}
                  className="flex w-full items-center justify-center gap-2 bg-blue-600 px-6 py-3 rounded-xl font-bold text-white transition-all shadow-[0_0_15px_rgba(37,99,235,0.2)] hover:bg-blue-700 hover:shadow-[0_0_25px_rgba(37,99,235,0.3)] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                >
                  <Save className="h-5 w-5" /> {isSavingAttendance ? 'Menyimpan…' : 'Simpan Presensi'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (settingsView === 'profile' || settingsView === 'officers') && (
            <div id="settings-profile" className="max-w-xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 scroll-mt-6">
              <div className={settingsView === 'profile' ? 'bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700' : 'hidden'}>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Pengaturan Halaman Kelas</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Sesuaikan nama kelas dan tahun ajaran aktif untuk kelas Anda.</p>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const target = e.target as typeof e.target & {
                    classNameInput: { value: string };
                    yearInput: { value: string };
                  };
                  try {
                    await classData.updateClassProfile(target.classNameInput.value, target.yearInput.value);
                    alert('Pengaturan kelas berhasil disimpan untuk semua browser.');
                  } catch (error) {
                    alert(error instanceof Error ? error.message : 'Gagal menyimpan pengaturan kelas.');
                  }
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nama Kelas</label>
                    <input 
                      type="text" 
                      name="classNameInput"
                      defaultValue={classData.selectedClass || ''}
                      placeholder="Contoh: XII MIPA 1"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tahun Ajaran</label>
                    <input 
                      type="text" 
                      name="yearInput"
                      defaultValue={classData.selectedYear || ''}
                      placeholder="Contoh: 2024/2025"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      required
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.2)] hover:shadow-[0_0_25px_rgba(37,99,235,0.3)] mt-4"
                  >
                    Simpan Perubahan
                  </button>
                </form>
              </div>

              <div className={settingsView === 'officers' ? 'bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700' : 'hidden'}>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Tugas Pengurus Kelas</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Tugas ini tampil melalui ikon informasi pada kartu Pengurus Kelas. Tulis satu poin tugas pada setiap baris.</p>
                <form onSubmit={async (event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  const duties = classData.officerDuties.map((duty) => ({ ...duty, description: String(formData.get(`officer-duty-${duty.key}`) || '').trim() }));
                  try {
                    await classData.updateOfficerDuties(duties);
                    alert('Tugas pengurus kelas berhasil disimpan.');
                  } catch (error) {
                    alert(error instanceof Error ? error.message : 'Gagal menyimpan tugas pengurus kelas.');
                  }
                }} className="space-y-5">
                  {classData.officerDuties.map((duty) => (
                    <div key={duty.key}>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{duty.label}</label>
                      <textarea name={`officer-duty-${duty.key}`} defaultValue={duty.description} rows={4} maxLength={1500} required className="w-full resize-y bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                    </div>
                  ))}
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all">Simpan Tugas Pengurus</button>
                </form>
              </div>
            </div>
          )}
          
          {activeTab === 'teaching-attendance' && (
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
              <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 md:flex-row md:items-center md:justify-between">
                <div><p className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Mode Mengajar</p><h3 className="mt-1 text-xl font-bold text-slate-800 dark:text-slate-100">Presensi Pembelajaran</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{activeTeachingSubject} · {classData.selectedClass}</p></div>
                <input type="date" value={teachingAttendanceDate} onChange={(event) => setTeachingAttendanceDate(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"><div className="block w-0 min-w-full max-w-full h-[60vh] overflow-x-auto overflow-y-scroll overscroll-contain touch-pan-x touch-pan-y [-webkit-overflow-scrolling:touch] md:h-auto md:overflow-visible"><table className="w-full min-w-0 text-left text-sm text-slate-600 dark:text-slate-300 md:min-w-[620px]"><thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-700/95"><tr><th className="px-5 py-4">Nama Siswa</th><th className="px-5 py-4">L/P</th><th className="px-5 py-4 text-center">Status Kehadiran</th></tr></thead><tbody>{classData.students.map((student) => { const status = teachingAttendanceMap[student.id] || 'Hadir'; return <tr key={student.id} className="border-t border-slate-100 dark:border-slate-700"><td className="px-5 py-3 font-medium">{student.name}</td><td className="px-5 py-3 text-xs">{student.gender}</td><td className="px-5 py-3"><div className="flex min-w-max justify-center gap-2">{(['Hadir', 'Sakit', 'Izin', 'Alfa'] as const).map((option) => <button key={option} onClick={() => setTeachingAttendanceMap((current) => ({ ...current, [student.id]: option }))} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${status === option ? option === 'Hadir' ? 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' : option === 'Sakit' ? 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400' : option === 'Izin' ? 'border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400' : 'border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400' : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'}`}>{option}</button>)}</div></td></tr>; })}</tbody></table></div></div>
               <div className="flex justify-end scroll-mb-40"><button onClick={handleSaveTeachingAttendance} disabled={isSavingTeachingAttendance} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto"><Save className="h-5 w-5" /> {isSavingTeachingAttendance ? 'Menyimpan…' : 'Simpan Presensi'}</button></div>
            </div>
          )}

          {activeTab === 'teaching-reports' && (
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm dark:border-blue-900/50 dark:from-slate-800 dark:to-slate-800">
                <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Mode Mengajar</p>
                    <h3 className="mt-1 text-xl font-bold text-slate-800 dark:text-slate-100">Laporan Mengajar</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Siapkan PDF untuk diserahkan secara manual kepada sekolah.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"><span className="block text-xs text-slate-400">Kelas</span><b className="text-slate-700 dark:text-slate-100">{classData.selectedClass}</b></div>
                    <div className="rounded-xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"><span className="block text-xs text-slate-400">Mata Pelajaran</span><b className="text-slate-700 dark:text-slate-100">{activeTeachingSubject || 'Belum dipilih'}</b></div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-700/60">
                  {([['grades', 'Rekap Nilai'], ['attendance', 'Presensi Mapel'], ['behavior', 'Sikap & Karakter']] as const).map(([category, label]) => (
                    <button key={category} onClick={() => setTeachingReportCategory(category)} className={`rounded-lg px-4 py-2 text-xs font-bold transition-all sm:text-sm ${teachingReportCategory === category ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800'}`}>{label}</button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Periode laporan
                  <select value={teachingReportPeriod} onChange={(event) => setTeachingReportPeriod(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                    <option>Semester Ganjil</option><option>Semester Genap</option><option>Tahun Ajaran Penuh</option>
                  </select>
                </label>
              </div>

              {teachingReportCategory === 'grades' ? (
                <div className="space-y-5">
                  <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 md:flex-row md:items-center md:justify-between">
                    <div><h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Rekap Nilai Mata Pelajaran</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Memuat komponen nilai, rata-rata, KKM, dan predikat untuk kelas serta mapel aktif.</p></div>
                    <button onClick={handlePrintTeachingGradesPDF} className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-red-700"><Printer className="h-4 w-4" /> Cetak / Simpan PDF</button>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"><div className="overflow-x-auto"><table className="w-full text-sm text-slate-600 dark:text-slate-300"><thead className="bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-5 py-4 text-left">Nama Siswa</th>{teachingAssessments.map((assessment) => <th key={`${assessment.type}-${assessment.name}`} className="px-5 py-4 text-center whitespace-nowrap">{assessment.name}</th>)}<th className="px-5 py-4 text-center">Rata-rata</th></tr></thead><tbody>{classData.students.map((student) => { const scores: (number | undefined)[] = teachingAssessments.map((assessment) => gradesList.find((grade: any) => grade.userId === Number(student.id) && grade.subject === activeTeachingSubject && grade.type === assessment.type && grade.name === assessment.name)?.score); const filled = scores.filter((score): score is number => score !== undefined); const average = filled.length ? Math.round(filled.reduce((sum, score) => sum + score, 0) / filled.length) : '-'; return <tr key={student.id} className="border-t border-slate-100 dark:border-slate-700"><td className="px-5 py-3 font-medium">{student.name}</td>{scores.map((score, index) => <td key={index} className="px-5 py-3 text-center">{score ?? '-'}</td>)}<td className="px-5 py-3 text-center font-bold">{average}</td></tr>; })}</tbody></table></div></div>
                </div>
              ) : teachingReportCategory === 'behavior' ? (
                <div className="space-y-5">
                  <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 md:flex-row md:items-center md:justify-between"><div><h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Laporan Sikap & Karakter Mapel</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Hanya menggunakan catatan observasi {activeTeachingSubject || 'mata pelajaran aktif'} pada kelas ini.</p></div><button onClick={handlePrintTeachingBehaviorPDF} className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-red-700"><Printer className="h-4 w-4" /> Cetak / Simpan PDF</button></div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"><div className="overflow-x-auto"><table className="w-full text-sm text-slate-600 dark:text-slate-300"><thead className="bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-5 py-4 text-left">Nama Siswa</th><th className="px-5 py-4 text-center">Positif</th><th className="px-5 py-4 text-center">Negatif</th><th className="px-5 py-4 text-center">Skor Akhir</th><th className="px-5 py-4 text-center">Predikat</th></tr></thead><tbody>{classData.students.map((student) => { const records = (classData.behaviorRecords || []).filter((record) => record.studentId === student.id && record.subject === activeTeachingSubject); const positive = records.filter((record) => record.type === 'positif').reduce((sum, record) => sum + record.points, 0); const negative = records.filter((record) => record.type === 'negatif').reduce((sum, record) => sum + record.points, 0); const score = 100 + positive - negative; const predicate = score >= 100 ? 'Sangat Baik' : score >= 85 ? 'Baik' : score >= 75 ? 'Cukup' : 'Perlu Pembinaan'; return <tr key={student.id} className="border-t border-slate-100 dark:border-slate-700"><td className="px-5 py-3 font-medium">{student.name}</td><td className="px-5 py-3 text-center text-emerald-600">+{positive}</td><td className="px-5 py-3 text-center text-rose-600">-{negative}</td><td className="px-5 py-3 text-center font-bold">{score}</td><td className="px-5 py-3 text-center">{predicate}</td></tr>; })}</tbody></table></div></div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 md:flex-row md:items-center md:justify-between"><div><h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Rekap Presensi Pembelajaran</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Kehadiran {activeTeachingSubject} pada {classData.selectedClass}.</p></div><div className="flex gap-2"><input type="month" value={teachingAttendanceMonth} onChange={(event) => setTeachingAttendanceMonth(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /><button onClick={handlePrintTeachingAttendancePDF} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"><Printer className="h-4 w-4" /> Cetak PDF</button></div></div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"><div className="overflow-x-auto"><table className="min-w-[620px] w-full text-sm text-slate-600 dark:text-slate-300"><thead className="bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-5 py-4 text-left">Nama Siswa</th><th className="px-5 py-4 text-center">L/P</th><th className="px-5 py-4 text-center">Hadir</th><th className="px-5 py-4 text-center">Sakit</th><th className="px-5 py-4 text-center">Izin</th><th className="px-5 py-4 text-center">Alfa</th></tr></thead><tbody>{teachingAttendanceReport.map((student) => <tr key={student.studentId} className="border-t border-slate-100 dark:border-slate-700"><td className="px-5 py-3 font-medium">{student.name}</td><td className="px-5 py-3 text-center">{student.gender}</td><td className="px-5 py-3 text-center text-emerald-600">{student.Hadir}</td><td className="px-5 py-3 text-center text-amber-600">{student.Sakit}</td><td className="px-5 py-3 text-center text-blue-600">{student.Izin}</td><td className="px-5 py-3 text-center text-rose-600">{student.Alfa}</td></tr>)}</tbody></table></div></div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
              <div className="flex bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 gap-2 w-fit">
                {([
                  ['attendance', 'Presensi'],
                  ['grades', 'Buku Nilai'],
                  ['behavior', 'Nilai Sikap'],
                ] as const).map(([category, label]) => (
                  <button key={category} onClick={() => setReportCategory(category)} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${reportCategory === category ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {reportCategory === 'attendance' && (
                <>
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Rekap Presensi Bulanan</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Lihat rekapitulasi kehadiran harian dan ibadah siswa.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <input 
                    type="month" 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  />
                  
                  <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto">
                    <button
                      onClick={handleExportCSV}
                      className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 sm:px-4 py-2 rounded-lg transition-all"
                    >
                      <FileSpreadsheet className="h-4 w-4" /> Ekspor CSV
                    </button>

                    <button
                      onClick={handlePrintPDF}
                      className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 sm:px-4 py-2 rounded-lg transition-all"
                    >
                      <Printer className="h-4 w-4" /> Cetak PDF
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex bg-slate-100 dark:bg-slate-700/50 p-1.5 rounded-xl w-fit">
                  {(['harian', 'dhuha', 'dzuhur', 'jumat'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setReportSubTab(tab)}
                      className={`px-5 py-2 rounded-lg text-xs font-semibold uppercase transition-all ${
                        reportSubTab === tab
                          ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      {tab === 'harian' ? 'Presensi Harian' : tab === 'dhuha' ? 'Sholat Dhuha' : tab === 'dzuhur' ? 'Sholat Dzuhur' : 'Sholat Jumat'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search & Filter Bar for Reports */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={reportSearch}
                    onChange={(e) => setReportSearch(e.target.value)}
                    placeholder="Cari berdasarkan nama siswa..."
                    className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Gender:</span>
                    <select
                      value={reportGenderFilter}
                      onChange={(e) => setReportGenderFilter(e.target.value as any)}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="all">Semua</option>
                      <option value="L">Laki-laki (L)</option>
                      <option value="P">Perempuan (P)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Filter Khusus:</span>
                    <select
                      value={reportAlfaFilter}
                      onChange={(e) => setReportAlfaFilter(e.target.value as any)}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="all">Semua Siswa</option>
                      <option value="alfa-only">Memiliki Alfa (&gt; 0)</option>
                      <option value="no-alfa">Bebas Alfa (Alfa = 0)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700">
                      {reportSubTab === 'harian' ? (
                        <tr>
                          <th className="px-6 py-4">Nama Lengkap</th>
                          <th className="px-6 py-4 text-center">L/P</th>
                          <th className="px-6 py-4 text-center text-emerald-600">Hadir (H)</th>
                          <th className="px-6 py-4 text-center text-amber-500">Sakit (S)</th>
                          <th className="px-6 py-4 text-center text-blue-500">Izin (I)</th>
                          <th className="px-6 py-4 text-center text-red-500">Alfa (A)</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="px-6 py-4">Nama Lengkap</th>
                          <th className="px-6 py-4 text-center">L/P</th>
                          <th className="px-6 py-4 text-center text-emerald-600">Sholat (S)</th>
                          <th className="px-6 py-4 text-center text-purple-500">Berhalangan (BH)</th>
                          <th className="px-6 py-4 text-center text-red-500">Alfa (A)</th>
                        </tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {isLoadingReport ? (
                        <tr>
                          <td colSpan={reportSubTab === 'harian' ? 6 : 5} className="text-center py-8 text-slate-400">Loading data rekapitulasi...</td>
                        </tr>
                      ) : reportData.length === 0 ? (
                        <tr>
                          <td colSpan={reportSubTab === 'harian' ? 6 : 5} className="text-center py-8 text-slate-400">Tidak ada data presensi pada bulan ini.</td>
                        </tr>
                      ) : filteredReportData.length === 0 ? (
                        <tr>
                          <td colSpan={reportSubTab === 'harian' ? 6 : 5} className="text-center py-8 text-slate-400">Tidak ada data siswa yang cocok dengan filter.</td>
                        </tr>
                      ) : (
                        filteredReportData.map((row) => (
                          <tr key={row.studentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{row.name}</td>
                            <td className="px-6 py-4 text-center font-mono text-xs">{row.gender}</td>
                            
                            {reportSubTab === 'harian' ? (
                              <>
                                <td className="px-6 py-4 text-center font-semibold text-emerald-600">{row.harian.Hadir}</td>
                                <td className="px-6 py-4 text-center text-amber-500">{row.harian.Sakit}</td>
                                <td className="px-6 py-4 text-center text-blue-500">{row.harian.Izin}</td>
                                <td className={`px-6 py-4 text-center ${row.harian.Alfa > 0 ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>{row.harian.Alfa}</td>
                              </>
                            ) : reportSubTab === 'dhuha' ? (
                              <>
                                <td className="px-6 py-4 text-center font-semibold text-emerald-600">{getSholatCount(row.dhuha)}</td>
                                <td className="px-6 py-4 text-center text-purple-500">{row.dhuha.Berhalangan}</td>
                                <td className={`px-6 py-4 text-center ${row.dhuha.Alfa > 0 ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>{row.dhuha.Alfa}</td>
                              </>
                            ) : reportSubTab === 'dzuhur' ? (
                              <>
                                <td className="px-6 py-4 text-center font-semibold text-emerald-600">{getSholatCount(row.dzuhur)}</td>
                                <td className="px-6 py-4 text-center text-purple-500">{row.dzuhur.Berhalangan}</td>
                                <td className={`px-6 py-4 text-center ${row.dzuhur.Alfa > 0 ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>{row.dzuhur.Alfa}</td>
                              </>
                            ) : (
                              <>
                                <td className="px-6 py-4 text-center font-semibold text-emerald-600">{getSholatCount(row.jumat)}</td>
                                <td className="px-6 py-4 text-center text-purple-500">{row.jumat.Berhalangan}</td>
                                <td className={`px-6 py-4 text-center ${row.jumat.Alfa > 0 ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>{row.jumat.Alfa}</td>
                              </>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
                </>
              )}

              {reportCategory === 'grades' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div><h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Laporan Buku Nilai</h3><p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Rekap nilai per mata pelajaran beserta rata-rata siswa.</p></div>
                    <div className="flex items-center gap-3"><select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm">{subjects.map((subject) => <option key={subject.id} value={subject.name}>{subject.name}</option>)}</select><button onClick={handlePrintGradesPDF} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg"><Printer className="h-4 w-4" /> Cetak PDF</button></div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm text-slate-600 dark:text-slate-300"><thead className="bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-5 py-4 text-left">Nama Siswa</th>{sessionAssessments.map((assessment) => <th key={`${assessment.type}-${assessment.name}`} className="px-5 py-4 text-center whitespace-nowrap">{assessment.name}</th>)}<th className="px-5 py-4 text-center">Rata-rata</th></tr></thead><tbody>{classData.students.map((student) => { const scores = sessionAssessments.map((assessment) => gradesList.find((grade) => grade.userId === Number(student.id) && grade.subject === selectedSubject && grade.type === assessment.type && grade.name === assessment.name)?.score); const filled = scores.filter((score) => score !== undefined); const average = filled.length ? Math.round(filled.reduce((sum, score) => sum + score, 0) / filled.length) : '-'; return <tr key={student.id} className="border-t border-slate-100 dark:border-slate-700"><td className="px-5 py-3 font-medium">{student.name}</td>{scores.map((score, index) => <td key={index} className="px-5 py-3 text-center">{score ?? '-'}</td>)}<td className="px-5 py-3 text-center font-bold">{average}</td></tr>; })}</tbody></table></div></div>
                </div>
              )}

              {reportCategory === 'behavior' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700"><div><h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Laporan Nilai Sikap</h3><p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Rekap poin sikap dan predikat setiap siswa.</p></div><button onClick={handlePrintBehaviorPDF} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg"><Printer className="h-4 w-4" /> Cetak PDF</button></div>
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"><table className="w-full text-sm text-slate-600 dark:text-slate-300"><thead className="bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-5 py-4 text-left">Nama Siswa</th><th className="px-5 py-4 text-center">Positif</th><th className="px-5 py-4 text-center">Negatif</th><th className="px-5 py-4 text-center">Skor Akhir</th><th className="px-5 py-4 text-center">Predikat</th></tr></thead><tbody>{classData.students.map((student) => { const records = (classData.behaviorRecords || []).filter((record) => record.studentId === student.id); const positive = records.filter((record) => record.type === 'positif').reduce((sum, record) => sum + record.points, 0); const negative = records.filter((record) => record.type === 'negatif').reduce((sum, record) => sum + record.points, 0); const score = 100 + positive - negative; const predicate = score >= 100 ? 'Sangat Baik' : score >= 85 ? 'Baik' : score >= 75 ? 'Cukup' : 'Perlu Pembinaan'; return <tr key={student.id} className="border-t border-slate-100 dark:border-slate-700"><td className="px-5 py-3 font-medium">{student.name}</td><td className="px-5 py-3 text-center text-emerald-600">+{positive}</td><td className="px-5 py-3 text-center text-rose-600">-{negative}</td><td className="px-5 py-3 text-center font-bold">{score}</td><td className="px-5 py-3 text-center">{predicate}</td></tr>; })}</tbody></table></div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'academic' && (
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
              {/* Sub-tabs header */}
              <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 gap-2">
                <button
                  onClick={() => setAcademicSubTab('grades')}
                  className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                    academicSubTab === 'grades'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-750'
                  }`}
                >
                  Buku Nilai Digital
                </button>
                <button
                  onClick={() => setAcademicSubTab('materials')}
                  className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                    academicSubTab === 'materials'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-750'
                  }`}
                >
                  Bank Materi & Tugas
                </button>
                <button
                  onClick={() => setAcademicSubTab('schedule')}
                  className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                    academicSubTab === 'schedule'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-750'
                  }`}
                >
                  Jadwal & Kalender
                </button>
              </div>

              {academicSubTab === 'grades' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Buku Nilai Digital</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Kelola nilai tugas, ulangan harian, PTS, dan PAS siswa secara realtime.</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mata Pelajaran:</span>
                        {workspaceMode === 'teaching' ? (
                          <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300" title="Mata pelajaran mengikuti penugasan guru">
                            <Lock className="h-4 w-4" /> {activeTeachingSubject || selectedSubject}
                          </div>
                        ) : (<><select
                          value={selectedSubject}
                          onChange={(e) => setSelectedSubject(e.target.value)}
                          className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer font-medium"
                        >
                          {subjects.map(subject => (
                            <option key={subject.id} value={subject.name}>{subject.name}</option>
                          ))}
                        </select>
                        <button onClick={() => { setShowSubjectManager(!showSubjectManager); setSubjectName(''); setEditingSubjectId(null); }} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg" title="Kelola Mata Pelajaran" aria-label="Kelola Mata Pelajaran">
                          <Settings className="h-4 w-4" />
                        </button></>)}
                      </div>

                      <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto">
                      <button
                        onClick={() => {
                          setNewAssessmentName('');
                          setNewAssessmentType('Tugas');
                          setShowAddModalAcademic(true);
                        }}
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 sm:px-4 py-2 rounded-lg transition-all shadow-sm"
                      >
                        <Plus className="h-4 w-4" /> Tambah Penilaian
                      </button>

                      <button
                        onClick={handleSaveGrades}
                        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 sm:px-4 py-2 rounded-lg transition-all shadow-sm"
                      >
                        <Save className="h-4 w-4" /> Simpan Semua Nilai
                      </button>
                      </div>
                    </div>
                  </div>

                  {showSubjectManager && (
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-4"><h4 className="font-bold text-slate-800 dark:text-slate-100">Kelola Mata Pelajaran</h4><button onClick={() => setShowSubjectManager(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button></div>
                      <div className="flex gap-2 mb-4"><input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveSubject()} placeholder="Nama mata pelajaran" className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100" /><button onClick={handleSaveSubject} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">{editingSubjectId ? 'Simpan' : 'Tambah'}</button></div>
                      <div className="space-y-2">{subjects.map((subject) => <div key={subject.id} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-900 px-3 py-2"><span className="text-sm text-slate-700 dark:text-slate-200">{subject.name}</span><div className="flex gap-1"><button onClick={() => { setEditingSubjectId(subject.id); setSubjectName(subject.name); }} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded" aria-label={`Ubah ${subject.name}`}><Edit2 className="h-4 w-4" /></button><button onClick={() => handleDeleteSubject(subject)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded" aria-label={`Hapus ${subject.name}`}><Trash2 className="h-4 w-4" /></button></div></div>)}</div>
                    </div>
                  )}

                  {/* Search & Statistics summary for Gradebook */}
                  <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                        <Search className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        value={academicSearch}
                        onChange={(e) => setAcademicSearch(e.target.value)}
                        placeholder="Cari berdasarkan nama siswa..."
                        className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Total Kolom Penilaian</span>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{sessionAssessments.length} Kolom</span>
                      </div>
                      <div className="text-right border-l border-slate-200 dark:border-slate-700 pl-6">
                        <span className="text-xs text-slate-400 block">KKM Kelas</span>
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">75</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="px-6 py-4" style={{ width: '5%' }}>No</th>
                            <th className="px-6 py-4" style={{ minWidth: '200px' }}>Nama Lengkap</th>
                            <th className="px-6 py-4 text-center">NISN</th>
                            
                            {sessionAssessments.map((assessment) => (
                              <th key={assessment.name} className="px-6 py-4 text-center relative group min-w-[140px]">
                                <div className="flex items-center justify-center gap-1.5">
                                  <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-mono uppercase scale-90">
                                    {assessment.type}
                                  </span>
                                  <span className="truncate max-w-[100px]" title={assessment.name}>{assessment.name}</span>
                                  
                                  <button
                                    onClick={() => handleDeleteAssessment(assessment.name, assessment.type)}
                                    className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-0.5 rounded transition-all ml-1"
                                    title="Hapus kolom ini"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </th>
                            ))}
                            
                            <th className="px-6 py-4 text-center font-bold text-slate-800 dark:text-slate-100 min-w-[100px]">Rata-Rata</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                          {isLoadingGrades ? (
                            <tr>
                              <td colSpan={4 + sessionAssessments.length} className="text-center py-8 text-slate-400">Loading data penilaian...</td>
                            </tr>
                          ) : filteredAcademicStudents.length === 0 ? (
                            <tr>
                              <td colSpan={4 + sessionAssessments.length} className="text-center py-8 text-slate-400">Tidak ada data siswa yang cocok dengan filter.</td>
                            </tr>
                          ) : (
                            filteredAcademicStudents.map((student, index) => {
                              let totalScore = 0;
                              let count = 0;
                              sessionAssessments.forEach(assessment => {
                                const val = tempScores[`${student.id}_${assessment.name}`];
                                if (val !== undefined && val !== null && val !== '') {
                                  totalScore += Number(val);
                                  count++;
                                }
                              });
                              const average = count > 0 ? Math.round(totalScore / count) : null;

                              return (
                                <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                  <td className="px-6 py-4 text-xs font-mono text-slate-400">{index + 1}</td>
                                  <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{student.name}</td>
                                  <td className="px-6 py-4 text-xs font-mono">{student.nisn}</td>
                                  
                                  {sessionAssessments.map((assessment) => {
                                    const scoreKey = `${student.id}_${assessment.name}`;
                                    const currentVal = tempScores[scoreKey] ?? '';
                                    const isBelowKkm = currentVal !== '' && Number(currentVal) < 75;

                                    return (
                                      <td key={assessment.name} className="px-6 py-3 text-center">
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          value={currentVal}
                                          onChange={(e) => {
                                            const valStr = e.target.value;
                                            const scoreVal = valStr === '' ? '' : Math.min(100, Math.max(0, parseInt(valStr) || 0));
                                            setTempScores(prev => ({
                                              ...prev,
                                              [scoreKey]: scoreVal as number
                                            }));
                                          }}
                                          className={`w-16 px-2 py-1 text-center text-sm font-semibold rounded-lg border focus:outline-none transition-colors ${
                                            isBelowKkm 
                                              ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 focus:border-red-500 focus:ring-1 focus:ring-red-500' 
                                              : currentVal !== ''
                                                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                                                : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                          }`}
                                          placeholder="0"
                                        />
                                      </td>
                                    );
                                  })}
                                  
                                  <td className="px-6 py-4 text-center font-bold">
                                    {average !== null ? (
                                      <span className={average < 75 ? 'text-red-500 font-semibold' : 'text-emerald-500 font-semibold'}>
                                        {average}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {academicSubTab === 'materials' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Bank Materi & Tugas</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Bagikan materi belajar dan pantau pengumpulan tugas siswa.</p>
                    </div>
                    
                    <button
                      onClick={() => {
                        setNewAssignmentTitle('');
                        setNewAssignmentDesc('');
                        setNewAssignmentType('tugas');
                        setNewAssignmentDueDate('');
                        setNewAssignmentFilePath('');
                        setShowAddAssignmentModal(true);
                      }}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all shadow-sm"
                    >
                      <Plus className="h-4 w-4" /> Tambah Materi / Tugas
                    </button>
                  </div>

                  {isLoadingAssignments ? (
                    <div className="text-center py-12 text-slate-400">Memuat data bank materi...</div>
                  ) : assignmentsList.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-750">
                      <FileText className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                      <h4 className="font-semibold text-slate-600 dark:text-slate-400">Belum ada materi atau tugas</h4>
                      <p className="text-sm text-slate-400 mt-1">Klik tombol di atas untuk membagikan materi pertama Anda.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {assignmentsList.map((item) => (
                        <div key={item.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between hover:shadow-md transition-all duration-300">
                          <div>
                            <div className="flex justify-between items-start mb-4">
                              <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                                item.type === 'tugas' 
                                  ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50' 
                                  : 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50'
                              }`}>
                                {item.type === 'tugas' ? 'Tugas' : 'Materi'}
                              </span>
                              <button 
                                onClick={() => handleDeleteAssignment(item.id)}
                                className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                title="Hapus"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            
                            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">{item.title}</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 mb-4">{item.description || 'Tidak ada deskripsi.'}</p>
                            
                            {item.filePath && (
                              <div className="flex items-center gap-2 mb-4 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                <FileText className="h-4 w-4 text-blue-600" />
                                <span className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate max-w-[220px]" title={item.filePath}>
                                  {item.filePath.split('/').pop()}
                                </span>
                                <a 
                                  href={item.filePath} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="text-xs text-blue-600 hover:underline font-bold ml-auto"
                                >
                                  Lihat File
                                </a>
                              </div>
                            )}
                          </div>

                          <div className="border-t border-slate-100 dark:border-slate-700/50 pt-4 mt-2 flex justify-between items-center text-xs">
                            <div>
                              <span className="text-slate-400 block">Dibuat Pada</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                            
                            {item.type === 'tugas' ? (
                              <>
                                <div>
                                  <span className="text-slate-400 block">Tenggat Waktu</span>
                                  <span className="font-semibold text-red-500">
                                    {item.dueDate 
                                      ? new Date(item.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                                      : '-'
                                    }
                                  </span>
                                </div>
                                <button
                                  onClick={() => { setSubmissionSearch(''); setSubmissionStatusFilter('all'); setViewSubmissionsAssignmentId(item.id); }}
                                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-2 rounded-lg transition-all"
                                >
                                  Lihat Pengumpulan
                                </button>
                              </>
                            ) : (
                              <span className="text-slate-400 italic">Materi Belajar</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {academicSubTab === 'schedule' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                  {/* Left Column: Jadwal Pelajaran (2/3 width) */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-blue-600" />
                            Jadwal Pelajaran Kelas
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Atur jadwal mata pelajaran mingguan untuk kelas {classData.selectedClass || 'aktif'}.
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setNewScheduleDay('Senin');
                            setNewScheduleSubject('');
                            setNewScheduleTimeStart('07:30');
                            setNewScheduleTimeEnd('09:00');
                            setNewScheduleTeacher('');
                            setNewScheduleColor('blue');
                            setShowAddScheduleModal(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 text-sm shadow-sm"
                        >
                          <Plus className="h-4 w-4" /> Tambah Jadwal
                        </button>
                      </div>

                      {/* Schedule Timetable by Day */}
                      <div className="space-y-6">
                        {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].map((day) => {
                          const daySchedules = (classData.schedules || []).filter(s => s.day === day)
                            .sort((a, b) => a.timeStart.localeCompare(b.timeStart));

                          return (
                            <div key={day} className="border-b border-slate-105 dark:border-slate-750 pb-6 last:border-0 last:pb-0">
                              <h4 className="font-bold text-slate-750 dark:text-slate-200 mb-3 flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                                {day}
                              </h4>
                              {daySchedules.length === 0 ? (
                                <p className="text-xs text-slate-400 dark:text-slate-500 italic ml-4">Tidak ada jadwal pelajaran.</p>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-4">
                                  {daySchedules.map((sched) => {
                                    const colorClasses: Record<string, string> = {
                                      blue: 'bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/50',
                                      emerald: 'bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50',
                                      amber: 'bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/50',
                                      rose: 'bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-900/50',
                                      indigo: 'bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50',
                                      violet: 'bg-violet-50/50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-400 border-violet-100 dark:border-violet-900/50',
                                    };
                                    const colorStyle = colorClasses[sched.color] || colorClasses.blue;

                                    return (
                                      <div key={sched.id} className={`p-4 rounded-xl border flex justify-between items-start group hover:shadow-sm transition-all ${colorStyle}`}>
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm">{sched.subject}</span>
                                          </div>
                                          <div className="text-xs font-medium flex items-center gap-1.5 opacity-80">
                                            <Clock className="h-3 w-3" />
                                            {sched.timeStart} - {sched.timeEnd}
                                          </div>
                                          {sched.teacherName && (
                                            <div className="text-xs opacity-70 italic">
                                              Guru: {sched.teacherName}
                                            </div>
                                          )}
                                        </div>
                                        <button
                                          onClick={async () => {
                                            if (confirm(`Hapus jadwal ${sched.subject} pada hari ${sched.day}?`)) {
                                              await classData.removeSchedule(sched.id);
                                            }
                                          }}
                                          className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-white/50 dark:hover:bg-slate-800 transition-colors"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Kalender Akademik (1/3 width) */}
                  <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-emerald-600" />
                        Kalender Akademik
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                        Agenda terdekat yang akan muncul di halaman utama wali kelas dan siswa.
                      </p>

                      {/* Add Agenda Form */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-750 mb-6 space-y-4">
                        <h4 className="font-bold text-xs text-slate-700 dark:text-slate-350 uppercase tracking-wider">Tambah Agenda Baru</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Tanggal</label>
                            <input
                              type="text"
                              value={newAgendaDate}
                              onChange={e => setNewAgendaDate(e.target.value)}
                              placeholder="Contoh: 15 Okt, 20-22 Nov"
                              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Judul Kegiatan</label>
                            <input
                              type="text"
                              value={newAgendaTitle}
                              onChange={e => setNewAgendaTitle(e.target.value)}
                              placeholder="Contoh: Pembagian Rapor"
                              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Tipe</label>
                            <select
                              value={newAgendaType}
                              onChange={e => setNewAgendaType(e.target.value)}
                              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 cursor-pointer"
                            >
                              <option value="Kegiatan">Kegiatan</option>
                              <option value="Ujian">Ujian</option>
                              <option value="Libur">Libur</option>
                              <option value="Tugas">Tugas</option>
                            </select>
                          </div>
                          <button
                            onClick={() => {
                              if (!newAgendaTitle || !newAgendaDate) {
                                alert('Isi tanggal dan judul agenda!');
                                return;
                              }
                              classData.addAgenda({
                                id: '',
                                date: newAgendaDate,
                                title: newAgendaTitle,
                                type: newAgendaType
                              });
                              setNewAgendaDate('');
                              setNewAgendaTitle('');
                              alert('Agenda berhasil ditambahkan!');
                            }}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Plus className="h-3.5 w-3.5" /> Simpan ke Kalender
                          </button>
                        </div>
                      </div>

                      {/* Agenda list */}
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        {classData.agenda.length === 0 ? (
                          <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-4">Belum ada agenda akademik.</p>
                        ) : (
                          classData.agenda.map((item) => (
                            <div key={item.id} className="flex items-start justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-750 gap-2">
                              <div className="flex items-start gap-3">
                                <div className="flex flex-col items-center justify-center text-blue-600 dark:text-blue-400 min-w-10 bg-blue-50 dark:bg-blue-950/40 p-1.5 rounded-lg">
                                  <span className="text-[9px] font-bold uppercase">{item.date.split(' ')[1] || 'AGS'}</span>
                                  <span className="text-lg font-extrabold leading-none">{item.date.split(' ')[0] || '1'}</span>
                                </div>
                                <div>
                                  <h4 className="font-semibold text-xs text-slate-800 dark:text-slate-200">{item.title}</h4>
                                  <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 uppercase">{item.type}</span>
                                </div>
                              </div>
                              <button
                                onClick={async () => {
                                  if (confirm(`Hapus agenda "${item.title}"?`)) {
                                    await classData.removeAgenda(item.id);
                                  }
                                }}
                                className="text-red-500 hover:text-red-700 p-1 rounded transition-colors self-center"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'monitoring' && (userRole === 'admin' || userRole === 'counselor') && (
            <div className="mx-auto max-w-6xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
              <div className="flex flex-col gap-4 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white shadow-lg dark:border-amber-900">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div><p className="text-xs font-bold uppercase tracking-wider text-amber-100">Pusat Pemantauan Siswa</p><h3 className="mt-1 text-2xl font-black">Kasus Pembinaan</h3><p className="mt-2 max-w-2xl text-sm text-amber-50">Pantau masalah, kebutuhan bantuan, dan tindak lanjut siswa secara terstruktur.</p></div>
                  <button onClick={openNewCaseModal} className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-amber-700 shadow-sm hover:bg-amber-50"><MessageSquare className="h-4 w-4" /> Buat Kasus</button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: 'Kasus Terbuka', value: openStudentCases, icon: ShieldAlert, tone: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
                  { label: 'Prioritas Tinggi', value: urgentStudentCases, icon: AlertTriangle, tone: 'text-rose-600 bg-rose-50 dark:bg-rose-950/30' },
                  { label: 'Tindak Lanjut Terlambat', value: overdueStudentCases, icon: CalendarDays, tone: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
                ].map((item) => <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"><div><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{item.label}</p><p className="mt-1 text-3xl font-black text-slate-800 dark:text-slate-100">{item.value}</p></div><span className={`rounded-xl p-3 ${item.tone}`}><item.icon className="h-6 w-6" /></span></div>)}
              </div>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h4 className="font-bold text-slate-800 dark:text-slate-100">Peringatan Sistem</h4><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sinyal dari presensi, nilai, sikap, dan tugas. Tinjau konteks sebelum membuat kasus.</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{studentWarnings.length} peringatan</span></div>
                {studentWarnings.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400 dark:border-slate-700">Belum ada peringatan berdasarkan data saat ini.</p> : <div className="grid gap-3 md:grid-cols-2">{studentWarnings.map((warning) => <div key={warning.id} className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-800 dark:text-slate-100">{warning.studentName}</p><span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">{warning.kind}</span></div><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{warning.reason}</p><button onClick={() => openCaseFromWarning(warning)} className="mt-2 text-xs font-bold text-amber-700 hover:underline dark:text-amber-300">Buat kasus dari peringatan →</button></div></div>)}</div>}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h4 className="font-bold text-slate-800 dark:text-slate-100">Daftar Kasus Pembinaan</h4><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Catatan kasus hanya dapat diakses oleh pihak yang berwenang.</p></div><div className="flex flex-wrap gap-2"><select value={monitoringClassFilter} onChange={(event) => setMonitoringClassFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="all">Semua kelas</option>{classData.classes.filter((item) => item.status === 'Aktif').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={monitoringStatusFilter} onChange={(event) => setMonitoringStatusFilter(event.target.value as typeof monitoringStatusFilter)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="all">Semua status</option><option value="terbuka">Terbuka</option><option value="ditangani">Ditangani</option><option value="selesai">Selesai</option></select><select value={monitoringPriorityFilter} onChange={(event) => setMonitoringPriorityFilter(event.target.value as typeof monitoringPriorityFilter)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="all">Semua prioritas</option><option value="mendesak">Mendesak</option><option value="tinggi">Tinggi</option><option value="sedang">Sedang</option><option value="rendah">Rendah</option></select></div></div>
                <div className="mb-4"><input value={monitoringSearch} onChange={(event) => setMonitoringSearch(event.target.value)} placeholder="Cari siswa atau judul kasus..." className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /></div>
                {isLoadingMonitoring ? <p className="py-10 text-center text-sm text-slate-400">Memuat pemantauan siswa…</p> : filteredStudentCases.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-slate-700">Belum ada kasus yang sesuai filter.</p> : <div className="space-y-3">{filteredStudentCases.map((item) => <button key={item.id} onClick={() => openCaseDetail(item.id)} className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-amber-300 hover:shadow-sm dark:border-slate-700 dark:hover:border-amber-700"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-bold text-slate-800 dark:text-slate-100">{item.student?.name || 'Siswa'}</span><span className="text-xs text-slate-400">{item.class?.name || 'Kelas'}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${item.priority === 'mendesak' || item.priority === 'tinggi' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'}`}>{item.priority}</span></div><p className="mt-2 font-semibold text-slate-700 dark:text-slate-200">{item.title}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{item.summary}</p></div><div className="flex shrink-0 items-center gap-2 text-xs"><span className={`rounded-full px-2.5 py-1 font-bold ${item.status === 'selesai' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : item.status === 'ditangani' ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>{item.status}</span>{item.visibility === 'sensitif' && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">Sensitif</span>}</div></div><p className="mt-3 text-[11px] text-slate-400">Penanggung jawab: {item.owner?.name || 'Belum ditentukan'} {item.dueDate ? `· Tindak lanjut: ${item.dueDate}` : ''}</p></button>)}</div>}
              </section>

              {selectedCase && <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm dark:border-amber-900/50 dark:bg-slate-800"><div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-700 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-600">Detail Kasus</p><h4 className="mt-1 text-xl font-black text-slate-800 dark:text-slate-100">{selectedCase.title}</h4><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{selectedCase.student?.name} · {selectedCase.class?.name}</p></div><button onClick={() => setSelectedCase(null)} className="self-end rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><X className="h-5 w-5" /></button></div><div className="grid gap-4 py-4 sm:grid-cols-3"><div><p className="text-xs text-slate-400">Status</p><select value={selectedCase.status} onChange={(event) => updateStudentCase(selectedCase.id, { status: event.target.value })} className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="terbuka">Terbuka</option><option value="ditangani">Ditangani</option><option value="selesai">Selesai</option></select></div><div><p className="text-xs text-slate-400">Prioritas</p><select value={selectedCase.priority} onChange={(event) => updateStudentCase(selectedCase.id, { priority: event.target.value })} className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="mendesak">Mendesak</option><option value="tinggi">Tinggi</option><option value="sedang">Sedang</option><option value="rendah">Rendah</option></select></div><div><p className="text-xs text-slate-400">Penanggung jawab</p><select value={selectedCase.ownerId} onChange={(event) => updateStudentCase(selectedCase.id, { ownerId: event.target.value })} className="mt-1 max-w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">{caseOwners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></div></div><div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-900/50 dark:text-slate-300"><p className="font-semibold text-slate-700 dark:text-slate-200">Ringkasan</p><p className="mt-1 whitespace-pre-wrap">{selectedCase.summary}</p></div><div className="mt-5 flex items-center justify-between"><h5 className="font-bold text-slate-800 dark:text-slate-100">Riwayat Tindak Lanjut</h5><button onClick={() => { setCaseUpdateNote(''); setCaseNextFollowUpDate(''); setCaseUpdateVisibility('ringkasan'); setShowCaseUpdateModal(true); }} className="flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700"><Plus className="h-4 w-4" /> Tambah Catatan</button></div><div className="mt-3 space-y-3">{selectedCase.updates.length === 0 ? <p className="py-5 text-center text-sm text-slate-400">Belum ada catatan tindak lanjut.</p> : selectedCase.updates.map((update) => <div key={update.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400"><span>{update.author?.name || 'Pengguna'} · {update.createdAt ? new Date(update.createdAt).toLocaleString('id-ID') : ''}</span>{update.nextFollowUpDate && <span className="font-semibold text-amber-600">Tindak lanjut: {update.nextFollowUpDate}</span>}</div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{update.note}</p></div>)}</div></section>}
            </div>
          )}

          {activeTab === 'behavior' && (
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
              {/* Sub-tabs header */}
              <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 gap-2">
                <button
                  onClick={() => setBehaviorSubTab('sikap')}
                  className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                    behaviorSubTab === 'sikap'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-750'
                  }`}
                >
                  {workspaceMode === 'teaching' ? 'Penilaian Sikap & Karakter' : 'Catatan Sikap & Karakter'}
                </button>
                {workspaceMode !== 'teaching' && <button
                  onClick={() => setBehaviorSubTab('prestasi')}
                  className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                    behaviorSubTab === 'prestasi'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-750'
                  }`}
                >
                  Prestasi Siswa
                </button>}
              </div>

              {behaviorSubTab === 'sikap' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Student List & Behavior Scores (2/3 width) */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{workspaceMode === 'teaching' ? 'Penilaian Sikap & Karakter' : 'Poin Sikap & Karakter Siswa'}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{workspaceMode === 'teaching' ? `Catatan observasi ${activeTeachingSubject || 'mata pelajaran'} untuk ${classData.selectedClass}.` : 'Nilai awal standar adalah 100 poin.'}</p>
                        </div>
                        <button
                          onClick={() => {
                            if (classData.students.length > 0) {
                              setBehaviorStudentId(classData.students[0].id);
                            }
                            setBehaviorType('positif');
                            setBehaviorPoints(10);
                            setBehaviorCategory('Kedisiplinan');
                            setBehaviorDescription('');
                            setShowAddBehaviorModal(true);
                          }}
                          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-[0_0_12px_rgba(37,99,235,0.15)]"
                        >
                          <Plus className="h-4 w-4" /> Catat Sikap
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                          <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700">
                            <tr>
                              <th className="px-4 py-3">Nama Siswa</th>
                              <th className="px-4 py-3 text-center">Poin Positif</th>
                              <th className="px-4 py-3 text-center">Poin Negatif</th>
                              <th className="px-4 py-3 text-center">Skor Akhir</th>
                              <th className="px-4 py-3 text-right">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {classData.students.map((student) => {
                              const sRecords = visibleBehaviorRecords.filter(r => r.studentId === student.id);
                              const posPoints = sRecords.filter(r => r.type === 'positif').reduce((sum, r) => sum + r.points, 0);
                              const negPoints = sRecords.filter(r => r.type === 'negatif').reduce((sum, r) => sum + r.points, 0);
                              const score = 100 + posPoints - negPoints;

                              let scoreColor = 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50';
                              if (score < 85) {
                                scoreColor = 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50';
                              } else if (score < 100) {
                                scoreColor = 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50';
                              }

                              return (
                                <tr key={student.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${selectedStudentForDetails === student.id ? 'bg-blue-50/50 dark:bg-blue-950/10' : ''}`}>
                                  <td className="px-4 py-3">
                                    <div className="font-semibold text-slate-800 dark:text-slate-200">{student.name}</div>
                                    <div className="text-[10px] text-slate-400">NISN: {student.nisn}</div>
                                  </td>
                                  <td className="px-4 py-3 text-center text-emerald-600 font-bold">+{posPoints}</td>
                                  <td className="px-4 py-3 text-center text-rose-600 font-bold">-{negPoints}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`inline-block font-bold px-2 py-1 rounded-lg border text-xs ${scoreColor}`}>
                                      {score}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <button
                                      onClick={() => setSelectedStudentForDetails(student.id)}
                                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                                    >
                                      Detail Log
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Detailed Logs for Selected Student (1/3 width) */}
                  <div className="hidden space-y-6 lg:block">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                      {selectedStudentForDetails ? (() => {
                        const student = classData.students.find(s => s.id === selectedStudentForDetails);
                        const sRecords = visibleBehaviorRecords.filter(r => r.studentId === selectedStudentForDetails)
                          .sort((a, b) => b.date.localeCompare(a.date));

                        if (!student) return <p className="text-sm text-slate-400 italic">Siswa tidak ditemukan.</p>;

                        return (
                          <div className="space-y-6">
                            <div className="border-b border-slate-100 dark:border-slate-700 pb-4">
                              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base">{student.name}</h4>
                              <p className="text-xs text-slate-400 mt-1">Daftar riwayat sikap & tindakan</p>
                            </div>

                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                              {sRecords.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-6">Belum ada catatan sikap untuk siswa ini.</p>
                              ) : (
                                sRecords.map((rec) => (
                                  <div key={rec.id} className={`p-4 rounded-xl border relative group ${
                                    rec.type === 'positif' 
                                      ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30' 
                                      : 'bg-rose-50/30 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/30'
                                  }`}>
                                    <div className="flex justify-between items-start gap-2 mb-1.5">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                        rec.type === 'positif'
                                          ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                          : 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                                      }`}>
                                        {rec.category} ({rec.type === 'positif' ? `+${rec.points}` : `-${rec.points}`}){rec.subject ? ` · ${rec.subject}` : ''}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-mono">{rec.date}</span>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{rec.description}</p>
                                    
                                    <button
                                      onClick={async () => {
                                        if (confirm('Hapus catatan sikap ini?')) {
                                          await classData.removeBehaviorRecord(rec.id);
                                        }
                                      }}
                                      className="absolute right-3 bottom-3 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })() : (
                        <div className="text-center py-12 text-slate-400">
                          <Award className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                          <p className="text-sm font-semibold">Pilih Siswa</p>
                          <p className="text-xs mt-1">Klik "Detail Log" di tabel siswa untuk melihat riwayat lengkap sikap mereka.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {behaviorSubTab === 'prestasi' && workspaceMode !== 'teaching' && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Daftar Prestasi & Penghargaan</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Catatan pencapaian siswa di bidang akademik maupun non-akademik.</p>
                    </div>
                    <button
                      onClick={() => {
                        if (classData.students.length > 0) {
                          setAchievementStudentId(classData.students[0].id);
                        }
                        setAchievementTitle('');
                        setAchievementLevel('Kabupaten');
                        setAchievementRank('Juara 1');
                        setAchievementDescription('');
                        setShowAddAchievementModal(true);
                      }}
                      className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-[0_0_12px_rgba(37,99,235,0.15)]"
                    >
                      <Plus className="h-4 w-4" /> Catat Prestasi
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                      <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="px-6 py-4">Nama Siswa</th>
                          <th className="px-6 py-4">Judul Prestasi</th>
                          <th className="px-6 py-4 text-center">Tingkat</th>
                          <th className="px-6 py-4 text-center">Peringkat</th>
                          <th className="px-6 py-4 text-center">Tanggal</th>
                          <th className="px-6 py-4 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {(classData.achievements || []).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-slate-400">Belum ada catatan prestasi kelas.</td>
                          </tr>
                        ) : (
                          classData.achievements.map((item) => {
                            const student = classData.students.find(s => s.id === item.studentId);
                            return (
                              <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">
                                  {student ? student.name : 'Siswa Tidak Dikenal'}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="font-medium text-slate-700 dark:text-slate-300">{item.title}</div>
                                  {item.description && <div className="text-xs text-slate-450 italic mt-0.5">{item.description}</div>}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
                                    {item.level}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center font-bold text-amber-600 dark:text-amber-400">{item.rank}</td>
                                <td className="px-6 py-4 text-center font-mono text-xs">{item.date}</td>
                                <td className="px-6 py-4 text-right">
                                  <button
                                    onClick={async () => {
                                      if (confirm(`Hapus catatan prestasi "${item.title}"?`)) {
                                        await classData.removeAchievement(item.id);
                                      }
                                    }}
                                    className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'behavior' && behaviorSubTab === 'sikap' && selectedStudentForDetails && (
            <div className="lg:hidden fixed inset-0 z-50 flex items-end bg-slate-950/60" onClick={() => setSelectedStudentForDetails(null)}>
              <div className="max-h-[82vh] w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-800" onClick={(event) => event.stopPropagation()}>
                {(() => {
                  const student = classData.students.find((item) => item.id === selectedStudentForDetails);
                  const records = visibleBehaviorRecords
                    .filter((record) => record.studentId === selectedStudentForDetails)
                    .sort((a, b) => b.date.localeCompare(a.date));
                  if (!student) return null;
                  return <>
                    <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
                      <div><h4 className="font-bold text-slate-800 dark:text-slate-100">{student.name}</h4><p className="mt-1 text-xs text-slate-400">Daftar riwayat sikap & tindakan</p></div>
                      <button onClick={() => setSelectedStudentForDetails(null)} aria-label="Tutup detail log" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"><X className="h-5 w-5" /></button>
                    </div>
                    <div className="max-h-[64vh] space-y-3 overflow-y-auto p-5">
                      {records.length === 0 ? <p className="py-8 text-center text-sm italic text-slate-400">Belum ada catatan sikap untuk siswa ini.</p> : records.map((record) => (
                        <div key={record.id} className={`relative rounded-xl border p-4 pr-11 ${record.type === 'positif' ? 'border-emerald-100 bg-emerald-50/40 dark:border-emerald-900/30 dark:bg-emerald-950/10' : 'border-rose-100 bg-rose-50/40 dark:border-rose-900/30 dark:bg-rose-950/10'}`}>
                          <div className="mb-1.5 flex items-start justify-between gap-2"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${record.type === 'positif' ? 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-400' : 'border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-900/50 dark:text-rose-400'}`}>{record.category} ({record.type === 'positif' ? `+${record.points}` : `-${record.points}`}){record.subject ? ` · ${record.subject}` : ''}</span><span className="shrink-0 font-mono text-[10px] text-slate-400">{record.date}</span></div>
                          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{record.description}</p>
                          <button onClick={async () => { if (confirm('Hapus catatan sikap ini?')) await classData.removeBehaviorRecord(record.id); }} aria-label="Hapus catatan sikap" className="absolute bottom-3 right-3 rounded p-1 text-red-500 hover:bg-white/70 hover:text-red-700 dark:hover:bg-slate-700"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>
                  </>;
                })()}
              </div>
            </div>
          )}

          {activeTab !== 'workspace' && activeTab !== 'dashboard' && activeTab !== 'settings' && activeTab !== 'students' && activeTab !== 'attendance' && activeTab !== 'reports' && activeTab !== 'monitoring' && activeTab !== 'teaching-reports' && activeTab !== 'teaching-attendance' && activeTab !== 'academic' && activeTab !== 'behavior' && (
            <div className="flex items-center justify-center h-full text-slate-500 animate-in fade-in">
              <div className="text-center">
                <Settings className="h-12 w-12 mx-auto mb-4 text-slate-300 animate-spin-slow" />
                <h3 className="text-xl font-semibold text-slate-700">Modul sedang dalam pengembangan</h3>
                <p className="text-slate-400 mt-2">Halaman {activeTab} akan segera tersedia.</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 grid grid-cols-5 items-center px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-lg">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'students', label: 'Siswa', icon: Users },
          { id: 'attendance', label: 'Presensi', icon: CheckSquare },
          { id: 'academic', label: 'Akademik', icon: BookOpen },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => { if (item.id === 'settings') setSettingsView('overview'); setActiveTab(item.id); }}
            className={`min-h-11 flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition-all duration-200 ${
              activeTab === item.id 
              ? 'text-blue-600 dark:text-blue-400 font-medium' 
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <item.icon className="h-4 w-4" />
            <span className="text-[10px] tracking-tight">{item.label}</span>
          </button>
        ))}
        <button onClick={() => setShowMobileMoreMenu(true)} className={`min-h-11 flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition-all ${showMobileMoreMenu ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
          <Menu className="h-5 w-5" /><span className="text-[10px] tracking-tight">Lainnya</span>
        </button>
      </nav>

      {showMobileMoreMenu && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end bg-slate-900/40" onClick={() => setShowMobileMoreMenu(false)}>
          <div className="w-full bg-white dark:bg-slate-800 rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom-8" onClick={(event) => event.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-600 mx-auto mb-5" /><h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4">Menu Lainnya</h3>
            <div className="grid grid-cols-3 gap-3">{[
              ...((userRole === 'admin' || userRole === 'counselor') ? [{ id: 'monitoring', label: 'Pemantauan Siswa', icon: ShieldAlert }] : []),
              ...(workspaceMode === 'teaching' ? [{ id: 'teaching-attendance', label: 'Presensi Mapel', icon: CheckSquare }, { id: 'teaching-reports', label: 'Laporan Mengajar', icon: FileText }] : userRole === 'admin' ? [{ id: 'reports', label: 'Laporan', icon: FileText }] : []),
              ...((userRole === 'admin' || workspaceMode === 'teaching') ? [{ id: 'behavior', label: workspaceMode === 'teaching' ? 'Sikap & Karakter' : 'Sikap & Prestasi', icon: Award }] : []),
              ...(userRole === 'admin' ? [{ id: 'settings', label: 'Pengaturan', icon: Settings }] : []),
            ].map((item) => <button key={item.id} onClick={() => { setActiveTab(item.id); setShowMobileMoreMenu(false); }} className="min-h-24 flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200"><item.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" /><span className="text-xs font-semibold text-center">{item.label}</span></button>)}</div>
          </div>
        </div>
      )}
      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setShowAddModal(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          ></div>
          
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 animate-in zoom-in-95 duration-200 relative">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              {editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {editingStudent ? 'Perbarui data diri siswa di bawah ini.' : 'Masukkan data diri siswa baru secara manual.'}
            </p>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!manualNisn || !manualName) return;
              if (editingStudent) {
                await classData.updateStudent({
                  id: editingStudent.id,
                  nisn: manualNisn,
                  name: manualName,
                  gender: manualGender,
                  status: manualStatus
                });
                alert('Siswa berhasil diperbarui!');
              } else {
                await classData.addStudent({
                  id: '',
                  nisn: manualNisn,
                  name: manualName,
                  gender: manualGender,
                  status: manualStatus
                });
                alert('Siswa berhasil ditambahkan!');
              }
              setShowAddModal(false);
              setEditingStudent(null);
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">NISN</label>
                <input 
                  type="text" 
                  pattern="[0-9]*"
                  value={manualNisn}
                  onChange={(e) => setManualNisn(e.target.value)}
                  placeholder="Contoh: 10029385"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-400"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Contoh: Budi Utomo"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Jenis Kelamin</label>
                  <select 
                    value={manualGender}
                    onChange={(e) => setManualGender(e.target.value as 'L' | 'P')}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Status</label>
                  <select 
                    value={manualStatus}
                    onChange={(e) => setManualStatus(e.target.value as 'Aktif' | 'Nonaktif')}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Nonaktif">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.2)] hover:shadow-[0_0_25px_rgba(37,99,235,0.3)]"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Assessment Modal */}
      {showAddModalAcademic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setShowAddModalAcademic(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          ></div>
          
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 animate-in zoom-in-95 duration-200 relative">
            <button 
              onClick={() => setShowAddModalAcademic(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Tambah Kolom Penilaian
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nama Penilaian</label>
                <input 
                  type="text" 
                  value={newAssessmentName}
                  onChange={(e) => setNewAssessmentName(e.target.value)}
                  placeholder="Misal: Tugas 1, Ulangan Harian 2" 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Kategori</label>
                <select 
                  value={newAssessmentType}
                  onChange={(e) => setNewAssessmentType(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Tugas">Tugas</option>
                  <option value="Ulangan">Ulangan</option>
                  <option value="PTS">PTS</option>
                  <option value="PAS">PAS</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowAddModalAcademic(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button 
                  onClick={() => {
                    if (!newAssessmentName.trim()) {
                      alert('Nama penilaian tidak boleh kosong!');
                      return;
                    }
                    const exists = sessionAssessments.some(a => a.name.toLowerCase() === newAssessmentName.trim().toLowerCase());
                    if (exists) {
                      alert('Nama penilaian sudah ada!');
                      return;
                    }
                    setSessionAssessments(prev => [...prev, { name: newAssessmentName.trim(), type: newAssessmentType }]);
                    setShowAddModalAcademic(false);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.2)] hover:shadow-[0_0_25px_rgba(37,99,235,0.3)]"
                >
                  Tambah
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Assignment Modal */}
      {showAddAssignmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setShowAddAssignmentModal(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          ></div>
          
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 animate-in zoom-in-95 duration-200 relative">
            <button 
              onClick={() => setShowAddAssignmentModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Tambah Materi / Tugas
            </h3>
            
            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Judul</label>
                <input 
                  type="text" 
                  value={newAssignmentTitle}
                  onChange={(e) => setNewAssignmentTitle(e.target.value)}
                  placeholder="Misal: Tugas Matematika Aljabar" 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Deskripsi</label>
                <textarea 
                  value={newAssignmentDesc}
                  onChange={(e) => setNewAssignmentDesc(e.target.value)}
                  placeholder="Deskripsi tugas atau petunjuk pengerjaan..." 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-24 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tipe</label>
                <select 
                  value={newAssignmentType}
                  onChange={(e) => setNewAssignmentType(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="tugas">Tugas (Memerlukan Pengumpulan & Nilai)</option>
                  <option value="materi">Materi (Hanya untuk Dibaca/Didownload)</option>
                </select>
              </div>

              {newAssignmentType === 'tugas' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tenggat Waktu</label>
                  <input 
                    type="datetime-local" 
                    value={newAssignmentDueDate}
                    onChange={(e) => setNewAssignmentDueDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Link File Pendukung (Opsional)</label>
                <input 
                  type="text" 
                  value={newAssignmentFilePath}
                  onChange={(e) => setNewAssignmentFilePath(e.target.value)}
                  placeholder="Misal: https://drive.google.com/... atau path file" 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddAssignmentModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.2)]"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Submissions & Grading Modal */}
      {viewSubmissionsAssignmentId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setViewSubmissionsAssignmentId(null)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          ></div>
          
          <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 animate-in zoom-in-95 duration-200 relative max-h-[85vh] flex flex-col">
            <button 
              onClick={() => setViewSubmissionsAssignmentId(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-blue-600" />
              Pantau Pengumpulan Tugas & Beri Nilai
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Berikut adalah daftar pengumpulan tugas oleh siswa kelas ini beserta status penilaiannya.
            </p>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={submissionSearch}
                  onChange={(event) => setSubmissionSearch(event.target.value)}
                  placeholder="Cari nama atau NISN siswa..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <select
                value={submissionStatusFilter}
                onChange={(event) => setSubmissionStatusFilter(event.target.value as 'all' | 'submitted' | 'pending')}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="all">Semua Status</option>
                <option value="submitted">Sudah Mengumpulkan</option>
                <option value="pending">Belum Mengumpulkan</option>
              </select>
            </div>

            <div className="overflow-y-auto flex-1 pr-1">
              {isLoadingSubmissions ? (
                <div className="text-center py-12 text-slate-450">Memuat data pengumpulan...</div>
              ) : submissionsList.length === 0 ? (
                <div className="text-center py-12 text-slate-455">Belum ada siswa terdaftar di kelas ini.</div>
              ) : filteredSubmissions.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">Tidak ada siswa yang sesuai dengan pencarian atau filter.</div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-sm text-slate-600 dark:text-slate-350">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-6 py-4">Nama Siswa</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-center">Waktu Kirim</th>
                        <th className="px-6 py-4">File Lampiran</th>
                        <th className="px-6 py-4 text-center" style={{ width: '150px' }}>Nilai</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {filteredSubmissions.map((sub) => {
                        const studentGrade = tempSubGrades[sub.studentId] ?? '';

                        return (
                          <tr key={sub.studentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4">
                              <span className="font-semibold text-slate-800 dark:text-slate-200 block">{sub.studentName}</span>
                              <span className="text-xs text-slate-400 font-mono">{sub.studentNisn}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {sub.hasSubmitted ? (
                                <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-200 dark:border-emerald-900/50">
                                  Terkumpul
                                </span>
                              ) : (
                                <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-full text-xs font-medium">
                                  Belum Mengumpulkan
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center text-xs text-slate-500 dark:text-slate-400 font-mono">
                              {sub.submittedAt 
                                ? new Date(sub.submittedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) 
                                : '-'
                              }
                            </td>
                            <td className="px-6 py-4 text-xs font-mono">
                              {sub.hasSubmitted && sub.filePath ? (
                                <a 
                                  href={sub.filePath} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="text-blue-600 hover:underline font-bold"
                                >
                                  {sub.filePath.split('/').pop()}
                                </a>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={studentGrade}
                                  onChange={(e) => {
                                    const valStr = e.target.value;
                                    const gradeVal = valStr === '' ? '' : Math.min(100, Math.max(0, parseInt(valStr) || 0));
                                    setTempSubGrades(prev => ({
                                      ...prev,
                                      [sub.studentId]: gradeVal as number
                                    }));
                                  }}
                                  className="w-16 px-2 py-1 text-center font-bold text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                  placeholder="-"
                                />
                                <button
                                  onClick={() => handleSaveSubmissionGrade(sub.studentId, Number(studentGrade))}
                                  disabled={studentGrade === ''}
                                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-bold p-1.5 rounded-lg transition-all"
                                  title="Simpan Nilai"
                                >
                                  <Save className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50 mt-4 flex justify-end">
              <button
                onClick={() => setViewSubmissionsAssignmentId(null)}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold px-6 py-2.5 rounded-xl transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Schedule Modal */}
      {showAddScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setShowAddScheduleModal(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          ></div>
          
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 animate-in zoom-in-95 duration-200 relative">
            <button 
              onClick={() => setShowAddScheduleModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Tambah Jadwal Pelajaran
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Hari</label>
                <select
                  value={newScheduleDay}
                  onChange={(e) => setNewScheduleDay(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nama Mata Pelajaran</label>
                <input 
                  type="text" 
                  value={newScheduleSubject}
                  onChange={(e) => setNewScheduleSubject(e.target.value)}
                  placeholder="Misal: Fisika, Matematika" 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Jam Mulai</label>
                  <input 
                    type="text" 
                    value={newScheduleTimeStart}
                    onChange={(e) => setNewScheduleTimeStart(e.target.value)}
                    placeholder="Contoh: 07:30" 
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Jam Selesai</label>
                  <input 
                    type="text" 
                    value={newScheduleTimeEnd}
                    onChange={(e) => setNewScheduleTimeEnd(e.target.value)}
                    placeholder="Contoh: 09:00" 
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nama Guru Pengajar (Opsional)</label>
                <input 
                  type="text" 
                  value={newScheduleTeacher}
                  onChange={(e) => setNewScheduleTeacher(e.target.value)}
                  placeholder="Misal: Ahmad Fauzi, S.Pd." 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Warna Label</label>
                <div className="flex gap-2.5">
                  {['blue', 'emerald', 'amber', 'rose', 'indigo', 'violet'].map((color) => {
                    const bgColors: Record<string, string> = {
                      blue: 'bg-blue-500',
                      emerald: 'bg-emerald-500',
                      amber: 'bg-amber-500',
                      rose: 'bg-rose-500',
                      indigo: 'bg-indigo-500',
                      violet: 'bg-violet-500'
                    };
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewScheduleColor(color)}
                        className={`h-7 w-7 rounded-full transition-all border-2 ${bgColors[color]} ${
                          newScheduleColor === color ? 'border-slate-900 dark:border-white scale-110 shadow-md' : 'border-transparent hover:scale-105'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddScheduleModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button 
                  type="button"
                  onClick={async () => {
                    if (!newScheduleSubject || !newScheduleTimeStart || !newScheduleTimeEnd) {
                      alert('Isi semua data wajib!');
                      return;
                    }
                    await classData.addSchedule({
                      day: newScheduleDay,
                      subject: newScheduleSubject,
                      timeStart: newScheduleTimeStart,
                      timeEnd: newScheduleTimeEnd,
                      teacherName: newScheduleTeacher,
                      color: newScheduleColor
                    });
                    setShowAddScheduleModal(false);
                    alert('Jadwal pelajaran berhasil ditambahkan!');
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.2)] hover:shadow-[0_0_25px_rgba(37,99,235,0.3)]"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-700"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-600">Pemantauan Siswa</p><h3 className="mt-1 text-lg font-bold text-slate-800 dark:text-slate-100">Buat Kasus Pembinaan</h3></div><button onClick={() => setShowCaseModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><X className="h-5 w-5" /></button></div>
            <form onSubmit={handleCreateStudentCase} className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-bold text-slate-500">Siswa</label><select value={caseStudentId} onChange={(event) => setCaseStudentId(event.target.value)} required className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="">Pilih siswa</option>{classData.students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></div><div><label className="mb-1.5 block text-xs font-bold text-slate-500">Kelas</label><div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">{classData.classes.find((item) => item.id === caseClassId)?.name || 'Kelas aktif'}</div></div></div>
              <div><label className="mb-1.5 block text-xs font-bold text-slate-500">Judul kasus</label><input value={caseTitle} onChange={(event) => setCaseTitle(event.target.value)} placeholder="Contoh: Penurunan kehadiran" required className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /></div>
              <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-bold text-slate-500">Kategori</label><select value={caseCategory} onChange={(event) => setCaseCategory(event.target.value as CaseCategory)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="akademik">Akademik</option><option value="presensi">Presensi</option><option value="sikap">Sikap & perilaku</option><option value="sosial-emosional">Sosial-emosional</option><option value="kesehatan">Kesehatan</option><option value="keluarga-lingkungan">Keluarga/lingkungan</option><option value="lainnya">Lainnya</option></select></div><div><label className="mb-1.5 block text-xs font-bold text-slate-500">Prioritas</label><select value={casePriority} onChange={(event) => setCasePriority(event.target.value as CasePriority)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="mendesak">Mendesak</option><option value="tinggi">Tinggi</option><option value="sedang">Sedang</option><option value="rendah">Rendah</option></select></div></div>
              <div><label className="mb-1.5 block text-xs font-bold text-slate-500">Ringkasan</label><textarea value={caseSummary} onChange={(event) => setCaseSummary(event.target.value)} rows={4} placeholder="Jelaskan masalah atau kebutuhan bantuan siswa..." required className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /></div>
              <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-bold text-slate-500">Penanggung jawab</label><select value={caseOwnerId} onChange={(event) => setCaseOwnerId(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="">Saya sendiri</option>{caseOwners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}{owner.primaryRole === 'counselor' ? ' (BK)' : ''}</option>)}</select></div><div><label className="mb-1.5 block text-xs font-bold text-slate-500">Tenggat tindak lanjut</label><input type="date" value={caseDueDate} onChange={(event) => setCaseDueDate(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /></div></div>
              <div><label className="mb-1.5 block text-xs font-bold text-slate-500">Visibilitas</label><select value={caseVisibility} onChange={(event) => setCaseVisibility(event.target.value as CaseVisibility)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="ringkasan">Ringkasan untuk wali kelas, admin, dan BK</option><option value="sensitif">Sensitif untuk BK, admin, dan penanggung jawab</option></select></div>
              <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowCaseModal(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 dark:border-slate-600 dark:text-slate-300">Batal</button><button type="submit" className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700">Simpan Kasus</button></div>
            </form>
          </div>
        </div>
      )}

      {showCaseUpdateModal && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800"><div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-700"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-600">Tindak Lanjut</p><h3 className="mt-1 text-lg font-bold text-slate-800 dark:text-slate-100">Tambah Catatan</h3></div><button onClick={() => setShowCaseUpdateModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><X className="h-5 w-5" /></button></div><form onSubmit={handleAddCaseUpdate} className="space-y-4 p-5"><div><label className="mb-1.5 block text-xs font-bold text-slate-500">Catatan tindakan</label><textarea value={caseUpdateNote} onChange={(event) => setCaseUpdateNote(event.target.value)} rows={5} required placeholder="Tuliskan observasi, komunikasi, atau bantuan yang diberikan..." className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-bold text-slate-500">Tindak lanjut berikutnya</label><input type="date" value={caseNextFollowUpDate} onChange={(event) => setCaseNextFollowUpDate(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /></div><div><label className="mb-1.5 block text-xs font-bold text-slate-500">Visibilitas catatan</label><select value={caseUpdateVisibility} onChange={(event) => setCaseUpdateVisibility(event.target.value as CaseVisibility)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="ringkasan">Ringkasan</option><option value="sensitif">Sensitif</option></select></div></div><div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowCaseUpdateModal(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 dark:border-slate-600 dark:text-slate-300">Batal</button><button type="submit" className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700">Simpan Catatan</button></div></form></div>
        </div>
      )}

      {/* Modal Add Behavior */}
      {showAddBehaviorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{workspaceMode === 'teaching' ? 'Catat Sikap & Karakter' : 'Catat Sikap Siswa'}</h3>
              <button onClick={() => setShowAddBehaviorModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              await classData.addBehaviorRecord({
                studentId: behaviorStudentId,
                type: behaviorType,
                points: behaviorPoints,
                category: behaviorCategory,
                description: behaviorDescription,
                date: behaviorDate,
                subject: workspaceMode === 'teaching' ? activeTeachingSubject || undefined : undefined
              });
              setShowAddBehaviorModal(false);
              alert('Catatan sikap berhasil disimpan!');
            }} className="p-6 space-y-4">
              {workspaceMode === 'teaching' && <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-300"><span className="font-bold">Mata Pelajaran:</span> {activeTeachingSubject || 'Belum dipilih'}</div>}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nama Siswa</label>
                <select
                  value={behaviorStudentId}
                  onChange={(e) => setBehaviorStudentId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                  required
                >
                  {classData.students.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Jenis Sikap</label>
                  <select
                    value={behaviorType}
                    onChange={(e) => {
                      const val = e.target.value as 'positif' | 'negatif';
                      setBehaviorType(val);
                      setBehaviorPoints(val === 'positif' ? 10 : 5);
                      setBehaviorCategory('Kedisiplinan');
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="positif">Positif (+)</option>
                    <option value="negatif">Negatif (-)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Poin</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={behaviorPoints}
                    onChange={(e) => setBehaviorPoints(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Kategori</label>
                  <select
                    value={behaviorCategory}
                    onChange={(e) => setBehaviorCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {behaviorType === 'positif' ? (
                      <>
                        <option value="Sopan Santun">Sopan Santun</option>
                        <option value="Kedisiplinan">Kedisiplinan</option>
                        <option value="Tanggung Jawab">Tanggung Jawab</option>
                        <option value="Kejujuran">Kejujuran</option>
                        <option value="Kerjasama">Kerjasama</option>
                        <option value="Kepedulian">Kepedulian</option>
                      </>
                    ) : (
                      <>
                        <option value="Kedisiplinan">Kedisiplinan (Terlambat/Membolos)</option>
                        <option value="Kerapian">Kerapian (Seragam/Rambut)</option>
                        <option value="Sopan Santun">Sopan Santun (Perkataan/Sikap)</option>
                        <option value="Ketertiban">Ketertiban Kelas</option>
                        <option value="Kejujuran">Kejujuran (Mencontek/Kecurangan)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tanggal</label>
                  <input
                    type="date"
                    value={behaviorDate}
                    onChange={(e) => setBehaviorDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Contoh Keterangan</label>
                <div className="flex flex-wrap gap-2">
                  {(BEHAVIOR_DESCRIPTION_EXAMPLES[behaviorType][behaviorCategory] || []).map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setBehaviorDescription(example)}
                      className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-left text-xs font-medium text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
                    >
                      {example}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">Pilih contoh untuk mengisi keterangan, lalu sesuaikan bila diperlukan.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Keterangan / Tindakan</label>
                <textarea
                  value={behaviorDescription}
                  onChange={(e) => setBehaviorDescription(e.target.value)}
                  placeholder="Tulis detail tindakan/kejadian..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 h-24 resize-none"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddBehaviorModal(false)}
                  className="flex-1 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-lg shadow-blue-600/10"
                >
                  Simpan Catatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add Achievement */}
      {showAddAchievementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Catat Prestasi Siswa</h3>
              <button onClick={() => setShowAddAchievementModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              await classData.addAchievement({
                studentId: achievementStudentId,
                title: achievementTitle,
                level: achievementLevel,
                rank: achievementRank,
                date: achievementDate,
                description: achievementDescription
              });
              setShowAddAchievementModal(false);
              alert('Prestasi berhasil dicatat!');
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nama Siswa</label>
                <select
                  value={achievementStudentId}
                  onChange={(e) => setAchievementStudentId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                  required
                >
                  {classData.students.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nama Penghargaan / Prestasi</label>
                <input
                  type="text"
                  value={achievementTitle}
                  onChange={(e) => setAchievementTitle(e.target.value)}
                  placeholder="Contoh: Juara 1 Olimpiade Matematika"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tingkat</label>
                  <select
                    value={achievementLevel}
                    onChange={(e) => setAchievementLevel(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Sekolah">Sekolah</option>
                    <option value="Kecamatan">Kecamatan</option>
                    <option value="Kabupaten">Kabupaten/Kota</option>
                    <option value="Provinsi">Provinsi</option>
                    <option value="Nasional">Nasional</option>
                    <option value="Internasional">Internasional</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Peringkat / Juara</label>
                  <input
                    type="text"
                    value={achievementRank}
                    onChange={(e) => setAchievementRank(e.target.value)}
                    placeholder="Contoh: Juara 1, Finalis"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tanggal</label>
                <input
                  type="date"
                  value={achievementDate}
                  onChange={(e) => setAchievementDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Keterangan Tambahan</label>
                <textarea
                  value={achievementDescription}
                  onChange={(e) => setAchievementDescription(e.target.value)}
                  placeholder="Detail prestasi, penyelenggara, dll..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 h-20 resize-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddAchievementModal(false)}
                  className="flex-1 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-lg shadow-blue-600/10"
                >
                  Simpan Prestasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showPasswordModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-600">Keamanan Akun</p><h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Ubah Password</h3></div><button onClick={() => setShowPasswordModal(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Tutup"><X className="h-5 w-5" /></button></div><form onSubmit={handleChangePassword} className="space-y-4"><div><label className="mb-1.5 block text-xs font-bold text-slate-500">Password saat ini</label><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></div><div><label className="mb-1.5 block text-xs font-bold text-slate-500">Password baru</label><input type="password" autoComplete="new-password" minLength={6} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" /><p className="mt-1 text-[11px] text-slate-400">Minimal 6 karakter.</p></div><div><label className="mb-1.5 block text-xs font-bold text-slate-500">Konfirmasi password baru</label><input type="password" autoComplete="new-password" minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></div><button type="submit" className="w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white hover:bg-violet-700">Simpan Password Baru</button></form></div></div>}
    </div>
  );
};

export default Dashboard;
