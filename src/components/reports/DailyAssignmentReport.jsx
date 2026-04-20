import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
// WorkplaceLogistics is available via base44.entities.WorkplaceLogistics
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function toHebrewDate(dateStr) {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
      day: 'numeric', month: 'long', year: 'numeric'
    }).format(d);
  } catch {
    return '';
  }
}

export default function DailyAssignmentReport() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [exporting, setExporting] = useState(false);
  const tableRef = useRef(null);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['assignments', date],
    queryFn: () => base44.entities.Assignment.filter({ date }),
  });

  const { data: logisticsList = [] } = useQuery({
    queryKey: ['workplace-logistics', date],
    queryFn: () => base44.entities.WorkplaceLogistics.filter({ date }),
  });

  const reportGroups = useMemo(() => {
    const SKIP = ['לא עובד', 'לימודים'];
    const filtered = assignments.filter(a => !SKIP.includes(a.workplace_name));
    const globalTeamLeader = assignments.find(a => a.role === 'ראש צוות');

    const logisticsMap = {};
    logisticsList.forEach(l => { logisticsMap[l.workplace_id] = l; });

    const byWorkplace = {};
    filtered.forEach(a => {
      const key = a.workplace_id;
      if (!byWorkplace[key]) byWorkplace[key] = { id: a.workplace_id, name: a.workplace_name, students: [] };
      byWorkplace[key].students.push(a);
    });

    return Object.values(byWorkplace)
      .sort((a, b) => a.name.localeCompare(b.name, 'he'))
      .map(g => {
        const log = logisticsMap[g.id] || {};
        return {
          workplaceName: g.name,
          students: g.students.sort((a, b) => (a.student_name || '').localeCompare(b.student_name || '', 'he')),
          driverName: log.driver_student_name || '',
          vehicleName: log.vehicle_name || '',
          exitTime: log.exit_time || '',
          teamLeaderName: globalTeamLeader?.student_name || '',
        };
      });
  }, [assignments, logisticsList]);

  const gregDate = new Date(date + 'T12:00:00').toLocaleDateString('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  const hebrewDate = toHebrewDate(date);

  const handleExportPDF = async () => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 100));
    const el = tableRef.current;
    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW - 20;
    const ratio = canvas.width / imgW;
    let srcY = 0;
    while (srcY < canvas.height) {
      const sliceH = Math.min((pageH - 20) * ratio, canvas.height - srcY);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceH;
      sliceCanvas.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 10, 10, imgW, sliceH / ratio);
      srcY += sliceH;
      if (srcY < canvas.height) pdf.addPage();
    }
    pdf.save(`סידור_עבודה_יומי_${date}.pdf`);
    setExporting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">תאריך</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 h-9"
          />
        </div>
        {reportGroups.length > 0 && (
          <Button onClick={handleExportPDF} disabled={exporting} size="sm">
            {exporting ? <Loader2 size={14} className="animate-spin ml-1" /> : <Download size={14} className="ml-1" />}
            הורד PDF
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}

      {!isLoading && (
        <div ref={tableRef} className="bg-white p-4 rounded-xl border border-border" dir="rtl">
          <div className="mb-4 text-center">
            <h2 className="text-base font-bold">סידור עבודה</h2>
            <p className="text-sm">{gregDate} — {hebrewDate}</p>
          </div>

          {reportGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">אין שיבוצים לתאריך זה</p>
          ) : (
            <div className="space-y-4">
              {reportGroups.map((group) => (
                <div key={group.workplaceName}>
                  <div className="bg-gray-100 px-2 py-1 font-bold text-xs border border-gray-300 rounded-t flex justify-between items-center">
                    <span>{group.workplaceName}</span>
                    <span className="font-normal text-gray-500">
                      {group.vehicleName ? `רכב: ${group.vehicleName}` : ''}{group.vehicleName && group.exitTime ? ' | ' : ''}{group.exitTime ? `יציאה: ${group.exitTime}` : ''}
                    </span>
                  </div>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-2 py-1 text-right font-semibold">שם תלמיד</th>
                        <th className="border border-gray-300 px-2 py-1 text-center font-semibold w-20">אחראי פק"ל</th>
                        <th className="border border-gray-300 px-2 py-1 text-right font-semibold w-28">נהג</th>
                        <th className="border border-gray-300 px-2 py-1 text-right font-semibold w-28">ראש צוות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.students.map((s, i) => (
                        <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border border-gray-300 px-2 py-1">{s.student_name}</td>
                          <td className="border border-gray-300 px-2 py-1 text-center">
                            {s.role === 'אחראי פק"ל' ? 'כן' : ''}
                          </td>
                          <td className="border border-gray-300 px-2 py-1">{group.driverName}</td>
                          <td className="border border-gray-300 px-2 py-1">{group.teamLeaderName}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100">
                        <td colSpan={4} className="border border-gray-300 px-2 py-1 text-right text-xs font-medium">
                          סה"כ תלמידים: {group.students.length}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}