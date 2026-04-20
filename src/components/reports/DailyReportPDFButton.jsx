import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
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

function buildReportGroups(assignments, logisticsMap) {
  const SKIP = ['לא עובד', 'לימודים'];
  const filtered = assignments.filter(a => !SKIP.includes(a.workplace_name));
  const globalTeamLeader = assignments.find(a => a.role === 'ראש צוות');

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
      const driverAssignment = g.students.find(s => s.role === 'נהג');
      const driverName = driverAssignment?.student_name || log.driver_student_name || '';
      return {
        workplaceName: g.name,
        students: g.students.sort((a, b) => (a.student_name || '').localeCompare(b.student_name || '', 'he')),
        driverName,
        vehicleName: log.vehicle_name || '',
        exitTime: log.exit_time || '',
        teamLeaderName: globalTeamLeader?.student_name || '',
      };
    });
}

export default function DailyReportPDFButton({ date, assignments }) {
  const [exporting, setExporting] = useState(false);
  const hiddenRef = useRef(null);

  const { data: logisticsList = [] } = useQuery({
    queryKey: ['workplace-logistics', date],
    queryFn: () => base44.entities.WorkplaceLogistics.filter({ date }),
  });

  const logisticsMap = {};
  logisticsList.forEach(l => { logisticsMap[l.workplace_id] = l; });

  const gregDate = new Date(date + 'T12:00:00').toLocaleDateString('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  const hebrewDate = toHebrewDate(date);
  const reportGroups = buildReportGroups(assignments, logisticsMap);

  const handleExport = async () => {
    setExporting(true);
    // Make hidden div visible for canvas capture
    hiddenRef.current.style.position = 'fixed';
    hiddenRef.current.style.top = '-9999px';
    hiddenRef.current.style.left = '0';
    hiddenRef.current.style.display = 'block';
    await new Promise(r => setTimeout(r, 100));

    const canvas = await html2canvas(hiddenRef.current, { scale: 2, useCORS: true });

    hiddenRef.current.style.display = 'none';

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
    <>
      <Button onClick={handleExport} disabled={exporting || reportGroups.length === 0}>
        {exporting ? <Loader2 size={16} className="animate-spin ml-2" /> : <Download size={16} className="ml-2" />}
        {exporting ? 'מייצא...' : 'סידור עבודה PDF'}
      </Button>

      {/* Hidden report for PDF rendering */}
      <div ref={hiddenRef} style={{ display: 'none', width: '794px', background: 'white', padding: '16px', fontFamily: 'Arial, sans-serif' }} dir="rtl">
        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>סידור עבודה</h2>
          <p style={{ fontSize: '13px', margin: '4px 0 0' }}>{gregDate} — {hebrewDate}</p>
        </div>

        {reportGroups.map((group) => (
          <div key={group.workplaceName} style={{ marginBottom: '16px' }}>
            <div style={{ background: '#e5e7eb', padding: '6px 8px', fontWeight: 'bold', fontSize: '12px', border: '1px solid #9ca3af', borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{group.workplaceName}</span>
              <span style={{ display: 'flex', gap: '12px' }}>
                {group.vehicleName && (
                  <span style={{ fontWeight: 'bold', fontSize: '11px', background: '#1e40af', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}>
                    🚐 {group.vehicleName}
                  </span>
                )}
                {group.exitTime && (
                  <span style={{ fontWeight: 'bold', fontSize: '11px', background: '#166534', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}>
                    ⏰ יציאה: {group.exitTime}
                  </span>
                )}
              </span>
            </div>
            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ border: '1px solid #d1d5db', padding: '4px 8px', textAlign: 'right' }}>שם תלמיד</th>
                  <th style={{ border: '1px solid #d1d5db', padding: '4px 8px', textAlign: 'center', width: '80px' }}>אחראי פק"ל</th>
                  <th style={{ border: '1px solid #d1d5db', padding: '4px 8px', textAlign: 'right', width: '110px' }}>נהג</th>
                  <th style={{ border: '1px solid #d1d5db', padding: '4px 8px', textAlign: 'right', width: '110px' }}>ראש צוות</th>
                </tr>
              </thead>
              <tbody>
                {group.students.map((s, i) => (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    <td style={{ border: '1px solid #d1d5db', padding: '3px 8px' }}>{s.student_name}</td>
                    <td style={{ border: '1px solid #d1d5db', padding: '3px 8px', textAlign: 'center' }}>{s.role === 'אחראי פק"ל' ? 'כן' : ''}</td>
                    <td style={{ border: '1px solid #d1d5db', padding: '3px 8px' }}>{group.driverName}</td>
                    <td style={{ border: '1px solid #d1d5db', padding: '3px 8px' }}>{group.teamLeaderName}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f3f4f6' }}>
                  <td colSpan={4} style={{ border: '1px solid #d1d5db', padding: '3px 8px', textAlign: 'right', fontWeight: '500' }}>
                    סה"כ תלמידים: {group.students.length}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
      </div>
    </>
  );
}