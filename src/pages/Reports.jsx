import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Shuffle, Loader2, UserCheck, BarChart2, Users } from 'lucide-react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import PeriodicWorkReport from '@/components/reports/PeriodicWorkReport';
import PeriodWorkReport from '@/components/reports/PeriodWorkReport';
import StudentWorkReport from '@/components/reports/StudentWorkReport';
import PublishedScheduleCard from '@/components/reports/PublishedScheduleCard';
import BackupExport from '@/components/reports/BackupExport';
import BackupEmailSettings from '@/components/reports/BackupEmailSettings';
import ImportAssignments from '@/components/reports/ImportAssignments';

export default function Reports() {
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

  const [assigningRoles, setAssigningRoles] = useState(false);
  const [rolesStatus, setRolesStatus] = useState('');

  // --- Assign Roles ---
  const handleAssignRoles = async () => {
    if (!confirm('פעולה זו תשבץ תפקידים (נהג, אחראי פק"ל, ראש צוות) לכל יום מ-01/04/2026 עד היום. להמשיך?')) return;

    setAssigningRoles(true);
    setRolesStatus('טוען שיבוצים...');

    const allAssignments = await base44.entities.Assignment.list();
    const relevant = allAssignments.filter(a => a.date >= '2026-04-01');

    // Group by date
    const byDate = {};
    relevant.forEach(a => {
      if (!byDate[a.date]) byDate[a.date] = [];
      byDate[a.date].push(a);
    });

    const dates = Object.keys(byDate).sort();
    const ROLES = ['נהג', 'אחראי פק"ל', 'ראש צוות'];

    // For rotation: track which students had each role previously
    // Use simple index-based rotation across days so each day 3 different students get the roles
    // We pick 3 students per day using a rotating offset based on day index
    const allStudentIds = [...new Set(relevant.map(a => a.student_id))];

    const updates = []; // { id, role }

    dates.forEach((date, dayIdx) => {
      const dayAssignments = byDate[date];
      // Pick 3 different students using rotating offset
      const offset = (dayIdx * 3) % allStudentIds.length;
      const roleStudents = [
        allStudentIds[offset % allStudentIds.length],
        allStudentIds[(offset + 1) % allStudentIds.length],
        allStudentIds[(offset + 2) % allStudentIds.length],
      ];

      dayAssignments.forEach(a => {
        const roleIdx = roleStudents.indexOf(a.student_id);
        if (roleIdx !== -1) {
          updates.push({ id: a.id, role: ROLES[roleIdx] });
        } else if (a.role) {
          // Clear old roles from students not assigned today
          updates.push({ id: a.id, role: '' });
        }
      });
    });

    setRolesStatus(`מעדכן תפקידים... 0 / ${updates.length}`);
    for (let i = 0; i < updates.length; i++) {
      await base44.entities.Assignment.update(updates[i].id, { role: updates[i].role });
      if (i % 5 === 0) {
        setRolesStatus(`מעדכן תפקידים... ${i + 1} / ${updates.length}`);
        await new Promise(r => setTimeout(r, 150));
      }
    }

    setAssigningRoles(false);
    setRolesStatus('');
    alert(`עודכנו תפקידים ל-${dates.length} ימים בהצלחה!`);
  };

  const [activeTab, setActiveTab] = useState('tools');

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">דוחות</h2>
        <p className="text-muted-foreground mt-1">ייצוא נתונים וכלי ניהול</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 mb-6 w-fit">
        {[
          { key: 'tools', label: 'כלי ניהול', icon: FileSpreadsheet },
          { key: 'periodic', label: 'דוח עבודה חודשי', icon: BarChart2 },
          { key: 'period', label: 'דוח עבודה לתקופה', icon: BarChart2 },
          { key: 'student', label: 'דוח עבודת תלמיד', icon: Users },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'periodic' && <PeriodicWorkReport />}
      {activeTab === 'period' && <PeriodWorkReport />}
      {activeTab === 'student' && <StudentWorkReport />}

      {activeTab === 'tools' && <div className="space-y-4 max-w-2xl">

        {/* Published Schedule Link */}
        <PublishedScheduleCard />

        {/* Backup Export */}
        <BackupExport />

        {/* Import Assignments */}
        <ImportAssignments />

        {/* Backup Email Settings */}
        <BackupEmailSettings />

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

        {/* Role Assignment */}
        <div className="bg-card border border-border rounded-2xl p-6 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-success/10 rounded-xl p-3">
              <UserCheck size={24} className="text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-base">שיבוץ תפקידים אוטומטי</h3>
              <p className="text-sm text-muted-foreground mt-1">
                משבץ בכל יום 3 תלמידים שונים לתפקידים: נהג, אחראי פק"ל, ראש צוות (01/04/2026 עד היום).
              </p>
              {rolesStatus && (
                <p className="text-xs text-primary mt-2 font-medium">{rolesStatus}</p>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={handleAssignRoles} disabled={assigningRoles} className="shrink-0 border-success text-success hover:bg-success/10">
            {assigningRoles ? <Loader2 size={16} className="animate-spin ml-2" /> : <UserCheck size={16} className="ml-2" />}
            {assigningRoles ? 'מעבד...' : 'שבץ תפקידים'}
          </Button>
        </div>

      </div>}
    </div>
  );
}