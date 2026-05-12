import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
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
  } catch { return ''; }
}

function sortByLastName(students) {
  return [...students].sort((a, b) => {
    const last = (name) => { const p = (name || '').trim().split(/\s+/); return p[p.length - 1] || ''; };
    return last(a.student_name).localeCompare(last(b.student_name), 'he');
  });
}

// ---- PDF Card component (inline styles only, for html2canvas) ----
function PdfCard({ group }) {
  return (
    <div style={{
      border: '2px solid #333',
      borderRadius: '6px',
      overflow: 'hidden',
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      breakInside: 'avoid',
    }}>
      {/* Workplace name */}
      <div style={{
        background: '#2c4fa3',
        color: 'white',
        padding: '7px 10px',
        fontWeight: 'bold',
        fontSize: '14px',
        borderBottom: '2px solid #1a3070',
      }}>
        {group.workplaceName}
      </div>

      {/* Logistics: vehicles + exit time — BIG */}
      <div style={{
        background: '#f5f0d0',
        borderBottom: '2px solid #c8b800',
        padding: '8px 10px',
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        {group.vehicles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', color: '#666', marginBottom: '1px' }}>רכב</span>
            <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#222' }}>🚗 {group.vehicles.join(' | ')}</span>
          </div>
        )}
        {group.exitTime && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', color: '#666', marginBottom: '1px' }}>שעת יציאה</span>
            <span style={{ fontSize: '17px', fontWeight: 'bold', color: '#b30000' }}>⏰ {group.exitTime}</span>
          </div>
        )}
        {!group.vehicles.length && !group.exitTime && (
          <span style={{ color: '#aaa', fontSize: '12px' }}>—</span>
        )}
      </div>

      {/* Roles row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        borderBottom: '1px solid #ccc',
        background: '#f0f4ff',
      }}>
        {[['נהג', group.driverName], ['ראש צוות', group.teamLeaderName], ['אחראי פק"ל', group.pakalName]].map(([label, val], i) => (
          <div key={label} style={{
            padding: '5px 7px',
            borderLeft: i < 2 ? '1px solid #ccc' : 'none',
          }}>
            <div style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>{label}</div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: val ? '#111' : '#bbb' }}>{val || '—'}</div>
          </div>
        ))}
      </div>

      {/* Students list */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <tbody>
          {group.students.map((s, i) => (
            <tr key={s.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f5f5f5' }}>
              <td style={{ padding: '4px 10px', borderBottom: '1px solid #e8e8e8' }}>{s.student_name}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#e8e8e8' }}>
            <td style={{ padding: '4px 10px', fontSize: '10px', color: '#555', fontWeight: '600' }}>
              סה"כ: {group.students.length} תלמידים
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function DailyAssignmentReport() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [exporting, setExporting] = useState(false);
  const printRef = useRef(null);

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
    const logisticsMap = {};
    logisticsList.forEach(l => { logisticsMap[l.workplace_id] = l; });

    const byWorkplace = {};
    filtered.forEach(a => {
      const key = a.workplace_id;
      if (!byWorkplace[key]) byWorkplace[key] = { id: a.workplace_id, name: a.workplace_name, students: [] };
      byWorkplace[key].students.push(a);
    });

    const globalTeamLeader = assignments.find(a => a.role === 'ראש צוות');
    const globalPakal = assignments.find(a => a.role === 'אחראי פק"ל');
    const globalDriver = assignments.find(a => a.role === 'נהג');

    return Object.values(byWorkplace)
      .sort((a, b) => a.name.localeCompare(b.name, 'he'))
      .map(g => {
        const log = logisticsMap[g.id] || {};
        const driverFromRole = g.students.find(s => s.role === 'נהג');
        const driverName = log.driver_student_name || driverFromRole?.student_name || globalDriver?.student_name || '';
        const teamLeaderInGroup = g.students.find(s => s.role === 'ראש צוות');
        const teamLeaderName = teamLeaderInGroup?.student_name || globalTeamLeader?.student_name || '';
        const pakalInGroup = g.students.find(s => s.role === 'אחראי פק"ל');
        const pakalName = pakalInGroup?.student_name || globalPakal?.student_name || '';
        const vehicles = [log.vehicle_name, log.vehicle_name_2, log.vehicle_name_3].filter(Boolean);
        return {
          workplaceName: g.name,
          students: sortByLastName(g.students),
          driverName,
          teamLeaderName,
          pakalName,
          vehicles,
          exitTime: log.exit_time || '',
        };
      });
  }, [assignments, logisticsList]);

  const gregDate = new Date(date + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
  const hebrewDate = toHebrewDate(date);

  const handleExportPDF = async () => {
    setExporting(true);
    const el = printRef.current;
    // Make visible off-screen for html2canvas
    el.style.visibility = 'visible';
    el.style.pointerEvents = 'none';
    await new Promise(r => setTimeout(r, 300));

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    el.style.visibility = 'hidden';
    el.style.pointerEvents = 'none';

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const contentW = pageW - margin * 2;
    const contentH = pageH - margin * 2;
    const pxPerMM = canvas.width / contentW;
    const pageHeightPx = contentH * pxPerMM;

    let srcY = 0;
    let first = true;
    while (srcY < canvas.height) {
      const sliceH = Math.min(pageHeightPx, canvas.height - srcY);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceH;
      slice.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      if (!first) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.93), 'JPEG', margin, margin, contentW, sliceH / pxPerMM);
      srcY += sliceH;
      first = false;
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
            {exporting ? 'מייצא...' : 'הורד PDF'}
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}

      {/* Hidden PDF layout — fixed off-screen, visibility:hidden so html2canvas can capture */}
      <div
        ref={printRef}
        style={{
          position: 'fixed',
          top: 0,
          left: '-9999px',
          width: '794px',
          background: 'white',
          padding: '20px',
          fontFamily: 'Arial, sans-serif',
          direction: 'rtl',
          visibility: 'hidden',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '14px', borderBottom: '2px solid #2c4fa3', paddingBottom: '10px' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1a3070' }}>סידור עבודה</div>
          <div style={{ fontSize: '13px', marginTop: '3px', color: '#444' }}>{gregDate} — {hebrewDate}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'start' }}>
          {reportGroups.map(group => <PdfCard key={group.workplaceName} group={group} />)}
        </div>
      </div>

      {/* Screen preview — same two-column layout */}
      {!isLoading && reportGroups.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">אין שיבוצים לתאריך זה</p>
      )}
      {!isLoading && reportGroups.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-border" dir="rtl">
          <div className="mb-4 text-center">
            <h2 className="text-lg font-bold text-blue-900">סידור עבודה</h2>
            <p className="text-sm text-gray-500">{gregDate} — {hebrewDate}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {reportGroups.map((group) => (
              <div key={group.workplaceName} className="border-2 border-gray-400 rounded overflow-hidden text-xs">
                {/* Workplace name */}
                <div className="bg-blue-700 text-white px-3 py-1.5 font-bold text-sm">
                  {group.workplaceName}
                </div>
                {/* Logistics */}
                <div className="bg-yellow-50 border-b-2 border-yellow-400 px-3 py-2 flex gap-4 flex-wrap items-center">
                  {group.vehicles.length > 0 && (
                    <div className="flex flex-col">
                      <span className="text-gray-400 text-[9px]">רכב</span>
                      <span className="text-sm font-bold">🚗 {group.vehicles.join(' | ')}</span>
                    </div>
                  )}
                  {group.exitTime && (
                    <div className="flex flex-col">
                      <span className="text-gray-400 text-[9px]">שעת יציאה</span>
                      <span className="text-base font-bold text-red-700">⏰ {group.exitTime}</span>
                    </div>
                  )}
                  {!group.vehicles.length && !group.exitTime && <span className="text-gray-300">—</span>}
                </div>
                {/* Roles */}
                <div className="grid grid-cols-3 border-b border-gray-200 bg-blue-50">
                  {[['נהג', group.driverName], ['ראש צוות', group.teamLeaderName], ['אחראי פק"ל', group.pakalName]].map(([label, val], i) => (
                    <div key={label} className={`px-2 py-1 ${i < 2 ? 'border-l border-gray-200' : ''}`}>
                      <div className="text-gray-400 text-[9px]">{label}</div>
                      <div className={`text-[11px] font-bold ${val ? 'text-gray-800' : 'text-gray-300'}`}>{val || '—'}</div>
                    </div>
                  ))}
                </div>
                {/* Students */}
                <table className="w-full border-collapse">
                  <tbody>
                    {group.students.map((s, i) => (
                      <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-1 border-b border-gray-100 text-xs">{s.student_name}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100">
                      <td className="px-2 py-1 text-gray-500 text-[10px] font-medium">סה"כ: {group.students.length} תלמידים</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}