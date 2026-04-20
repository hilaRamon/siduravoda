import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, Shuffle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, eachDayOfInterval, parseISO } from 'date-fns';

export default function Reports() {
  const [exportingBackup, setExportingBackup] = useState(false);
  const [randomizing, setRandomizing] = useState(false);
  const [randomStatus, setRandomStatus] = useState('');

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list(),
  });

  const { data: workplaces = [] } = useQuery({
    queryKey: ['workplaces'],
    queryFn: () => base44.entities.Workplace.list('-created_date'),
  });

  // --- Backup Export ---
  const handleBackupExport = async () => {
    setExportingBackup(true);
    const allAssignments = await base44.entities.Assignment.list();
    if (!allAssignments.length) {
      alert('אין שיבוצים לייצוא');
      setExportingBackup(false);
      return;
    }

    // Get unique sorted dates
    const dates = [...new Set(allAssignments.map(a => a.date))].sort();

    // Get unique students (by id)
    const studentMap = {};
    allAssignments.forEach(a => {
      if (!studentMap[a.student_id]) {
        studentMap[a.student_id] = a.student_name || a.student_id;
      }
    });
    const studentIds = Object.keys(studentMap);

    // Build assignment lookup: studentId -> date -> workplace_name
    const lookup = {};
    allAssignments.forEach(a => {
      if (!lookup[a.student_id]) lookup[a.student_id] = {};
      lookup[a.student_id][a.date] = a.workplace_name || '';
    });

    // Build rows: first col = student name, then one col per date
    const header = ['שם תלמיד', ...dates];
    const rows = studentIds.map(sid => {
      const row = [studentMap[sid]];
      dates.forEach(d => row.push(lookup[sid]?.[d] || ''));
      return row;
    });

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'שיבוצים');
    XLSX.writeFile(wb, `גיבוי_שיבוצים_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    setExportingBackup(false);
  };

  // --- Random Assignment ---
  const handleRandomAssignment = async () => {
    if (!confirm('פעולה זו תמחק את כל השיבוצים הקיימים מ-01/04/2026 ותיצור שיבוצים רנדומליים חדשים. להמשיך?')) return;

    setRandomizing(true);
    setRandomStatus('טוען נתונים...');

    const allStudents = await base44.entities.Student.list();
    const activeStudents = allStudents.filter(s => s.is_active !== false);
    if (!activeStudents.length) {
      alert('אין תלמידים פעילים');
      setRandomizing(false);
      return;
    }

    // Fixed special workplaces
    const SPECIAL_WP = [
      { id: '69e5bf0070786e7ad489a574', name: 'לא עובד' },
      { id: '69e5bf05a5a0b60e073731ae', name: 'לימודים' },
    ];

    // 8 first workplaces from sorted list (by created_date asc) + 2 special = 10 total
    const allWorkplaces = await base44.entities.Workplace.list('created_date', 100);
    const regularWp = allWorkplaces
      .filter(w => !['69e5bf0070786e7ad489a574', '69e5bf05a5a0b60e073731ae'].includes(w.id))
      .slice(0, 8)
      .map(w => ({ id: w.id, name: w.name }));

    const pool = [...regularWp, ...SPECIAL_WP]; // 10 workplaces

    // Date range: 01/04/2026 to today
    const startDate = parseISO('2026-04-01');
    const endDate = new Date();
    const allDates = eachDayOfInterval({ start: startDate, end: endDate }).map(d => format(d, 'yyyy-MM-dd'));

    setRandomStatus('מוחק שיבוצים קיימים...');

    // Delete all existing assignments from 01/04/2026 in small batches with delay
    const existingAssignments = await base44.entities.Assignment.list();
    const toDelete = existingAssignments.filter(a => a.date >= '2026-04-01');
    for (let i = 0; i < toDelete.length; i++) {
      setRandomStatus(`מוחק שיבוצים... ${i + 1} / ${toDelete.length}`);
      await base44.entities.Assignment.delete(toDelete[i].id);
      await new Promise(r => setTimeout(r, 200));
    }

    setRandomStatus('יוצר שיבוצים חדשים...');

    const shuffle = (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    // Build all assignments: each student gets a random workplace from pool
    // Ensure at least 1 student in "לא עובד" and 1 in "לימודים" each day
    const allNew = [];
    for (const date of allDates) {
      const shuffledStudents = shuffle([...activeStudents]);
      // First 2 students guaranteed to "לא עובד" and "לימודים"
      const assignments = shuffledStudents.map((student, idx) => {
        let wp;
        if (idx === 0) wp = SPECIAL_WP[0]; // לא עובד
        else if (idx === 1) wp = SPECIAL_WP[1]; // לימודים
        else wp = pool[Math.floor(Math.random() * pool.length)];
        return {
          date,
          student_id: student.id,
          student_name: student.full_name,
          workplace_id: wp.id,
          workplace_name: wp.name,
          rate: 40,
          hours: 4.5,
        };
      });
      allNew.push(...assignments);
    }

    // Bulk create in batches of 100
    for (let i = 0; i < allNew.length; i += 100) {
      setRandomStatus(`יוצר שיבוצים... ${Math.min(i + 100, allNew.length)} / ${allNew.length}`);
      await base44.entities.Assignment.bulkCreate(allNew.slice(i, i + 100));
    }

    setRandomizing(false);
    setRandomStatus('');
    alert(`נוצרו ${allNew.length} שיבוצים רנדומליים בהצלחה!`);
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">דוחות</h2>
        <p className="text-muted-foreground mt-1">ייצוא נתונים וכלי ניהול</p>
      </div>

      <div className="space-y-4">

        {/* Backup Export */}
        <div className="bg-card border border-border rounded-2xl p-6 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-primary/10 rounded-xl p-3">
              <FileSpreadsheet size={24} className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-base">הורדת גיבוי שיבוצים</h3>
              <p className="text-sm text-muted-foreground mt-1">
                מוריד קובץ Excel עם כל השיבוצים. שורות = תלמידים, עמודות = תאריכים.
              </p>
            </div>
          </div>
          <Button onClick={handleBackupExport} disabled={exportingBackup} className="shrink-0">
            {exportingBackup ? <Loader2 size={16} className="animate-spin ml-2" /> : <Download size={16} className="ml-2" />}
            {exportingBackup ? 'מייצא...' : 'הורד Excel'}
          </Button>
        </div>

        {/* Random Assignment */}
        <div className="bg-card border border-border rounded-2xl p-6 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-warning/10 rounded-xl p-3">
              <Shuffle size={24} className="text-warning" />
            </div>
            <div>
              <h3 className="font-semibold text-base">שיבוץ רנדומלי</h3>
              <p className="text-sm text-muted-foreground mt-1">
                מוחק את כל השיבוצים מ-01/04/2026 ומשבץ מחדש את כל התלמידים הפעילים ל-10 מקומות העבודה הראשונים.
              </p>
              {randomStatus && (
                <p className="text-xs text-primary mt-2 font-medium">{randomStatus}</p>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={handleRandomAssignment} disabled={randomizing} className="shrink-0 border-warning text-warning hover:bg-warning/10">
            {randomizing ? <Loader2 size={16} className="animate-spin ml-2" /> : <Shuffle size={16} className="ml-2" />}
            {randomizing ? 'מעבד...' : 'הרץ שיבוץ'}
          </Button>
        </div>

      </div>
    </div>
  );
}