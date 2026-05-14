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
    const formatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
    const formatted = formatter.format(d);
    
    // המרה של מספרים לגימטריה עברית
    const hebrewDigits = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'י״א', 'י״ב', 'י״ג', 'י״ד', 'ט״ו', 'ט״ז', 'י״ז', 'י״ח', 'י״ט', 'כ', 'כ״א', 'כ״ב', 'כ״ג', 'כ״ד', 'כ״ה', 'כ״ו', 'כ״ז', 'כ״ח', 'כ״ט', 'ל'];
    const parts = formatted.split(' ');
    
    if (parts.length >= 3 && !isNaN(parts[0])) {
      const day = parseInt(parts[0]);
      const year = parseInt(parts[parts.length - 1]);
      const month = parts.slice(1, -1).join(' ');
      
      const dayHebrew = hebrewDigits[day] || parts[0];
      const yearHebrew = year.toString().split('').map((d, i, arr) => {
        const num = parseInt(d);
        if (i === arr.length - 1) return hebrewDigits[num] || d;
        return hebrewDigits[num * Math.pow(10, arr.length - i - 1)] || d;
      }).join('');
      
      return `${dayHebrew} ${month} תשפ"${hebrewDigits[year % 10]}`;
    }
    
    return formatted;
  } catch { return ''; }
}

// Workplaces to exclude from the PDF report
const SKIP_WORKPLACE_NAMES = ['לא עובד', 'לימודים', 'לא יצא', 'תתת - לא עובד', 'קרוב', 'רחוק', 'אאא- לפני שיבוץ'];
const shouldSkip = (name) => !name || !name.trim() || SKIP_WORKPLACE_NAMES.some(kw => name.trim() === kw);

function buildReportGroups(assignments, logisticsMap, logisticsMapByName, studentsMap) {
  // Only include assignments with a real workplace that's not in the skip list
  const filtered = assignments.filter(a =>
    a.workplace_id &&
    a.workplace_name &&
    !shouldSkip(a.workplace_name)
  );

  // Deduplicate: keep one assignment per student (most recently updated)
  const bestByStudent = {};
  filtered.forEach(a => {
    const existing = bestByStudent[a.student_id];
    if (!existing || (a.updated_date || a.created_date) > (existing.updated_date || existing.created_date)) {
      bestByStudent[a.student_id] = a;
    }
  });

  // Group by workplace
  const byWorkplace = {};
  Object.values(bestByStudent).forEach(a => {
    const key = a.workplace_id;
    if (!byWorkplace[key]) byWorkplace[key] = { id: a.workplace_id, name: a.workplace_name, students: [] };
    byWorkplace[key].students.push(a);
  });

  // Build result — only workplaces with at least 1 student, sorted alphabetically
  return Object.values(byWorkplace)
    .filter(g => g.students.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'he'))
    .map(g => {
      const log = logisticsMap[g.id] || logisticsMapByName[g.name] || {};
      const vehicles = [log.vehicle_name, log.vehicle_name_2, log.vehicle_name_3].filter(Boolean).join(' + ');

      // Sort students: cohort alphabetically, then name alphabetically
      const sortedStudents = [...g.students].sort((a, b) => {
        const aCohort = studentsMap[a.student_id]?.cohort || '';
        const bCohort = studentsMap[b.student_id]?.cohort || '';
        const cohortCmp = aCohort.localeCompare(bCohort, 'he');
        if (cohortCmp !== 0) return cohortCmp;
        return (a.student_name || '').localeCompare(b.student_name || '', 'he');
      });

      return {
        workplaceName: g.name,
        students: sortedStudents,
        vehicleName: vehicles || '',
        exitTime: log.exit_time || '',
        notes: log.notes || '',
      };
    });
}

const S = {
  // The hidden container — A4 width at 96dpi ≈ 794px, we use 760px with padding
  wrap: {
    display: 'none',
    width: '760px',
    background: '#ffffff',
    padding: '12px',
    fontFamily: "'Heebo', Arial, sans-serif",
    direction: 'rtl',
    boxSizing: 'border-box',
  },
  titleBox: {
    textAlign: 'center',
    borderBottom: '2px solid #1e3a8a',
    paddingBottom: '5px',
    marginBottom: '8px',
  },
  titleText: { fontSize: '14px', fontWeight: 'bold', color: '#1e3a8a', margin: 0 },
  subtitle: { fontSize: '9px', color: '#555', margin: '2px 0 0' },
  cols: { display: 'flex', gap: '6px', alignItems: 'flex-start' },
  col: { flex: 1, minWidth: 0 },
  group: { marginBottom: '5px', border: '1px solid #9ca3af', borderRadius: '3px', overflow: 'hidden', pageBreakInside: 'avoid' },
  groupHeader: { background: '#1e3a8a', color: '#fff', padding: '2px 5px', fontWeight: 'bold', fontSize: '8px', pageBreakInside: 'avoid' },
  logRow: {
    background: '#fef9c3',
    borderBottom: '1px solid #ca8a04',
    padding: '2.5px 5px',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    fontSize: '8.5px',
    flexWrap: 'wrap',
  },
  logLabel: { color: '#78716c', fontSize: '7.5px' },
  logVal: { fontWeight: 'bold', color: '#1e3a8a' },
  logValRed: { fontWeight: 'bold', color: '#b91c1c' },
  table: { width: '100%', fontSize: '8.5px', borderCollapse: 'collapse' },
  th: { background: '#dbeafe', border: '1px solid #d1d5db', padding: '2.5px 4px', textAlign: 'right', fontSize: '7.5px', fontWeight: 'bold', color: '#1e3a8a', verticalAlign: 'middle' },
  tdEven: { border: '1px solid #e5e7eb', padding: '3px 4px', background: '#fff', fontSize: '8.5px', fontWeight: '500', color: '#1f2937', verticalAlign: 'middle' },
  tdOdd:  { border: '1px solid #e5e7eb', padding: '3px 4px', background: '#f9fafb', fontSize: '8.5px', fontWeight: '500', color: '#1f2937', verticalAlign: 'middle' },
  tdRole: { fontWeight: '700', color: '#1d4ed8' },
  tfootTd: { border: '1px solid #d1d5db', padding: '2px 4px', fontSize: '7.5px', color: '#374151', background: '#f3f4f6', fontWeight: '600' },
};

