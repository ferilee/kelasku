import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Users, Calendar, CheckSquare, Settings, LayoutDashboard, Plus, Trash2, Save, Megaphone, Upload, Edit2, Key, Lock, X, Download, Ban, FileText, Printer, FileSpreadsheet, Search, Clock, CalendarDays, Award, Menu, ImageIcon, Thermometer, ShieldAlert, AlertTriangle, MessageSquare, Activity, RefreshCw, Bell } from 'lucide-react';
import { useClassData, Student } from './ClassContext';
import { useNotifications } from './NotificationCenter';
import { ThemePicker } from './ThemeContext';
import { useModalAccessibility } from './useModalAccessibility';

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
type AssignmentStatus = 'draft' | 'published' | 'archived';

function apiErrorMessage(payload: { error?: string; code?: string } | null, fallback: string) {
  if (payload?.code === 'STORAGE_FORBIDDEN') return 'Penyimpanan sekolah menolak akses. Hubungi administrator.';
  if (payload?.code === 'STORAGE_NOT_FOUND') return 'Penyimpanan sekolah belum siap. Hubungi administrator.';
  if (payload?.code === 'STORAGE_UNAVAILABLE') return 'Penyimpanan sekolah sedang tidak tersedia. Silakan coba lagi.';
  return payload?.error || fallback;
}

