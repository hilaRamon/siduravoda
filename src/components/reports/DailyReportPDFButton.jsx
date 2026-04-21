import { useState, useRef, useCallback } from 'react';
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
      const vehicles = [log.vehicle_name, log.vehicle_name_2].filter(Boolean).join(' + ');
      return {
        workplaceName: g.name,
        students: g.students.sort((a, b) => (a.student_name || '').localeCompare(b.student_name || '', 'he')),
        driverName,
        vehicleName: vehicles || '',
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

    const container = hiddenRef.current;
    container.style.position = 'fixed';
    container.style.top = '-9999px';
    container.style.left = '0';
    container.style.display = 'block';
    await new Promise(r => setTimeout(r, 150));

    const SCALE = 1.5;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentW = pageW - margin * 2;
    const contentH = pageH - margin * 2;

    // Collect the block elements: header + each group div
    const blocks = Array.from(container.children);
    // containerOffsetTop relative to container itself = 0 since we measure offsetTop within container
    const containerTop = container.getBoundingClientRect().top;

    let curPageUsedMM = 0; // how many mm used on current page
    let isFirstPage = true;

    for (const block of blocks) {
      const blockCanvas = await html2canvas(block, { scale: SCALE, useCORS: true, backgroundColor: '#ffffff' });
      const blockHeightMM = (blockCanvas.height / SCALE) * (contentW / (blockCanvas.width / SCALE));
      // simpler: blockHeightMM = blockCanvas.height / SCALE * (contentW / (blockCanvas.width / SCALE))
      const ratio = blockCanvas.width / contentW; // px per mm
      const blockH_MM = blockCanvas.height / ratio;

      // If block doesn't fit on remaining page and we already have content, add new page
      if (!isFirstPage && curPageUsedMM + blockH_MM > contentH) {
        pdf.addPage();
        curPageUsedMM = 0;
      }

      pdf.addImage(
        blockCanvas.toDataURL('image/jpeg', 0.85),
        'JPEG',
        margin,
        margin + curPageUsedMM,
        contentW,
        blockH_MM
      );

      curPageUsedMM += blockH_MM + 2; // 2mm gap between blocks
      isFirstPage = false;

      // If we overflow (large single block), move to next page for subsequent blocks
      if (curPageUsedMM >= contentH) {
        pdf.addPage();
        curPageUsedMM = 0;
      }
    }

    container.style.display = 'none';
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
            <div style={{ background: '#e5e7eb', padding: '8px 8px', fontWeight: 'bold', fontSize: '12px', border: '1px solid #9ca3af', borderBottom: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <span>{group.workplaceName}</span>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  {group.vehicleName && (
                    <span style={{ fontWeight: 'bold', fontSize: '11px', background: '#1e40af', color: '#fff', padding: '3px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                      🚐 {group.vehicleName}
                    </span>
                  )}
                  {group.exitTime && (
                    <span style={{ fontWeight: 'bold', fontSize: '11px', background: '#166534', color: '#fff', padding: '3px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                      ⏰ {group.exitTime}
                    </span>
                  )}
                </div>
              </div>
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