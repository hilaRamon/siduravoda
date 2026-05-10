import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, XCircle, Clock, CalendarDays } from 'lucide-react';
import { format, subDays } from 'date-fns';

const STATUS_STYLES = {
  'ממתין': 'bg-yellow-100 text-yellow-700',
  'אושר': 'bg-green-100 text-green-700',
  'נדחה': 'bg-red-100 text-red-700',
};

export default function TimeReportsAdmin() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['time-reports', selectedDate],
    queryFn: () => base44.entities.TimeReport.filter({ date: selectedDate }, 'student_name', 500),
  });

  const handleStatus = async (report, status) => {
    await base44.entities.TimeReport.update(report.id, { status });
    queryClient.invalidateQueries({ queryKey: ['time-reports', selectedDate] });
  };

  const approved = reports.filter(r => r.status === 'אושר').length;
  const pending = reports.filter(r => r.status === 'ממתין').length;
  const rejected = reports.filter(r => r.status === 'נדחה').length;

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

      {/* Stats */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="bg-card border border-border rounded-xl px-4 py-2 flex items-center gap-2 text-sm">
          <Clock size={15} className="text-yellow-500" />
          <span className="font-medium">{pending}</span>
          <span className="text-muted-foreground">ממתינים</span>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-2 flex items-center gap-2 text-sm">
          <CheckCircle2 size={15} className="text-green-500" />
          <span className="font-medium">{approved}</span>
          <span className="text-muted-foreground">אושרו</span>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-2 flex items-center gap-2 text-sm">
          <XCircle size={15} className="text-red-500" />
          <span className="font-medium">{rejected}</span>
          <span className="text-muted-foreground">נדחו</span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-secondary rounded-xl animate-pulse" />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Clock size={48} className="mx-auto mb-3 opacity-30" />
          <p>אין דיווחים לתאריך זה</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 border-b border-border">
              <tr>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">שם תלמיד</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">מקום עבודה</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">כניסה</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">יציאה</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">סטטוס</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reports.map(r => (
                <tr key={r.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{r.student_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.workplace_name}</td>
                  <td className="px-4 py-3 font-mono text-sm">{r.start_time || '—'}</td>
                  <td className="px-4 py-3 font-mono text-sm">{r.end_time || '—'}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}