function escapePrintHtml(value: string | null | undefined) {
  return (value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

function localDateValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function learningLevelTone(level: number | null | undefined) {
  if (!level) return 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400';
  if (level === 1) return 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';
  if (level === 2) return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
  if (level === 3) return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
}

type LearningSummaryFilter = 'all' | 'needs-support' | 'developing' | 'independent';

function learningSummaryStatus(student: StudentLearningSummary['students'][number]): Exclude<LearningSummaryFilter, 'all'> {
  if (!student.profile) return 'needs-support';
  const lowestLevel = Math.min(student.profile.conceptLevel, student.profile.reasoningLevel, student.profile.literacyLevel, student.profile.independenceLevel);
  if (lowestLevel <= 1) return 'needs-support';
  if (lowestLevel === 2) return 'developing';
  return 'independent';
}

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

type LearningLevel = 1 | 2 | 3 | 4;
type LearningObservationCategory = 'pemahaman konsep' | 'strategi pemecahan masalah' | 'literasi soal' | 'kemandirian' | 'partisipasi' | 'kolaborasi' | 'lainnya';
type StudentLearningProfile = {
  id: string; studentId: string; subject: string; topic: string;
  conceptLevel: LearningLevel; reasoningLevel: LearningLevel; literacyLevel: LearningLevel; independenceLevel: LearningLevel;
  strengths: string; supportNeeds: string; updatedBy: { id: string; name: string } | null; createdAt: string | null; updatedAt: string | null;
};
type StudentLearningObservation = {
  id: string; studentId: string; classId: string; subject: string; topic: string; category: LearningObservationCategory; note: string; date: string;
  recordedBy: { id: string; name: string } | null; createdAt: string | null;
};
type StudentLearningCheckpoint = {
  id: string; studentId: string; classId: string; subject: string; topic: string; date: string;
  recallLevel: LearningLevel; reasoningLevel: LearningLevel; transferLevel: LearningLevel; reflection: string;
  recordedBy: { id: string; name: string } | null; createdAt: string | null;
};
type StudentLearningData = {
  student: { id: string; name: string; identifier: string; status: string; classId: string; className: string; academicYear: string };
  profiles: StudentLearningProfile[]; observations: StudentLearningObservation[]; checkpoints: StudentLearningCheckpoint[];
};
type StudentLearningSummary = {
  class: { id: string; name: string; academicYear: string };
  subject: string; topic: string;
  students: Array<{
    id: string; name: string; identifier: string; status: string;
    profile: Pick<StudentLearningProfile, 'id' | 'subject' | 'topic' | 'conceptLevel' | 'reasoningLevel' | 'literacyLevel' | 'independenceLevel' | 'updatedAt'> | null;
    checkpoint: Pick<StudentLearningCheckpoint, 'id' | 'subject' | 'topic' | 'date' | 'recallLevel' | 'reasoningLevel' | 'transferLevel' | 'reflection'> | null;
  }>;
};
type LearningInterventionStatus = 'rencana' | 'berjalan' | 'selesai';
type StudentLearningIntervention = {
  id: string; classId: string; subject: string; topic: string; title: string; goal: string; strategy: string; scheduledDate: string | null; status: LearningInterventionStatus;
  createdBy: { id: string; name: string } | null; createdAt: string | null; updatedAt: string | null;
  members: Array<{ id: string; name: string; identifier: string }>;
};

type ActivityAction = 'login' | 'logout' | 'page_view' | 'material_opened' | 'material_downloaded' | 'assignment_opened' | 'assignment_submitted';
type ActivityStudent = {
  id: string; name: string; identifier: string; status: string; classId: string | null; className: string;
  online: boolean; lastActiveAt: string | null; totalActiveSeconds: number; sessionCount: number; activityCount: number;
  latestActivity: { action: ActivityAction; occurredAt: string; page: string | null; resourceTitle: string | null } | null;
  assignmentStats: { total: number; pendingCount: number; overdueCount: number; lateCount: number; attention: 'overdue' | 'opened_pending' | 'not_started' | 'none' };
};
type ActivityReport = {
  generatedAt: string;
  summary: { onlineCount: number; activeStudentCount: number; totalActiveSeconds: number; sessionCount: number; activityCount: number };
  students: ActivityStudent[];
  sessions: Array<{ id: string; studentId: string; studentName: string; className: string; startedAt: string; lastSeenAt: string; endedAt: string | null; endReason: string | null; activeSeconds: number }>;
  activities: Array<{ id: string; sessionId: string; studentId: string; studentName: string; action: ActivityAction; page: string | null; resourceType: string | null; resourceId: string | null; resourceTitle: string | null; occurredAt: string }>;
};

type AttendanceReminder = {
  id: string;
  scheduleId: string;
  scheduleIds: string[];
  classId: string;
  className: string;
  subject: string;
  date: string;
  day: string;
  timeStart: string;
  timeEnd: string;
  dueAt: string;
  studentCount: number;
  recordedCount: number;
  status: 'missing' | 'incomplete';
};

type ScheduleChangeRequest = {
  id: string;
  scheduleId: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
  subject: string;
  current: { day: string; timeStart: string; timeEnd: string } | null;
  requested: { day: string; timeStart: string; timeEnd: string };
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNote: string | null;
  reviewerName: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

type TeachingJournal = {
  id: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
  subjectId: string;
  subject: string;
  scheduleId: string | null;
  date: string;
  day: string;
  timeStart: string | null;
  timeEnd: string | null;
  schedule: { day: string; timeStart: string; timeEnd: string } | null;
  materialCovered: string;
  classroomEvents: string;
  nextPlan: string;
  createdAt: string;
  updatedAt: string;
};

type TeachingJournalForm = {
  classId: string;
  subject: string;
  scheduleId: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  materialCovered: string;
  classroomEvents: string;
  nextPlan: string;
};

const TEACHING_DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
const currentTeachingDay = () => {
  const day = new Date().getDay();
  return day >= 1 && day <= 5 ? TEACHING_DAY_NAMES[day - 1] : null;
};

type TeacherWorkspace = {
  user: { id: string; name: string; roles: string[] };
  homeroomClasses: { id: string; name: string; academicYear: string }[];
  subjectGroups: { subjectId: string; subjectName: string; classes: { assignmentId: string; classId: string; className: string; academicYear: string; studentCount: number; gradeCount: number }[] }[];
  teachingSchedule: { id: string; classId: string; className: string; day: string; subject: string; timeStart: string; timeEnd: string }[];
};

const EMPTY_TEACHER_WORKSPACE: TeacherWorkspace = { user: { id: '', name: '', roles: [] }, homeroomClasses: [], subjectGroups: [], teachingSchedule: [] };

const activityLabels: Record<ActivityAction, string> = {
  login: 'Masuk', logout: 'Keluar', page_view: 'Membuka halaman', material_opened: 'Membuka materi', material_downloaded: 'Mengunduh materi', assignment_opened: 'Membuka tugas', assignment_submitted: 'Mengumpulkan tugas',
};

const activityAttentionLabels = {
  overdue: 'Lewat tenggat',
  opened_pending: 'Sudah membuka, belum mengumpulkan',
  not_started: 'Belum mulai tugas',
  none: 'Tidak ada tindak lanjut',
} as const;

const formatActivityDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return '< 1 menit';
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} jam ${minutes % 60} menit` : `${minutes} menit`;
};

const Dashboard = ({ userRole = 'admin' }: { userRole?: DashboardRole }) => {
  useModalAccessibility();
  const [activeTab, setActiveTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'workspace');
  const classData = useClassData();
  const { notify, confirm } = useNotifications();
  const [workspaceMode, setWorkspaceMode] = useState<'homeroom' | 'teaching'>(() => {
    const savedMode = window.localStorage.getItem(`webkelas-workspace-mode-${userRole}`);
    if (savedMode === 'homeroom' || savedMode === 'teaching') return savedMode;
    return userRole === 'teacher' ? 'teaching' : 'homeroom';
  });
  const [activeTeachingSubject, setActiveTeachingSubject] = useState<string | null>(() => new URLSearchParams(window.location.search).get('subject'));
  const canManageStudents = userRole === 'admin';
  const canViewLearningProfiles = userRole === 'admin' || userRole === 'teacher' || userRole === 'counselor';
  const [workspace, setWorkspace] = useState<TeacherWorkspace>(EMPTY_TEACHER_WORKSPACE);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);
  const [scheduleChangeRequests, setScheduleChangeRequests] = useState<ScheduleChangeRequest[]>([]);
  const [showScheduleRequestModal, setShowScheduleRequestModal] = useState(false);
  const [selectedScheduleForRequest, setSelectedScheduleForRequest] = useState<{ id: string; classId: string; className: string; subject: string; day: string; timeStart: string; timeEnd: string } | null>(null);
  const [requestedScheduleDay, setRequestedScheduleDay] = useState('Senin');
  const [requestedScheduleTimeStart, setRequestedScheduleTimeStart] = useState('07:30');
  const [requestedScheduleTimeEnd, setRequestedScheduleTimeEnd] = useState('09:00');
  const [scheduleRequestReason, setScheduleRequestReason] = useState('');
  const [isSubmittingScheduleRequest, setIsSubmittingScheduleRequest] = useState(false);
  const [teachingJournals, setTeachingJournals] = useState<TeachingJournal[]>([]);
  const [journalClassFilter, setJournalClassFilter] = useState('all');
  const [journalSubjectFilter, setJournalSubjectFilter] = useState('all');
  const [journalFrom, setJournalFrom] = useState('');
  const [journalTo, setJournalTo] = useState('');
  const [isLoadingJournals, setIsLoadingJournals] = useState(false);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [journalForm, setJournalForm] = useState<TeachingJournalForm>({ classId: '', subject: '', scheduleId: '', date: localDateValue(), timeStart: '', timeEnd: '', materialCovered: '', classroomEvents: '', nextPlan: '' });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [attendanceReminders, setAttendanceReminders] = useState<AttendanceReminder[]>([]);
  const [showAttendanceReminders, setShowAttendanceReminders] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<AttendanceReminder | null>(null);
  const [reminderReason, setReminderReason] = useState('');
  const [isSavingReminderException, setIsSavingReminderException] = useState(false);

  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        const response = await fetch('/api/my-workspace');
        if (response.ok) setWorkspace(await response.json());
      } finally { setIsLoadingWorkspace(false); }
    };
    fetchWorkspace();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(`webkelas-workspace-mode-${userRole}`, workspaceMode);
  }, [userRole, workspaceMode]);

  const fetchAttendanceReminders = useCallback(async () => {
    if (userRole !== 'teacher') return;
    try {
      const response = await fetch('/api/attendance-reminders');
      if (response.ok) {
        const result = await response.json();
        setAttendanceReminders(result.reminders || []);
      }
    } catch (error) {
      console.error('Gagal memuat pengingat presensi:', error);
    }
  }, [userRole]);

  useEffect(() => {
    if (userRole !== 'teacher') return undefined;
    fetchAttendanceReminders();
    const intervalId = window.setInterval(fetchAttendanceReminders, 60_000);
    return () => window.clearInterval(intervalId);
  }, [fetchAttendanceReminders, userRole]);

  const fetchScheduleChangeRequests = useCallback(async () => {
    try {
      const response = await fetch('/api/schedule-change-requests');
      if (response.ok) setScheduleChangeRequests(await response.json());
    } catch (error) {
      console.error('Gagal memuat pengajuan perubahan jadwal:', error);
    }
  }, []);

  useEffect(() => {
    fetchScheduleChangeRequests();
  }, [fetchScheduleChangeRequests]);

  const fetchTeachingJournals = useCallback(async () => {
    setIsLoadingJournals(true);
    try {
      const params = new URLSearchParams();
      if (journalClassFilter !== 'all') params.set('classId', journalClassFilter);
      if (journalSubjectFilter !== 'all') params.set('subject', journalSubjectFilter);
      if (journalFrom) params.set('from', journalFrom);
      if (journalTo) params.set('to', journalTo);
      const response = await fetch(`/api/teaching-journals${params.toString() ? `?${params.toString()}` : ''}`);
      if (response.ok) setTeachingJournals(await response.json());
    } catch (error) {
      console.error('Gagal memuat jurnal mengajar:', error);
    } finally {
      setIsLoadingJournals(false);
    }
  }, [journalClassFilter, journalFrom, journalSubjectFilter, journalTo, userRole]);

  useEffect(() => {
    fetchTeachingJournals();
  }, [fetchTeachingJournals]);

  const journalClassOptions = Array.from(new Map([
    ...workspace.subjectGroups.flatMap((group) => group.classes.map((item) => [item.classId, { id: item.classId, name: item.className }] as const)),
    ...teachingJournals.map((item) => [item.classId, { id: item.classId, name: item.className }] as const),
  ]).values());
  const subjectOptionsForClass = (classId: string) => workspace.subjectGroups.filter((group) => !classId || group.classes.some((item) => item.classId === classId)).map((group) => ({ id: group.subjectId, name: group.subjectName }));
  const journalSubjectOptions = subjectOptionsForClass(journalForm.classId);
  const journalFilterSubjectOptions = Array.from(new Set([...workspace.subjectGroups.map((group) => group.subjectName), ...teachingJournals.map((item) => item.subject)])).sort((first, second) => first.localeCompare(second, 'id'));
  const journalScheduleOptions = workspace.teachingSchedule.filter((item) => item.classId === journalForm.classId && item.subject === journalForm.subject);

  const resetJournalForm = () => {
    const firstClass = journalClassOptions[0];
    const firstSubject = subjectOptionsForClass(firstClass?.id || '')[0];
    setJournalForm({ classId: firstClass?.id || '', subject: firstSubject?.name || '', scheduleId: '', date: localDateValue(), timeStart: '', timeEnd: '', materialCovered: '', classroomEvents: '', nextPlan: '' });
  };

  const openNewJournal = (schedule?: TeacherWorkspace['teachingSchedule'][number]) => {
    const firstClass = journalClassOptions[0];
    const firstSubject = subjectOptionsForClass(firstClass?.id || '')[0];
    setEditingJournalId(null);
    setJournalForm({
      classId: schedule?.classId || firstClass?.id || '', subject: schedule?.subject || firstSubject?.name || '', scheduleId: schedule?.id || '', date: localDateValue(),
      timeStart: schedule?.timeStart || '', timeEnd: schedule?.timeEnd || '', materialCovered: '', classroomEvents: '', nextPlan: '',
    });
    setShowJournalModal(true);
  };

  const openEditJournal = (journal: TeachingJournal) => {
    setEditingJournalId(journal.id);
    setJournalForm({ classId: journal.classId, subject: journal.subject, scheduleId: journal.scheduleId || '', date: journal.date, timeStart: journal.timeStart || '', timeEnd: journal.timeEnd || '', materialCovered: journal.materialCovered, classroomEvents: journal.classroomEvents, nextPlan: journal.nextPlan });
    setShowJournalModal(true);
  };

  const handleSaveJournal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSavingJournal || !journalForm.classId || !journalForm.subject || !journalForm.date || !journalForm.materialCovered.trim()) return;
    setIsSavingJournal(true);
    try {
      const response = await fetch(editingJournalId ? `/api/teaching-journals/${editingJournalId}` : '/api/teaching-journals', {
        method: editingJournalId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...journalForm, scheduleId: journalForm.scheduleId || null }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) return notify(result?.error || 'Gagal menyimpan jurnal mengajar.', 'error');
      setShowJournalModal(false);
      setEditingJournalId(null);
      resetJournalForm();
      await fetchTeachingJournals();
      notify(editingJournalId ? 'Jurnal mengajar berhasil diperbarui.' : 'Jurnal mengajar berhasil disimpan.', 'success');
    } catch (error) {
      console.error('Gagal menyimpan jurnal mengajar:', error);
      notify('Terjadi kesalahan saat menyimpan jurnal mengajar.', 'error');
    } finally {
      setIsSavingJournal(false);
    }
  };

  const handleDeleteJournal = async (journal: TeachingJournal) => {
    if (!(await confirm({ title: 'Hapus jurnal mengajar', message: `Hapus jurnal ${journal.subject} pada ${journal.date}?`, danger: true, confirmLabel: 'Hapus' }))) return;
    const response = await fetch(`/api/teaching-journals/${journal.id}`, { method: 'DELETE' });
    const result = await response.json().catch(() => null);
    if (!response.ok) return notify(result?.error || 'Gagal menghapus jurnal mengajar.', 'error');
    await fetchTeachingJournals();
    notify('Jurnal mengajar berhasil dihapus.', 'success');
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', activeTab);
    if (classData.classId) params.set('classId', classData.classId);
    else params.delete('classId');
    if (activeTeachingSubject) params.set('subject', activeTeachingSubject);
    else params.delete('subject');
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, [activeTab, classData.classId, activeTeachingSubject]);

  useEffect(() => {
    const requestedClassId = new URLSearchParams(window.location.search).get('classId');
    if (requestedClassId && classData.classes.some((item) => item.id === requestedClassId) && classData.classId !== requestedClassId) {
      classData.selectClass(requestedClassId).catch(() => undefined);
    }
  }, [classData.classes, classData.classId, classData.selectClass]);

  const openTeachingClass = async (classId: string, subjectName: string) => {
    await classData.selectClass(classId);
    setWorkspaceMode('teaching');
    setActiveTeachingSubject(subjectName);
    setBehaviorSubTab('sikap');
    setSelectedSubject(subjectName);
    setActiveTab('academic');
  };

  const openAttendanceReminder = async (reminder: AttendanceReminder) => {
    await classData.selectClass(reminder.classId);
    setWorkspaceMode('teaching');
    setActiveTeachingSubject(reminder.subject);
    setTeachingAttendanceDate(reminder.date);
    setActiveTab('teaching-attendance');
    setShowAttendanceReminders(false);
  };

  const handleSkipAttendanceReminder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedReminder || !reminderReason.trim() || isSavingReminderException) return;
    setIsSavingReminderException(true);
    try {
      const response = await fetch(`/api/attendance-reminders/${selectedReminder.scheduleId}/skip`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedReminder.date, reason: reminderReason.trim() }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) return notify(result?.error || 'Gagal menandai jadwal.', 'error');
      setSelectedReminder(null);
      setReminderReason('');
      await fetchAttendanceReminders();
      notify('Jadwal ditandai tidak ada pertemuan.', 'success');
    } catch (error) {
      console.error('Gagal menandai jadwal:', error);
      notify('Terjadi kesalahan saat menandai jadwal.', 'error');
    } finally {
      setIsSavingReminderException(false);
    }
  };

  const openScheduleRequest = (schedule: { id: string; classId: string; className: string; subject: string; day: string; timeStart: string; timeEnd: string }) => {
    setSelectedScheduleForRequest(schedule);
    setRequestedScheduleDay(schedule.day);
    setRequestedScheduleTimeStart(schedule.timeStart);
    setRequestedScheduleTimeEnd(schedule.timeEnd);
    setScheduleRequestReason('');
    setShowScheduleRequestModal(true);
  };

  const handleSubmitScheduleRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedScheduleForRequest || !scheduleRequestReason.trim() || isSubmittingScheduleRequest) return;
    setIsSubmittingScheduleRequest(true);
    try {
      const response = await fetch('/api/schedule-change-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId: selectedScheduleForRequest.id, day: requestedScheduleDay, timeStart: requestedScheduleTimeStart, timeEnd: requestedScheduleTimeEnd, reason: scheduleRequestReason.trim() }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) return notify(result?.error || 'Gagal mengajukan perubahan jadwal.', 'error');
      setShowScheduleRequestModal(false);
      setSelectedScheduleForRequest(null);
      setScheduleRequestReason('');
      await fetchScheduleChangeRequests();
      notify('Pengajuan perubahan jadwal berhasil dikirim.', 'success');
    } catch (error) {
      console.error('Gagal mengajukan perubahan jadwal:', error);
      notify('Terjadi kesalahan saat mengajukan perubahan jadwal.', 'error');
    } finally {
      setIsSubmittingScheduleRequest(false);
    }
  };

  const handleReviewScheduleRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    const message = status === 'approved' ? 'Setujui perubahan jadwal ini?' : 'Tolak pengajuan perubahan jadwal ini?';
    if (!(await confirm({ title: status === 'approved' ? 'Setujui jadwal' : 'Tolak jadwal', message, danger: status === 'rejected', confirmLabel: status === 'approved' ? 'Setujui' : 'Tolak' }))) return;
    const response = await fetch(`/api/schedule-change-requests/${requestId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    const result = await response.json().catch(() => null);
    if (!response.ok) return notify(result?.error || 'Gagal memproses pengajuan.', 'error');
    await fetchScheduleChangeRequests();
    await classData.selectClass(classData.classId || '');
    notify(status === 'approved' ? 'Perubahan jadwal disetujui.' : 'Pengajuan perubahan jadwal ditolak.', 'success');
  };

  const handleAddTeachingAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!classData.classId || !activeTeachingSubject || !teachingAnnouncementText.trim()) return;
    const response = await fetch('/api/teaching-announcements', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId: classData.classId, subject: activeTeachingSubject, type: teachingAnnouncementType, text: teachingAnnouncementText }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) return notify(result?.error || 'Gagal menyimpan informasi untuk siswa.', 'error');
    setTeachingAnnouncementText('');
    await classData.selectClass(classData.classId);
    notify('Informasi berhasil ditampilkan kepada siswa di kelas ini.', 'success');
  };

  const handleRemoveTeachingAnnouncement = async (id: string) => {
    if (!(await confirm({ title: 'Hapus informasi', message: 'Hapus informasi ini dari dashboard siswa?', danger: true, confirmLabel: 'Hapus' }))) return;
    const response = await fetch(`/api/teaching-announcements/${id}`, { method: 'DELETE' });
    const result = await response.json().catch(() => null);
    if (!response.ok) return notify(result?.error || 'Gagal menghapus informasi.', 'error');
    if (classData.classId) await classData.selectClass(classData.classId);
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) return notify('Konfirmasi password baru tidak sama.', 'warning');
    try {
      const response = await fetch('/api/auth/password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) });
      const data = await response.json();
      if (!response.ok) return notify(data.error || 'Gagal mengubah password.', 'error');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setShowPasswordModal(false);
      notify('Password berhasil diubah.', 'success');
    } catch (error) { console.error('Error changing password:', error); notify('Terjadi kesalahan saat mengubah password.', 'error'); }
  };

  const loadLearningProfile = async (student: Student) => {
    setSelectedLearningStudent(student);
    setShowLearningProfileModal(true);
    setIsLoadingLearningProfile(true);
    setLearningProfileData(null);
    setLearningProfileForm({ subject: activeTeachingSubject || 'Matematika', topic: '', conceptLevel: 1, reasoningLevel: 1, literacyLevel: 1, independenceLevel: 1, strengths: '', supportNeeds: '' });
    setLearningObservationForm({ subject: activeTeachingSubject || 'Matematika', topic: '', category: 'pemahaman konsep', note: '', date: localDateValue() });
    setLearningCheckpointForm({ subject: activeTeachingSubject || 'Matematika', topic: '', date: localDateValue(), recallLevel: 1, reasoningLevel: 1, transferLevel: 1, reflection: '' });
    try {
      const response = await fetch(`/api/student-learning-profiles/${student.id}`);
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setShowLearningProfileModal(false);
        return notify(result?.error || 'Gagal memuat profil belajar.', 'error');
      }
      setLearningProfileData(result);
      const latest = result.profiles?.[0] as StudentLearningProfile | undefined;
      if (latest) {
        setLearningProfileForm({ subject: latest.subject, topic: latest.topic, conceptLevel: latest.conceptLevel, reasoningLevel: latest.reasoningLevel, literacyLevel: latest.literacyLevel, independenceLevel: latest.independenceLevel, strengths: latest.strengths, supportNeeds: latest.supportNeeds });
        setLearningObservationForm((current) => ({ ...current, subject: latest.subject, topic: latest.topic }));
        setLearningCheckpointForm((current) => ({ ...current, subject: latest.subject, topic: latest.topic }));
      }
    } catch (error) {
      console.error('Gagal memuat profil belajar:', error);
      setShowLearningProfileModal(false);
      notify('Terjadi kesalahan saat memuat profil belajar.', 'error');
    } finally {
      setIsLoadingLearningProfile(false);
    }
  };

  const refreshLearningProfile = async () => {
    if (!selectedLearningStudent) return;
    const response = await fetch(`/api/student-learning-profiles/${selectedLearningStudent.id}`);
    if (response.ok) setLearningProfileData(await response.json());
  };

  const handleSaveLearningProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedLearningStudent || isSavingLearningProfile || !learningProfileForm.topic.trim()) return;
    setIsSavingLearningProfile(true);
    try {
      const response = await fetch(`/api/student-learning-profiles/${selectedLearningStudent.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(learningProfileForm) });
      const result = await response.json().catch(() => null);
      if (!response.ok) return notify(result?.error || 'Gagal menyimpan profil belajar.', 'error');
      await refreshLearningProfile();
      notify('Profil belajar berhasil disimpan.', 'success');
    } catch (error) {
      console.error('Gagal menyimpan profil belajar:', error);
      notify('Terjadi kesalahan saat menyimpan profil belajar.', 'error');
    } finally {
      setIsSavingLearningProfile(false);
    }
  };

  const handleSaveLearningObservation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedLearningStudent || isSavingLearningObservation || !learningObservationForm.topic.trim() || !learningObservationForm.note.trim()) return;
    setIsSavingLearningObservation(true);
    try {
      const response = await fetch(`/api/student-learning-profiles/${selectedLearningStudent.id}/observations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(learningObservationForm) });
      const result = await response.json().catch(() => null);
      if (!response.ok) return notify(result?.error || 'Gagal menyimpan observasi.', 'error');
      setLearningObservationForm((current) => ({ ...current, note: '' }));
      await refreshLearningProfile();
      notify('Observasi belajar berhasil dicatat.', 'success');
    } catch (error) {
      console.error('Gagal menyimpan observasi belajar:', error);
      notify('Terjadi kesalahan saat menyimpan observasi.', 'error');
    } finally {
      setIsSavingLearningObservation(false);
    }
  };

  const handleSaveLearningCheckpoint = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedLearningStudent || isSavingLearningCheckpoint || !learningCheckpointForm.topic.trim()) return;
    setIsSavingLearningCheckpoint(true);
    try {
      const response = await fetch(`/api/student-learning-profiles/${selectedLearningStudent.id}/checkpoints`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(learningCheckpointForm) });
      const result = await response.json().catch(() => null);
      if (!response.ok) return notify(result?.error || 'Gagal menyimpan checkpoint.', 'error');
      setLearningCheckpointForm((current) => ({ ...current, reflection: '' }));
      await refreshLearningProfile();
      notify('Checkpoint belajar berhasil disimpan.', 'success');
    } catch (error) {
      console.error('Gagal menyimpan checkpoint:', error);
      notify('Terjadi kesalahan saat menyimpan checkpoint.', 'error');
    } finally {
      setIsSavingLearningCheckpoint(false);
    }
  };

  const handleDeleteLearningObservation = async (observation: StudentLearningObservation) => {
    if (!(await confirm({ title: 'Hapus observasi', message: 'Hapus catatan observasi ini?', danger: true, confirmLabel: 'Hapus' }))) return;
    const response = await fetch(`/api/student-learning-observations/${observation.id}`, { method: 'DELETE' });
    const result = await response.json().catch(() => null);
    if (!response.ok) return notify(result?.error || 'Gagal menghapus observasi.', 'error');
    await refreshLearningProfile();
    notify('Observasi berhasil dihapus.', 'success');
  };

  const handleDeleteLearningCheckpoint = async (checkpoint: StudentLearningCheckpoint) => {
    if (!(await confirm({ title: 'Hapus checkpoint', message: 'Hapus hasil checkpoint ini?', danger: true, confirmLabel: 'Hapus' }))) return;
    const response = await fetch(`/api/student-learning-checkpoints/${checkpoint.id}`, { method: 'DELETE' });
    const result = await response.json().catch(() => null);
    if (!response.ok) return notify(result?.error || 'Gagal menghapus checkpoint.', 'error');
    await refreshLearningProfile();
    notify('Checkpoint berhasil dihapus.', 'success');
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
  const [teachingAnnouncementType, setTeachingAnnouncementType] = useState<'PENTING' | 'INFO' | 'SELAMAT'>('INFO');
  const [teachingAnnouncementText, setTeachingAnnouncementText] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [manualNisn, setManualNisn] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualGender, setManualGender] = useState<'L' | 'P'>('L');
  const [manualStatus, setManualStatus] = useState<'Aktif' | 'Nonaktif'>('Aktif');
  const [showLearningProfileModal, setShowLearningProfileModal] = useState(false);
  const [selectedLearningStudent, setSelectedLearningStudent] = useState<Student | null>(null);
  const [learningProfileData, setLearningProfileData] = useState<StudentLearningData | null>(null);
  const [isLoadingLearningProfile, setIsLoadingLearningProfile] = useState(false);
  const [isSavingLearningProfile, setIsSavingLearningProfile] = useState(false);
  const [isSavingLearningObservation, setIsSavingLearningObservation] = useState(false);
  const [isSavingLearningCheckpoint, setIsSavingLearningCheckpoint] = useState(false);
  const [learningProfileForm, setLearningProfileForm] = useState({ subject: 'Matematika', topic: '', conceptLevel: 1 as LearningLevel, reasoningLevel: 1 as LearningLevel, literacyLevel: 1 as LearningLevel, independenceLevel: 1 as LearningLevel, strengths: '', supportNeeds: '' });
  const [learningObservationForm, setLearningObservationForm] = useState({ subject: 'Matematika', topic: '', category: 'pemahaman konsep' as LearningObservationCategory, note: '', date: localDateValue() });
  const [learningCheckpointForm, setLearningCheckpointForm] = useState({ subject: 'Matematika', topic: '', date: localDateValue(), recallLevel: 1 as LearningLevel, reasoningLevel: 1 as LearningLevel, transferLevel: 1 as LearningLevel, reflection: '' });
  const [learningSummary, setLearningSummary] = useState<StudentLearningSummary | null>(null);
  const [learningSummarySource, setLearningSummarySource] = useState<StudentLearningSummary | null>(null);
  const [learningSummaryFilter, setLearningSummaryFilter] = useState<LearningSummaryFilter>('all');
  const [learningSummarySubject, setLearningSummarySubject] = useState('Matematika');
  const [learningSummaryTopic, setLearningSummaryTopic] = useState('');
  const [isLoadingLearningSummary, setIsLoadingLearningSummary] = useState(false);
  const [learningInterventions, setLearningInterventions] = useState<StudentLearningIntervention[]>([]);
  const [isLoadingLearningInterventions, setIsLoadingLearningInterventions] = useState(false);
  const [selectedInterventionStudentIds, setSelectedInterventionStudentIds] = useState<string[]>([]);
  const [showLearningInterventionModal, setShowLearningInterventionModal] = useState(false);
  const [isSavingLearningIntervention, setIsSavingLearningIntervention] = useState(false);
  const [learningInterventionForm, setLearningInterventionForm] = useState({ title: '', goal: '', strategy: '', scheduledDate: '', status: 'rencana' as LearningInterventionStatus });

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
  const [monitoringSubTab, setMonitoringSubTab] = useState<'cases' | 'activity'>(userRole === 'teacher' ? 'activity' : 'cases');
  const [activityFrom, setActivityFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [activityTo, setActivityTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [activityActionFilter, setActivityActionFilter] = useState<'all' | ActivityAction>('all');
  const [activityAttentionFilter, setActivityAttentionFilter] = useState<'all' | ActivityStudent['assignmentStats']['attention']>('all');
  const [activitySearch, setActivitySearch] = useState('');
  const [studentActivityReport, setStudentActivityReport] = useState<ActivityReport | null>(null);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [selectedActivityStudentId, setSelectedActivityStudentId] = useState<string | null>(null);
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

  const fetchStudentActivity = useCallback(async () => {
    setIsLoadingActivity(true);
    try {
      const params = new URLSearchParams({ from: activityFrom, to: activityTo });
      if (monitoringClassFilter !== 'all') params.set('classId', monitoringClassFilter);
      if (activityActionFilter !== 'all') params.set('action', activityActionFilter);
      const response = await fetch(`/api/student-activity?${params.toString()}`);
      if (response.ok) setStudentActivityReport(await response.json());
      else setStudentActivityReport(null);
    } catch (error) {
      console.error('Error fetching student activity:', error);
      setStudentActivityReport(null);
    } finally {
      setIsLoadingActivity(false);
    }
  }, [activityActionFilter, activityFrom, activityTo, monitoringClassFilter, userRole]);

  useEffect(() => {
    if (activeTab !== 'monitoring' || monitoringSubTab !== 'activity') return undefined;
    fetchStudentActivity();
    const refreshId = window.setInterval(fetchStudentActivity, 30_000);
    return () => window.clearInterval(refreshId);
  }, [activeTab, monitoringSubTab, fetchStudentActivity]);

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
    if (!response.ok) return notify(result?.error || 'Gagal membuat kasus pembinaan.', 'error');
    setShowCaseModal(false);
    await fetchMonitoring();
    notify('Kasus pembinaan berhasil dibuat.', 'success');
  };

  const openCaseDetail = async (caseId: string) => {
    const response = await fetch(`/api/student-cases/${caseId}`);
    if (!response.ok) return notify((await response.json().catch(() => null))?.error || 'Gagal memuat detail kasus.', 'error');
    setSelectedCase(await response.json());
  };

  const updateStudentCase = async (caseId: string, payload: Record<string, unknown>) => {
    const response = await fetch(`/api/student-cases/${caseId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => null);
    if (!response.ok) return notify(result?.error || 'Gagal memperbarui kasus.', 'error');
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
    if (!response.ok) return notify(result?.error || 'Gagal menyimpan tindak lanjut.', 'error');
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
  const [statsTab, setStatsTab] = useState<'harian' | 'mingguan' | 'bulanan'>('harian');
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

  useEffect(() => {
    if (workspaceMode === 'teaching') setStatsTab('harian');
  }, [workspaceMode, activeTeachingSubject]);

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
  const [tempScores, setTempScores] = useState<Record<string, number | ''>>({});
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
    if (!res.ok) return notify((await res.json()).error || 'Gagal menyimpan mata pelajaran.');
    setSelectedSubject(name);
    setSubjectName('');
    setEditingSubjectId(null);
    fetchSubjects();
    fetchGrades();
  };

  const handleDeleteSubject = async (subject: { id: number; name: string }) => {
    if (!(await confirm({ title: 'Hapus mata pelajaran', message: `Hapus mata pelajaran "${subject.name}"?`, danger: true, confirmLabel: 'Hapus' }))) return;
    const res = await fetch(`/api/subjects/${subject.id}`, { method: 'DELETE' });
    if (!res.ok) return notify((await res.json()).error || 'Gagal menghapus mata pelajaran.');
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
      notify('Nilai berhasil disimpan!');
      fetchGrades();
    } catch (err) {
      console.error('Error saving grades:', err);
      notify('Gagal menyimpan nilai.');
    }
  };

  const handleDeleteAssessment = async (assessmentName: string, assessmentType: string) => {
    const isConfirmed = await confirm({ title: 'Hapus kolom penilaian', message: `Apakah Anda yakin ingin menghapus kolom penilaian "${assessmentName}"?`, danger: true, confirmLabel: 'Hapus' });
    if (!isConfirmed) return;
    try {
      const res = await fetch(`/api/grades/assessment?subject=${encodeURIComponent(selectedSubject)}&type=${assessmentType}&name=${encodeURIComponent(assessmentName)}&classId=${classData.classId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        notify('Kolom penilaian berhasil dihapus!');
        fetchGrades();
      }
    } catch (err) {
      console.error('Error deleting assessment:', err);
      notify('Gagal menghapus kolom penilaian.');
    }
  };

  // Academic Sub-tabs & Bank Materi / Tugas States
  const [academicSubTab, setAcademicSubTab] = useState<'grades' | 'materials' | 'schedule'>('grades');
  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false);
  const [newScheduleDay, setNewScheduleDay] = useState('Senin');
  const [newScheduleSubject, setNewScheduleSubject] = useState('');
  const [newScheduleTimeStart, setNewScheduleTimeStart] = useState('07:30');
  const [newScheduleTimeEnd, setNewScheduleTimeEnd] = useState('09:00');
  const [newScheduleTeacherId, setNewScheduleTeacherId] = useState('');
  const [newScheduleColor, setNewScheduleColor] = useState('blue');

  useEffect(() => {
    if (activeTab === 'academic' && academicSubTab === 'schedule' && userRole === 'admin') fetchTeachingSetup();
  }, [activeTab, academicSubTab, fetchTeachingSetup, userRole]);

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
  const [newAssignmentFile, setNewAssignmentFile] = useState<File | null>(null);
  const [newAssignmentStatus, setNewAssignmentStatus] = useState<AssignmentStatus>('published');
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [newAssignmentTargetClassIds, setNewAssignmentTargetClassIds] = useState<string[]>([]);
  const [editingAssignmentId, setEditingAssignmentId] = useState<number | null>(null);
  
  const [viewSubmissionsAssignmentId, setViewSubmissionsAssignmentId] = useState<number | null>(null);
  const [submissionClassId, setSubmissionClassId] = useState('');
  const [submissionsList, setSubmissionsList] = useState<any[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [tempSubGrades, setTempSubGrades] = useState<Record<number, number | ''>>({});
  const [submissionSearch, setSubmissionSearch] = useState('');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<'all' | 'submitted' | 'pending' | 'ungraded' | 'late'>('all');

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (selectedActivityStudentId) setSelectedActivityStudentId(null);
      else if (viewSubmissionsAssignmentId !== null) setViewSubmissionsAssignmentId(null);
      else if (showAddAssignmentModal) setShowAddAssignmentModal(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedActivityStudentId, viewSubmissionsAssignmentId, showAddAssignmentModal]);

  const filteredSubmissions = submissionsList.filter((submission) => {
    const query = submissionSearch.trim().toLowerCase();
    const matchesSearch = !query || submission.studentName.toLowerCase().includes(query) || String(submission.studentNisn || '').includes(query);
    const matchesStatus = submissionStatusFilter === 'all'
      || (submissionStatusFilter === 'submitted' && submission.hasSubmitted)
      || (submissionStatusFilter === 'pending' && !submission.hasSubmitted)
      || (submissionStatusFilter === 'ungraded' && submission.hasSubmitted && submission.grade === null)
      || (submissionStatusFilter === 'late' && submission.late);
    return matchesSearch && matchesStatus;
  });

  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentTypeFilter, setAssignmentTypeFilter] = useState<'all' | 'tugas' | 'materi'>('all');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<'all' | AssignmentStatus>('all');
  const [assignmentClassFilter, setAssignmentClassFilter] = useState('all');
  const [assignmentSort, setAssignmentSort] = useState<'newest' | 'dueSoon'>('newest');

  const filteredAssignments = assignmentsList
    .filter((item) => {
      const query = assignmentSearch.trim().toLowerCase();
      const matchesQuery = !query || item.title.toLowerCase().includes(query) || (item.description || '').toLowerCase().includes(query);
      const matchesType = assignmentTypeFilter === 'all' || item.type === assignmentTypeFilter;
      const matchesStatus = assignmentStatusFilter === 'all' || (item.status || 'published') === assignmentStatusFilter;
      const matchesClass = assignmentClassFilter === 'all' || (item.targetClassIds || []).includes(Number(assignmentClassFilter));
      return matchesQuery && matchesType && matchesStatus && matchesClass;
    })
    .sort((a, b) => assignmentSort === 'dueSoon'
      ? (a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER) - (b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER)
      : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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

  const openNewAssignmentModal = () => {
    setEditingAssignmentId(null);
    setNewAssignmentTitle('');
    setNewAssignmentDesc('');
    setNewAssignmentType('tugas');
    setNewAssignmentDueDate('');
    setNewAssignmentFilePath('');
    setNewAssignmentFile(null);
    setNewAssignmentStatus('published');
    setNewAssignmentTargetClassIds(classData.classId ? [classData.classId] : []);
    setShowAddAssignmentModal(true);
  };

  const openEditAssignmentModal = (item: any) => {
    setEditingAssignmentId(item.id);
    setNewAssignmentTitle(item.title || '');
    setNewAssignmentDesc(item.description || '');
    setNewAssignmentType(item.type === 'materi' ? 'materi' : 'tugas');
    setNewAssignmentDueDate(item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 16) : '');
    setNewAssignmentFilePath(item.filePath || '');
    setNewAssignmentFile(null);
    setNewAssignmentStatus(item.status || 'published');
    setNewAssignmentTargetClassIds((item.targetClassIds || []).map((id: number | string) => String(id)));
    setShowAddAssignmentModal(true);
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssignmentTitle.trim()) {
      notify('Judul tidak boleh kosong!');
      return;
    }
    if (!newAssignmentTargetClassIds.length) {
      notify('Pilih setidaknya satu kelas tujuan.');
      return;
    }

    setIsSavingAssignment(true);
    try {
      const res = await fetch(editingAssignmentId ? `/api/assignments/${editingAssignmentId}` : '/api/assignments', {
        method: editingAssignmentId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newAssignmentTitle.trim(),
          description: newAssignmentDesc.trim(),
          type: newAssignmentType,
          status: newAssignmentStatus,
          filePath: newAssignmentFilePath.trim() || null,
          dueDate: newAssignmentType === 'tugas' && newAssignmentDueDate ? newAssignmentDueDate : null,
          targetClassIds: newAssignmentTargetClassIds,
        })
      });

      if (res.ok) {
        const savedAssignment = await res.json();
        if (newAssignmentFile) {
          const fileForm = new FormData();
          fileForm.append('file', newAssignmentFile);
          const fileResponse = await fetch(`/api/assignments/${savedAssignment.id}/file`, { method: 'POST', body: fileForm });
          if (!fileResponse.ok) {
            const payload = await fileResponse.json().catch(() => null) as { error?: string; code?: string } | null;
            notify(apiErrorMessage(payload, 'File pendukung gagal diunggah.'), 'error');
            setIsSavingAssignment(false);
            fetchAssignments();
            return;
          }
        }
        notify(editingAssignmentId ? 'Materi atau tugas berhasil diperbarui!' : (newAssignmentType === 'tugas' ? 'Tugas berhasil dibuat!' : 'Materi berhasil dibagikan!'));
        setShowAddAssignmentModal(false);
        setEditingAssignmentId(null);
        fetchAssignments();
      } else {
        const payload = await res.json().catch(() => null) as { error?: string } | null;
        notify(apiErrorMessage(payload, 'Gagal menyimpan.'), 'error');
      }
    } catch (err) {
      console.error('Error saving assignment:', err);
      notify('Terjadi kesalahan saat menyimpan.', 'error');
    } finally {
      setIsSavingAssignment(false);
    }
  };

  const handleDeleteAssignment = async (id: number) => {
    const isConfirmed = await confirm({ title: 'Hapus item', message: 'Apakah Anda yakin ingin menghapus item ini?', danger: true, confirmLabel: 'Hapus' });
    if (!isConfirmed) return;
    try {
      const res = await fetch(`/api/assignments/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        notify('Berhasil dihapus!');
        fetchAssignments();
      }
    } catch (err) {
      console.error('Error deleting assignment:', err);
      notify('Gagal menghapus.');
    }
  };

  const fetchSubmissions = useCallback(async (assignmentId: number, requestedClassId = submissionClassId || classData.classId || '') => {
    if (!requestedClassId) {
      setSubmissionsList([]);
      return;
    }
    setIsLoadingSubmissions(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/submissions?classId=${encodeURIComponent(requestedClassId)}`);
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
      } else {
        const payload = await res.json().catch(() => null) as { error?: string; code?: string } | null;
        notify(apiErrorMessage(payload, 'Gagal memuat pengumpulan tugas.'), 'error');
      }
    } catch (err) {
      console.error('Error fetching submissions:', err);
    } finally {
      setIsLoadingSubmissions(false);
    }
  }, [classData.classId, submissionClassId]);

  const handleSaveSubmissionGrade = async (studentId: number, gradeVal: number) => {
    if (viewSubmissionsAssignmentId === null) return;
    try {
      const res = await fetch(`/api/assignments/${viewSubmissionsAssignmentId}/student/${studentId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: gradeVal })
      });
      if (res.ok) {
        fetchSubmissions(viewSubmissionsAssignmentId, submissionClassId);
        notify('Nilai berhasil disimpan.', 'success');
      } else {
        const payload = await res.json().catch(() => null) as { error?: string; code?: string } | null;
        notify(apiErrorMessage(payload, 'Gagal menyimpan nilai.'), 'error');
      }
    } catch (err) {
      console.error('Error grading submission:', err);
      notify('Gagal menyimpan nilai.');
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
  }, [viewSubmissionsAssignmentId, fetchSubmissions, submissionClassId]);

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
            .data-table th { background-color: #2563EB; border-color: #1d4ed8; font-weight: bold; color: #ffffff; }
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

  const printReportDocument = (title: string, content: string, landscape = false, highlightHeaders = false) => {
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
        th { background: ${highlightHeaders ? '#2563EB' : '#f1f5f9'}; color: ${highlightHeaders ? '#ffffff' : '#1e293b'}; border-color: ${highlightHeaders ? '#1d4ed8' : '#94a3b8'}; } td.name { text-align: left; }
        .meta { margin: 0 0 12px; font-weight: 600; } .footer { margin-top: 28px; text-align: right; }
      </style></head><body>${content}<script>window.onload=()=>window.print()</script></body></html>
    `);
    printWindow.document.close();
  };

  const handlePrintTeachingJournalsPDF = () => {
    if (!teachingJournals.length) return notify('Belum ada jurnal mengajar yang dapat diekspor.', 'warning');
    const rows = teachingJournals.map((journal, index) => {
      const displayDate = new Date(`${journal.date}T12:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
      const time = journal.timeStart && journal.timeEnd ? `${journal.timeStart}–${journal.timeEnd}` : '-';
      return `<tr><td>${index + 1}</td><td>${escapePrintHtml(displayDate)}<br>${escapePrintHtml(journal.day)}<br>${escapePrintHtml(time)}</td><td class="name"><b>${escapePrintHtml(journal.className)}</b><br>${escapePrintHtml(journal.subject)}<br><span style="color:#64748b">${escapePrintHtml(journal.teacherName)}</span></td><td class="journal-cell">${escapePrintHtml(journal.materialCovered).replace(/\n/g, '<br>')}</td><td class="journal-cell">${escapePrintHtml(journal.classroomEvents || 'Tidak ada kejadian khusus.').replace(/\n/g, '<br>')}</td><td class="journal-cell">${escapePrintHtml(journal.nextPlan || '-').replace(/\n/g, '<br>')}</td></tr>`;
    }).join('');
    const filterSummary = [journalClassFilter !== 'all' ? journalClassOptions.find((item) => item.id === journalClassFilter)?.name : 'Semua kelas', journalSubjectFilter !== 'all' ? journalSubjectFilter : 'Semua mata pelajaran', journalFrom || journalTo ? `${journalFrom || 'awal'} s.d. ${journalTo || 'sekarang'}` : 'Semua tanggal'].join(' · ');
    printReportDocument('Jurnal Mengajar', `
      <h1>JURNAL MENGAJAR GURU</h1>
      <p class="subtitle">${escapePrintHtml(filterSummary)}</p>
      <p class="meta">Guru: ${escapePrintHtml(workspace.user.name || 'Guru Pengajar')}<br>Tahun Ajaran: ${escapePrintHtml(classData.selectedYear || '-')}<br>Diekspor: ${escapePrintHtml(new Date().toLocaleString('id-ID'))}</p>
      <table><thead><tr><th>No</th><th>Tanggal & Jam</th><th>Kelas & Mata Pelajaran</th><th>Materi yang Diajarkan</th><th>Kejadian di Kelas</th><th>Rencana Berikutnya</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="footer">Guru Pengajar,<br><br><br><b>${escapePrintHtml(workspace.user.name || 'Guru Pengajar')}</b></p>
    `, true);
  };

  const handlePrintTeachingAttendancePDF = () => {
    if (!activeTeachingSubject || !teachingAttendanceReport.length) return notify('Belum ada data presensi pembelajaran pada periode ini.');
    const dates = [...new Set(teachingAttendanceReport.flatMap((student) => Object.keys(student.attendanceByDate || {})))].sort();
    if (!dates.length) return notify('Belum ada presensi pembelajaran yang tersimpan pada bulan ini.');
    const statusCode: Record<string, string> = { Hadir: '✓', Sakit: 'S', Izin: 'I', Alfa: 'A' };
    const dateHeaders = dates.map((date) => `<th>${new Date(`${date}T00:00:00`).getDate()}</th>`).join('');
    const rows = teachingAttendanceReport.map((student, index) => `<tr><td>${index + 1}</td><td class="name">${student.name}</td><td>${student.gender}</td>${dates.map((date) => `<td>${statusCode[student.attendanceByDate?.[date]] || '-'}</td>`).join('')}<td>${student.Hadir}</td><td>${student.Sakit}</td><td>${student.Izin}</td><td>${student.Alfa}</td></tr>`).join('');
    printReportDocument(`Presensi ${activeTeachingSubject}`, `
      <h1>REKAP PRESENSI PEMBELAJARAN</h1><p class="subtitle">${activeTeachingSubject} — ${classData.selectedClass}</p>
      <p class="meta">Guru Pengajar: ${workspace?.user.name || 'Guru Pengajar'}<br>Bulan: ${teachingAttendanceMonth} &nbsp; | &nbsp; Tahun Ajaran: ${classData.selectedYear}</p>
      <table><thead><tr><th>No</th><th>Nama Siswa</th><th>L/P</th>${dateHeaders}<th>✓</th><th>S</th><th>I</th><th>A</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="meta">Keterangan: ✓ = Hadir, S = Sakit, I = Izin, A = Alfa.</p>
      <p class="footer">${new Date().toLocaleDateString('id-ID')}<br>Guru Mata Pelajaran,<br><br><br><b>${workspace?.user.name || 'Guru Pengajar'}</b></p>
    `, true, true);
  };

  const handlePrintGradesPDF = () => {
    if (sessionAssessments.length === 0) {
      notify('Belum ada data penilaian untuk mata pelajaran ini.');
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
    if (!activeTeachingSubject) return notify('Pilih kelas dan mata pelajaran dari Dashboard Saya terlebih dahulu.');
    const assessments = teachingAssessments;
    if (!assessments.length) return notify('Belum ada data penilaian untuk mata pelajaran ini.');

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
    if (!activeTeachingSubject) return notify('Pilih kelas dan mata pelajaran dari Dashboard Saya terlebih dahulu.');
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
  let totalHarian = 0;
  let totalHadirCount = 0;

  dashboardSummary.forEach(s => {
    totalHarian += s.harian.total;
    totalHadirCount += s.harian.Hadir;
  });

  if (totalHarian > 0) avgHadir = Math.round((totalHadirCount / totalHarian) * 100);

  const stats = [
    { title: "Total Siswa", value: classData.stats.totalStudents, icon: Users, color: "text-blue-500" },
    { title: "Rata-rata Kehadiran", value: dashboardSummary.length > 0 ? `${avgHadir}%` : classData.stats.attendance, icon: CheckSquare, color: "text-green-500" },
    { title: "Rata-rata Nilai", value: classData.stats.averageGrade, icon: BookOpen, color: "text-orange-500" },
    { title: "Agenda Aktif", value: classData.agenda.length.toString(), icon: Calendar, color: "text-purple-500" },
  ];

  const handleSaveQuote = () => {
    classData.updateQuote(quoteText, quoteAuthor);
    notify('Kutipan berhasil diperbarui!');
  };

  const handleAddAnnouncement = async () => {
    if (!newAnnText) return;
    try {
      await classData.addAnnouncement({ id: Date.now().toString(), type: newAnnType, text: newAnnText });
      setNewAnnText('');
      notify('Pengumuman berhasil ditampilkan.', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Gagal menampilkan pengumuman.', 'error');
    }
  };

  const handleAddAgenda = async () => {
    if (!newAgendaTitle || !newAgendaDate) return;
    try {
      await classData.addAgenda({ id: Date.now().toString(), date: newAgendaDate, title: newAgendaTitle, type: newAgendaType });
      setNewAgendaDate('');
      setNewAgendaTitle('');
      notify('Agenda berhasil ditambahkan.', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Gagal menambahkan agenda.', 'error');
    }
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
      notify(`Memproses file: ${file.name}...`);
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
          notify(`Sukses mengimpor ${successCount} data siswa!`);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleResetPassword = async (studentName: string) => {
    const isConfirmed = await confirm({ title: 'Reset password', message: `Apakah Anda yakin ingin mereset password milik ${studentName} menjadi '123456'?`, confirmLabel: 'Reset' });
    if (isConfirmed) {
      notify(`Sukses! Password untuk ${studentName} berhasil direset.`);
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
      return notify('Data kelas atau presensi belum siap. Muat ulang data lalu coba lagi.');
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
        notify('Presensi berhasil disimpan!');
      } else {
        const result = await res.json().catch(() => null);
        notify(result?.error || `Gagal menyimpan presensi (${res.status}).`);
      }
    } catch (err) {
      console.error('Error saving attendance:', err);
      notify('Terjadi kesalahan saat menyimpan presensi.');
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const handleMarkAllPrayerAbsent = async () => {
    const targetStudents = classData.students.filter((student) => attendanceType !== 'jumat' || student.gender === 'L');
    const targetLabel = attendanceType === 'jumat' ? 'semua siswa laki-laki' : 'semua siswa';
    const attendanceLabel = attendanceType === 'harian' ? 'presensi harian' : attendanceType === 'dhuha' ? 'Sholat Dhuha' : attendanceType === 'dzuhur' ? 'Sholat Dzuhur' : 'Sholat Jumat';
    if (!targetStudents.length || !(await confirm({ title: 'Tandai presensi', message: `Jadikan ${targetLabel} berstatus Alfa untuk ${attendanceLabel}? Perubahan baru tersimpan setelah Anda menekan Simpan Presensi.`, danger: true, confirmLabel: 'Tandai Alfa' }))) return;
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
    if (!classData.classId || !activeTeachingSubject) return notify('Pilih kartu kelas dan mata pelajaran dari Dashboard Saya terlebih dahulu.');
    if (isSavingTeachingAttendance) return;
    if (!Object.keys(teachingAttendanceMap).length) return notify('Data siswa belum siap. Muat ulang data lalu coba lagi.');
    setIsSavingTeachingAttendance(true);
    try {
      const res = await fetch('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        date: teachingAttendanceDate, type: 'mapel', subject: activeTeachingSubject, classId: classData.classId,
        records: Object.entries(teachingAttendanceMap).map(([studentId, status]) => ({ studentId, status })),
      }) });
      if (res.ok) notify('Presensi pembelajaran berhasil disimpan.');
      else {
        const result = await res.json().catch(() => null);
        notify(result?.error || `Gagal menyimpan presensi pembelajaran (${res.status}).`);
      }
    } catch (error) {
      console.error('Error saving teaching attendance:', error);
      notify('Terjadi kesalahan saat menyimpan presensi pembelajaran.');
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
  const fetchLearningSummary = useCallback(async () => {
    if (!classData.classId || !canViewLearningProfiles) return;
    setIsLoadingLearningSummary(true);
    try {
      const params = new URLSearchParams({ classId: classData.classId });
      if (learningSummarySubject.trim()) params.set('subject', learningSummarySubject.trim());
      if (learningSummaryTopic.trim()) params.set('topic', learningSummaryTopic.trim());
      const response = await fetch(`/api/student-learning-summary?${params.toString()}`);
      if (response.ok) {
        const result = await response.json() as StudentLearningSummary;
        setLearningSummarySource(result);
        setLearningSummary(result);
      } else {
        setLearningSummarySource(null);
        setLearningSummary(null);
      }
    } catch (error) {
      console.error('Gagal memuat ringkasan perkembangan kelas:', error);
      setLearningSummarySource(null);
      setLearningSummary(null);
    } finally {
      setIsLoadingLearningSummary(false);
    }
  }, [canViewLearningProfiles, classData.classId, learningSummarySubject, learningSummaryTopic]);

  const fetchLearningInterventions = useCallback(async () => {
    if (!classData.classId || !canViewLearningProfiles) return;
    setIsLoadingLearningInterventions(true);
    try {
      const params = new URLSearchParams({ classId: classData.classId });
      if (learningSummarySubject.trim()) params.set('subject', learningSummarySubject.trim());
      if (learningSummaryTopic.trim()) params.set('topic', learningSummaryTopic.trim());
      const response = await fetch(`/api/student-learning-interventions?${params.toString()}`);
      if (response.ok) setLearningInterventions(await response.json());
      else setLearningInterventions([]);
    } catch (error) {
      console.error('Gagal memuat kelompok intervensi:', error);
      setLearningInterventions([]);
    } finally {
      setIsLoadingLearningInterventions(false);
    }
  }, [canViewLearningProfiles, classData.classId, learningSummarySubject, learningSummaryTopic]);

  useEffect(() => {
    if (activeTab === 'students') fetchLearningSummary();
  }, [activeTab, fetchLearningSummary]);

  useEffect(() => {
    if (activeTab === 'students') fetchLearningInterventions();
  }, [activeTab, fetchLearningInterventions]);

  useEffect(() => {
    if (!learningSummarySource) {
      setLearningSummary(null);
      return;
    }
    setLearningSummary({
      ...learningSummarySource,
      students: learningSummarySource.students.filter((student) => learningSummaryFilter === 'all' || learningSummaryStatus(student) === learningSummaryFilter),
    });
  }, [learningSummaryFilter, learningSummarySource]);

  const learningSummaryRecommendations = learningSummarySource ? [
    { key: 'concept', label: 'Pemahaman konsep', count: learningSummarySource.students.filter((student) => !student.profile || student.profile.conceptLevel <= 2).length, suggestion: 'Gunakan contoh konkret dan minta siswa menjelaskan makna sebelum memakai rumus.' },
    { key: 'reasoning', label: 'Penalaran', count: learningSummarySource.students.filter((student) => !student.profile || student.profile.reasoningLevel <= 2).length, suggestion: 'Gunakan pertanyaan “bagaimana kamu tahu?” dan minta siswa membandingkan strategi.' },
    { key: 'literacy', label: 'Literasi soal', count: learningSummarySource.students.filter((student) => !student.profile || student.profile.literacyLevel <= 2).length, suggestion: 'Latih menandai informasi, tujuan soal, dan representasi sebelum menghitung.' },
    { key: 'independence', label: 'Kemandirian', count: learningSummarySource.students.filter((student) => !student.profile || student.profile.independenceLevel <= 2).length, suggestion: 'Berikan bantuan bertahap lalu kurangi petunjuk pada soal berikutnya.' },
  ].sort((first, second) => second.count - first.count) : [];

  const openLearningInterventionModal = () => {
    if (!selectedInterventionStudentIds.length) return notify('Pilih minimal satu siswa untuk dibuatkan kelompok dukungan.', 'warning');
    setLearningInterventionForm({ title: '', goal: '', strategy: '', scheduledDate: '', status: 'rencana' });
    setShowLearningInterventionModal(true);
  };

  const handleSaveLearningIntervention = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!classData.classId || !learningSummarySubject.trim() || !learningSummaryTopic.trim() || !selectedInterventionStudentIds.length || isSavingLearningIntervention) return;
    setIsSavingLearningIntervention(true);
    try {
      const response = await fetch('/api/student-learning-interventions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classId: classData.classId, subject: learningSummarySubject.trim(), topic: learningSummaryTopic.trim(), studentIds: selectedInterventionStudentIds, ...learningInterventionForm }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) return notify(result?.error || 'Gagal menyimpan kelompok intervensi.', 'error');
      setShowLearningInterventionModal(false);
      setSelectedInterventionStudentIds([]);
      await fetchLearningInterventions();
      notify('Kelompok intervensi berhasil dibuat.', 'success');
    } catch (error) {
      console.error('Gagal menyimpan kelompok intervensi:', error);
      notify('Terjadi kesalahan saat menyimpan kelompok intervensi.', 'error');
    } finally {
      setIsSavingLearningIntervention(false);
    }
  };

  const handleUpdateLearningIntervention = async (intervention: StudentLearningIntervention, status: LearningInterventionStatus) => {
    const response = await fetch(`/api/student-learning-interventions/${intervention.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    const result = await response.json().catch(() => null);
    if (!response.ok) return notify(result?.error || 'Gagal memperbarui status intervensi.', 'error');
    await fetchLearningInterventions();
    notify('Status tindak lanjut diperbarui.', 'success');
  };

  const handleDeleteLearningIntervention = async (intervention: StudentLearningIntervention) => {
    if (!(await confirm({ title: 'Hapus kelompok intervensi', message: `Hapus rencana “${intervention.title}”?`, danger: true, confirmLabel: 'Hapus' }))) return;
    const response = await fetch(`/api/student-learning-interventions/${intervention.id}`, { method: 'DELETE' });
    const result = await response.json().catch(() => null);
    if (!response.ok) return notify(result?.error || 'Gagal menghapus kelompok intervensi.', 'error');
    await fetchLearningInterventions();
    notify('Kelompok intervensi dihapus.', 'success');
  };

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
  const activeContext = workspaceMode === 'teaching'
    ? `${classData.selectedClass || 'Kelas belum dipilih'}${activeTeachingSubject ? ` · ${activeTeachingSubject}` : ''}`
    : classData.selectedClass || 'Kelas belum dipilih';
  const hasHomeroomMode = workspace.homeroomClasses.length > 0;
  const hasTeachingMode = userRole === 'teacher' || workspace.subjectGroups.length > 0 || workspace.teachingSchedule.length > 0;
  const canSwitchWorkspaceMode = hasHomeroomMode && hasTeachingMode;
  useEffect(() => {
    if (workspaceMode === 'homeroom' && !hasHomeroomMode && hasTeachingMode) setWorkspaceMode('teaching');
    if (workspaceMode === 'teaching' && !hasTeachingMode && hasHomeroomMode) setWorkspaceMode('homeroom');
  }, [hasHomeroomMode, hasTeachingMode, workspaceMode]);
  const changeWorkspaceMode = async (mode: 'homeroom' | 'teaching') => {
    setWorkspaceMode(mode);
    setActiveTeachingSubject(null);
    setActiveTab('workspace');
    const targetClass = mode === 'homeroom' ? workspace.homeroomClasses[0]?.id : workspace.subjectGroups[0]?.classes[0]?.classId;
    if (targetClass) await classData.selectClass(targetClass);
  };
  const scheduleAssignments = teachingAssignments.filter((item) => item.classId === classData.classId);
  const scheduleSubjects = [...new Set(scheduleAssignments.map((item) => item.subjectName))];
  const scheduleTeachers = scheduleAssignments.filter((item) => item.subjectName === newScheduleSubject);

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
            { id: 'workspace', label: 'Beranda', icon: LayoutDashboard },
            { id: 'dashboard', label: 'Ringkasan Kelas', icon: LayoutDashboard },
            { id: 'students', label: 'Siswa', icon: Users },
            ...(userRole === 'admin' ? [{ id: 'attendance', label: 'Presensi', icon: CheckSquare }, { id: 'reports', label: 'Laporan', icon: FileText }] : []),
            ...((userRole === 'admin' || userRole === 'teacher' || userRole === 'counselor') ? [{ id: 'monitoring', label: 'Pemantauan Siswa', icon: ShieldAlert }] : []),
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
        <header className="relative z-30 h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 md:px-8">
          <div className="min-w-0 mr-2">
            <h2 className="text-base sm:text-xl font-semibold text-slate-800 dark:text-slate-100 truncate">
              {activeTab === 'workspace' ? (workspaceMode === 'teaching' ? 'Beranda Pengajar' : 'Beranda Perwalian') : activeTab === 'dashboard' ? `Ringkasan (${classData.selectedClass})` : activeTab === 'monitoring' ? 'Pemantauan Siswa' : activeTab === 'settings' ? 'Pengaturan Halaman' : activeTab === 'reports' ? 'Laporan Kelas' : activeTab === 'teaching-reports' ? 'Laporan Mengajar' : activeTab === 'teaching-attendance' ? 'Presensi Pembelajaran' : 'Manajemen Kelas'}
            </h2>
            {activeTab !== 'workspace' && <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">Konteks kerja: {activeContext}</p>}
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <select
              value={classData.classId || ''}
              onChange={(event) => { if (event.target.value) classData.selectClass(event.target.value); }}
              aria-label="Pilih kelas aktif"
              className="max-w-[150px] sm:max-w-[220px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              {classData.classes.filter((item) => item.status === 'Aktif').map((item) => <option key={item.id} value={item.id}>{item.name} · {item.academicYear}</option>)}
            </select>
            {userRole === 'teacher' && <div className="relative">
              <button type="button" onClick={() => setShowAttendanceReminders((current) => !current)} className={`relative rounded-xl p-2 transition-colors ${attendanceReminders.length ? 'text-amber-600 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'}`} aria-label={`Pengingat presensi${attendanceReminders.length ? `, ${attendanceReminders.length} belum selesai` : ''}`} aria-expanded={showAttendanceReminders}>
                <Bell className="h-5 w-5" />
                {attendanceReminders.length > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-amber-500 px-1 text-center text-[10px] font-black leading-5 text-white">{attendanceReminders.length > 9 ? '9+' : attendanceReminders.length}</span>}
              </button>
              {showAttendanceReminders && <div className="absolute right-0 top-12 w-[min(23rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-800 dark:text-slate-100">Pengingat Presensi</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Jadwal yang belum memiliki presensi lengkap.</p></div><button type="button" onClick={() => setShowAttendanceReminders(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Tutup pengingat"><X className="h-4 w-4" /></button></div>
                {attendanceReminders.length ? <div className="mt-3 max-h-[min(26rem,60vh)] space-y-2 overflow-y-auto">{attendanceReminders.map((reminder) => <div key={reminder.id} className="rounded-xl border border-amber-100 bg-amber-50/70 p-3 dark:border-amber-900/50 dark:bg-amber-950/20"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" /><div className="min-w-0 flex-1"><p className="font-bold text-sm text-slate-800 dark:text-slate-100">{reminder.subject}</p><p className="text-xs text-slate-600 dark:text-slate-300">{reminder.className} · {reminder.day}, {reminder.date}</p><p className="text-xs text-slate-500 dark:text-slate-400">{reminder.timeStart}–{reminder.timeEnd} · {reminder.recordedCount}/{reminder.studentCount} siswa</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => openAttendanceReminder(reminder)} className="rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-violet-700">Isi Presensi</button><button type="button" onClick={() => { setSelectedReminder(reminder); setReminderReason(''); setShowAttendanceReminders(false); }} className="rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/50">Tidak ada pertemuan</button></div></div></div></div>)}</div> : <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-center text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">Semua presensi mapel sudah lengkap.</p>}
              </div>}
            </div>}
            {/* Dark Mode Toggle */}
            <ThemePicker />
            {workspaceMode === 'teaching' && <button onClick={() => { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setShowPasswordModal(true); }} className="p-2 text-slate-500 dark:text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30 rounded-full transition-colors" title="Ubah password"><Key className="h-5 w-5" /></button>}
            <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-200 dark:border-slate-700">
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold shrink-0">W</div>
              <div className="hidden sm:flex flex-col">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{workspaceMode === 'teaching' ? 'Guru Pengajar' : userRole === 'counselor' ? 'BK' : 'Wali Kelas'}</span>
                <span className="text-[10px] text-slate-400 font-mono leading-none mt-0.5">{classData.selectedClass} ({classData.selectedYear})</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Scrollable Area */}
        <div className="min-w-0 flex-1 overflow-auto p-4 pb-[calc(10rem+env(safe-area-inset-bottom))] md:p-8 md:pb-8">
          {userRole === 'teacher' && attendanceReminders.length > 0 && <div className="mx-auto mb-5 flex max-w-6xl items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100" role="status"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" /><div className="min-w-0 flex-1"><p className="font-bold">Ada {attendanceReminders.length} presensi mapel yang perlu dilengkapi.</p><p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/80">Pengingat mencakup kelas ampuan hari ini dan tujuh hari terakhir.</p></div><button type="button" onClick={() => setShowAttendanceReminders(true)} className="shrink-0 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700">Lihat</button></div>}
          {workspaceMode === 'teaching' && workspace?.teachingSchedule?.length > 0 && <section className="mx-auto mb-5 max-w-6xl rounded-2xl border border-violet-100 bg-white p-4 shadow-sm dark:border-violet-900/50 dark:bg-slate-800"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-slate-800 dark:text-slate-100">Perlu mengubah jadwal?</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Ajukan perubahan kepada admin atau wali kelas untuk disetujui.</p></div><div className="flex flex-col gap-2 sm:flex-row"><select value={selectedScheduleForRequest?.id || ''} onChange={(event) => { const schedule = workspace.teachingSchedule.find((item) => item.id === event.target.value); if (schedule) setSelectedScheduleForRequest(schedule); }} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="">Pilih jadwal</option>{workspace.teachingSchedule.map((item) => <option key={item.id} value={item.id}>{item.day} · {item.timeStart} · {item.subject} · {item.className}</option>)}</select><button type="button" disabled={!selectedScheduleForRequest} onClick={() => selectedScheduleForRequest && openScheduleRequest(selectedScheduleForRequest)} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">Ajukan perubahan</button></div></div>{scheduleChangeRequests.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{scheduleChangeRequests.slice(0, 3).map((request) => <span key={request.id} className={`rounded-full px-3 py-1 text-[11px] font-bold ${request.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : request.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'}`}>{request.subject} · {request.status === 'pending' ? 'Menunggu persetujuan' : request.status === 'approved' ? 'Disetujui' : 'Ditolak'}</span>)}</div>}</section>}
          {userRole === 'admin' && activeTab === 'settings' && settingsView === 'teaching' && <section className="mx-auto mb-5 max-w-6xl rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20"><div className="flex items-center justify-between gap-3"><div><p className="font-bold text-slate-800 dark:text-slate-100">Pengajuan Perubahan Jadwal</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Tinjau usulan perubahan dari guru pengajar sebelum jadwal aktif diperbarui.</p></div><span className="rounded-full bg-amber-200 px-2.5 py-1 text-xs font-black text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">{scheduleChangeRequests.filter((request) => request.status === 'pending').length} menunggu</span></div>{scheduleChangeRequests.filter((request) => request.status === 'pending').length ? <div className="mt-4 space-y-3">{scheduleChangeRequests.filter((request) => request.status === 'pending').map((request) => <div key={request.id} className="rounded-xl border border-amber-200 bg-white p-4 dark:border-amber-900/50 dark:bg-slate-800"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><p className="font-bold text-slate-800 dark:text-slate-100">{request.teacherName} · {request.subject} · {request.className}</p><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{request.current?.day} {request.current?.timeStart}–{request.current?.timeEnd} → <b>{request.requested.day} {request.requested.timeStart}–{request.requested.timeEnd}</b></p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Alasan: {request.reason}</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => handleReviewScheduleRequest(request.id, 'rejected')} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30">Tolak</button><button type="button" onClick={() => handleReviewScheduleRequest(request.id, 'approved')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Setujui</button></div></div></div>)}</div> : <p className="mt-4 text-center text-sm text-amber-800/70 dark:text-amber-200/70">Belum ada pengajuan yang menunggu.</p>}</section>}
          {activeTab === 'workspace' && (
            <div className="mx-auto max-w-6xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className={`rounded-2xl border p-6 text-white shadow-lg ${workspaceMode === 'teaching' ? 'border-blue-100 bg-gradient-to-br from-blue-600 to-indigo-700 dark:border-blue-900' : 'border-emerald-100 bg-gradient-to-br from-emerald-600 to-teal-700 dark:border-emerald-900'}`}><p className={`text-sm font-semibold ${workspaceMode === 'teaching' ? 'text-blue-100' : 'text-emerald-100'}`}>{workspaceMode === 'teaching' ? 'RUANG KERJA GURU PENGAJAR' : 'RUANG KERJA WALI KELAS'}</p><h3 className="mt-1 text-2xl font-black">Selamat datang, {workspace?.user.name || 'Guru'}.</h3><p className={`mt-2 max-w-2xl text-sm ${workspaceMode === 'teaching' ? 'text-blue-100' : 'text-emerald-100'}`}>{workspaceMode === 'teaching' ? 'Kelola jadwal, presensi mapel, materi, tugas, dan jurnal pembelajaran dari satu ruang kerja.' : 'Pantau kondisi kelas, kehadiran, perkembangan siswa, dan tindak lanjut perwalian dari satu ruang kerja.'}</p></div>
              {canSwitchWorkspaceMode && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Mode kerja</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Pilih fokus pekerjaan untuk beranda dan menu Anda.</p></div><div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-900"><button type="button" onClick={() => changeWorkspaceMode('homeroom')} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${workspaceMode === 'homeroom' ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-800 dark:text-emerald-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>Mode Perwalian</button><button type="button" onClick={() => changeWorkspaceMode('teaching')} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${workspaceMode === 'teaching' ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>Mode Pengajar</button></div></div>}
              {workspaceMode === 'teaching' && <section className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm dark:border-violet-900/50 dark:bg-slate-800"><div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Informasi Mengajar</p><h3 className="mt-1 text-xl font-bold text-slate-800 dark:text-slate-100">Jadwal Mengajar Saya</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Jadwal Senin–Jumat untuk kelas dan mata pelajaran yang Anda ampu.</p></div><Calendar className="h-6 w-6 shrink-0 text-violet-500" /></div>{workspace?.teachingSchedule?.length ? <><div className="mb-5 rounded-xl border border-violet-100 bg-violet-50/70 p-4 dark:border-violet-900/50 dark:bg-violet-950/20"><p className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300">Jadwal hari ini</p>{(() => { const todaySchedules = workspace.teachingSchedule.filter((item) => item.day === currentTeachingDay()).sort((first, second) => first.timeStart.localeCompare(second.timeStart)); return todaySchedules.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{todaySchedules.map((item) => <button key={item.id} type="button" onClick={() => openTeachingClass(item.classId, item.subject)} className="flex items-center gap-3 rounded-xl bg-white p-3 text-left shadow-sm transition hover:ring-2 hover:ring-violet-200 dark:bg-slate-800 dark:hover:ring-violet-800"><span className="w-12 shrink-0 text-xs font-black text-violet-600 dark:text-violet-300">{item.timeStart}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm text-slate-800 dark:text-slate-100">{item.subject}</b><span className="block truncate text-xs text-slate-500 dark:text-slate-400">{item.className} · {item.timeEnd}</span></span></button>)}</div> : <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Tidak ada jadwal mengajar hari ini.</p>; })()}</div><div className="grid grid-cols-2 gap-3 md:grid-cols-5">{TEACHING_DAY_NAMES.map((day) => { const daySchedules = workspace.teachingSchedule.filter((item) => item.day === day).sort((first, second) => first.timeStart.localeCompare(second.timeStart)); return <div key={day} className={`min-w-0 rounded-xl border p-3 ${day === currentTeachingDay() ? 'border-violet-300 bg-violet-50/50 dark:border-violet-700 dark:bg-violet-950/20' : 'border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/30'}`}><p className="text-xs font-black text-slate-700 dark:text-slate-200">{day}</p>{daySchedules.length ? <div className="mt-3 space-y-2">{daySchedules.map((item) => <button key={item.id} type="button" onClick={() => openTeachingClass(item.classId, item.subject)} className="min-w-0 w-full rounded-lg bg-white p-2 text-left shadow-sm hover:ring-2 hover:ring-violet-200 dark:bg-slate-800 dark:hover:ring-violet-800"><span className="block text-[11px] font-bold text-violet-600 dark:text-violet-300">{item.timeStart}–{item.timeEnd}</span><span className="mt-0.5 block truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{item.subject}</span><span className="block truncate text-[11px] text-slate-400">{item.className}</span></button>)}</div> : <p className="mt-3 text-[11px] text-slate-400">Kosong</p>}</div>; })}</div></> : <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400 dark:border-slate-700">Belum ada jadwal mengajar yang terhubung dengan akun Anda.</div>}</section>}
              {workspaceMode === 'teaching' && <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm dark:border-emerald-900/50 dark:bg-slate-800">
                <div className="flex flex-col gap-4 border-b border-emerald-100 pb-4 dark:border-emerald-900/50 sm:flex-row sm:items-start sm:justify-between">
                  <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Dokumentasi Pembelajaran</p><h3 className="mt-1 text-xl font-bold text-slate-800 dark:text-slate-100">Jurnal Mengajar</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Catat materi, kejadian kelas, dan rencana pertemuan berikutnya.</p></div>
                  <div className="flex flex-wrap gap-2"><button type="button" onClick={handlePrintTeachingJournalsPDF} disabled={!teachingJournals.length} className="flex items-center justify-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"><Printer className="h-4 w-4" /> Ekspor PDF</button><button type="button" onClick={() => openNewJournal()} disabled={!journalClassOptions.length} className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" /> Buat jurnal</button></div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <select aria-label="Filter kelas jurnal" value={journalClassFilter} onChange={(event) => setJournalClassFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="all">Semua kelas</option>{journalClassOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                  <select aria-label="Filter mata pelajaran jurnal" value={journalSubjectFilter} onChange={(event) => setJournalSubjectFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="all">Semua mata pelajaran</option>{journalFilterSubjectOptions.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select>
                  <input aria-label="Tanggal mulai jurnal" type="date" value={journalFrom} onChange={(event) => setJournalFrom(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
                  <input aria-label="Tanggal akhir jurnal" type="date" value={journalTo} onChange={(event) => setJournalTo(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
                </div>
                {isLoadingJournals ? <p className="py-8 text-center text-sm text-slate-400">Memuat jurnal mengajar…</p> : teachingJournals.length ? <div className="mt-4 space-y-3">{teachingJournals.map((journal) => <article key={journal.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{journal.day}</span><span className="text-xs text-slate-400">{new Date(`${journal.date}T12:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}{journal.timeStart && journal.timeEnd ? ` · ${journal.timeStart}–${journal.timeEnd}` : ''}</span></div><h4 className="mt-2 font-bold text-slate-800 dark:text-slate-100">{journal.className} · {journal.subject}</h4><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{journal.materialCovered}</p></div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => openEditJournal(journal)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-700" title="Edit jurnal"><Edit2 className="h-4 w-4" /></button><button type="button" onClick={() => handleDeleteJournal(journal)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-700" title="Hapus jurnal"><Trash2 className="h-4 w-4" /></button></div></div>{(journal.classroomEvents || journal.nextPlan) && <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-700 sm:grid-cols-2"><div><p className="font-bold text-slate-400">Kejadian di kelas</p><p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{journal.classroomEvents || 'Tidak ada kejadian khusus.'}</p></div><div><p className="font-bold text-slate-400">Rencana berikutnya</p><p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{journal.nextPlan || 'Belum ditentukan.'}</p></div></div>}</article>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-700"><FileText className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Belum ada jurnal mengajar.</p><p className="mt-1 text-xs text-slate-400">Buat jurnal setelah selesai mengajar untuk menyimpan progres pembelajaran.</p></div>}
              </section>}
              {workspaceMode === 'homeroom' && <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm dark:border-emerald-900/50 dark:bg-slate-800"><div className="flex flex-col gap-3 border-b border-emerald-100 pb-4 sm:flex-row sm:items-start sm:justify-between dark:border-emerald-900/50"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Dokumentasi Guru</p><h3 className="mt-1 text-xl font-bold text-slate-800 dark:text-slate-100">Jurnal Mengajar</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Pantau progres materi dan kejadian pembelajaran dari kelas yang dapat Anda akses.</p></div><button type="button" onClick={handlePrintTeachingJournalsPDF} disabled={!teachingJournals.length} className="flex items-center justify-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"><Printer className="h-4 w-4" /> Ekspor PDF</button></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><select aria-label="Filter kelas jurnal" value={journalClassFilter} onChange={(event) => setJournalClassFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="all">Semua kelas</option>{journalClassOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Filter mata pelajaran jurnal" value={journalSubjectFilter} onChange={(event) => setJournalSubjectFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-900 dark:bg-slate-900 dark:text-slate-100"><option value="all">Semua mata pelajaran</option>{journalFilterSubjectOptions.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select></div>{isLoadingJournals ? <p className="py-8 text-center text-sm text-slate-400">Memuat jurnal mengajar…</p> : teachingJournals.length ? <div className="mt-4 space-y-3">{teachingJournals.map((journal) => <article key={journal.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{journal.day}</span><span className="text-xs text-slate-400">{new Date(`${journal.date}T12:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div><h4 className="mt-2 font-bold text-slate-800 dark:text-slate-100">{journal.className} · {journal.subject} · {journal.teacherName}</h4><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{journal.materialCovered}</p>{(journal.classroomEvents || journal.nextPlan) && <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-700 sm:grid-cols-2"><div><p className="font-bold text-slate-400">Kejadian di kelas</p><p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{journal.classroomEvents || 'Tidak ada kejadian khusus.'}</p></div><div><p className="font-bold text-slate-400">Rencana berikutnya</p><p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{journal.nextPlan || 'Belum ditentukan.'}</p></div></div>}</article>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400 dark:border-slate-700">Belum ada jurnal mengajar pada kelas yang dapat diakses.</div>}</section>}
              {isLoadingWorkspace ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-400 dark:border-slate-700 dark:bg-slate-800">Memuat ruang kerja…</div> : <>
                {workspaceMode === 'homeroom' && <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold text-slate-800 dark:text-slate-100">Kelas Perwalian</h3><p className="text-xs text-slate-500">Akses penuh sebagai wali kelas.</p></div><Users className="h-5 w-5 text-blue-500" /></div>{workspace?.homeroomClasses.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{workspace.homeroomClasses.map((item) => <button key={item.id} onClick={async () => { await classData.selectClass(item.id); setWorkspaceMode('homeroom'); setActiveTeachingSubject(null); setActiveTab('dashboard'); }} className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-left transition hover:border-blue-300 hover:shadow-sm dark:border-blue-900/60 dark:bg-blue-950/20"><p className="font-bold text-slate-800 dark:text-slate-100">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.academicYear}</p><span className="mt-3 inline-block text-xs font-bold text-blue-600 dark:text-blue-400">Buka Dashboard Kelas →</span></button>)}</div> : <p className="py-4 text-sm text-slate-400">Belum ada kelas perwalian.</p>}</section>}
                {workspaceMode === 'teaching' && <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold text-slate-800 dark:text-slate-100">Kelas Mengajar</h3><p className="text-xs text-slate-500">Pilih kelas untuk membuka buku nilai mata pelajaran terkait.</p></div><BookOpen className="h-5 w-5 text-violet-500" /></div>{workspace?.subjectGroups.length ? <div className="space-y-5">{workspace.subjectGroups.map((group) => <div key={group.subjectId}><div className="mb-2 flex items-center gap-2"><span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">{group.subjectName}</span><span className="text-xs text-slate-400">{group.classes.length} kelas</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{group.classes.map((item) => <button key={item.assignmentId} onClick={() => openTeachingClass(item.classId, group.subjectName)} className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-violet-300 hover:shadow-sm dark:border-slate-700 dark:hover:border-violet-700"><div className="flex items-start justify-between gap-2"><p className="font-bold text-slate-800 dark:text-slate-100">{item.className}</p><span className="text-xs font-semibold text-violet-600 dark:text-violet-400">{item.academicYear}</span></div><p className="mt-2 text-xs text-slate-500">{item.studentCount} siswa · {item.gradeCount} nilai tercatat</p><span className="mt-3 inline-block text-xs font-bold text-violet-600 dark:text-violet-400">Buka Buku Nilai →</span></button>)}</div></div>)}</div> : <p className="py-5 text-sm text-slate-400">Belum ada penugasan mengajar. Tambahkan melalui Pengaturan Halaman.</p>}</section>}
              </>}
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {workspaceMode === 'teaching' && activeTeachingSubject && (
                <section className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm dark:border-cyan-900/50 dark:bg-slate-800 sm:p-6">
                  <div className="mb-4 flex items-start justify-between gap-4"><div><h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100"><Megaphone className="h-5 w-5 text-cyan-500" /> Informasi untuk Siswa</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Informasi akan berjalan di Dashboard Siswa kelas {classData.selectedClass} untuk mata pelajaran {activeTeachingSubject}.</p></div><span className="rounded-full bg-cyan-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">Mode Mengajar</span></div>
                  <form onSubmit={handleAddTeachingAnnouncement} className="grid gap-3 md:grid-cols-[140px_1fr_auto] md:items-end">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Jenis<select value={teachingAnnouncementType} onChange={(event) => setTeachingAnnouncementType(event.target.value as 'PENTING' | 'INFO' | 'SELAMAT')} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="INFO">INFO</option><option value="PENTING">PENTING</option><option value="SELAMAT">SELAMAT</option></select></label>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Isi informasi<textarea value={teachingAnnouncementText} onChange={(event) => setTeachingAnnouncementText(event.target.value)} maxLength={500} rows={2} placeholder="Contoh: Materi untuk pertemuan berikutnya sudah tersedia." className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /></label>
                    <button type="submit" disabled={!teachingAnnouncementText.trim()} className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="mr-1 inline h-4 w-4" />Tampilkan</button>
                  </form>
                  <div className="mt-5 space-y-2">{classData.teachingAnnouncements.length ? classData.teachingAnnouncements.map((announcement) => <div key={announcement.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded px-2 py-0.5 text-[10px] font-bold ${announcement.type === 'PENTING' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300' : announcement.type === 'SELAMAT' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'}`}>{announcement.type}</span><span className="text-[10px] text-slate-400">{announcement.teacherName} · {announcement.subjectName}</span></div><p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{announcement.text}</p></div>{announcement.teacherId === workspace?.user.id && <button type="button" onClick={() => handleRemoveTeachingAnnouncement(announcement.id)} className="shrink-0 rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30" title="Hapus informasi"><Trash2 className="h-4 w-4" /></button>}</div>) : <p className="py-3 text-center text-xs text-slate-400">Belum ada informasi dari guru untuk kelas ini.</p>}</div>
                </section>
              )}
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
                <div className="flex items-center justify-between mb-4"><div><h3 className="font-bold text-slate-800 dark:text-slate-100">Hari Ini</h3><p className="text-xs text-slate-400">Informasi kelas terkini</p></div><span className="text-xs font-bold px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">{currentTeachingDay() || 'Akhir Pekan'}</span></div>
                <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-700/50 rounded-xl mb-4"><button onClick={() => setMobileDashboardPanel('schedule')} className={`py-2 text-xs font-bold rounded-lg ${mobileDashboardPanel === 'schedule' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}>Jadwal</button><button onClick={() => setMobileDashboardPanel('agenda')} className={`py-2 text-xs font-bold rounded-lg ${mobileDashboardPanel === 'agenda' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}>Agenda</button></div>
                {mobileDashboardPanel === 'schedule' ? <div className="space-y-2">{(classData.schedules || []).filter((schedule) => schedule.day === currentTeachingDay()).sort((a, b) => a.timeStart.localeCompare(b.timeStart)).slice(0, 2).map((schedule) => <div key={schedule.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700"><span className="w-10 text-xs font-bold text-blue-600 dark:text-blue-400">{schedule.timeStart}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{schedule.subject}</p><p className="text-xs text-slate-400 truncate">{schedule.teacherName || 'Guru belum diatur'}</p></div></div>)}<p className="py-2 text-center text-sm text-slate-400">{currentTeachingDay() ? '' : 'Akhir pekan — tidak ada jadwal mengajar.'}</p><button onClick={() => { setActiveTab('academic'); setAcademicSubTab('schedule'); }} className="w-full pt-2 text-xs font-bold text-blue-600 dark:text-blue-400">Lihat semua jadwal →</button></div> : <div className="space-y-2">{classData.agenda.slice(0, 2).map((item) => <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700"><div className="w-10 text-center text-blue-600 dark:text-blue-400"><p className="text-[9px] font-bold uppercase">{item.date.split(' ')[1]}</p><p className="text-lg leading-none font-black">{item.date.split(' ')[0]}</p></div><div className="min-w-0"><p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{item.title}</p><p className="text-xs text-slate-400">{item.type}</p></div></div>)}<button onClick={() => setActiveTab('settings')} className="w-full pt-2 text-xs font-bold text-blue-600 dark:text-blue-400">Lihat semua agenda →</button></div>}
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
                      
                      {workspaceMode !== 'teaching' && (<div className="flex bg-slate-100 dark:bg-slate-700/50 p-1 rounded-xl w-fit">
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
                      </div>)}
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

                        if (workspaceMode === 'teaching') {
                          const periodOptions = [
                            { key: 'harian' as const, label: 'Harian', description: 'Hari ini', source: 'daily' },
                            { key: 'mingguan' as const, label: 'Mingguan', description: '7 hari terakhir', source: 'weekly' },
                            { key: 'bulanan' as const, label: 'Bulanan', description: 'Bulan berjalan', source: 'monthly' },
                          ];
                          const selectedDaily = data.harian;
                          const selectedTotal = selectedDaily.total;
                          const selectedHadirPct = selectedTotal > 0 ? Math.round((selectedDaily.Hadir / selectedTotal) * 100) : 0;

                          return (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                {periodOptions.map((period) => {
                                  const periodData = classStats[period.source].harian;
                                  const periodTotal = periodData.total;
                                  const periodHadirPct = periodTotal > 0 ? Math.round((periodData.Hadir / periodTotal) * 100) : 0;
                                  const isActive = statsTab === period.key;
                                  return (
                                    <button
                                      key={period.key}
                                      type="button"
                                      onClick={() => setStatsTab(period.key)}
                                      aria-pressed={isActive}
                                      className={`rounded-xl border p-4 text-left transition-all ${isActive ? 'border-blue-400 bg-blue-50 shadow-sm dark:border-blue-600 dark:bg-blue-950/30' : 'border-slate-200 bg-slate-50/60 hover:border-blue-200 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-blue-800 dark:hover:bg-blue-950/20'}`}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <span className={`text-sm font-bold ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>Presensi {period.label}</span>
                                        <span className="text-xs text-slate-400">Tot: {periodTotal}</span>
                                      </div>
                                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{period.description}</p>
                                      <div className="mt-3 flex items-center justify-between text-xs">
                                        <span className="text-slate-500 dark:text-slate-400">Hadir</span>
                                        <span className="font-bold text-emerald-600">{periodData.Hadir} ({periodHadirPct}%)</span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-700/50 dark:bg-slate-800/30">
                                <div className="flex items-center justify-between gap-3">
                                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Presensi Harian</h4>
                                  <span className="text-xs text-slate-400">Total: {selectedTotal}</span>
                                </div>
                                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${selectedHadirPct}%` }} />
                                </div>
                                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                  <div><p className="text-xs text-slate-500 dark:text-slate-400">Hadir</p><p className="mt-1 text-lg font-bold text-emerald-600">{selectedDaily.Hadir}</p></div>
                                  <div><p className="text-xs text-slate-500 dark:text-slate-400">Sakit</p><p className="mt-1 text-lg font-bold text-amber-500">{selectedDaily.Sakit}</p></div>
                                  <div><p className="text-xs text-slate-500 dark:text-slate-400">Izin</p><p className="mt-1 text-lg font-bold text-blue-500">{selectedDaily.Izin}</p></div>
                                  <div><p className="text-xs text-slate-500 dark:text-slate-400">Alfa</p><p className="mt-1 text-lg font-bold text-red-500">{selectedDaily.Alfa}</p></div>
                                </div>
                              </div>
                            </div>
                          );
                        }

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
                      {currentTeachingDay() || 'Akhir Pekan'}
                    </span>
                  </div>

                  {(() => {
                    const todayName = currentTeachingDay();
                    
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
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{sched.timeStart} - {sched.timeEnd}</p>
                              </div>
                              {sched.teacherName && (
                                <span className="text-[9px] font-medium text-slate-500 bg-slate-200 dark:bg-slate-700 dark:text-slate-400 px-2 py-0.5 rounded-full max-w-[110px] truncate" title={sched.teacherName}>
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
                  <section className="space-y-3"><h4 className="font-semibold text-slate-700 dark:text-slate-200">Master Kelas</h4><div className="grid grid-cols-2 gap-2"><input value={newClassName} onChange={(event) => setNewClassName(event.target.value)} placeholder="Contoh: XI TKJ B" className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600" /><input value={newClassYear} onChange={(event) => setNewClassYear(event.target.value)} placeholder={classData.selectedYear || '2026-2027'} className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600" /></div><button onClick={async () => { const name = newClassName.trim(), academicYear = newClassYear.trim() || classData.selectedYear || ''; if (!name || !academicYear) return; const response = await fetch('/api/classes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, academicYear }) }); if (!response.ok) return notify((await response.json()).error || 'Gagal menambah kelas.'); setNewClassName(''); setNewClassYear(''); await classData.selectClass(classData.classId || ''); }} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" />Tambah Kelas</button><div className="space-y-2">{classData.classes.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900/40"><button onClick={() => classData.selectClass(item.id)} className="text-left"><span className="font-medium text-slate-800 dark:text-slate-100">{item.name}</span><span className="ml-2 text-xs text-slate-400">{item.academicYear}</span></button>{item.id !== classData.classId && <button onClick={async () => { if (!(await confirm({ title: 'Hapus kelas', message: `Hapus kelas ${item.name}?`, danger: true, confirmLabel: 'Hapus' }))) return; const response = await fetch(`/api/classes/${item.id}`, { method: 'DELETE' }); if (!response.ok) return notify((await response.json()).error || 'Gagal menghapus kelas.'); await classData.selectClass(classData.classId || ''); }} className="text-red-500"><Trash2 className="h-4 w-4" /></button>}</div>)}</div></section>
                  <section className="space-y-3"><h4 className="font-semibold text-slate-700 dark:text-slate-200">Guru & BK</h4><div className="grid gap-2 sm:grid-cols-3"><input value={newTeacherName} onChange={(event) => setNewTeacherName(event.target.value)} placeholder="Nama akun" className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600" /><input value={newTeacherIdentifier} onChange={(event) => setNewTeacherIdentifier(event.target.value)} placeholder="NIP / username" className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600" /><select value={newAccountRole} onChange={(event) => setNewAccountRole(event.target.value as 'teacher' | 'counselor')} className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600"><option value="teacher">Guru Pengajar</option><option value="counselor">BK</option></select></div><button onClick={async () => { if (!newTeacherName.trim() || !newTeacherIdentifier.trim()) return; const response = await fetch('/api/teachers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newTeacherName, identifier: newTeacherIdentifier, accountRole: newAccountRole }) }); if (!response.ok) return notify((await response.json()).error || 'Gagal menambah akun.'); setNewTeacherName(''); setNewTeacherIdentifier(''); setNewAccountRole('teacher'); fetchTeachingSetup(); }} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" />Tambah Akun</button><div className="space-y-2">{teachers.length ? teachers.map((teacher) => <div key={teacher.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900/40"><span><span className="font-medium text-slate-800 dark:text-slate-100">{teacher.name}</span><span className="ml-2 text-xs text-slate-400">{teacher.identifier}</span><span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${teacher.primaryRole === 'counselor' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'}`}>{teacher.primaryRole === 'counselor' ? 'BK' : 'Guru'}</span></span><button onClick={async () => { if (!(await confirm({ title: 'Hapus akun', message: `Hapus akun ${teacher.name}?`, danger: true, confirmLabel: 'Hapus' }))) return; const response = await fetch(`/api/teachers/${teacher.id}`, { method: 'DELETE' }); if (!response.ok) return notify((await response.json()).error || 'Gagal menghapus akun.'); fetchTeachingSetup(); }} className="text-red-500"><Trash2 className="h-4 w-4" /></button></div>) : <p className="py-3 text-center text-xs text-slate-400">Belum ada akun guru atau BK.</p>}</div></section>
                </div>
                <section className="border-t border-slate-100 pt-5 dark:border-slate-700"><h4 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Penugasan Mengajar</h4><div className="grid gap-2 md:grid-cols-4"><select value={assignmentTeacherId} onChange={(event) => setAssignmentTeacherId(event.target.value)} className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600"><option value="">Pilih guru</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select><select value={assignmentClassId} onChange={(event) => setAssignmentClassId(event.target.value)} className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600"><option value="">Pilih kelas</option>{classData.classes.filter((item) => item.status === 'Aktif').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={assignmentSubjectId} onChange={(event) => setAssignmentSubjectId(event.target.value)} className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600"><option value="">Pilih mapel</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select><button onClick={async () => { const currentClass = classData.classes.find((item) => item.id === assignmentClassId); if (!assignmentTeacherId || !assignmentClassId || !assignmentSubjectId || !currentClass) return; const response = await fetch('/api/teaching-assignments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId: assignmentTeacherId, classId: assignmentClassId, subjectId: assignmentSubjectId, academicYear: currentClass.academicYear }) }); if (!response.ok) return notify((await response.json()).error || 'Gagal menyimpan penugasan.'); setAssignmentTeacherId(''); setAssignmentClassId(''); setAssignmentSubjectId(''); fetchTeachingSetup(); }} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white"><Save className="mr-1 inline h-4 w-4" />Tetapkan</button></div><div className="mt-3 space-y-2">{teachingAssignments.length ? teachingAssignments.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-slate-700"><span className="text-slate-700 dark:text-slate-200"><b>{item.teacherName}</b> · {item.subjectName} · {item.className} <span className="text-xs text-slate-400">({item.academicYear})</span></span><button onClick={async () => { if (!(await confirm({ title: 'Hapus penugasan', message: 'Hapus penugasan ini?', danger: true, confirmLabel: 'Hapus' }))) return; await fetch(`/api/teaching-assignments/${item.id}`, { method: 'DELETE' }); fetchTeachingSetup(); }} className="text-red-500"><Trash2 className="h-4 w-4" /></button></div>) : <p className="py-3 text-center text-xs text-slate-400">Belum ada penugasan mengajar.</p>}</div></section>
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
                      <button onClick={async () => { try { await classData.updateHeroImage(heroImageUrl); notify('Gambar hero berhasil disimpan.'); } catch (error) { notify(error instanceof Error ? error.message : 'Gagal menyimpan gambar hero.'); } }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"><Save className="h-4 w-4" /> Simpan Gambar</button>
                      <button onClick={async () => { if (!(await confirm({ title: 'Gunakan gambar default', message: 'Kembalikan gambar hero ke gambar default?', confirmLabel: 'Gunakan default' }))) return; try { await classData.resetHeroImage(); notify('Gambar hero dikembalikan ke default.'); } catch { notify('Gagal mengembalikan gambar default.'); } }} className="px-4 py-2 rounded-lg font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Gunakan Default</button>
                    </div>
                  </div>
                </div>
              </div>

              <div id="settings-gallery" className={`${settingsView === 'gallery' ? '' : 'hidden '}bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 scroll-mt-6`}>
                <div className="flex items-start gap-3 mb-4 border-b border-slate-100 dark:border-slate-700 pb-3"><span className="p-2 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400"><ImageIcon className="h-5 w-5" /></span><div><h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Galeri Momen Kelas</h3><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tambahkan dokumentasi kegiatan kelas melalui URL gambar.</p></div></div>
                <div className="grid gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-xs font-medium text-slate-500">Judul</label><input value={galleryTitle} onChange={(event) => setGalleryTitle(event.target.value)} placeholder="Contoh: Kegiatan Projek P5" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none" /></div><div><label className="mb-1 block text-xs font-medium text-slate-500">URL Gambar</label><input value={galleryImageUrl} onChange={(event) => setGalleryImageUrl(event.target.value)} placeholder="https://contoh.sch.id/kegiatan.jpg" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none" /></div><div className="sm:col-span-2"><label className="mb-1 block text-xs font-medium text-slate-500">Keterangan (opsional)</label><input value={galleryDescription} onChange={(event) => setGalleryDescription(event.target.value)} placeholder="Deskripsi singkat kegiatan" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none" /></div></div>
                <div className="mt-3 flex flex-wrap gap-3"><button disabled={!galleryTitle.trim() || !galleryImageUrl.trim()} onClick={async () => { try { await classData.addGalleryItem({ title: galleryTitle, imageUrl: galleryImageUrl, description: galleryDescription }); setGalleryTitle(''); setGalleryImageUrl(''); setGalleryDescription(''); notify('Foto galeri berhasil ditambahkan.'); } catch (error) { notify(error instanceof Error ? error.message : 'Gagal menambah foto galeri.'); } }} className="flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2 font-medium text-white transition-colors hover:bg-pink-700 disabled:opacity-50"><Plus className="h-4 w-4" /> Tambah Foto</button>{galleryImageUrl && <img src={galleryImageUrl} alt="Pratinjau galeri" className="h-10 w-10 rounded-lg object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}</div>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{classData.galleryItems.length === 0 ? <p className="col-span-full py-3 text-center text-sm text-slate-400">Belum ada foto galeri.</p> : classData.galleryItems.map((item) => <div key={item.id} className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"><img src={item.imageUrl} alt={item.title} className="aspect-square w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} /><div className="p-2"><p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{item.title}</p></div><button onClick={async () => { if (!(await confirm({ title: 'Hapus foto galeri', message: `Hapus foto "${item.title}"?`, danger: true, confirmLabel: 'Hapus' }))) return; try { await classData.removeGalleryItem(item.id); } catch { notify('Gagal menghapus foto galeri.'); } }} className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-red-500 opacity-0 shadow transition-opacity group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button></div>)}</div>
              </div>

              <div id="settings-homeroom-photo" className={`${settingsView === 'landing' ? '' : 'hidden '}bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 scroll-mt-6`}>
                <div className="flex items-start gap-3 mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
                  <span className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400"><ImageIcon className="h-5 w-5" /></span>
                  <div><h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Foto Wali Kelas</h3><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Foto ini tampil pada card wali kelas di landing page.</p></div>
                </div>
                <div className="grid md:grid-cols-[112px_1fr] gap-5 items-start">
                  <img src={homeroomTeacherPhotoUrl || '/wali-kelas-placeholder.svg'} alt="Pratinjau foto wali kelas" className="h-28 w-28 rounded-full border-4 border-slate-100 dark:border-slate-700 object-cover bg-slate-100 dark:bg-slate-900" onError={(event) => { event.currentTarget.src = '/wali-kelas-placeholder.svg'; }} />
                  <div className="space-y-3"><label className="block text-sm font-medium text-slate-600 dark:text-slate-400">URL Foto</label><input value={homeroomTeacherPhotoUrl} onChange={(event) => setHomeroomTeacherPhotoUrl(event.target.value)} placeholder="https://contoh.sch.id/foto-wali-kelas.jpg" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-4 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" /><div className="flex flex-wrap gap-2"><button onClick={async () => { try { await classData.updateHomeroomTeacherPhoto(homeroomTeacherPhotoUrl); notify('Foto wali kelas berhasil disimpan.'); } catch (error) { notify(error instanceof Error ? error.message : 'Gagal menyimpan foto wali kelas.'); } }} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"><Save className="h-4 w-4" /> Simpan Foto</button><button onClick={async () => { if (!(await confirm({ title: 'Gunakan foto placeholder', message: 'Kembalikan ke foto placeholder?', confirmLabel: 'Gunakan placeholder' }))) return; try { await classData.resetHomeroomTeacherPhoto(); notify('Foto placeholder digunakan kembali.'); } catch { notify('Gagal mengembalikan foto placeholder.'); } }} className="px-4 py-2 rounded-lg font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Gunakan Placeholder</button></div></div>
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
                  <button disabled={!officerRole.trim() || !officerStudentId} onClick={async () => { try { await classData.saveClassOfficer(officerStudentId, officerRole); notify('Pengurus kelas berhasil disimpan.'); } catch (error) { notify(error instanceof Error ? error.message : 'Gagal menyimpan pengurus kelas.'); } }} className="flex justify-center items-center gap-2 bg-emerald-600 disabled:opacity-50 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"><Save className="h-4 w-4" /> Simpan</button>
                </div>
                <div className="space-y-2">
                  {classData.officers.length === 0 ? <p className="py-4 text-center text-sm text-slate-400">Belum ada pengurus kelas.</p> : classData.officers.map((officer) => <div key={officer.id} className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-4 py-3"><div className="h-9 w-9 shrink-0 rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 grid place-items-center font-bold">{officer.name.slice(0, 1)}</div><div className="min-w-0 flex-1"><p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{officer.name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{officer.role}</p></div><button onClick={() => { setOfficerRole(officer.role); setOfficerStudentId(officer.userId); }} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg" title="Ubah penugasan"><Edit2 className="h-4 w-4" /></button><button onClick={async () => { if (!(await confirm({ title: 'Hapus jabatan', message: `Hapus jabatan ${officer.role}?`, danger: true, confirmLabel: 'Hapus' }))) return; try { await classData.removeClassOfficer(officer.id); } catch { notify('Gagal menghapus pengurus kelas.'); } }} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg" title="Hapus jabatan"><Trash2 className="h-4 w-4" /></button></div>)}
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
              {canViewLearningProfiles && <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm dark:border-violet-900/50 dark:bg-slate-800"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Tindak Lanjut</p><h3 className="mt-1 text-xl font-black text-slate-800 dark:text-slate-100">Kelompok intervensi</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Pilih siswa dari matriks untuk membuat rencana dukungan atau remedial bersama.</p></div><button type="button" onClick={openLearningInterventionModal} disabled={!selectedInterventionStudentIds.length || !learningSummaryTopic.trim()} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">Buat kelompok ({selectedInterventionStudentIds.length})</button></div><div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" onClick={() => setSelectedInterventionStudentIds((learningSummary?.students || []).map((student) => student.id))} disabled={!learningSummary?.students.length} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">Pilih semua tampilan</button><button type="button" onClick={() => setSelectedInterventionStudentIds([])} disabled={!selectedInterventionStudentIds.length} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">Batal pilih</button>{!learningSummaryTopic.trim() && <span className="text-xs text-amber-600 dark:text-amber-300">Isi topik pada ringkasan agar kelompok dapat dibuat.</span>}</div>{learningSummary?.students.length ? <div className="mt-3 grid max-h-36 gap-2 overflow-y-auto sm:grid-cols-2">{learningSummary.students.map((student) => <label key={student.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs hover:border-violet-300 dark:border-slate-700"><input type="checkbox" checked={selectedInterventionStudentIds.includes(student.id)} onChange={(event) => setSelectedInterventionStudentIds((current) => event.target.checked ? [...new Set([...current, student.id])] : current.filter((id) => id !== student.id))} className="h-4 w-4 rounded border-slate-300 text-violet-600" /><span className="font-semibold text-slate-700 dark:text-slate-200">{student.name}</span>{!student.profile && <span className="ml-auto text-[10px] text-rose-500">belum ada profil</span>}</label>)}</div> : <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400 dark:border-slate-700">Muat ringkasan kelas terlebih dahulu untuk memilih siswa.</p>}{learningInterventions.length > 0 && <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-700"><div className="mb-3 flex items-center justify-between"><h4 className="font-bold text-slate-800 dark:text-slate-100">Rencana tersimpan</h4>{isLoadingLearningInterventions && <span className="text-xs text-slate-400">Memuat…</span>}</div><div className="space-y-2">{learningInterventions.map((intervention) => <article key={intervention.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h5 className="font-bold text-sm text-slate-700 dark:text-slate-200">{intervention.title}</h5><span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">{intervention.members.length} siswa</span></div><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{intervention.subject} · {intervention.topic}{intervention.scheduledDate ? ` · ${intervention.scheduledDate}` : ''}</p><p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Tujuan: {intervention.goal}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Strategi: {intervention.strategy}</p></div><div className="flex shrink-0 items-center gap-2"><select value={intervention.status} onChange={(event) => handleUpdateLearningIntervention(intervention, event.target.value as LearningInterventionStatus)} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="rencana">Rencana</option><option value="berjalan">Berjalan</option><option value="selesai">Selesai</option></select><button type="button" onClick={() => handleDeleteLearningIntervention(intervention)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-700" aria-label="Hapus kelompok intervensi"><Trash2 className="h-4 w-4" /></button></div></div><p className="mt-2 text-[11px] text-slate-400">{intervention.members.map((member) => member.name).join(' · ')}</p></article>)}</div></div>}</section>}
              {canViewLearningProfiles && <section className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Fokus Tindak Lanjut</p><h3 className="mt-1 font-bold text-slate-800 dark:text-slate-100">Kelompok dukungan belajar</h3><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Pilih kelompok untuk menyaring matriks dan menentukan prioritas pembelajaran.</p></div><select value={learningSummaryFilter} onChange={(event) => setLearningSummaryFilter(event.target.value as LearningSummaryFilter)} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none dark:border-amber-800 dark:bg-slate-900 dark:text-slate-100"><option value="all">Semua siswa</option><option value="needs-support">Perlu dukungan</option><option value="developing">Sedang berkembang</option><option value="independent">Cukup mandiri</option></select></div>{learningSummarySource && <div className="mt-4 grid gap-2 sm:grid-cols-3"><button type="button" onClick={() => setLearningSummaryFilter('needs-support')} className={`rounded-xl border p-3 text-left transition ${learningSummaryFilter === 'needs-support' ? 'border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/30' : 'border-rose-100 bg-white hover:border-rose-300 dark:border-rose-900/50 dark:bg-slate-800'}`}><p className="text-2xl font-black text-rose-700 dark:text-rose-300">{learningSummarySource.students.filter((student) => learningSummaryStatus(student) === 'needs-support').length}</p><p className="text-xs font-bold text-rose-700 dark:text-rose-300">Perlu dukungan</p></button><button type="button" onClick={() => setLearningSummaryFilter('developing')} className={`rounded-xl border p-3 text-left transition ${learningSummaryFilter === 'developing' ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30' : 'border-amber-100 bg-white hover:border-amber-300 dark:border-amber-900/50 dark:bg-slate-800'}`}><p className="text-2xl font-black text-amber-700 dark:text-amber-300">{learningSummarySource.students.filter((student) => learningSummaryStatus(student) === 'developing').length}</p><p className="text-xs font-bold text-amber-700 dark:text-amber-300">Sedang berkembang</p></button><button type="button" onClick={() => setLearningSummaryFilter('independent')} className={`rounded-xl border p-3 text-left transition ${learningSummaryFilter === 'independent' ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30' : 'border-emerald-100 bg-white hover:border-emerald-300 dark:border-emerald-900/50 dark:bg-slate-800'}`}><p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{learningSummarySource.students.filter((student) => learningSummaryStatus(student) === 'independent').length}</p><p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Cukup mandiri</p></button></div>}{learningSummarySource && learningSummaryRecommendations.length > 0 && <div className="mt-4 grid gap-3 md:grid-cols-2">{learningSummaryRecommendations.slice(0, 2).map((recommendation) => <article key={recommendation.key} className="rounded-xl border border-amber-100 bg-white p-3 dark:border-amber-900/40 dark:bg-slate-800"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold text-slate-700 dark:text-slate-200">Prioritas: {recommendation.label}</p><span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{recommendation.count} siswa</span></div><p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{recommendation.suggestion}</p></article>)}</div>}</section>}
              {canViewLearningProfiles && <section className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm dark:border-cyan-900/50 dark:bg-slate-800"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Peta Perkembangan Kelas</p><h3 className="mt-1 text-xl font-black text-slate-800 dark:text-slate-100">Ringkasan Profil Belajar</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Lihat kebutuhan dukungan seluruh siswa berdasarkan profil topik terakhir yang tercatat.</p></div><div className="flex flex-col gap-2 sm:flex-row"><input value={learningSummarySubject} onChange={(event) => setLearningSummarySubject(event.target.value)} placeholder="Mata pelajaran" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /><input value={learningSummaryTopic} onChange={(event) => setLearningSummaryTopic(event.target.value)} placeholder="Topik (opsional)" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /><button type="button" onClick={fetchLearningSummary} className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-700">Tampilkan</button></div></div>{isLoadingLearningSummary ? <p className="py-8 text-center text-sm text-slate-400">Memuat ringkasan perkembangan…</p> : learningSummary && <><div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400"><span className="font-bold text-slate-700 dark:text-slate-200">{learningSummary.class.name}</span><span>·</span><span>{learningSummary.subject || 'Semua mata pelajaran'}</span>{learningSummary.topic && <><span>·</span><span>{learningSummary.topic}</span></>}<span className="ml-auto">{learningSummary.students.filter((student) => student.profile).length}/{learningSummary.students.length} siswa memiliki profil</span></div><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400"><tr><th className="px-3 py-3">Siswa</th><th className="px-3 py-3">Konsep</th><th className="px-3 py-3">Penalaran</th><th className="px-3 py-3">Literasi</th><th className="px-3 py-3">Mandiri</th><th className="px-3 py-3">Checkpoint</th><th className="px-3 py-3"></th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{learningSummary.students.map((student) => { const profile = student.profile; const checkpoint = student.checkpoint; return <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30"><td className="px-3 py-3"><p className="font-bold text-slate-700 dark:text-slate-200">{student.name}</p><p className="text-[10px] text-slate-400">{student.identifier}</p></td>{[profile?.conceptLevel, profile?.reasoningLevel, profile?.literacyLevel, profile?.independenceLevel].map((level, index) => <td key={index} className="px-3 py-3"><span className={`inline-flex min-w-8 justify-center rounded-full px-2 py-1 font-black ${learningLevelTone(level)}`}>{level ? `${level}/4` : '—'}</span></td>)}<td className="px-3 py-3">{checkpoint ? <div><span className="font-bold text-cyan-700 dark:text-cyan-300">{Math.round((checkpoint.recallLevel + checkpoint.reasoningLevel + checkpoint.transferLevel) / 3 * 10) / 10}/4</span><p className="mt-0.5 text-[10px] text-slate-400">{checkpoint.date}</p></div> : <span className="text-slate-400">—</span>}</td><td className="px-3 py-3 text-right"><button type="button" onClick={() => { const source = classData.students.find((item) => item.id === student.id); if (source) loadLearningProfile(source); }} className="rounded-lg px-2.5 py-1.5 font-bold text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/30">Profil</button></td></tr>; })}</tbody></table></div><div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-500 dark:text-slate-400"><span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">1 · Perlu dukungan</span><span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">2 · Berkembang</span><span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">3 · Cukup mandiri</span><span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">4 · Sangat baik</span></div></>}</section>}
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
                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200"><div className="flex items-center gap-2"><span>{student.name}</span>{canViewLearningProfiles && <button type="button" onClick={() => loadLearningProfile(student)} className="inline-flex items-center gap-1 rounded-lg border border-violet-200 px-2 py-1 text-[11px] font-bold text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/30" title={`Buka profil belajar ${student.name}`}><FileText className="h-3.5 w-3.5" /> Profil</button>}</div></td>
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
                              const isConfirmed = await confirm({ title: 'Nonaktifkan siswa', message: `Nonaktifkan ${student.name}? Data presensi, nilai, sikap, dan prestasi tetap tersimpan.`, confirmLabel: 'Nonaktifkan' });
                              if (isConfirmed) {
                                await classData.removeStudent(student.id);
                                notify('Status siswa berhasil diubah menjadi Nonaktif.');
                              }
                            }}
                            className="text-slate-400 hover:text-amber-500 p-1 ml-1"
                            title="Nonaktifkan siswa"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                          <button
                            onClick={async () => {
                              const isConfirmed = await confirm({ title: 'Hapus permanen siswa', message: `Hapus permanen ${student.name}? Tindakan ini tidak dapat dibatalkan dan hanya tersedia bila siswa belum memiliki riwayat data.`, danger: true, confirmLabel: 'Hapus permanen' });
                              if (!isConfirmed) return;
                              try {
                                await classData.permanentlyDeleteStudent(student.id);
                                notify('Siswa berhasil dihapus permanen.');
                              } catch (error) {
                                notify(error instanceof Error ? error.message : 'Gagal menghapus siswa.');
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
                                              : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40'
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
                                                : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40'
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
                    notify('Pengaturan kelas berhasil disimpan untuk semua browser.');
                  } catch (error) {
                    notify(error instanceof Error ? error.message : 'Gagal menyimpan pengaturan kelas.');
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
                    notify('Tugas pengurus kelas berhasil disimpan.');
                  } catch (error) {
                    notify(error instanceof Error ? error.message : 'Gagal menyimpan tugas pengurus kelas.');
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
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Buku Nilai Digital
                </button>
                <button
                  onClick={() => setAcademicSubTab('materials')}
                  className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                    academicSubTab === 'materials'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Bank Materi & Tugas
                </button>
                <button
                  onClick={() => setAcademicSubTab('schedule')}
                  className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                    academicSubTab === 'schedule'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
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
                                              [scoreKey]: scoreVal
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
                      onClick={openNewAssignmentModal}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all shadow-sm"
                    >
                      <Plus className="h-4 w-4" /> Tambah Materi / Tugas
                    </button>
                  </div>

                  <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-2 lg:grid-cols-5">
                    <label className="relative lg:col-span-2"><span className="sr-only">Cari materi atau tugas</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={assignmentSearch} onChange={(event) => setAssignmentSearch(event.target.value)} placeholder="Cari materi atau tugas..." className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" /></label>
                    <select aria-label="Filter tipe konten" value={assignmentTypeFilter} onChange={(event) => setAssignmentTypeFilter(event.target.value as typeof assignmentTypeFilter)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"><option value="all">Semua tipe</option><option value="tugas">Tugas</option><option value="materi">Materi</option></select>
                    <select aria-label="Filter status konten" value={assignmentStatusFilter} onChange={(event) => setAssignmentStatusFilter(event.target.value as typeof assignmentStatusFilter)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"><option value="all">Semua status</option><option value="draft">Draft</option><option value="published">Terbit</option><option value="archived">Arsip</option></select>
                    <select aria-label="Filter kelas tujuan" value={assignmentClassFilter} onChange={(event) => setAssignmentClassFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"><option value="all">Semua kelas</option>{classData.classes.filter((item) => item.status === 'Aktif').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                    <select aria-label="Urutkan materi dan tugas" value={assignmentSort} onChange={(event) => setAssignmentSort(event.target.value as typeof assignmentSort)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"><option value="newest">Terbaru dibuat</option><option value="dueSoon">Tenggat terdekat</option></select>
                  </div>

                  {isLoadingAssignments ? (
                    <div className="text-center py-12 text-slate-400">Memuat data bank materi...</div>
                  ) : assignmentsList.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <FileText className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                      <h4 className="font-semibold text-slate-600 dark:text-slate-400">Belum ada materi atau tugas</h4>
                      <p className="text-sm text-slate-400 mt-1">Klik tombol di atas untuk membagikan materi pertama Anda.</p>
                    </div>
                  ) : filteredAssignments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-800"><Search className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" /><h4 className="font-semibold text-slate-600 dark:text-slate-400">Tidak ada item yang sesuai</h4><p className="mt-1 text-sm text-slate-400">Ubah kata kunci atau filter pencarian.</p></div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {filteredAssignments.map((item) => (
                        <div key={item.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between hover:shadow-md transition-all duration-300">
                          <div>
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                                  item.type === 'tugas'
                                    ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50'
                                    : 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50'
                                }`}>
                                  {item.type === 'tugas' ? 'Tugas' : 'Materi'}
                                </span>
                                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.status === 'draft' ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' : item.status === 'archived' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'}`}>{item.status === 'draft' ? 'Draft' : item.status === 'archived' ? 'Arsip' : 'Terbit'}</span>
                                <div className="flex flex-wrap gap-1">
                                  {(item.targetClasses || []).map((target: any) => (
                                    <span key={target.id} className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300" title={`${target.name} · ${target.academicYear}`}>
                                      Kelas {target.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openEditAssignmentModal(item)}
                                  className="text-slate-400 hover:text-blue-500 p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                                  title="Edit"
                                  aria-label={`Edit ${item.title}`}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteAssignment(item.id)}
                                  className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                  title="Hapus"
                                  aria-label={`Hapus ${item.title}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            
                            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">{item.title}</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 mb-4">{item.description || 'Tidak ada deskripsi.'}</p>
                            
                            {item.filePath && (
                              <div className="flex items-center gap-2 mb-4 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                <FileText className="h-4 w-4 text-blue-600" />
                                <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[220px]" title={item.fileName || item.filePath}>
                                  {item.fileName || 'File pendukung'}
                                </span>
                                <a 
                                  href={item.fileDownloadUrl || item.filePath}
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
                                  onClick={() => { setSubmissionSearch(''); setSubmissionStatusFilter('all'); setSubmissionClassId(String(item.targetClassIds?.[0] || classData.classId || '')); setViewSubmissionsAssignmentId(item.id); }}
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
                            const firstSubject = scheduleSubjects[0] || '';
                            setNewScheduleSubject(firstSubject);
                            setNewScheduleTimeStart('07:30');
                            setNewScheduleTimeEnd('09:00');
                            setNewScheduleTeacherId(scheduleAssignments.find((item) => item.subjectName === firstSubject)?.teacherId || '');
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
                            <div key={day} className="border-b border-slate-100 dark:border-slate-700 pb-6 last:border-0 last:pb-0">
                              <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
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
                                            if (await confirm({ title: 'Hapus jadwal', message: `Hapus jadwal ${sched.subject} pada hari ${sched.day}?`, danger: true, confirmLabel: 'Hapus' })) {
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
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 mb-6 space-y-4">
                        <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider">Tambah Agenda Baru</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tanggal</label>
                            <input
                              type="text"
                              value={newAgendaDate}
                              onChange={e => setNewAgendaDate(e.target.value)}
                              placeholder="Contoh: 15 Okt, 20-22 Nov"
                              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Judul Kegiatan</label>
                            <input
                              type="text"
                              value={newAgendaTitle}
                              onChange={e => setNewAgendaTitle(e.target.value)}
                              placeholder="Contoh: Pembagian Rapor"
                              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipe</label>
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
                            onClick={async () => {
                              if (!newAgendaTitle || !newAgendaDate) {
                                notify('Isi tanggal dan judul agenda!');
                                return;
                              }
                              try {
                                await classData.addAgenda({
                                  id: '',
                                  date: newAgendaDate,
                                  title: newAgendaTitle,
                                  type: newAgendaType
                                });
                                setNewAgendaDate('');
                                setNewAgendaTitle('');
                                notify('Agenda berhasil ditambahkan!', 'success');
                              } catch (error) {
                                notify(error instanceof Error ? error.message : 'Gagal menambahkan agenda.', 'error');
                              }
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
                            <div key={item.id} className="flex items-start justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700 gap-2">
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
                                  if (await confirm({ title: 'Hapus agenda', message: `Hapus agenda "${item.title}"?`, danger: true, confirmLabel: 'Hapus' })) {
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

          {activeTab === 'monitoring' && (userRole === 'admin' || userRole === 'teacher' || userRole === 'counselor') && (
            <div className="mx-auto max-w-6xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
              <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                {userRole !== 'teacher' && <button onClick={() => setMonitoringSubTab('cases')} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${monitoringSubTab === 'cases' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}`}><ShieldAlert className="h-4 w-4" /> Kasus Pembinaan</button>}
                <button onClick={() => setMonitoringSubTab('activity')} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${monitoringSubTab === 'activity' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}`}><Activity className="h-4 w-4" /> Aktivitas Belajar</button>
              </div>
              {monitoringSubTab === 'cases' && (
              <>
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
              </>
              )}

              {monitoringSubTab === 'activity' && (
                <>
                  <div className="flex flex-col gap-4 rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-600 to-blue-700 p-6 text-white shadow-lg dark:border-cyan-900">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-wider text-cyan-100">Pusat Pemantauan Siswa</p><h3 className="mt-1 text-2xl font-black">Aktivitas Belajar</h3><p className="mt-2 max-w-2xl text-sm text-cyan-50">Pantau kehadiran online, waktu aktif, dan aktivitas belajar siswa.</p></div><RefreshCw className={`h-7 w-7 ${isLoadingActivity ? 'animate-spin' : ''}`} /></div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/20"><p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Online sekarang</p><p className="mt-1 text-3xl font-black text-emerald-800 dark:text-emerald-200">{studentActivityReport?.summary.onlineCount || 0}</p></div><div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900/50 dark:bg-blue-950/20"><p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Siswa beraktivitas</p><p className="mt-1 text-3xl font-black text-blue-800 dark:text-blue-200">{studentActivityReport?.summary.activeStudentCount || 0}</p></div><div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-900/50 dark:bg-violet-950/20"><p className="text-xs font-semibold text-violet-700 dark:text-violet-300">Total waktu aktif</p><p className="mt-1 text-2xl font-black text-violet-800 dark:text-violet-200">{formatActivityDuration(studentActivityReport?.summary.totalActiveSeconds || 0)}</p></div></div>
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h4 className="font-bold text-slate-800 dark:text-slate-100">Daftar Aktivitas Siswa</h4><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Durasi dihitung dari waktu aktif; materi yang dibuka bukan bukti seluruh isi telah dibaca.</p>{studentActivityReport?.generatedAt && <p className="mt-1 text-[11px] text-slate-400">Diperbarui {new Date(studentActivityReport.generatedAt).toLocaleString('id-ID')}</p>}</div><button onClick={fetchStudentActivity} className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"><RefreshCw className="h-3.5 w-3.5" /> Segarkan</button></div>
                    <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6"><select value={monitoringClassFilter} onChange={(event) => setMonitoringClassFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="all">Semua kelas</option>{classData.classes.filter((item) => item.status === 'Aktif').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input type="date" value={activityFrom} onChange={(event) => setActivityFrom(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /><input type="date" value={activityTo} onChange={(event) => setActivityTo(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /><select value={activityActionFilter} onChange={(event) => setActivityActionFilter(event.target.value as typeof activityActionFilter)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="all">Semua aktivitas</option>{Object.entries(activityLabels).filter(([key]) => key !== 'logout').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={activityAttentionFilter} onChange={(event) => setActivityAttentionFilter(event.target.value as typeof activityAttentionFilter)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="all">Semua tindak lanjut</option><option value="overdue">Lewat tenggat</option><option value="opened_pending">Sudah membuka</option><option value="not_started">Belum mulai</option><option value="none">Tidak perlu tindak lanjut</option></select><input value={activitySearch} onChange={(event) => setActivitySearch(event.target.value)} placeholder="Cari nama siswa..." className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /></div>
                    {studentActivityReport && (() => {
                      const students = studentActivityReport.students;
                      const count = (attention: ActivityStudent['assignmentStats']['attention']) => students.filter((student) => student.assignmentStats.attention === attention).length;
                      return <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3 dark:border-rose-900/40 dark:bg-rose-950/15"><p className="text-[11px] font-bold uppercase text-rose-600 dark:text-rose-300">Lewat tenggat</p><p className="mt-1 text-xl font-black text-rose-700 dark:text-rose-200">{count('overdue')} siswa</p></div>
                        <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/15"><p className="text-[11px] font-bold uppercase text-amber-600 dark:text-amber-300">Sudah membuka</p><p className="mt-1 text-xl font-black text-amber-700 dark:text-amber-200">{count('opened_pending')} siswa</p></div>
                        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900/40 dark:bg-blue-950/15"><p className="text-[11px] font-bold uppercase text-blue-600 dark:text-blue-300">Belum mulai</p><p className="mt-1 text-xl font-black text-blue-700 dark:text-blue-200">{count('not_started')} siswa</p></div>
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/15"><p className="text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-300">Tidak perlu tindak lanjut</p><p className="mt-1 text-xl font-black text-emerald-700 dark:text-emerald-200">{count('none')} siswa</p></div>
                      </div>;
                    })()}
                    {isLoadingActivity && !studentActivityReport ? <p className="py-10 text-center text-sm text-slate-400">Memuat aktivitas siswa…</p> : (() => { const rows = (studentActivityReport?.students || []).filter((student) => (activityAttentionFilter === 'all' || student.assignmentStats.attention === activityAttentionFilter) && (!activitySearch.trim() || student.name.toLowerCase().includes(activitySearch.trim().toLowerCase()) || student.identifier.includes(activitySearch.trim()))); return rows.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-slate-700">Belum ada data aktivitas pada periode ini.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"><tr><th className="px-3 py-3">Siswa</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Waktu aktif</th><th className="px-3 py-3">Aktivitas</th><th className="px-3 py-3">Tindak lanjut</th><th className="px-3 py-3">Terakhir aktif</th><th className="px-3 py-3"></th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{rows.map((student) => <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30"><td className="px-3 py-3"><p className="font-bold text-slate-800 dark:text-slate-100">{student.name}</p><p className="text-[11px] text-slate-400">{student.className} · {student.identifier}</p></td><td className="px-3 py-3">{student.online ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Online</span> : <span className="text-xs text-slate-400">Offline</span>}</td><td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">{formatActivityDuration(student.totalActiveSeconds)}</td><td className="px-3 py-3"><span className="font-semibold text-slate-700 dark:text-slate-200">{student.activityCount}</span><span className="ml-1 text-xs text-slate-400">event</span>{student.latestActivity && <p className="mt-1 max-w-[230px] truncate text-[11px] text-slate-400">{activityLabels[student.latestActivity.action]}{student.latestActivity.resourceTitle ? ` · ${student.latestActivity.resourceTitle}` : ''}</p>}</td><td className="px-3 py-3"><span className={student.assignmentStats.attention === 'overdue' ? 'font-bold text-rose-600 dark:text-rose-300' : student.assignmentStats.attention === 'none' ? 'text-emerald-600 dark:text-emerald-300' : 'font-semibold text-amber-600 dark:text-amber-300'}>{activityAttentionLabels[student.assignmentStats.attention]}</span><p className="mt-1 text-[11px] text-slate-400">{student.assignmentStats.pendingCount} tertunda · {student.assignmentStats.lateCount} terlambat</p></td><td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">{student.lastActiveAt ? new Date(student.lastActiveAt).toLocaleString('id-ID') : 'Belum aktif'}</td><td className="px-3 py-3 text-right"><button onClick={() => setSelectedActivityStudentId(selectedActivityStudentId === student.id ? null : student.id)} className="rounded-lg px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30">{selectedActivityStudentId === student.id ? 'Tutup' : 'Detail'}</button></td></tr>)}</tbody></table></div>; })()}
                  </section>
                  {selectedActivityStudentId && studentActivityReport && (() => {
                    const student = studentActivityReport.students.find((item) => item.id === selectedActivityStudentId);
                    const activities = studentActivityReport.activities.filter((item) => item.studentId === selectedActivityStudentId);
                    const sessions = studentActivityReport.sessions.filter((item) => item.studentId === selectedActivityStudentId);
                    if (!student) return null;
                    return (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="activity-detail-title">
                        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setSelectedActivityStudentId(null)} />
                        <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
                          <div className="flex items-start justify-between border-b border-slate-100 p-6 dark:border-slate-700">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Detail Aktivitas Siswa</p>
                              <h4 id="activity-detail-title" className="mt-1 text-xl font-black text-slate-800 dark:text-slate-100">{student.name}</h4>
                              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{student.className} · {student.identifier}</p>
                            </div>
                            <button onClick={() => setSelectedActivityStudentId(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Tutup detail aktivitas"><X className="h-5 w-5" /></button>
                          </div>
                          <div className="overflow-y-auto p-6">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/50"><p className="text-xs text-slate-400">Status</p><p className="mt-1 font-bold text-slate-700 dark:text-slate-200">{student.online ? 'Online' : 'Offline'}</p></div>
                              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/50"><p className="text-xs text-slate-400">Waktu aktif</p><p className="mt-1 font-bold text-slate-700 dark:text-slate-200">{formatActivityDuration(student.totalActiveSeconds)}</p></div>
                              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/50"><p className="text-xs text-slate-400">Sesi / aktivitas</p><p className="mt-1 font-bold text-slate-700 dark:text-slate-200">{student.sessionCount} / {student.activityCount}</p></div>
                              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/50"><p className="text-xs text-slate-400">Tugas tertunda</p><p className="mt-1 font-bold text-slate-700 dark:text-slate-200">{student.assignmentStats.pendingCount} · {student.assignmentStats.lateCount} terlambat</p></div>
                            </div>
                            <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
                              <section>
                                <h5 className="font-bold text-slate-800 dark:text-slate-100">Kronologi Aktivitas</h5>
                                <div className="mt-3 space-y-2">
                                  {activities.slice(0, 100).map((activity) => <div key={activity.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-700"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-500" /><div><p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{activityLabels[activity.action]}{activity.resourceTitle ? ` · ${activity.resourceTitle}` : ''}</p><p className="mt-1 text-xs text-slate-400">{new Date(activity.occurredAt).toLocaleString('id-ID')}{activity.page ? ` · ${activity.page}` : ''}</p></div></div>)}
                                  {activities.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400 dark:border-slate-700">Belum ada aktivitas detail pada periode ini.</p>}
                                </div>
                              </section>
                              <section>
                                <h5 className="font-bold text-slate-800 dark:text-slate-100">Riwayat Sesi</h5>
                                <div className="mt-3 space-y-2">
                                  {sessions.map((session) => <div key={session.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-700"><p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{new Date(session.startedAt).toLocaleString('id-ID')}</p><p className="mt-1 text-xs text-slate-400">{formatActivityDuration(session.activeSeconds)} · {session.endReason || (student.online ? 'Aktif' : 'Selesai')}</p></div>)}
                                  {sessions.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400 dark:border-slate-700">Belum ada sesi pada periode ini.</p>}
                                </div>
                              </section>
                            </div>
                          </div>
                          <div className="flex justify-end border-t border-slate-100 p-4 dark:border-slate-700"><button onClick={() => setSelectedActivityStudentId(null)} className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-cyan-700">Tutup</button></div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
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
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {workspaceMode === 'teaching' ? 'Penilaian Sikap & Karakter' : 'Catatan Sikap & Karakter'}
                </button>
                {workspaceMode !== 'teaching' && <button
                  onClick={() => setBehaviorSubTab('prestasi')}
                  className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                    behaviorSubTab === 'prestasi'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
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
                                        if (await confirm({ title: 'Hapus catatan sikap', message: 'Hapus catatan sikap ini?', danger: true, confirmLabel: 'Hapus' })) {
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
                                  {item.description && <div className="text-xs text-slate-400 italic mt-0.5">{item.description}</div>}
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
                                      if (await confirm({ title: 'Hapus catatan prestasi', message: `Hapus catatan prestasi "${item.title}"?`, danger: true, confirmLabel: 'Hapus' })) {
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
                          <button onClick={async () => { if (await confirm({ title: 'Hapus catatan sikap', message: 'Hapus catatan sikap ini?', danger: true, confirmLabel: 'Hapus' })) await classData.removeBehaviorRecord(record.id); }} aria-label="Hapus catatan sikap" className="absolute bottom-3 right-3 rounded p-1 text-red-500 hover:bg-white/70 hover:text-red-700 dark:hover:bg-slate-700"><Trash2 className="h-4 w-4" /></button>
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
          { id: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard },
          { id: 'students', label: 'Siswa', icon: Users },
          ...(userRole === 'admin' ? [{ id: 'attendance', label: 'Presensi', icon: CheckSquare }] : workspaceMode === 'teaching' ? [{ id: 'teaching-attendance', label: 'Presensi Mapel', icon: CheckSquare }] : []),
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
              ...((userRole === 'admin' || userRole === 'teacher' || userRole === 'counselor') ? [{ id: 'monitoring', label: 'Pemantauan Siswa', icon: ShieldAlert }] : []),
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
          
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 animate-in zoom-in-95 duration-200 relative" role="dialog" aria-modal="true" aria-labelledby="student-modal-title">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            
            <h3 id="student-modal-title" className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              {editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {editingStudent ? 'Perbarui data diri siswa di bawah ini.' : 'Masukkan data diri siswa baru secara manual.'}
            </p>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!manualNisn || !manualName) return;
              try {
                if (editingStudent) {
                  await classData.updateStudent({
                    id: editingStudent.id,
                    nisn: manualNisn,
                    name: manualName,
                    gender: manualGender,
                    status: manualStatus
                  });
                  notify('Siswa berhasil diperbarui!', 'success');
                } else {
                  await classData.addStudent({
                    id: '',
                    nisn: manualNisn,
                    name: manualName,
                    gender: manualGender,
                    status: manualStatus
                  });
                  notify('Siswa berhasil ditambahkan!', 'success');
                }
                setShowAddModal(false);
                setEditingStudent(null);
              } catch (error) {
                notify(error instanceof Error ? error.message : 'Gagal menyimpan data siswa.', 'error');
              }
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

      {showLearningProfileModal && selectedLearningStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setShowLearningProfileModal(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
          <div className="relative z-10 max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800 sm:p-7" role="dialog" aria-modal="true" aria-labelledby="learning-profile-title">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-700">
              <div><p className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Student Learning Profile</p><h3 id="learning-profile-title" className="mt-1 text-xl font-black text-slate-800 dark:text-slate-100">Profil Belajar · {selectedLearningStudent.name}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Catat perkembangan berdasarkan bukti pembelajaran, bukan label terhadap siswa.</p></div>
              <button type="button" onClick={() => setShowLearningProfileModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Tutup profil belajar"><X className="h-5 w-5" /></button>
            </div>
            {isLoadingLearningProfile ? <p className="py-12 text-center text-sm text-slate-400">Memuat profil belajar…</p> : learningProfileData && <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-5">
                <form onSubmit={handleSaveLearningProfile} className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
                  <div className="mb-4 flex items-center justify-between gap-3"><div><h4 className="font-bold text-slate-800 dark:text-slate-100">Ringkasan penguasaan</h4><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Skala 1–4 adalah alat bantu guru, bukan nilai rapor.</p></div><span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-violet-700 shadow-sm dark:bg-slate-800 dark:text-violet-300">{learningProfileData.profiles.length} topik tersimpan</span></div>
                  <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-500">Mata pelajaran<input value={learningProfileForm.subject} onChange={(event) => setLearningProfileForm((current) => ({ ...current, subject: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" required /></label><label className="text-xs font-semibold text-slate-500">Topik<input value={learningProfileForm.topic} onChange={(event) => setLearningProfileForm((current) => ({ ...current, topic: event.target.value }))} placeholder="Contoh: Barisan dan Deret" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" required /></label></div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">{([['conceptLevel', 'Pemahaman konsep'], ['reasoningLevel', 'Penalaran'], ['literacyLevel', 'Literasi soal'], ['independenceLevel', 'Kemandirian']] as const).map(([field, label]) => <label key={field} className="text-xs font-semibold text-slate-500">{label}<select value={learningProfileForm[field]} onChange={(event) => setLearningProfileForm((current) => ({ ...current, [field]: Number(event.target.value) as LearningLevel }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="1">1 · Perlu dukungan</option><option value="2">2 · Mulai berkembang</option><option value="3">3 · Cukup mandiri</option><option value="4">4 · Sangat baik</option></select></label>)}</div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-500">Kekuatan yang terlihat<textarea value={learningProfileForm.strengths} onChange={(event) => setLearningProfileForm((current) => ({ ...current, strengths: event.target.value }))} rows={3} placeholder="Contoh: mampu menjelaskan pola dengan gambar…" className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /></label><label className="text-xs font-semibold text-slate-500">Kebutuhan dukungan<textarea value={learningProfileForm.supportNeeds} onChange={(event) => setLearningProfileForm((current) => ({ ...current, supportNeeds: event.target.value }))} rows={3} placeholder="Contoh: perlu bantuan saat membaca soal cerita…" className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /></label></div>
                  <div className="mt-4 flex justify-end"><button type="submit" disabled={isSavingLearningProfile || !learningProfileForm.topic.trim()} className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">{isSavingLearningProfile ? 'Menyimpan…' : 'Simpan profil topik'}</button></div>
                </form>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><div className="mb-3 flex items-center justify-between"><div><h4 className="font-bold text-slate-800 dark:text-slate-100">Topik tersimpan</h4><p className="mt-1 text-xs text-slate-500">Pilih topik untuk memperbarui profilnya.</p></div></div>{learningProfileData.profiles.length ? <div className="space-y-2">{learningProfileData.profiles.map((profile) => <button type="button" key={profile.id} onClick={() => { setLearningProfileForm({ subject: profile.subject, topic: profile.topic, conceptLevel: profile.conceptLevel, reasoningLevel: profile.reasoningLevel, literacyLevel: profile.literacyLevel, independenceLevel: profile.independenceLevel, strengths: profile.strengths, supportNeeds: profile.supportNeeds }); setLearningObservationForm((current) => ({ ...current, subject: profile.subject, topic: profile.topic })); }} className={`w-full rounded-xl border p-3 text-left transition ${learningProfileForm.topic === profile.topic && learningProfileForm.subject === profile.subject ? 'border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/20' : 'border-slate-200 hover:border-violet-200 dark:border-slate-700 dark:hover:border-violet-800'}`}><div className="flex items-center justify-between gap-2"><span className="font-bold text-sm text-slate-700 dark:text-slate-200">{profile.subject} · {profile.topic}</span><span className="text-[11px] text-slate-400">{profile.updatedAt ? new Date(profile.updatedAt).toLocaleDateString('id-ID') : ''}</span></div><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Konsep {profile.conceptLevel}/4 · Penalaran {profile.reasoningLevel}/4 · Literasi {profile.literacyLevel}/4 · Mandiri {profile.independenceLevel}/4</p></button>)}</div> : <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400 dark:border-slate-700">Belum ada profil topik. Isi ringkasan pertama di atas.</p>}</div>
              </div>
              <div className="space-y-5">
                <form onSubmit={handleSaveLearningObservation} className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20"><div className="mb-4"><h4 className="font-bold text-slate-800 dark:text-slate-100">Catatan observasi</h4><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Gunakan perilaku konkret dan konteks singkat.</p></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-500">Mata pelajaran<input value={learningObservationForm.subject} onChange={(event) => setLearningObservationForm((current) => ({ ...current, subject: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" required /></label><label className="text-xs font-semibold text-slate-500">Topik<input value={learningObservationForm.topic} onChange={(event) => setLearningObservationForm((current) => ({ ...current, topic: event.target.value }))} placeholder="Topik observasi" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" required /></label></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-500">Kategori<select value={learningObservationForm.category} onChange={(event) => setLearningObservationForm((current) => ({ ...current, category: event.target.value as LearningObservationCategory }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">{['pemahaman konsep', 'strategi pemecahan masalah', 'literasi soal', 'kemandirian', 'partisipasi', 'kolaborasi', 'lainnya'].map((category) => <option key={category} value={category}>{category}</option>)}</select></label><label className="text-xs font-semibold text-slate-500">Tanggal<input type="date" value={learningObservationForm.date} onChange={(event) => setLearningObservationForm((current) => ({ ...current, date: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" required /></label></div><label className="mt-3 block text-xs font-semibold text-slate-500">Catatan<textarea value={learningObservationForm.note} onChange={(event) => setLearningObservationForm((current) => ({ ...current, note: event.target.value }))} rows={4} placeholder="Contoh: mampu menyelesaikan soal rutin, tetapi masih berhenti saat bentuk soal diubah." className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" required /></label><div className="mt-3 flex justify-end"><button type="submit" disabled={isSavingLearningObservation || !learningObservationForm.topic.trim() || !learningObservationForm.note.trim()} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{isSavingLearningObservation ? 'Menyimpan…' : 'Tambah observasi'}</button></div></form>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><h4 className="font-bold text-slate-800 dark:text-slate-100">Riwayat observasi</h4>{learningProfileData.observations.length ? <div className="mt-3 max-h-[30rem] space-y-2 overflow-y-auto">{learningProfileData.observations.map((observation) => <article key={observation.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-700"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-1.5"><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{observation.category}</span><span className="text-[11px] text-slate-400">{observation.date}</span></div><p className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-200">{observation.subject} · {observation.topic}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{observation.note}</p><p className="mt-2 text-[11px] text-slate-400">Dicatat oleh {observation.recordedBy?.name || 'Pengguna'}</p></div><button type="button" onClick={() => handleDeleteLearningObservation(observation)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-700" aria-label="Hapus observasi"><Trash2 className="h-4 w-4" /></button></div></article>)}</div> : <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400 dark:border-slate-700">Belum ada observasi belajar.</p>}</div>
              </div>
            </div>}
            {learningProfileData && <div className="mt-5 grid gap-5 border-t border-slate-100 pt-5 dark:border-slate-700 lg:grid-cols-[0.9fr_1.1fr]">
              <form onSubmit={handleSaveLearningCheckpoint} className="rounded-2xl border border-cyan-100 bg-cyan-50/50 p-4 dark:border-cyan-900/50 dark:bg-cyan-950/20"><div className="mb-4"><h4 className="font-bold text-slate-800 dark:text-slate-100">Checkpoint / Exit Ticket</h4><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Rekam hasil asesmen singkat setelah siswa mencoba sendiri.</p></div><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold text-slate-500">Mata pelajaran<input value={learningCheckpointForm.subject} onChange={(event) => setLearningCheckpointForm((current) => ({ ...current, subject: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" required /></label><label className="text-xs font-semibold text-slate-500">Topik<input value={learningCheckpointForm.topic} onChange={(event) => setLearningCheckpointForm((current) => ({ ...current, topic: event.target.value }))} placeholder="Topik checkpoint" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" required /></label><label className="text-xs font-semibold text-slate-500">Tanggal<input type="date" value={learningCheckpointForm.date} onChange={(event) => setLearningCheckpointForm((current) => ({ ...current, date: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" required /></label></div><div className="mt-3 grid gap-3 sm:grid-cols-3">{([['recallLevel', 'Recall · konsep dasar'], ['reasoningLevel', 'Reasoning · menjelaskan'], ['transferLevel', 'Transfer · situasi baru']] as const).map(([field, label]) => <label key={field} className="text-xs font-semibold text-slate-500">{label}<select value={learningCheckpointForm[field]} onChange={(event) => setLearningCheckpointForm((current) => ({ ...current, [field]: Number(event.target.value) as LearningLevel }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="1">1 · Belum mulai</option><option value="2">2 · Dengan bantuan</option><option value="3">3 · Cukup mandiri</option><option value="4">4 · Mandiri dan jelas</option></select></label>)}</div><label className="mt-3 block text-xs font-semibold text-slate-500">Refleksi siswa / catatan singkat<textarea value={learningCheckpointForm.reflection} onChange={(event) => setLearningCheckpointForm((current) => ({ ...current, reflection: event.target.value }))} rows={3} placeholder="Contoh: Saya masih bingung mengapa rumus tersebut digunakan." className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /></label><div className="mt-3 flex justify-end"><button type="submit" disabled={isSavingLearningCheckpoint || !learningCheckpointForm.topic.trim()} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50">{isSavingLearningCheckpoint ? 'Menyimpan…' : 'Simpan checkpoint'}</button></div></form>
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><h4 className="font-bold text-slate-800 dark:text-slate-100">Riwayat checkpoint</h4>{learningProfileData.checkpoints.length ? <div className="mt-3 max-h-[22rem] space-y-2 overflow-y-auto">{learningProfileData.checkpoints.map((checkpoint) => <article key={checkpoint.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-700"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-1.5"><span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">{checkpoint.date}</span><span className="text-[11px] text-slate-400">{checkpoint.subject} · {checkpoint.topic}</span></div><p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Recall <b>{checkpoint.recallLevel}/4</b> · Reasoning <b>{checkpoint.reasoningLevel}/4</b> · Transfer <b>{checkpoint.transferLevel}/4</b></p>{checkpoint.reflection && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">“{checkpoint.reflection}”</p>}<p className="mt-2 text-[11px] text-slate-400">Dicatat oleh {checkpoint.recordedBy?.name || 'Pengguna'}</p></div><button type="button" onClick={() => handleDeleteLearningCheckpoint(checkpoint)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-700" aria-label="Hapus checkpoint"><Trash2 className="h-4 w-4" /></button></div></article>)}</div> : <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400 dark:border-slate-700">Belum ada checkpoint belajar.</p>}</div>
            </div>}
          </div>
        </div>
      )}

      {showLearningInterventionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div onClick={() => setShowLearningInterventionModal(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" /><div className="relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800" role="dialog" aria-modal="true" aria-labelledby="learning-intervention-title"><div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-700"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Rencana Dukungan</p><h3 id="learning-intervention-title" className="mt-1 text-xl font-black text-slate-800 dark:text-slate-100">Buat kelompok intervensi</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedInterventionStudentIds.length} siswa dipilih · {learningSummarySubject} · {learningSummaryTopic}</p></div><button type="button" onClick={() => setShowLearningInterventionModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Tutup dialog intervensi"><X className="h-5 w-5" /></button></div><form onSubmit={handleSaveLearningIntervention} className="mt-5 space-y-4"><label className="block text-xs font-bold text-slate-500">Nama kelompok / rencana<input value={learningInterventionForm.title} onChange={(event) => setLearningInterventionForm((current) => ({ ...current, title: event.target.value }))} placeholder="Contoh: Math Recovery Barisan dan Deret" className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" required /></label><label className="block text-xs font-bold text-slate-500">Tujuan belajar<textarea value={learningInterventionForm.goal} onChange={(event) => setLearningInterventionForm((current) => ({ ...current, goal: event.target.value }))} placeholder="Contoh: siswa mampu menjelaskan makna beda sebelum menggunakan rumus." rows={3} className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" required /></label><label className="block text-xs font-bold text-slate-500">Strategi / aktivitas<textarea value={learningInterventionForm.strategy} onChange={(event) => setLearningInterventionForm((current) => ({ ...current, strategy: event.target.value }))} placeholder="Contoh: gunakan pola konkret, diskusi berpasangan, lalu checkpoint 10 menit." rows={3} className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" required /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-500">Tanggal rencana<input type="date" value={learningInterventionForm.scheduledDate} onChange={(event) => setLearningInterventionForm((current) => ({ ...current, scheduledDate: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /></label><label className="text-xs font-bold text-slate-500">Status<select value={learningInterventionForm.status} onChange={(event) => setLearningInterventionForm((current) => ({ ...current, status: event.target.value as LearningInterventionStatus }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="rencana">Rencana</option><option value="berjalan">Berjalan</option><option value="selesai">Selesai</option></select></label></div><div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowLearningInterventionModal(false)} className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">Batal</button><button type="submit" disabled={isSavingLearningIntervention} className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">{isSavingLearningIntervention ? 'Menyimpan…' : 'Simpan rencana'}</button></div></form></div></div>
      )}

      {/* Add Assessment Modal */}
      {showAddModalAcademic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setShowAddModalAcademic(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          ></div>
          
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 animate-in zoom-in-95 duration-200 relative" role="dialog" aria-modal="true" aria-labelledby="assessment-modal-title">
            <button 
              onClick={() => setShowAddModalAcademic(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 id="assessment-modal-title" className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
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
                      notify('Nama penilaian tidak boleh kosong!');
                      return;
                    }
                    const exists = sessionAssessments.some(a => a.name.toLowerCase() === newAssessmentName.trim().toLowerCase());
                    if (exists) {
                      notify('Nama penilaian sudah ada!');
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
          
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 animate-in zoom-in-95 duration-200 relative max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="assignment-modal-title">
            <button 
              onClick={() => setShowAddAssignmentModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 id="assignment-modal-title" className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              {editingAssignmentId ? <Edit2 className="h-5 w-5 text-blue-600" /> : <Plus className="h-5 w-5 text-blue-600" />}
              {editingAssignmentId ? 'Edit Materi / Tugas' : 'Tambah Materi / Tugas'}
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

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Status publikasi</label>
                <select value={newAssignmentStatus} onChange={(event) => setNewAssignmentStatus(event.target.value as AssignmentStatus)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500">
                  <option value="draft">Draft — belum tampil ke siswa</option>
                  <option value="published">Terbit — tampil ke siswa</option>
                  <option value="archived">Arsip — tidak tampil ke siswa</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Kelas Tujuan</label>
                <div className="max-h-36 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                  {classData.classes.filter((item) => item.status === 'Aktif').map((item) => {
                    const checked = newAssignmentTargetClassIds.includes(item.id);
                    return (
                      <label key={item.id} className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors ${checked ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setNewAssignmentTargetClassIds((current) => checked ? current.filter((id) => id !== item.id) : [...current, item.id])}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span><span className="font-semibold">{item.name}</span><span className="ml-2 text-xs text-slate-400">{item.academicYear}</span></span>
                      </label>
                    );
                  })}
                  {classData.classes.filter((item) => item.status === 'Aktif').length === 0 && <p className="text-xs text-slate-400">Belum ada kelas aktif yang dapat dipilih.</p>}
                </div>
                <p className="mt-1 text-xs text-slate-400">Materi/tugas hanya akan tampil untuk siswa pada kelas yang dipilih.</p>
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
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">File Pendukung PDF (Opsional)</label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 px-4 py-3 text-sm text-blue-700 hover:border-blue-400 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-300">
                  <Upload className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{newAssignmentFile?.name || 'Pilih PDF dari perangkat (maks. 10 MB)'}</span>
                  <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    if (!file) return;
                    if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && !['application/pdf', 'application/octet-stream'].includes(file.type))) { notify('File pendukung harus berformat PDF.', 'warning'); event.currentTarget.value = ''; return; }
                    if (file.size > 10 * 1024 * 1024) { notify('Ukuran PDF maksimal 10 MB.', 'warning'); event.currentTarget.value = ''; return; }
                    setNewAssignmentFile(file);
                  }} />
                </label>
                {newAssignmentFile && <p className="mt-1 text-xs text-slate-400">{(newAssignmentFile.size / 1024 / 1024).toFixed(2)} MB · siap diunggah ke penyimpanan sekolah</p>}
                <p className="mb-2 mt-3 text-[11px] text-slate-400">Atau gunakan link eksternal yang sudah tersedia.</p>
                <input 
                  type="text" 
                  value={newAssignmentFilePath}
                  onChange={(e) => setNewAssignmentFilePath(e.target.value)}
                  placeholder="Misal: https://drive.google.com/..."
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
                  disabled={isSavingAssignment}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.2)]"
                >
                  {isSavingAssignment ? 'Menyimpan…' : newAssignmentStatus === 'draft' ? 'Simpan Draft' : 'Simpan & Terbitkan'}
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
          
          <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 animate-in zoom-in-95 duration-200 relative max-h-[85vh] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="submissions-modal-title">
            <button 
              onClick={() => setViewSubmissionsAssignmentId(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 id="submissions-modal-title" className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-blue-600" />
              Pantau Pengumpulan Tugas & Beri Nilai
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Berikut adalah daftar pengumpulan tugas oleh siswa pada kelas tujuan beserta status penilaiannya.
            </p>

            {(() => {
              const assignment = assignmentsList.find((item) => item.id === viewSubmissionsAssignmentId);
              const targetClasses = assignment?.targetClasses || [];
              return targetClasses.length > 1 ? (
                <div className="mb-4 flex items-center gap-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Kelas</label>
                  <select
                    value={submissionClassId}
                    onChange={(event) => { setSubmissionClassId(event.target.value); fetchSubmissions(viewSubmissionsAssignmentId, event.target.value); }}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {targetClasses.map((target: any) => <option key={target.id} value={target.id}>{target.name} · {target.academicYear}</option>)}
                  </select>
                </div>
              ) : null;
            })()}

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
                onChange={(event) => setSubmissionStatusFilter(event.target.value as typeof submissionStatusFilter)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="all">Semua Status</option>
                <option value="submitted">Sudah Mengumpulkan</option>
                <option value="pending">Belum Mengumpulkan</option>
                <option value="ungraded">Belum Dinilai</option>
                <option value="late">Terlambat</option>
              </select>
            </div>

            <div className="overflow-y-auto flex-1 pr-1">
              {isLoadingSubmissions ? (
                <div className="text-center py-12 text-slate-400">Memuat data pengumpulan...</div>
              ) : submissionsList.length === 0 ? (
                <div className="text-center py-12 text-slate-400">Belum ada siswa terdaftar di kelas ini.</div>
              ) : filteredSubmissions.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">Tidak ada siswa yang sesuai dengan pencarian atau filter.</div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                  <table className="w-full min-w-[760px] text-left text-sm text-slate-600 dark:text-slate-300">
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
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${sub.late ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900/50' : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/50'}`}>
                                  {sub.late ? 'Terlambat' : 'Terkumpul'}
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
                              {sub.hasSubmitted && sub.downloadUrl ? (
                                <a 
                                  href={sub.downloadUrl}
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="text-blue-600 hover:underline font-bold"
                                >
                                  {sub.originalName || 'Lihat PDF'}
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
                                      [sub.studentId]: gradeVal
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

      {showScheduleRequestModal && selectedScheduleForRequest && <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800" role="dialog" aria-modal="true" aria-labelledby="schedule-request-title">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300">Jadwal Mengajar</p><h3 id="schedule-request-title" className="mt-1 text-lg font-bold text-slate-800 dark:text-slate-100">Ajukan perubahan jadwal</h3></div><button type="button" onClick={() => setShowScheduleRequestModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Tutup dialog"><X className="h-5 w-5" /></button></div>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300"><b>{selectedScheduleForRequest.subject}</b> · {selectedScheduleForRequest.className}<br />Jadwal aktif: {selectedScheduleForRequest.day}, {selectedScheduleForRequest.timeStart}–{selectedScheduleForRequest.timeEnd}</p>
          <form onSubmit={handleSubmitScheduleRequest} className="mt-5 space-y-4"><div><label htmlFor="requested-schedule-day" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Hari usulan</label><select id="requested-schedule-day" value={requestedScheduleDay} onChange={(event) => setRequestedScheduleDay(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-violet-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">{TEACHING_DAY_NAMES.map((day) => <option key={day} value={day}>{day}</option>)}</select></div><div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="requested-schedule-start" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Jam mulai</label><input id="requested-schedule-start" type="time" value={requestedScheduleTimeStart} onChange={(event) => setRequestedScheduleTimeStart(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-violet-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" required /></div><div><label htmlFor="requested-schedule-end" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Jam selesai</label><input id="requested-schedule-end" type="time" value={requestedScheduleTimeEnd} onChange={(event) => setRequestedScheduleTimeEnd(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-violet-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" required /></div></div><div><label htmlFor="schedule-request-reason" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Alasan perubahan</label><textarea id="schedule-request-reason" value={scheduleRequestReason} onChange={(event) => setScheduleRequestReason(event.target.value)} maxLength={500} rows={3} placeholder="Contoh: Penyesuaian jadwal rapat guru." className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-violet-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" required /><p className="mt-1 text-right text-[11px] text-slate-400">{scheduleRequestReason.length}/500</p></div><p className="rounded-xl bg-violet-50 p-3 text-xs text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">Jadwal aktif tidak berubah sebelum pengajuan disetujui admin atau wali kelas.</p><div className="flex gap-3"><button type="button" onClick={() => setShowScheduleRequestModal(false)} className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">Batal</button><button type="submit" disabled={isSubmittingScheduleRequest || scheduleRequestReason.trim().length < 3} className="flex-1 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">{isSubmittingScheduleRequest ? 'Mengirim…' : 'Kirim pengajuan'}</button></div></form>
        </div>
      </div>}

      {showJournalModal && <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
        <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800" role="dialog" aria-modal="true" aria-labelledby="journal-modal-title">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">Dokumentasi Pembelajaran</p><h3 id="journal-modal-title" className="mt-1 text-lg font-bold text-slate-800 dark:text-slate-100">{editingJournalId ? 'Edit jurnal mengajar' : 'Buat jurnal mengajar'}</h3></div><button type="button" onClick={() => setShowJournalModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Tutup dialog"><X className="h-5 w-5" /></button></div>
          <form onSubmit={handleSaveJournal} className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-500 dark:text-slate-400">Kelas<select disabled={Boolean(editingJournalId)} value={journalForm.classId} onChange={(event) => { const classId = event.target.value; const subject = subjectOptionsForClass(classId)[0]?.name || ''; setJournalForm((current) => ({ ...current, classId, subject, scheduleId: '', timeStart: '', timeEnd: '' })); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="">Pilih kelas</option>{journalClassOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-xs font-bold text-slate-500 dark:text-slate-400">Mata pelajaran<select disabled={Boolean(editingJournalId)} value={journalForm.subject} onChange={(event) => setJournalForm((current) => ({ ...current, subject: event.target.value, scheduleId: '', timeStart: '', timeEnd: '' }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="">Pilih mata pelajaran</option>{journalSubjectOptions.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label></div>
            <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-bold text-slate-500 dark:text-slate-400">Tanggal<input type="date" required value={journalForm.date} onChange={(event) => setJournalForm((current) => ({ ...current, date: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /></label><label className="text-xs font-bold text-slate-500 dark:text-slate-400 sm:col-span-2">Jadwal terkait (opsional)<select disabled={Boolean(editingJournalId)} value={journalForm.scheduleId} onChange={(event) => { const schedule = journalScheduleOptions.find((item) => item.id === event.target.value); setJournalForm((current) => ({ ...current, scheduleId: event.target.value, timeStart: schedule?.timeStart || current.timeStart, timeEnd: schedule?.timeEnd || current.timeEnd })); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="">Tidak terkait jadwal tertentu</option>{journalScheduleOptions.map((item) => <option key={item.id} value={item.id}>{item.day} · {item.timeStart}–{item.timeEnd}</option>)}</select></label></div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-500 dark:text-slate-400">Jam mulai<input type="time" value={journalForm.timeStart} onChange={(event) => setJournalForm((current) => ({ ...current, timeStart: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /></label><label className="text-xs font-bold text-slate-500 dark:text-slate-400">Jam selesai<input type="time" value={journalForm.timeEnd} onChange={(event) => setJournalForm((current) => ({ ...current, timeEnd: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /></label></div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">Materi yang diajarkan<textarea required minLength={3} maxLength={3000} rows={4} value={journalForm.materialCovered} onChange={(event) => setJournalForm((current) => ({ ...current, materialCovered: event.target.value }))} placeholder="Contoh: Persamaan kuadrat — menyelesaikan soal menggunakan rumus ABC." className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /><span className="mt-1 block text-right text-[11px] font-normal text-slate-400">{journalForm.materialCovered.length}/3000</span></label>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">Kejadian di kelas <span className="font-normal text-slate-400">(opsional)</span><textarea maxLength={3000} rows={3} value={journalForm.classroomEvents} onChange={(event) => setJournalForm((current) => ({ ...current, classroomEvents: event.target.value }))} placeholder="Contoh: Beberapa siswa memerlukan pendampingan tambahan." className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /></label>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">Rencana pertemuan berikutnya <span className="font-normal text-slate-400">(opsional)</span><textarea maxLength={3000} rows={3} value={journalForm.nextPlan} onChange={(event) => setJournalForm((current) => ({ ...current, nextPlan: event.target.value }))} placeholder="Contoh: Latihan soal dan pembahasan kesalahan umum." className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /></label>
            <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowJournalModal(false)} className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">Batal</button><button type="submit" disabled={isSavingJournal || !journalForm.classId || !journalForm.subject || journalForm.materialCovered.trim().length < 3} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{isSavingJournal ? 'Menyimpan…' : 'Simpan jurnal'}</button></div>
          </form>
        </div>
      </div>}

      {selectedReminder && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800" role="dialog" aria-modal="true" aria-labelledby="skip-attendance-title">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">Pengingat Presensi</p><h3 id="skip-attendance-title" className="mt-1 text-lg font-bold text-slate-800 dark:text-slate-100">Tandai tidak ada pertemuan</h3></div><button type="button" onClick={() => setSelectedReminder(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Tutup dialog"><X className="h-5 w-5" /></button></div>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300"><b>{selectedReminder.subject}</b> · {selectedReminder.className}<br />{selectedReminder.day}, {selectedReminder.date} · {selectedReminder.timeStart}–{selectedReminder.timeEnd}</p>
          <form onSubmit={handleSkipAttendanceReminder} className="mt-5 space-y-4"><div><label htmlFor="reminder-reason" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Alasan</label><textarea id="reminder-reason" value={reminderReason} onChange={(event) => setReminderReason(event.target.value)} maxLength={200} rows={3} placeholder="Contoh: Kelas diliburkan karena kegiatan sekolah." className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" required /><p className="mt-1 text-right text-[11px] text-slate-400">{reminderReason.length}/200</p></div><div className="flex gap-3"><button type="button" onClick={() => setSelectedReminder(null)} className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">Batal</button><button type="submit" disabled={isSavingReminderException || reminderReason.trim().length < 3} className="flex-1 rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50">{isSavingReminderException ? 'Menyimpan…' : 'Simpan alasan'}</button></div></form>
        </div>
      </div>}

      {/* Add Schedule Modal */}
      {showAddScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setShowAddScheduleModal(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          ></div>
          
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 animate-in zoom-in-95 duration-200 relative" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title">
            <button 
              onClick={() => setShowAddScheduleModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 id="schedule-modal-title" className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
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
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mata Pelajaran</label>
                <select value={newScheduleSubject} onChange={(event) => { const subject = event.target.value; setNewScheduleSubject(subject); setNewScheduleTeacherId(scheduleAssignments.find((item) => item.subjectName === subject)?.teacherId || ''); }} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" required>
                  <option value="">Pilih mata pelajaran</option>
                  {scheduleSubjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                </select>
                {!scheduleSubjects.length && <p className="mt-2 text-xs text-amber-600">Belum ada penugasan mengajar pada kelas ini.</p>}
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
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Guru Pengajar</label>
                <select value={newScheduleTeacherId} onChange={(event) => setNewScheduleTeacherId(event.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" required>
                  <option value="">Pilih guru pengajar</option>
                  {scheduleTeachers.map((item) => <option key={item.teacherId} value={item.teacherId}>{item.teacherName}</option>)}
                </select>
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
                    if (!newScheduleSubject || !newScheduleTimeStart || !newScheduleTimeEnd || !newScheduleTeacherId) {
                      notify('Isi semua data wajib!');
                      return;
                    }
                    try {
                      await classData.addSchedule({
                        day: newScheduleDay,
                        subject: newScheduleSubject,
                        timeStart: newScheduleTimeStart,
                        timeEnd: newScheduleTimeEnd,
                        teacherId: newScheduleTeacherId,
                        teacherName: scheduleTeachers.find((item) => item.teacherId === newScheduleTeacherId)?.teacherName || '',
                        color: newScheduleColor
                      });
                      setShowAddScheduleModal(false);
                      notify('Jadwal pelajaran berhasil ditambahkan!', 'success');
                    } catch (error) {
                      notify(error instanceof Error ? error.message : 'Gagal menyimpan jadwal.', 'error');
                    }
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
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800" role="dialog" aria-modal="true" aria-labelledby="case-modal-title">
            <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-700"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-600">Pemantauan Siswa</p><h3 id="case-modal-title" className="mt-1 text-lg font-bold text-slate-800 dark:text-slate-100">Buat Kasus Pembinaan</h3></div><button onClick={() => setShowCaseModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Tutup dialog kasus"><X className="h-5 w-5" /></button></div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Tambah Catatan">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800"><div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-700"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-600">Tindak Lanjut</p><h3 className="mt-1 text-lg font-bold text-slate-800 dark:text-slate-100">Tambah Catatan</h3></div><button onClick={() => setShowCaseUpdateModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><X className="h-5 w-5" /></button></div><form onSubmit={handleAddCaseUpdate} className="space-y-4 p-5"><div><label className="mb-1.5 block text-xs font-bold text-slate-500">Catatan tindakan</label><textarea value={caseUpdateNote} onChange={(event) => setCaseUpdateNote(event.target.value)} rows={5} required placeholder="Tuliskan observasi, komunikasi, atau bantuan yang diberikan..." className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-bold text-slate-500">Tindak lanjut berikutnya</label><input type="date" value={caseNextFollowUpDate} onChange={(event) => setCaseNextFollowUpDate(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /></div><div><label className="mb-1.5 block text-xs font-bold text-slate-500">Visibilitas catatan</label><select value={caseUpdateVisibility} onChange={(event) => setCaseUpdateVisibility(event.target.value as CaseVisibility)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"><option value="ringkasan">Ringkasan</option><option value="sensitif">Sensitif</option></select></div></div><div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowCaseUpdateModal(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 dark:border-slate-600 dark:text-slate-300">Batal</button><button type="submit" className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700">Simpan Catatan</button></div></form></div>
        </div>
      )}

      {/* Modal Add Behavior */}
      {showAddBehaviorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200" role="dialog" aria-modal="true" aria-labelledby="behavior-modal-title">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 id="behavior-modal-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">{workspaceMode === 'teaching' ? 'Catat Sikap & Karakter' : 'Catat Sikap Siswa'}</h3>
              <button onClick={() => setShowAddBehaviorModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
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
                notify('Catatan sikap berhasil disimpan!', 'success');
              } catch (error) {
                notify(error instanceof Error ? error.message : 'Gagal menyimpan catatan sikap.', 'error');
              }
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
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200" role="dialog" aria-modal="true" aria-labelledby="achievement-modal-title">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 id="achievement-modal-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">Catat Prestasi Siswa</h3>
              <button onClick={() => setShowAddAchievementModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                await classData.addAchievement({
                  studentId: achievementStudentId,
                  title: achievementTitle,
                  level: achievementLevel,
                  rank: achievementRank,
                  date: achievementDate,
                  description: achievementDescription
                });
                setShowAddAchievementModal(false);
                notify('Prestasi berhasil dicatat!', 'success');
              } catch (error) {
                notify(error instanceof Error ? error.message : 'Gagal menyimpan prestasi.', 'error');
              }
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
