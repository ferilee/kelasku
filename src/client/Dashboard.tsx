import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Users, Calendar, CheckSquare, Settings, Bell, LayoutDashboard, Plus, Trash2, Save, Megaphone, Upload, Edit2, Key, Sun, Moon, X, Download, Ban, FileText, Printer, FileSpreadsheet, Search, Clock, CalendarDays, Award, Menu, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useClassData, Announcement, AgendaItem, Student } from './ClassContext';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const classData = useClassData();

  // Dark mode state with persistence
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || 
             localStorage.getItem('theme') === 'dark';
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

  // Local state for the settings form to avoid immediate re-renders while typing
  const [quoteText, setQuoteText] = useState(classData.quote.text);
  const [quoteAuthor, setQuoteAuthor] = useState(classData.quote.author);
  
  const [newAnnType, setNewAnnType] = useState<'PENTING' | 'INFO' | 'SELAMAT'>('INFO');
  const [newAnnText, setNewAnnText] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [manualNisn, setManualNisn] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualGender, setManualGender] = useState<'L' | 'P'>('L');
  const [manualStatus, setManualStatus] = useState<'Aktif' | 'Nonaktif'>('Aktif');

  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [attendanceType, setAttendanceType] = useState<'harian' | 'dhuha' | 'dzuhur'>('harian');
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [mobileDashboardPanel, setMobileDashboardPanel] = useState<'schedule' | 'agenda'>('schedule');
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [reportData, setReportData] = useState<any[]>([]);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportCategory, setReportCategory] = useState<'attendance' | 'grades' | 'behavior'>('attendance');
  const [dashboardSummary, setDashboardSummary] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardSummary = async () => {
      try {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const res = await fetch(`/api/attendance/summary?month=${currentMonth}`);
        if (res.ok) {
          const json = await res.json();
          setDashboardSummary(json);
        }
      } catch (err) {
        console.error('Error fetching dashboard summary:', err);
      }
    };
    fetchDashboardSummary();
  }, [classData.students]);

  const fetchReportData = useCallback(async () => {
    setIsLoadingReport(true);
    try {
      const res = await fetch(`/api/attendance/summary?month=${selectedMonth}`);
      if (res.ok) {
        const json = await res.json();
        setReportData(json);
      }
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setIsLoadingReport(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    if (activeTab === 'reports' && reportCategory === 'attendance') {
      fetchReportData();
    }
  }, [activeTab, reportCategory, fetchReportData]);

  const [reportSubTab, setReportSubTab] = useState<'harian' | 'dhuha' | 'dzuhur'>('harian');
  const [statsTab, setStatsTab] = useState<'harian' | 'mingguan' | 'bulanan'>('bulanan');
  const [classStats, setClassStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const fetchClassStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const res = await fetch('/api/attendance/stats');
      if (res.ok) {
        const json = await res.json();
        setClassStats(json);
      }
    } catch (err) {
      console.error('Error fetching class stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

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

  const fetchGrades = useCallback(async () => {
    setIsLoadingGrades(true);
    try {
      const res = await fetch('/api/grades');
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
  }, []);

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
            scores
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
      const res = await fetch(`/api/grades/assessment?subject=${encodeURIComponent(selectedSubject)}&type=${assessmentType}&name=${encodeURIComponent(assessmentName)}`, {
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
        alert('Gagal menyimpan.');
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
    setIsLoadingSubmissions(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/submissions`);
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
  }, []);

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
    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (reportSubTab === 'harian') {
      csvContent += "No,Nama,L/P,Hadir (H),Sakit (S),Izin (I),Alfa (A)\n";
      reportData.forEach((row, index) => {
        csvContent += `${index + 1},"${row.name}",${row.gender},${row.harian.Hadir},${row.harian.Sakit},${row.harian.Izin},${row.harian.Alfa}\n`;
      });
    } else if (reportSubTab === 'dhuha') {
      csvContent += "No,Nama,L/P,Sholat (S),Berhalangan (BH),Alfa (A)\n";
      reportData.forEach((row, index) => {
        csvContent += `${index + 1},"${row.name}",${row.gender},${getSholatCount(row.dhuha)},${row.dhuha.Berhalangan || 0},${row.dhuha.Alfa}\n`;
      });
    } else {
      csvContent += "No,Nama,L/P,Sholat (S),Berhalangan (BH),Alfa (A)\n";
      reportData.forEach((row, index) => {
        csvContent += `${index + 1},"${row.name}",${row.gender},${getSholatCount(row.dzuhur)},${row.dzuhur.Berhalangan || 0},${row.dzuhur.Alfa}\n`;
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
        : 'LAPORAN PRESENSI SHOLAT DZUHUR SISWA';

    const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
    const dateColumns = Array.from({ length: daysInMonth }, (_, index) => index + 1)
      .filter((day) => {
        const dayOfWeek = new Date(Number(year), Number(month) - 1, day).getDay();
        return dayOfWeek !== 0 && dayOfWeek !== 6;
      })
      .map((day) => {
        const label = String(day).padStart(2, '0');
        return { label, date: `${selectedMonth}-${label}` };
      });
    const statusCodes: Record<string, string> = {
      Hadir: 'H',
      Sakit: 'S',
      Izin: 'I',
      Alfa: 'A',
      Sholat: 'S',
      Berjamaah: 'S',
      Munfarid: 'S',
      Berhalangan: 'BH',
    };
    const statusLegend = reportSubTab === 'harian'
      ? 'H = Hadir &nbsp;&nbsp; S = Sakit &nbsp;&nbsp; I = Izin &nbsp;&nbsp; A = Alfa'
      : 'S = Sholat (Berjamaah/Munfarid) &nbsp;&nbsp; BH = Berhalangan &nbsp;&nbsp; A = Alfa';
    const summaryColumns = reportSubTab === 'harian'
      ? ['H', 'S', 'I', 'A']
      : ['S', 'BH', 'A'];
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
    reportData.forEach((row, index) => {
      const statusCodesByDate = dateColumns.map(({ date }) => {
        const status = row.attendanceByDate?.[date]?.[reportSubTab];
        return status ? statusCodes[status] ?? status : '';
      });
      const statusCells = statusCodesByDate
        .map((statusCode) => `<td class="status ${statusCode === 'A' ? 'alfa' : ''}">${statusCode}</td>`)
        .join('');
      const summaryCells = summaryColumns
        .map((summaryCode) => `<td class="total ${summaryCode === 'A' ? 'alfa' : ''}">${statusCodesByDate.filter((statusCode) => statusCode === summaryCode).length}</td>`)
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
            .status-legend { margin-top: 8px; font-size: 9px; color: #475569; }
            .status-legend strong { color: #1e293b; }
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
        const res = await fetch(`/api/attendance?date=${attendanceDate}&type=${attendanceType}`);
        if (res.ok) {
          const json = await res.json();
          const map: Record<string, string> = {};
          json.forEach((r: any) => {
            map[r.studentId] = r.status === 'Berjamaah' || r.status === 'Munfarid'
              ? 'Sholat'
              : r.status;
          });
          
          classData.students.forEach(s => {
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
  }, [attendanceDate, attendanceType, classData.students]);

  const handleSaveAttendance = async () => {
    try {
      const records = Object.entries(attendanceMap).map(([studentId, status]) => ({
        studentId,
        status
      }));
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: attendanceDate,
          type: attendanceType,
          records
        })
      });
      if (res.ok) {
        alert('Presensi berhasil disimpan!');
      } else {
        alert('Gagal menyimpan presensi.');
      }
    } catch (err) {
      console.error('Error saving attendance:', err);
      alert('Terjadi kesalahan saat menyimpan presensi.');
    }
  };

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
      
      let matchAlfa = true;
      if (reportAlfaFilter === 'alfa-only') {
        const item = reportSubTab === 'harian' ? row.harian : reportSubTab === 'dhuha' ? row.dhuha : row.dzuhur;
        matchAlfa = item.Alfa > 0;
      } else if (reportAlfaFilter === 'no-alfa') {
        const item = reportSubTab === 'harian' ? row.harian : reportSubTab === 'dhuha' ? row.dhuha : row.dzuhur;
        matchAlfa = item.Alfa === 0;
      }
      
      return matchSearch && matchGender && matchAlfa;
    });

  const filteredAcademicStudents = classData.students
    .filter(student => {
      const matchSearch = student.name.toLowerCase().includes(academicSearch.toLowerCase()) || student.nisn.includes(academicSearch);
      return matchSearch;
    });

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
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'students', label: 'Siswa', icon: Users },
            { id: 'attendance', label: 'Presensi', icon: CheckSquare },
            { id: 'reports', label: 'Laporan', icon: FileText },
            { id: 'academic', label: 'Akademik & Tugas', icon: BookOpen },
            { id: 'behavior', label: 'Sikap & Prestasi', icon: Award },
            { id: 'settings', label: 'Pengaturan Halaman', icon: Settings },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
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
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 md:px-8">
          <h2 className="text-base sm:text-xl font-semibold text-slate-800 dark:text-slate-100 truncate mr-2">
            {activeTab === 'dashboard' ? `Ringkasan (${classData.selectedClass})` : activeTab === 'settings' ? 'Pengaturan Halaman' : activeTab === 'reports' ? 'Laporan Kelas' : 'Manajemen Kelas'}
          </h2>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Dark Mode Toggle */}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              title={isDarkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
            >
              {isDarkMode ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5" />}
            </button>
            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-200 dark:border-slate-700">
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold shrink-0">W</div>
              <div className="hidden sm:flex flex-col">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Wali Kelas</span>
                <span className="text-[10px] text-slate-400 font-mono leading-none mt-0.5">{classData.selectedClass} ({classData.selectedYear})</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Scrollable Area */}
        <div className="flex-1 overflow-auto p-4 md:p-8 pb-24 md:pb-8">
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
                        const dhuhaBjpPct = dhuhaTotal > 0 ? Math.round((data.dhuha.Berjamaah / dhuhaTotal) * 100) : 0;

                        const dzuhurTotal = data.dzuhur.total;
                        const dzuhurBjpPct = dzuhurTotal > 0 ? Math.round((data.dzuhur.Berjamaah / dzuhurTotal) * 100) : 0;

                        return (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                                  <span className="text-slate-500">Berjamaah</span>
                                  <span className="font-semibold text-emerald-600">{data.dhuha.Berjamaah}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-500">Munfarid</span>
                                  <span className="font-semibold text-blue-500">{data.dhuha.Munfarid}</span>
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
                                    <span className="text-slate-400 font-medium">Tingkat Berjamaah</span>
                                    <span className="font-bold text-emerald-600">{dhuhaBjpPct}%</span>
                                  </div>
                                  <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${dhuhaBjpPct}%` }} />
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
                                  <span className="text-slate-500">Berjamaah</span>
                                  <span className="font-semibold text-emerald-600">{data.dzuhur.Berjamaah}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-500">Munfarid</span>
                                  <span className="font-semibold text-blue-500">{data.dzuhur.Munfarid}</span>
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
                                    <span className="text-slate-400 font-medium">Tingkat Berjamaah</span>
                                    <span className="font-bold text-purple-600">{dzuhurBjpPct}%</span>
                                  </div>
                                  <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${dzuhurBjpPct}%` }} />
                                  </div>
                                </div>
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
              
              {/* Quote Settings */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
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
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
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
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
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

            </div>
          )}

          {activeTab === 'students' && (
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
              <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Daftar Siswa</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Kelola data seluruh siswa di kelas Anda.</p>
                </div>
                <div className="flex flex-wrap gap-2">
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
                </div>
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

              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4">NISN</th>
                      <th className="px-6 py-4">Nama Lengkap</th>
                      <th className="px-6 py-4">L/P</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-slate-400">Tidak ada data siswa yang cocok dengan filter.</td>
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
                        <td className="px-6 py-4 text-right">
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
                              const isConfirmed = window.confirm(`Apakah Anda yakin ingin menghapus siswa ${student.name}?`);
                              if (isConfirmed) {
                                await classData.removeStudent(student.id);
                                alert('Siswa berhasil dihapus!');
                              }
                            }}
                            className="text-slate-400 hover:text-red-500 p-1 ml-1" 
                            title="Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
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
                    {(['harian', 'dhuha', 'dzuhur'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setAttendanceType(type)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all ${
                          attendanceType === type
                            ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                      >
                        {type === 'harian' ? 'Harian' : type === 'dhuha' ? 'Dhuha' : 'Dzuhur'}
                      </button>
                    ))}
                  </div>
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

              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700">
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
                            <div className="flex justify-center gap-2">
                              {attendanceType === 'harian' ? (
                                (['Hadir', 'Sakit', 'Izin', 'Alfa'] as const).map((status) => (
                                  <button
                                    key={status}
                                    onClick={() => setAttendanceMap(prev => ({ ...prev, [student.id]: status }))}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
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
                                    {status}
                                  </button>
                                ))
                              ) : (
                                (['Sholat', 'Berhalangan', 'Alfa'] as const).map((status) => {
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

              <div className="flex justify-end">
                <button
                  onClick={handleSaveAttendance}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.2)] hover:shadow-[0_0_25px_rgba(37,99,235,0.3)]"
                >
                  <Save className="h-5 w-5" /> Simpan Presensi
                </button>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Pengaturan Halaman Kelas</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Sesuaikan nama kelas dan tahun ajaran aktif untuk kelas Anda.</p>
                
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const target = e.target as typeof e.target & {
                    classNameInput: { value: string };
                    yearInput: { value: string };
                  };
                  classData.setSelectedClass(target.classNameInput.value);
                  classData.setSelectedYear(target.yearInput.value);
                  alert('Pengaturan kelas berhasil disimpan!');
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
                  {(['harian', 'dhuha', 'dzuhur'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setReportSubTab(tab)}
                      className={`px-5 py-2 rounded-lg text-xs font-semibold uppercase transition-all ${
                        reportSubTab === tab
                          ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      {tab === 'harian' ? 'Presensi Harian' : tab === 'dhuha' ? 'Sholat Dhuha' : 'Sholat Dzuhur'}
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
                            ) : (
                              <>
                                <td className="px-6 py-4 text-center font-semibold text-emerald-600">{getSholatCount(row.dzuhur)}</td>
                                <td className="px-6 py-4 text-center text-purple-500">{row.dzuhur.Berhalangan}</td>
                                <td className={`px-6 py-4 text-center ${row.dzuhur.Alfa > 0 ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>{row.dzuhur.Alfa}</td>
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
                        <select
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
                        </button>
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
                                  onClick={() => setViewSubmissionsAssignmentId(item.id)}
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
                  Catatan Sikap & Karakter
                </button>
                <button
                  onClick={() => setBehaviorSubTab('prestasi')}
                  className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                    behaviorSubTab === 'prestasi'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-750'
                  }`}
                >
                  Prestasi Siswa
                </button>
              </div>

              {behaviorSubTab === 'sikap' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Student List & Behavior Scores (2/3 width) */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Poin Sikap & Karakter Siswa</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Nilai awal standar adalah 100 poin.</p>
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
                              const sRecords = (classData.behaviorRecords || []).filter(r => r.studentId === student.id);
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
                  <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                      {selectedStudentForDetails ? (() => {
                        const student = classData.students.find(s => s.id === selectedStudentForDetails);
                        const sRecords = (classData.behaviorRecords || []).filter(r => r.studentId === selectedStudentForDetails)
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
                                        {rec.category} ({rec.type === 'positif' ? `+${rec.points}` : `-${rec.points}`})
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

              {behaviorSubTab === 'prestasi' && (
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

          {activeTab !== 'dashboard' && activeTab !== 'settings' && activeTab !== 'students' && activeTab !== 'attendance' && activeTab !== 'reports' && activeTab !== 'academic' && activeTab !== 'behavior' && (
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 grid grid-cols-5 items-center py-2 px-2 shadow-lg">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'students', label: 'Siswa', icon: Users },
          { id: 'attendance', label: 'Presensi', icon: CheckSquare },
          { id: 'academic', label: 'Akademik', icon: BookOpen },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
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
            <div className="grid grid-cols-3 gap-3">{[{ id: 'reports', label: 'Laporan', icon: FileText }, { id: 'behavior', label: 'Sikap & Prestasi', icon: Award }, { id: 'settings', label: 'Pengaturan', icon: Settings }].map((item) => <button key={item.id} onClick={() => { setActiveTab(item.id); setShowMobileMoreMenu(false); }} className="min-h-24 flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200"><item.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" /><span className="text-xs font-semibold text-center">{item.label}</span></button>)}</div>
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

            <div className="overflow-y-auto flex-1 pr-1">
              {isLoadingSubmissions ? (
                <div className="text-center py-12 text-slate-450">Memuat data pengumpulan...</div>
              ) : submissionsList.length === 0 ? (
                <div className="text-center py-12 text-slate-455">Belum ada siswa terdaftar di kelas ini.</div>
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
                      {submissionsList.map((sub) => {
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

      {/* Modal Add Behavior */}
      {showAddBehaviorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Catat Sikap Siswa</h3>
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
                date: behaviorDate
              });
              setShowAddBehaviorModal(false);
              alert('Catatan sikap berhasil disimpan!');
            }} className="p-6 space-y-4">
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
    </div>
  );
};

export default Dashboard;
