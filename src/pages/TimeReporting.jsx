import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Send, Clock, CheckCircle2, ChevronDown, ChevronUp, Search, CalendarDays, Check } from 'lucide-react';

const DEFAULT_START = '07:00';
const DEFAULT_END = '11:45';
const NON_WORK = ['לא עובד', 'לימודים', 'לא יצא'];
const SUBMITTED_KEY = (date) => `time_report_submitted_${date}`;

function calcDuration(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) return null;
  return Math.round(diff / 60 * 100) / 100;
}

function TimeInput({ value, onChange }) {
  const [local, setLocal] = useState(value);
  const [dirty, setDirty] = useState(false);

  // Sync if parent changes (e.g. group reset)
  useEffect(() => { setLocal(value); setDirty(false); }, [value]);

  const handleChange = (e) => {
    setLocal(e.target.value);
    setDirty(e.target.value !== value);
  };

  const commit = () => {
    if (dirty) {
      onChange(local);
      setDirty(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <input
        type="time"
        value={local}
        onChange={handleChange}
        onBlur={commit}
        className="h-8 w-24 border border-border rounded-md px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-card"
      />
      {dirty && (
        <button
          onClick={commit}
          className="h-8 w-8 flex items-center justify-center rounded-md bg-primary text-white hover:bg-primary/90 transition-colors shrink-0"
          title="אשר"
        >
          <CheckCircle2 size={15} />
        </button>
      )}
    </div>
  );
}

function WorkplaceGroup({ workplace, students, times, overrides, onGroupTimeChange, onOverrideChange }) {
  const [collapsed, setCollapsed] = useState(true);
  const groupStart = times[workplace.id]?.start ?? DEFAULT_START;
  const groupEnd = times[workplace.id]?.end ?? DEFAULT_END;
  const duration = calcDuration(groupStart, groupEnd);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden mb-3 shadow-sm">
      {/* Group header */}
      <div className="bg-secondary/50 border-b border-border px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => setCollapsed(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <span className="font-semibold text-sm">{workplace.name}</span>
          <span className="text-xs text-muted-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
            {students.length} תלמידים
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">כניסה:</span>
          <TimeInput value={groupStart} onChange={v => onGroupTimeChange(workplace.id, 'start', v)} />
          <span className="text-xs text-muted-foreground">יציאה:</span>
          <TimeInput value={groupEnd} onChange={v => onGroupTimeChange(workplace.id, 'end', v)} />
          {duration !== null && (
            <span className="text-xs font-mono font-semibold text-foreground bg-secondary px-2 py-1 rounded-md">
              {duration.toFixed(2)} שע'
            </span>
          )}
        </div>
      </div>

      {/* Student rows */}
      {!collapsed && (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {students.map(a => {
              const ov = overrides[a.student_id];
              const effectiveStart = ov?.start ?? groupStart;
              const effectiveEnd = ov?.end ?? groupEnd;
              const hasOverride = ov !== undefined;
              const dur = calcDuration(effectiveStart, effectiveEnd);

              return (
                <tr key={a.student_id} className={`hover:bg-secondary/10 transition-colors ${hasOverride ? 'bg-yellow-50/60' : ''}`}>
                  <td className="px-4 py-2.5 font-medium w-48">{a.student_name}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <TimeInput
                        value={effectiveStart}
                        onChange={v => onOverrideChange(a.student_id, 'start', v, groupStart, groupEnd)}
                      />
                      <span className="text-xs text-muted-foreground">—</span>
                      <TimeInput
                        value={effectiveEnd}
                        onChange={v => onOverrideChange(a.student_id, 'end', v, groupStart, groupEnd)}
                      />
                      {dur !== null && (
                        <span className="text-xs font-mono text-muted-foreground">{dur.toFixed(2)} שע'</span>
                      )}
                      {hasOverride && (
                        <button
                          onClick={() => onOverrideChange(a.student_id, null, null, null, null)}
                          className="text-xs text-muted-foreground underline hover:text-destructive"
                        >
                          אפס
                        </button>
                      )}
                    </div>
                  </td>
                  {hasOverride && (
                    <td className="px-2 py-2.5">
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">שינוי פרטני</span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function TimeReporting() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(today);
  const [groupTimes, setGroupTimes] = useState({}); // { workplaceId: { start, end } }
  const [overrides, setOverrides] = useState({});   // { studentId: { start, end } }
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const submitted = !!localStorage.getItem(SUBMITTED_KEY(selectedDate));

  // Reset state when date changes
  useEffect(() => {
    setGroupTimes({});
    setOverrides({});
    setSearch('');
  }, [selectedDate]);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['assignments', selectedDate],
    queryFn: () => base44.entities.Assignment.filter({ date: selectedDate }, '-created_date', 2000),
  });

  const { data: logisticsList = [] } = useQuery({
    queryKey: ['workplace-logistics', selectedDate],
    queryFn: () => base44.entities.WorkplaceLogistics.filter({ date: selectedDate }),
  });

  // Build deduped assignment map per student
  const assignmentByStudent = useMemo(() => {
    const map = {};
    assignments.forEach(a => {
      const ex = map[a.student_id];
      if (!ex || (a.updated_date || a.created_date) > (ex.updated_date || ex.created_date)) {
        map[a.student_id] = a;
      }
    });
    return map;
  }, [assignments]);

  // Get active workplaces from logistics (same logic as LogisticsSidebar)
  const activeWorkplacesFromLogistics = useMemo(() => {
    const logMap = {};
    logisticsList.forEach(l => {
      const ex = logMap[l.workplace_id];
      if (!ex || l.updated_date > ex.updated_date) logMap[l.workplace_id] = l;
    });
    return Object.values(logMap).sort((a, b) => (a.workplace_name || '').localeCompare(b.workplace_name || '', 'he'));
  }, [logisticsList]);

  // Build workplace → students list from assignments
  const workplaceStudents = useMemo(() => {
    const map = {};
    Object.values(assignmentByStudent).forEach(a => {
      if (!a.student_name || !a.workplace_id || NON_WORK.includes(a.workplace_name?.trim())) return;
      if (!map[a.workplace_id]) map[a.workplace_id] = [];
      map[a.workplace_id].push(a);
    });
    return map;
  }, [assignmentByStudent]);

  // Use workplaces from logistics that actually have students assigned
  const workplacesToShow = useMemo(() => {
    if (activeWorkplacesFromLogistics.length > 0) {
      return activeWorkplacesFromLogistics.filter(wp => (workplaceStudents[wp.workplace_id] || []).length > 0);
    }
    // fallback: derive from assignments directly
    const seen = new Set();
    return Object.values(assignmentByStudent)
      .filter(a => a.workplace_id && a.workplace_name && !NON_WORK.includes(a.workplace_name?.trim()))
      .filter(a => { if (seen.has(a.workplace_id)) return false; seen.add(a.workplace_id); return true; })
      .map(a => ({ workplace_id: a.workplace_id, workplace_name: a.workplace_name }))
      .sort((a, b) => a.workplace_name.localeCompare(b.workplace_name, 'he'));
  }, [activeWorkplacesFromLogistics, workplaceStudents, assignmentByStudent]);

  // All students for search
  const allStudents = useMemo(() =>
    Object.values(assignmentByStudent).filter(a => a.student_name && a.workplace_id && !NON_WORK.includes(a.workplace_name?.trim())),
    [assignmentByStudent]
  );

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    return allStudents.filter(a => a.student_name.includes(search.trim()));
  }, [search, allStudents]);

  const handleGroupTimeChange = (workplaceId, field, val) => {
    setGroupTimes(prev => ({
      ...prev,
      [workplaceId]: { ...(prev[workplaceId] || { start: DEFAULT_START, end: DEFAULT_END }), [field]: val },
    }));
  };

  const handleOverrideChange = (studentId, field, val, groupStart, groupEnd) => {
    if (field === null) {
      // Reset override
      setOverrides(prev => { const n = { ...prev }; delete n[studentId]; return n; });
      return;
    }
    setOverrides(prev => {
      const current = prev[studentId] || { start: groupStart, end: groupEnd };
      return { ...prev, [studentId]: { ...current, [field]: val } };
    });
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const existing = await base44.entities.TimeReport.filter({ date: selectedDate });
      const existingByStudent = {};
      existing.forEach(r => { existingByStudent[r.student_id] = r; });

      for (const wp of workplacesToShow) {
        const wpId = wp.workplace_id || wp.id;
        const wpName = wp.workplace_name || wp.name;
        const students = workplaceStudents[wpId] || [];
        const groupStart = groupTimes[wpId]?.start ?? DEFAULT_START;
        const groupEnd = groupTimes[wpId]?.end ?? DEFAULT_END;

        for (const a of students) {
          const ov = overrides[a.student_id];
          const start_time = ov?.start ?? groupStart;
          const end_time = ov?.end ?? groupEnd;

          const data = {
            date: selectedDate,
            student_id: a.student_id,
            student_name: a.student_name,
            workplace_id: a.workplace_id,
            workplace_name: a.workplace_name,
            start_time,
            end_time,
            status: 'ממתין',
          };

          if (existingByStudent[a.student_id]) {
            await base44.entities.TimeReport.update(existingByStudent[a.student_id].id, data);
          } else {
            await base44.entities.TimeReport.create(data);
          }
        }
      }

      localStorage.setItem(SUBMITTED_KEY(selectedDate), '1');
      // Force re-render
      setGroupTimes(prev => ({ ...prev }));
    } finally {
      setSaving(false);
    }
  };

  const totalStudents = workplacesToShow.reduce((s, wp) => s + (workplaceStudents[wp.workplace_id || wp.id] || []).length, 0);

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 gap-6" dir="rtl">
        <CheckCircle2 size={64} className="text-success" />
        <h2 className="text-2xl font-bold">הדיווח נשלח בהצלחה!</h2>
        <p className="text-muted-foreground">הנתונים לתאריך {selectedDate} נשמרו ומחכים לאישור מנהל.</p>
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-primary" />
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <p className="text-xs text-muted-foreground">בחר תאריך אחר לדיווח חדש</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">דיווח זמנים יומי</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-primary" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <Button onClick={handleSubmit} disabled={saving || totalStudents === 0} className="gap-2">
              <Send size={16} />
              {saving ? 'שולח...' : 'שלח דיווח'}
            </Button>
          </div>
        </div>

        {/* Search for individual override */}
        <div className="mb-5">
          <div className="relative">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש תלמיד לתיקון פרטני..."
              className="pr-9"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              {searchResults.map(a => {
                const wpId = a.workplace_id;
                const groupStart = groupTimes[wpId]?.start ?? DEFAULT_START;
                const groupEnd = groupTimes[wpId]?.end ?? DEFAULT_END;
                const ov = overrides[a.student_id];
                const effectiveStart = ov?.start ?? groupStart;
                const effectiveEnd = ov?.end ?? groupEnd;
                const dur = calcDuration(effectiveStart, effectiveEnd);

                return (
                  <div key={a.student_id} className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 flex-wrap ${ov ? 'bg-yellow-50/60' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm">{a.student_name}</div>
                      <div className="text-xs text-muted-foreground">{a.workplace_name}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <TimeInput value={effectiveStart} onChange={v => handleOverrideChange(a.student_id, 'start', v, groupStart, groupEnd)} />
                      <span className="text-xs">—</span>
                      <TimeInput value={effectiveEnd} onChange={v => handleOverrideChange(a.student_id, 'end', v, groupStart, groupEnd)} />
                      {dur !== null && <span className="text-xs font-mono text-muted-foreground">{dur.toFixed(2)} שע'</span>}
                      {ov && (
                        <button onClick={() => handleOverrideChange(a.student_id, null, null, null, null)}
                          className="text-xs text-muted-foreground underline hover:text-destructive">
                          אפס
                        </button>
                      )}
                    </div>
                    {ov && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">שינוי פרטני</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Workplace groups */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-secondary rounded-2xl animate-pulse" />)}
          </div>
        ) : workplacesToShow.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Clock size={48} className="mx-auto mb-3 opacity-30" />
            <p>אין שיבוצים לתאריך זה</p>
          </div>
        ) : (
          workplacesToShow.map(wp => {
            const wpId = wp.workplace_id || wp.id;
            const wpName = wp.workplace_name || wp.name;
            const students = workplaceStudents[wpId] || [];
            if (students.length === 0) return null;
            return (
              <WorkplaceGroup
                key={wpId}
                workplace={{ id: wpId, name: wpName }}
                students={students}
                times={groupTimes}
                overrides={overrides}
                onGroupTimeChange={handleGroupTimeChange}
                onOverrideChange={handleOverrideChange}
              />
            );
          })
        )}
      </div>
    </div>
  );
}