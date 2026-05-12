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
  } catch {
    return '';
  }
}

// Sort by last word (last name) in Hebrew name
function sortByLastName(students) {
  return [...students].sort((a, b) => {
    const lastName = (name) => {
      const parts = (name || '').trim().split(/\s+/);
      return parts[parts.length - 1] || '';
    };
    return lastName(a.student_name).localeCompare(lastName(b.student_name), 'he');
  });
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

    const logisticsMap = {};
    logisticsList.forEach(l => { logisticsMap[l.workplace_id] = l; });

    const byWorkplace = {};
    filtered.forEach(a => {
      const key = a.workplace_id;
      if (!byWorkplace[key]) byWorkplace[key] = { id: a.workplace_id, name: a.workplace_name, students: [] };
      byWorkplace[key].students.push(a);
    });

    // Find global team leader (may be assigned to any workplace)
    const globalTeamLeader = assignments.find(a => a.role === 'ראש צוות');
    // Find global logistics officer
    const globalPakal = assignments.find(a => a.role === 'אחראי פק"ל');

    return Object.values(byWorkplace)
      .sort((a, b) => a.name.localeCompare(b.name, 'he'))
      .map(g => {
        const log = logisticsMap[g.id] || {};

        // Driver: prefer from logistics, fallback to student with role נהג in this group
        const driverFromRole = g.students.find(s => s.role === 'נהג');
        const driverName = log.driver_student_name || driverFromRole?.student_name || '';

        // Team leader: prefer one in this group, fallback to global
        const teamLeaderInGroup = g.students.find(s => s.role === 'ראש צוות');
        const teamLeaderName = teamLeaderInGroup?.student_name || globalTeamLeader?.student_name || '';

        // Logistics officer: prefer one in this group, fallback to global
        const pakalInGroup = g.students.find(s => s.role === 'אחראי פק"ל');
        const pakalName = pakalInGroup?.student_name || globalPakal?.student_name || '';

        // Vehicles: up to 3
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

  const gregDate = new Date(date + 'T12:00:00').toLocaleDateString('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  const hebrewDate = toHebrewDate(date);

  const handleExportPDF = async () => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 150));
    const el = tableRef.current;
    el.style.display = 'block';
    await new Promise(r => setTimeout(r, 100));
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    el.style.display = 'none';

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
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, contentW, sliceH / pxPerMM);
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
            הורד PDF
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}

      {/* Hidden print layout — two columns */}
      <div
        ref={tableRef}
        style={{
          display: 'none',
          position: 'fixed',
          top: '-9999px',
          left: 0,
          width: '794px',
          background: 'white',
          padding: '16px',
          fontFamily: 'Arial, sans-serif',
          direction: 'rtl',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '12px', borderBottom: '2px solid #333', paddingBottom: '8px' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>סידור עבודה</div>
          <div style={{ fontSize: '13px', marginTop: '2px' }}>{gregDate} — {hebrewDate}</div>
        </div>

        {/* Two-column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'start' }}>
          {reportGroups.map((group) => (
            <div key={group.workplaceName} style={{ border: '1px solid #999', borderRadius: '4px', overflow: 'hidden', fontSize: '11px' }}>
              {/* Workplace header */}
              <div style={{ background: '#d0d8f0', padding: '5px 8px', fontWeight: 'bold', fontSize: '12px', borderBottom: '1px solid #999' }}>
                {group.workplaceName}
              </div>

              {/* Logistics row */}
              <div style={{ display: 'flex', gap: '6px', padding: '4px 8px', background: '#f0f0f0', borderBottom: '1px solid #ccc', fontSize: '12px', fontWeight: '600' }}>
                {group.vehicles.length > 0 && (
                  <span>🚗 {group.vehicles.join(', ')}</span>
                )}
                {group.exitTime && (
                  <span style={{ marginRight: group.vehicles.length ? '8px' : 0 }}>⏰ {group.exitTime}</span>
                )}
                {!group.vehicles.length && !group.exitTime && (
                  <span style={{ color: '#aaa' }}>—</span>
                )}
              </div>

              {/* Roles row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #ccc', background: '#f8f8f8' }}>
                <div style={{ padding: '3px 6px', borderLeft: '1px solid #ddd', fontSize: '11px' }}>
                  <div style={{ color: '#666', fontSize: '9px', marginBottom: '1px' }}>נהג</div>
                  <div style={{ fontWeight: '600' }}>{group.driverName || '—'}</div>
                </div>
                <div style={{ padding: '3px 6px', borderLeft: '1px solid #ddd', fontSize: '11px' }}>
                  <div style={{ color: '#666', fontSize: '9px', marginBottom: '1px' }}>ראש צוות</div>
                  <div style={{ fontWeight: '600' }}>{group.teamLeaderName || '—'}</div>
                </div>
                <div style={{ padding: '3px 6px', fontSize: '11px' }}>
                  <div style={{ color: '#666', fontSize: '9px', marginBottom: '1px' }}>אחראי פק"ל</div>
                  <div style={{ fontWeight: '600' }}>{group.pakalName || '—'}</div>
                </div>
              </div>

              {/* Students */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <tbody>
                  {group.students.map((s, i) => (
                    <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : '#f7f7f7' }}>
                      <td style={{ padding: '3px 8px', borderBottom: '1px solid #eee' }}>{s.student_name}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#eee' }}>
                    <td style={{ padding: '3px 8px', fontSize: '10px', color: '#555', fontWeight: '600' }}>
                      סה"כ: {group.students.length} תלמידים
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
        </div>
      </div>

      {/* Screen preview */}
      {!isLoading && reportGroups.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">אין שיבוצים לתאריך זה</p>
      )}
      {!isLoading && reportGroups.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-border" dir="rtl">
          <div className="mb-4 text-center">
            <h2 className="text-base font-bold">סידור עבודה</h2>
            <p className="text-sm">{gregDate} — {hebrewDate}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {reportGroups.map((group) => (
              <div key={group.workplaceName} className="border border-gray-300 rounded overflow-hidden text-xs">
                <div className="bg-blue-100 px-2 py-1 font-bold text-xs border-b border-gray-300">
                  {group.workplaceName}
                </div>
                <div className="flex gap-2 px-2 py-1 bg-gray-100 border-b border-gray-200 text-xs font-semibold">
                  {group.vehicles.length > 0 && <span>🚗 {group.vehicles.join(', ')}</span>}
                  {group.exitTime && <span>⏰ {group.exitTime}</span>}
                  {!group.vehicles.length && !group.exitTime && <span className="text-gray-400">—</span>}
                </div>
                <div className="grid grid-cols-3 border-b border-gray-200 bg-gray-50">
                  {[['נהג', group.driverName], ['ראש צוות', group.teamLeaderName], ['אחראי פק"ל', group.pakalName]].map(([label, val]) => (
                    <div key={label} className="px-1 py-1 border-l border-gray-200 last:border-l-0">
                      <div className="text-gray-400 text-[9px]">{label}</div>
                      <div className="font-semibold text-[10px]">{val || '—'}</div>
                    </div>
                  ))}
                </div>
                <table className="w-full border-collapse">
                  <tbody>
                    {group.students.map((s, i) => (
                      <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-0.5 border-b border-gray-100">{s.student_name}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100">
                      <td className="px-2 py-0.5 text-gray-500 text-[10px]">סה"כ: {group.students.length}</td>
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