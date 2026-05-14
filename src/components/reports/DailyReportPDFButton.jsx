import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Share2 } from 'lucide-react';
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

const SKIP_NAMES = ['לא עובד', 'לימודים', 'לא יצא'];
const shouldSkip = (name) => !name || SKIP_NAMES.some(kw => name.trim() === kw);

function buildReportGroups(assignments, logisticsMap) {
  const filtered = assignments.filter(a => !shouldSkip(a.workplace_name));

  const byWorkplace = {};
  const seenStudents = new Set();
  filtered.forEach(a => {
    const key = a.workplace_id;
    if (!byWorkplace[key]) byWorkplace[key] = { id: a.workplace_id, name: a.workplace_name, students: [] };
    if (!seenStudents.has(a.student_id)) {
      seenStudents.add(a.student_id);
      byWorkplace[key].students.push(a);
    }
  });

  const groups = Object.values(byWorkplace)
    .sort((a, b) => a.name.localeCompare(b.name, 'he'));

  // Find which workplace each role holder actually belongs to
  const driverAssignment = assignments.find(a => a.role === 'נהג');
  const teamLeaderAssignment = assignments.find(a => a.role === 'ראש צוות');
  const equipAssignment = assignments.find(a => a.role === 'אחראי פק"ל');

  return groups.map(g => {
    const log = logisticsMap[g.id] || {};
    const vehicles = [log.vehicle_name, log.vehicle_name_2, log.vehicle_name_3].filter(Boolean).join(' + ');
    // Only show role in the workplace they are actually assigned to
    const driverName = driverAssignment?.workplace_id === g.id ? driverAssignment.student_name : '';
    const teamLeaderName = teamLeaderAssignment?.workplace_id === g.id ? teamLeaderAssignment.student_name : '';
    const equipName = equipAssignment?.workplace_id === g.id ? equipAssignment.student_name : '';
    return {
      workplaceName: g.name,
      students: g.students.sort((a, b) => (a.student_name || '').localeCompare(b.student_name || '', 'he')),
      vehicleName: vehicles || '',
      exitTime: log.exit_time || '06:35',
      notes: log.notes || '',
      driverName,
      teamLeaderName,
      equipName,
    };
  });
}

async function generatePDFBlob(container, date) {
  container.style.position = 'fixed';
  container.style.top = '-9999px';
  container.style.left = '0';
  container.style.display = 'block';
  await new Promise(r => setTimeout(r, 150));

  const SCALE = 1.5;
  const canvas = await html2canvas(container, { scale: SCALE, useCORS: true, backgroundColor: '#ffffff' });
  container.style.display = 'none';

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;

  const pxPerMM = canvas.width / contentW;
  const pageHeightPx = contentH * pxPerMM;

  const blocks = Array.from(container.children);
  const safeCutsPx = blocks.map(block => {
    let top = 0;
    let el = block;
    while (el && el !== container) {
      top += el.offsetTop;
      el = el.offsetParent;
    }
    return (top + block.offsetHeight) * SCALE;
  });

  const pdf_pages = [];
  let srcY = 0;

  while (srcY < canvas.height) {
    const idealEnd = srcY + pageHeightPx;
    let cutY = idealEnd;
    for (const safePx of safeCutsPx) {
      if (safePx <= idealEnd && safePx > srcY) cutY = safePx;
    }
    const sliceH = Math.min(cutY, canvas.height) - srcY;

    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceH;
    slice.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

    if (pdf_pages.length > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL('image/jpeg', 0.85), 'JPEG', margin, margin, contentW, sliceH / pxPerMM);
    pdf_pages.push(true);

    srcY += sliceH;
  }

  return pdf.output('blob');
}

