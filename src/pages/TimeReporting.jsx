import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Send, Clock, CheckCircle2 } from 'lucide-react';

const DEFAULT_START = '07:00';
const DEFAULT_END = '11:45';
const TODAY = format(new Date(), 'yyyy-MM-dd');

export default function TimeReporting() {
  const [times, setTimes] = useState({}); // { student_id: { start, end } }
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['assignments', TODAY],
    queryFn: () => base44.entities.Assignment.filter({ date: TODAY }, '-created_date', 2000),
  });

  // Filter out non-working assignments and guests, deduplicate by student
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

  // Init times when assignments load
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

  const handleSubmit = async () => {
    setSaving(true);
    try {
      // Check for existing report today
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
      <div className="max-w-4xl mx-auto">
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
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground w-32">שעת כניסה</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground w-32">שעת יציאה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {validAssignments.map(a => (
                  <tr key={a.student_id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{a.student_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.workplace_name}</td>
                    <td className="px-4 py-3">
                      <Input
                        type="time"
                        value={times[a.student_id]?.start ?? DEFAULT_START}
                        onChange={e => setTime(a.student_id, 'start', e.target.value)}
                        className="h-8 text-sm w-28"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="time"
                        value={times[a.student_id]?.end ?? DEFAULT_END}
                        onChange={e => setTime(a.student_id, 'end', e.target.value)}
                        className="h-8 text-sm w-28"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}