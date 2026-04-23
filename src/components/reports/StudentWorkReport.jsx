import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const SKIP_WORKPLACES = ['לא עובד', 'לימודים'];

export default function StudentWorkReport() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + '-01';
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);

  const { data: allAssignments = [], isLoading } = useQuery({
    queryKey: ['assignments-all'],
    queryFn: () => base44.entities.Assignment.list(),
  });

  const reportData = useMemo(() => {
    const filtered = allAssignments.filter(a =>
      !SKIP_WORKPLACES.includes(a.workplace_name) &&
      a.date >= fromDate &&
      a.date <= toDate
    );

    // Group by student
    const byStudent = {};
    filtered.forEach(a => {
      if (!byStudent[a.student_id]) {
        byStudent[a.student_id] = { name: a.student_name, workplaces: {} };
      }
      const wp = a.workplace_name || '';
      if (!byStudent[a.student_id].workplaces[wp]) {
        byStudent[a.student_id].workplaces[wp] = 0;
      }
      byStudent[a.student_id].workplaces[wp]++;
    });

    return Object.values(byStudent)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'))
      .map(s => ({
        name: s.name,
        workplaces: Object.entries(s.workplaces).sort(([a], [b]) => a.localeCompare(b, 'he')),
        totalDays: Object.values(s.workplaces).reduce((sum, d) => sum + d, 0),
      }));
  }, [allAssignments, fromDate, toDate]);

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex flex-wrap gap-4 items-end bg-card border border-border rounded-xl p-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">מתאריך</label>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">עד תאריך</label>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {reportData.length > 0 && `${reportData.length} תלמידים`}
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}

      {!isLoading && reportData.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">אין נתונים לתקופה זו</p>
      )}

      {!isLoading && reportData.length > 0 && (
        <div className="bg-white rounded-xl border border-border overflow-hidden" dir="rtl">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-right font-semibold">שם תלמיד</th>
                <th className="border border-gray-300 px-3 py-2 text-right font-semibold">מקום עבודה</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-24">כמות ימים</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-24">סה"כ ימים</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((student, si) =>
                student.workplaces.map(([wpName, days], wi) => (
                  <tr key={`${si}-${wi}`} className={si % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {wi === 0 && (
                      <td
                        rowSpan={student.workplaces.length}
                        className="border border-gray-300 px-3 py-2 font-medium align-top"
                      >
                        {student.name}
                      </td>
                    )}
                    <td className="border border-gray-300 px-3 py-2">{wpName}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center">{days}</td>
                    {wi === 0 && (
                      <td
                        rowSpan={student.workplaces.length}
                        className="border border-gray-300 px-3 py-2 text-center font-bold align-middle"
                      >
                        {student.totalDays}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}