export default function DailyReportPDFButton({ date, assignments }) {
  const [exporting, setExporting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedOk, setPublishedOk] = useState(false);
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
    const blob = await generatePDFBlob(hiddenRef.current, date);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `סידור_עבודה_יומי_${date}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPublishedOk(false);
    const blob = await generatePDFBlob(hiddenRef.current, date);
    const file = new File([blob], `schedule_${date}.pdf`, { type: 'application/pdf' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    // Delete old published schedule records and create a fresh one
    const existing = await base44.entities.PublishedSchedule.list();
    await Promise.all(existing.map(r => base44.entities.PublishedSchedule.delete(r.id)));
    await base44.entities.PublishedSchedule.create({ date, file_url });

    setPublishedOk(true);
    setPublishing(false);
  };

  // Split groups into two columns
  const leftCol = reportGroups.filter((_, i) => i % 2 === 0);
  const rightCol = reportGroups.filter((_, i) => i % 2 === 1);

  const renderGroup = (group) => {
    // Build student rows: show role name next to the student who holds it
    const rows = group.students.map(s => {
      let roleLabel = '';
      if (s.role === 'נהג') roleLabel = 'נהג';
      else if (s.role === 'ראש צוות') roleLabel = 'ראש צוות';
      else if (s.role === 'אחראי פק"ל') roleLabel = 'אחראי פק"ל';
      return { name: s.student_name, role: roleLabel };
    });

    return (
      <div key={group.workplaceName} style={{ marginBottom: '6px', border: '1px solid #9ca3af', borderRadius: '3px', overflow: 'hidden' }}>
        {/* Header: workplace name */}
        <div style={{ background: '#1e3a8a', color: '#fff', padding: '3px 6px', fontWeight: 'bold', fontSize: '10px' }}>
          {group.workplaceName}
        </div>

        {/* Logistics row: vehicle + exit time */}
        <div style={{ background: '#fef9c3', borderBottom: '1px solid #ca8a04', padding: '2px 6px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {group.vehicleName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ fontSize: '8px', color: '#78716c' }}>רכב:</span>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#1e3a8a' }}>🚐 {group.vehicleName}</span>
            </div>
          )}
          {group.exitTime && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ fontSize: '8px', color: '#78716c' }}>יציאה:</span>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#b91c1c' }}>⏰ {group.exitTime}</span>
            </div>
          )}
          {group.notes && (
            <span style={{ fontSize: '8px', color: '#78350f', marginRight: 'auto' }}>📝 {group.notes}</span>
          )}
        </div>

        {/* Students table */}
        <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#dbeafe' }}>
              <th style={{ border: '1px solid #d1d5db', padding: '2px 4px', textAlign: 'right' }}>שם תלמיד</th>
              <th style={{ border: '1px solid #d1d5db', padding: '2px 4px', textAlign: 'right', width: '60px' }}>תפקיד</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                <td style={{ border: '1px solid #e5e7eb', padding: '2px 4px' }}>{r.name}</td>
                <td style={{ border: '1px solid #e5e7eb', padding: '2px 4px', fontWeight: r.role ? '700' : 'normal', color: r.role ? '#1d4ed8' : 'inherit' }}>
                  {r.role || ''}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f3f4f6' }}>
              <td colSpan={2} style={{ border: '1px solid #d1d5db', padding: '2px 4px', fontSize: '8px', color: '#6b7280' }}>
                סה"כ: {group.students.length} תלמידים
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const reportContent = (
    <div ref={hiddenRef} style={{ display: 'none', width: '794px', background: 'white', padding: '16px', fontFamily: 'Arial, sans-serif' }} dir="rtl">
      <div style={{ marginBottom: '8px', textAlign: 'center', borderBottom: '2px solid #1e3a8a', paddingBottom: '5px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0, color: '#1e3a8a' }}>סידור עבודה</h2>
        <p style={{ fontSize: '10px', margin: '2px 0 0', color: '#555' }}>{gregDate} — {hebrewDate}</p>
      </div>

      {/* Two-column layout using a table for reliable PDF rendering */}
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '50%' }} />
          <col style={{ width: '8px' }} />
          <col style={{ width: '50%' }} />
        </colgroup>
        <tbody>
          {Array.from({ length: Math.max(leftCol.length, rightCol.length) }).map((_, i) => (
            <tr key={i} style={{ verticalAlign: 'top' }}>
              <td style={{ padding: '0 4px 0 0', verticalAlign: 'top' }}>
                {leftCol[i] ? renderGroup(leftCol[i]) : null}
              </td>
              <td />
              <td style={{ padding: '0 0 0 4px', verticalAlign: 'top' }}>
                {rightCol[i] ? renderGroup(rightCol[i]) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        <div className="flex gap-2">
          <Button onClick={handleExport} disabled={exporting || reportGroups.length === 0}>
            {exporting ? <Loader2 size={16} className="animate-spin ml-2" /> : <Download size={16} className="ml-2" />}
            {exporting ? 'מייצא...' : 'סידור עבודה PDF'}
          </Button>
          <Button
            onClick={handlePublish}
            disabled={publishing || reportGroups.length === 0}
            style={{ backgroundColor: '#166534', color: 'white' }}
            className="hover:opacity-90"
          >
            {publishing ? <Loader2 size={16} className="animate-spin ml-2" /> : <Share2 size={16} className="ml-2" />}
            {publishing ? 'מפרסם...' : 'פרסום סידור'}
          </Button>
        </div>
        {publishedOk && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs">
            <span className="text-green-700 font-medium">✓ הסידור פורסם בהצלחה!</span>
          </div>
        )}
      </div>

      {reportContent}
    </>
  );
}