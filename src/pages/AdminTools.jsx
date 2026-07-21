import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Shuffle, Loader2, UserCheck, BookOpen, Settings2, HardDriveDownload, Shield } from 'lucide-react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import PublishedScheduleCard from '@/components/reports/PublishedScheduleCard';
import TimeReportingLink from '@/components/reports/TimeReportingLink';
import BackupExport from '@/components/reports/BackupExport';
import BackupEmailSettings from '@/components/reports/BackupEmailSettings';
import ImportAssignments from '@/components/reports/ImportAssignments';
import SRSViewer from '@/components/reports/SRSViewer';
import DefaultSettings from '@/components/admin/DefaultSettings';
import UserPermissions from '@/components/admin/UserPermissions';
import { getAssignmentDefaults, normalizeAppSettings } from '@/lib/pricing';

export default function AdminTools() {
  const { user: currentUser } = useAuth();
  const [randomizing, setRandomizing] = useState(false);
  const [randomStatus, setRandomStatus] = useState('');
  const [assigningRoles, setAssigningRoles] = useState(false);
  const [rolesStatus, setRolesStatus] = useState('');
  const [activeTab, setActiveTab] = useState('links');

  // --- Random Assignment ---
  const handleRandomAssignment = async () => {
    if (!confirm('פעולה זו תמחק את כל השיבוצים הקיימים מ-01/04/2026 ותיצור שיבוצים רנדומליים חדשים. להמשיך?')) return;
    setRandomizing(true);
    setRandomStatus('טוען נתונים...');

    const settingsList = await base44.entities.AppSettings.list();
    const assignmentDefaults = getAssignmentDefaults(
      normalizeAppSettings(settingsList[0]),
    );

    const allStudents = await base44.entities.Student.list();
    const activeStudents = allStudents.filter(s => s.is_active !== false);
    if (!activeStudents.length) { alert('אין תלמידים פעילים'); setRandomizing(false); return; }

    const SPECIAL_WP = [
      { id: '69e5bf0070786e7ad489a574', name: 'לא עובד' },
      { id: '69e5bf05a5a0b60e073731ae', name: 'לימודים' },
    ];

    const allWorkplaces = await base44.entities.Workplace.list('created_date', 100);
    const regularWp = allWorkplaces
      .filter(w => !['69e5bf0070786e7ad489a574', '69e5bf05a5a0b60e073731ae'].includes(w.id))
      .slice(0, 8)
      .map(w => ({ id: w.id, name: w.name }));

    const pool = [...regularWp, ...SPECIAL_WP];
    const startDate = parseISO('2026-04-01');
    const endDate = new Date();
    const allDates = eachDayOfInterval({ start: startDate, end: endDate }).map(d => format(d, 'yyyy-MM-dd'));

    setRandomStatus('מוחק שיבוצים קיימים...');
    const existingAssignments = await base44.entities.Assignment.list();
    const toDelete = existingAssignments.filter(a => a.date >= '2026-04-01');
    for (let i = 0; i < toDelete.length; i++) {
      setRandomStatus(`מוחק שיבוצים... ${i + 1} / ${toDelete.length}`);
      await base44.entities.Assignment.delete(toDelete[i].id);
      await new Promise(r => setTimeout(r, 200));
    }

    setRandomStatus('יוצר שיבוצים חדשים...');
    const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

    const allNew = [];
    for (const date of allDates) {
      const shuffledStudents = shuffle([...activeStudents]);
      const assignments = shuffledStudents.map((student, idx) => {
        let wp;
        if (idx === 0) wp = SPECIAL_WP[0];
        else if (idx === 1) wp = SPECIAL_WP[1];
        else wp = pool[Math.floor(Math.random() * pool.length)];
        return { date, student_id: student.id, student_name: student.full_name, workplace_id: wp.id, workplace_name: wp.name, rate: assignmentDefaults.rate, hours: assignmentDefaults.hours };
      });
      allNew.push(...assignments);
    }

    for (let i = 0; i < allNew.length; i += 100) {
      setRandomStatus(`יוצר שיבוצים... ${Math.min(i + 100, allNew.length)} / ${allNew.length}`);
      await base44.entities.Assignment.bulkCreate(allNew.slice(i, i + 100));
    }

    setRandomizing(false);
    setRandomStatus('');
    alert(`נוצרו ${allNew.length} שיבוצים רנדומליים בהצלחה!`);
  };

  // --- Assign Roles ---
  const handleAssignRoles = async () => {
    if (!confirm('פעולה זו תשבץ תפקידים (נהג, אחראי פק"ל, ראש צוות) לכל יום מ-01/04/2026 עד היום. להמשיך?')) return;
    setAssigningRoles(true);
    setRolesStatus('טוען שיבוצים...');

    const allAssignments = await base44.entities.Assignment.list();
    const relevant = allAssignments.filter(a => a.date >= '2026-04-01');
    const byDate = {};
    relevant.forEach(a => { if (!byDate[a.date]) byDate[a.date] = []; byDate[a.date].push(a); });

    const dates = Object.keys(byDate).sort();
    const ROLES = ['נהג', 'אחראי פק"ל', 'ראש צוות'];
    const allStudentIds = [...new Set(relevant.map(a => a.student_id))];
    const updates = [];

    dates.forEach((date, dayIdx) => {
      const dayAssignments = byDate[date];
      const offset = (dayIdx * 3) % allStudentIds.length;
      const roleStudents = [
        allStudentIds[offset % allStudentIds.length],
        allStudentIds[(offset + 1) % allStudentIds.length],
        allStudentIds[(offset + 2) % allStudentIds.length],
      ];
      dayAssignments.forEach(a => {
        const roleIdx = roleStudents.indexOf(a.student_id);
        if (roleIdx !== -1) updates.push({ id: a.id, role: ROLES[roleIdx] });
        else if (a.role) updates.push({ id: a.id, role: '' });
      });
    });

    setRolesStatus(`מעדכן תפקידים... 0 / ${updates.length}`);
    for (let i = 0; i < updates.length; i++) {
      await base44.entities.Assignment.update(updates[i].id, { role: updates[i].role });
      if (i % 5 === 0) { setRolesStatus(`מעדכן תפקידים... ${i + 1} / ${updates.length}`); await new Promise(r => setTimeout(r, 150)); }
    }

    setAssigningRoles(false);
    setRolesStatus('');
    alert(`עודכנו תפקידים ל-${dates.length} ימים בהצלחה!`);
  };

  const tabs = [
    { key: 'links', label: 'קישורים', icon: BookOpen },
    { key: 'backup', label: 'גיבוי ושחזור', icon: HardDriveDownload },
    { key: 'random', label: 'שיבוץ אקראי', icon: Shuffle },
    { key: 'settings', label: 'הגדרות ברירות מחדל', icon: Settings2 },
    { key: 'permissions', label: 'הרשאות משתמשים', icon: Shield },
    { key: 'srs', label: 'מפרט מערכת', icon: BookOpen },
  ];

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">כלי ניהול</h2>
        <p className="text-muted-foreground mt-1">הגדרות, כלי עזר ומפרט המערכת</p>
      </div>

      <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 mb-6 w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
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

      {activeTab === 'settings' && <DefaultSettings />}
      {activeTab === 'permissions' && <UserPermissions />}
      {activeTab === 'srs' && <SRSViewer />}

      {activeTab === 'links' && (
        <div className="space-y-4 max-w-2xl">
          <PublishedScheduleCard />
          <TimeReportingLink />
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="space-y-4 max-w-2xl">
          <BackupExport />
          <ImportAssignments />
          <BackupEmailSettings />
        </div>
      )}

      {activeTab === 'random' && (
        <div className="space-y-4 max-w-2xl">
          {/* Random Assignment */}
          <div className="bg-card border border-border rounded-2xl p-6 flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="bg-warning/10 rounded-xl p-3"><Shuffle size={24} className="text-warning" /></div>
              <div>
                <h3 className="font-semibold text-base">שיבוץ רנדומלי</h3>
                <p className="text-sm text-muted-foreground mt-1">מוחק את כל השיבוצים מ-01/04/2026 ומשבץ מחדש את כל התלמידים הפעילים ל-10 מקומות העבודה הראשונים.</p>
                {randomStatus && <p className="text-xs text-primary mt-2 font-medium">{randomStatus}</p>}
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
              <div className="bg-success/10 rounded-xl p-3"><UserCheck size={24} className="text-success" /></div>
              <div>
                <h3 className="font-semibold text-base">שיבוץ תפקידים אוטומטי</h3>
                <p className="text-sm text-muted-foreground mt-1">משבץ בכל יום 3 תלמידים שונים לתפקידים: נהג, אחראי פק"ל, ראש צוות (01/04/2026 עד היום).</p>
                {rolesStatus && <p className="text-xs text-primary mt-2 font-medium">{rolesStatus}</p>}
              </div>
            </div>
            <Button variant="outline" onClick={handleAssignRoles} disabled={assigningRoles} className="shrink-0 border-success text-success hover:bg-success/10">
              {assigningRoles ? <Loader2 size={16} className="animate-spin ml-2" /> : <UserCheck size={16} className="ml-2" />}
              {assigningRoles ? 'מעבד...' : 'שבץ תפקידים'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}