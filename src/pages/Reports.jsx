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

    // Active students only
    const activeStudents = students.filter(s => s.is_active !== false);
    if (!activeStudents.length) {
      alert('אין תלמידים פעילים');
      setRandomizing(false);
      return;
    }

    // Take first 10 workplaces (by created_date desc = as returned)
    const top10 = workplaces.slice(0, 10);
    if (!top10.length) {
      alert('אין מקומות עבודה במערכת');
      setRandomizing(false);
      return;
    }

    // Date range: 01/04/2026 to today
    const startDate = parseISO('2026-04-01');
    const endDate = new Date();
    const allDates = eachDayOfInterval({ start: startDate, end: endDate }).map(d => format(d, 'yyyy-MM-dd'));

    setRandomStatus('מוחק שיבוצים קיימים...');

    // Delete all existing assignments from 01/04/2026
    const existingAssignments = await base44.entities.Assignment.list();
    const toDelete = existingAssignments.filter(a => a.date >= '2026-04-01');
    for (const a of toDelete) {
      await base44.entities.Assignment.delete(a.id);
    }

    setRandomStatus('יוצר שיבוצים חדשים...');

    // Create random assignments for each date
    const allNew = [];
    for (const date of allDates) {
      for (const student of activeStudents) {
        const wp = top10[Math.floor(Math.random() * top10.length)];
        allNew.push({
          date,
          student_id: student.id,
          student_name: student.full_name,
          workplace_id: wp.id,
          workplace_name: wp.name,
        });
      }
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