function WorkplaceCard({ group, studentsMap }) {
  const roleMap = { 'נהג': 'נהג', 'ראש צוות': 'ראש צוות', 'אחראי פק"ל': 'פק"ל' };
  const hasLog = group.vehicleName || group.exitTime || group.notes;

  return (
    <div style={S.group}>
      <div style={S.groupHeader}>{group.workplaceName}</div>
      {hasLog && (
        <div style={S.logRow}>
          {group.vehicleName && (
            <span>
              <span style={S.logLabel}>רכב: </span>
              <span style={S.logVal}>🚐 {group.vehicleName}</span>
            </span>
          )}
          {group.exitTime && (
            <span>
              <span style={S.logLabel}>יציאה: </span>
              <span style={S.logValRed}>⏰ {group.exitTime}</span>
            </span>
          )}
          {group.notes && <span style={{ fontSize: '7px', color: '#78350f' }}>📝 {group.notes}</span>}
        </div>
      )}
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>שם תלמיד</th>
            <th style={{ ...S.th, width: '45px' }}>תפקיד</th>
          </tr>
        </thead>
        <tbody>
          {group.students.map((s, i) => {
            const role = roleMap[s.role] || '';
            const cohort = studentsMap[s.student_id]?.cohort || '';
            return (
              <tr key={i}>
                <td style={i % 2 === 0 ? S.tdEven : S.tdOdd}>
                  {s.student_name}
                </td>
                <td style={{ ...(i % 2 === 0 ? S.tdEven : S.tdOdd), ...(role ? S.tdRole : {}) }}>{role}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} style={S.tfootTd}>סה"כ: {group.students.length} תלמידים</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ReportContent({ forwardRef, reportGroups, gregDate, hebrewDate, studentsMap }) {
  const leftCol = reportGroups.filter((_, i) => i % 2 === 0);
  const rightCol = reportGroups.filter((_, i) => i % 2 === 1);

  return (
    <div ref={forwardRef} style={S.wrap}>
      <div style={S.titleBox}>
        <h2 style={S.titleText}>סידור עבודה</h2>
        <p style={S.subtitle}>{gregDate} — {hebrewDate}</p>
      </div>
      <div style={S.cols}>
        <div style={S.col}>
          {leftCol.map(g => <WorkplaceCard key={g.workplaceName} group={g} studentsMap={studentsMap} />)}
        </div>
        <div style={S.col}>
          {rightCol.map(g => <WorkplaceCard key={g.workplaceName} group={g} studentsMap={studentsMap} />)}
        </div>
      </div>
    </div>
  );
}

async function generatePDFBlob(container) {
  container.style.display = 'block';
  container.style.position = 'fixed';
  container.style.top = '-9999px';
  container.style.left = '0';
  await new Promise(r => setTimeout(r, 200));

  const SCALE = 3; // high-res for crisp text
  const canvas = await html2canvas(container, { scale: SCALE, useCORS: true, backgroundColor: '#ffffff' });

  container.style.display = 'none';

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();   // 210
  const pageH = pdf.internal.pageSize.getHeight();  // 297
  const margin = 8;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;

  // How many canvas pixels fit in one PDF page (height)
  const mmPerPx = contentW / canvas.width;
  const pageHeightPx = contentH / mmPerPx;

  let srcY = 0;
  let firstPage = true;

  while (srcY < canvas.height) {
    const sliceH = Math.min(pageHeightPx, canvas.height - srcY);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceH;
    slice.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

    if (!firstPage) pdf.addPage();
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, contentW, sliceH * mmPerPx);
    firstPage = false;
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

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list('-created_date'),
  });

  const logisticsMap = {};
  const logisticsMapByName = {};
  logisticsList.forEach(l => {
    if (l.workplace_id) logisticsMap[l.workplace_id] = l;
    if (l.workplace_name) logisticsMapByName[l.workplace_name] = l;
  });

  // Map student_id → student record (for cohort lookup)
  const studentsMap = {};
  students.forEach(s => { studentsMap[s.id] = s; });

  const gregDate = new Date(date + 'T12:00:00').toLocaleDateString('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  const hebrewDate = toHebrewDate(date);
  const reportGroups = buildReportGroups(assignments, logisticsMap, logisticsMapByName, studentsMap);

  const handleExport = async () => {
    setExporting(true);
    const blob = await generatePDFBlob(hiddenRef.current);
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
    const blob = await generatePDFBlob(hiddenRef.current);
    const file = new File([blob], `schedule_${date}.pdf`, { type: 'application/pdf' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const existing = await base44.entities.PublishedSchedule.list();
    await Promise.all(existing.map(r => base44.entities.PublishedSchedule.delete(r.id)));
    await base44.entities.PublishedSchedule.create({ date, file_url });
    setPublishedOk(true);
    setPublishing(false);
  };

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

      <ReportContent forwardRef={hiddenRef} reportGroups={reportGroups} gregDate={gregDate} hebrewDate={hebrewDate} studentsMap={studentsMap} />
    </>
  );
}