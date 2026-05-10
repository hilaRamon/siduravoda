import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Clock, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_STYLES = {
  'ממתין': 'bg-yellow-100 text-yellow-700',
  'אושר': 'bg-green-100 text-green-700',
  'נדחה': 'bg-red-100 text-red-700',
};

const DEFAULT_START = '07:00';
const DEFAULT_END = '11:45';

function calcDuration(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) return null;
  return Math.round(diff / 60 * 100) / 100;
}

export default function TimeReportsAdmin() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activeTab, setActiveTab] = useState('ממתין');
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['time-reports', selectedDate],
    queryFn: () => base44.entities.TimeReport.filter({ date: selectedDate }, 'student_name', 500),
  });

  const changedReports = reports
    .filter(r => r.start_time !== DEFAULT_START || r.end_time !== DEFAULT_END)
    .sort((a, b) => (a.workplace_name || '').localeCompare(b.workplace_name || '', 'he'));

  const pending = changedReports.filter(r => r.status === 'ממתין');
  const approved = changedReports.filter(r => r.status === 'אושר');
  const rejected = changedReports.filter(r => r.status === 'נדחה');

  const tabReports = activeTab === 'ממתין' ? pending : activeTab === 'אושר' ? approved : rejected;

  const handleStatus = async (report, status) => {
    await base44.entities.TimeReport.update(report.id, { status });

    // If approving, update hours in the daily assignments
    if (status === 'אושר') {
      const duration = calcDuration(report.start_time, report.end_time);
      if (duration !== null) {
        // Find matching assignment for this student on this date
        const assignments = await base44.entities.Assignment.filter({
          date: report.date,
          student_id: report.student_id,
        });
        if (assignments.length > 0) {
          await base44.entities.Assignment.update(assignments[0].id, { hours: duration });
        }
      }
    }

    queryClient.invalidateQueries({ queryKey: ['time-reports', selectedDate] });
    queryClient.invalidateQueries({ queryKey: ['assignments', selectedDate] });
  };

  const tabs = [
    { key: 'ממתין', label: 'ממתינים', count: pending.length, color: 'text-yellow-600', icon: Clock },
    { key: 'אושר', label: 'אושרו', count: approved.length, color: 'text-green-600', icon: CheckCircle2 },
    { key: 'נדחה', label: 'נדחו', count: rejected.length, color: 'text-red-500', icon: XCircle },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">עדכון זמנים</h2>
          <p className="text-muted-foreground mt-1">אישור ודחיית דיווחי זמנים</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-primary" />
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 mb-6 w-fit">
        {tabs.map(({ key, label, count, color, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={15} className={activeTab === key ? color : ''} />
            {label}
            {count > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                key === 'ממתין' ? 'bg-yellow-100 text-yellow-700' :
                key === 'אושר' ? 'bg-green-100 text-green-700' :
                'bg-red-100 text-red-700'
              }`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-secondary rounded-xl animate-pulse" />)}
        </div>
      ) : tabReports.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Clock size={48} className="mx-auto mb-3 opacity-30" />
          <p>
            {changedReports.length === 0
              ? (reports.length > 0 ? 'אין שינויים מהברירת מחדל לתאריך זה' : 'אין דיווחים לתאריך זה')
              : `אין רשומות ב"${activeTab === 'ממתין' ? 'ממתינים' : activeTab === 'אושר' ? 'אושרו' : 'נדחו'}"`
            }
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-base">
            <thead className="bg-secondary/60 border-b border-border">
              <tr>
                <th className="text-right px-4 py-3 text-base font-semibold text-muted-foreground">שם תלמיד</th>
                <th className="text-right px-4 py-3 text-base font-semibold text-muted-foreground">מקום עבודה</th>
                <th className="text-right px-4 py-3 text-base font-semibold text-muted-foreground">כניסה</th>
                <th className="text-right px-4 py-3 text-base font-semibold text-muted-foreground">יציאה</th>
                <th className="text-right px-4 py-3 text-base font-semibold text-muted-foreground">שעות</th>
                <th className="text-right px-4 py-3 text-base font-semibold text-muted-foreground">סטטוס</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tabReports.map(r => {
                const duration = calcDuration(r.start_time, r.end_time);
                return (
                  <tr key={r.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-base">{r.student_name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-base">{r.workplace_name}</td>
                    <td className="px-4 py-3 font-mono text-base">{r.start_time || '—'}</td>
                    <td className="px-4 py-3 font-mono text-base">{r.end_time || '—'}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-base">
                      {duration !== null ? duration.toFixed(2) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLES[r.status] || ''}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant={r.status === 'אושר' ? 'default' : 'outline'}
                          className="h-7 text-xs gap-1 text-green-600 border-green-300 hover:bg-green-50"
                          onClick={() => handleStatus(r, 'אושר')}
                          disabled={r.status === 'אושר'}
                        >
                          <CheckCircle2 size={13} /> אשר
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 text-red-500 border-red-300 hover:bg-red-50"
                          onClick={() => handleStatus(r, 'נדחה')}
                          disabled={r.status === 'נדחה'}
                        >
                          <XCircle size={13} /> דחה
                        </Button>
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
  );
}