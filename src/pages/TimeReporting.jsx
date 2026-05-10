import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Send, Clock, CheckCircle2, Check } from 'lucide-react';

const DEFAULT_START = '07:00';
const DEFAULT_END = '11:45';
const TODAY = format(new Date(), 'yyyy-MM-dd');

function calcDuration(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) return null;
  return Math.round(diff / 60 * 100) / 100;
}

function TimeCell({ studentId, field, value, confirmed, onConfirm, onChange }) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => { setLocalVal(value); }, [value]);

  const commit = () => {
    setEditing(false);
    onChange(studentId, field, localVal);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          type="time"
          value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          className="w-24 h-8 border border-primary rounded-md px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-card"
        />
        <button
          onMouseDown={e => { e.preventDefault(); commit(); onConfirm(studentId, field); }}
          className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-white hover:bg-primary/90 transition-colors shrink-0"
        >
          <Check size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setEditing(true)}
        className={`w-24 h-8 text-sm text-right px-2 rounded-md border transition-colors flex items-center justify-between group ${
          confirmed ? 'border-primary/40 bg-primary/5 text-primary font-medium' : 'border-dashed border-border hover:bg-secondary/60'
        }`}
      >
        <span>{value}</span>
      </button>
      {!confirmed && (
        <button
          onClick={() => { onConfirm(studentId, field); }}
          className="w-7 h-7 rounded-md border border-primary/40 flex items-center justify-center text-primary hover:bg-primary/10 transition-colors shrink-0"
        >
          <Check size={14} />
        </button>
      )}
      {confirmed && (
        <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shrink-0">
          <Check size={14} className="text-white" />
        </div>
      )}
    </div>
  );
}

export default function TimeReporting() {
  const [times, setTimes] = useState({});
  const [confirmed, setConfirmed] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['assignments', TODAY],
    queryFn: () => base44.entities.Assignment.filter({ date: TODAY }, '-created_date', 2000),
  });

  const validAssignments = (() => {
    const NON_WORK = ['לא עובד', 'לימודים', 'לא יצא'];
    const seen = new Set();
    return assignments
      .filter(a => a.student_name && a.workplace_name && !NON_WORK.includes(a.workplace_name?.trim()))
      .filter(a => {
        if (seen.has(a.student_id)) return false;
        seen.add(a.student_id);
        return true;
      })
      .sort((a, b) => (a.workplace_name || '').localeCompare(b.workplace_name || '', 'he'));
  })();

  useEffect(() => {
    if (validAssignments.length && Object.keys(times).length === 0) {
      const init = {};
      validAssignments.forEach(a => {
        init[a.student_id] = { start: DEFAULT_START, end: DEFAULT_END };
      });
      setTimes(init);
    }
  }, [validAssignments.length]);

  const setTime = (studentId, field, val) => {
    setTimes(prev => ({ ...prev, [studentId]: { ...prev[studentId], [field]: val } }));
  };

  const confirmField = (studentId, field) => {
    setConfirmed(prev => ({ ...prev, [`${studentId}_${field}`]: true }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const existing = await base44.entities.TimeReport.filter({ date: TODAY });
      const existingByStudent = {};
      existing.forEach(r => { existingByStudent[r.student_id] = r; });

      for (const a of validAssignments) {
        const t = times[a.student_id] || { start: DEFAULT_START, end: DEFAULT_END };
        const data = {
          date: TODAY,
          student_id: a.student_id,
          student_name: a.student_name,
          workplace_id: a.workplace_id,
          workplace_name: a.workplace_name,
          start_time: t.start || DEFAULT_START,
          end_time: t.end || DEFAULT_END,
          status: 'ממתין',
        };
        if (existingByStudent[a.student_id]) {
          await base44.entities.TimeReport.update(existingByStudent[a.student_id].id, data);
        } else {
          await base44.entities.TimeReport.create(data);
        }
      }
      setSubmitted(true);
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6" dir="rtl">
        <div className="text-center space-y-4">
          <CheckCircle2 size={64} className="mx-auto text-success" />
          <h2 className="text-2xl font-bold">הדיווח נשלח בהצלחה!</h2>
          <p className="text-muted-foreground">הנתונים נשמרו ומחכים לאישור מנהל.</p>
          <Button onClick={() => setSubmitted(false)} variant="outline">חזרה לדיווח</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">דיווח זמנים יומי</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {new Date(TODAY + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <Button onClick={handleSubmit} disabled={saving || validAssignments.length === 0} className="gap-2">
            <Send size={16} />
            {saving ? 'שולח...' : 'שלח דיווח'}
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-secondary rounded-xl animate-pulse" />)}
          </div>
        ) : validAssignments.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Clock size={48} className="mx-auto mb-3 opacity-30" />
            <p>אין שיבוצים להיום</p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 border-b border-border">
                <tr>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">שם תלמיד</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">מקום עבודה</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">שעת כניסה</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">שעת יציאה</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground w-24">משך (שעות)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {validAssignments.map(a => {
                  const t = times[a.student_id] || { start: DEFAULT_START, end: DEFAULT_END };
                  const duration = calcDuration(t.start, t.end);
                  return (
                    <tr key={a.student_id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{a.student_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.workplace_name}</td>
                      <td className="px-4 py-3">
                        <TimeCell
                          studentId={a.student_id}
                          field="start"
                          value={t.start}
                          confirmed={!!confirmed[`${a.student_id}_start`]}
                          onChange={setTime}
                          onConfirm={confirmField}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <TimeCell
                          studentId={a.student_id}
                          field="end"
                          value={t.end}
                          confirmed={!!confirmed[`${a.student_id}_end`]}
                          onChange={setTime}
                          onConfirm={confirmField}
                        />
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-medium text-foreground">
                        {duration !== null ? duration.toFixed(2) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}