import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Share2 } from 'lucide-react';
import jsPDF from 'jspdf';

function toHebrewDate(dateStr) {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
      day: 'numeric', month: 'long', year: 'numeric'
    }).format(d);
  } catch { return ''; }
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

  return Object.values(byWorkplace)
    .sort((a, b) => a.name.localeCompare(b.name, 'he'))
    .map(g => {
      const log = logisticsMap[g.id] || {};
      const vehicles = [log.vehicle_name, log.vehicle_name_2, log.vehicle_name_3].filter(Boolean).join(' + ');
      return {
        workplaceName: g.name,
        students: g.students.sort((a, b) => (a.student_name || '').localeCompare(b.student_name || '', 'he')),
        vehicleName: vehicles || '',
        exitTime: log.exit_time || '',
        notes: log.notes || '',
      };
    });
}

// Mirror Hebrew text for jsPDF RTL rendering
function rev(str) {
  return String(str || '').split('').reverse().join('');
}

function generatePDF(reportGroups, gregDate, hebrewDate) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Page dimensions
  const pageW = 210;
  const pageH = 297;
  const margin = 8;
  const colGap = 4;
  const colW = (pageW - margin * 2 - colGap) / 2;

  // Fonts & sizes
  const FONT = 'helvetica';
  const SZ_TITLE = 13;
  const SZ_HEADER = 7;    // workplace header
  const SZ_LOGISTICS = 6; // vehicle/time row
  const SZ_TABLE = 5.5;   // student rows
  const SZ_TOTAL = 5;

  const ROW_H = 4.5;      // student row height
  const HEADER_H = 5.5;   // workplace name bar
  const LOG_H = 5;        // logistics bar
  const TOTAL_H = 4;      // totals footer
  const TH_H = 4.5;       // table header row

  // Draw title once
  let titleH = 0;
  const drawTitle = () => {
    const titleY = margin;
    doc.setFont(FONT, 'bold');
    doc.setFontSize(SZ_TITLE);
    doc.setTextColor(30, 58, 138);
    doc.text(rev('סידור עבודה'), pageW / 2, titleY + 4, { align: 'center' });
    doc.setFont(FONT, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text(rev(`${gregDate} — ${hebrewDate}`), pageW / 2, titleY + 8, { align: 'center' });
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(0.4);
    doc.line(margin, titleY + 10, pageW - margin, titleY + 10);
    titleH = 13;
  };

  // Measure a group's total height
  const groupHeight = (g) => {
    const hasLogistics = g.vehicleName || g.exitTime || g.notes;
    return HEADER_H + (hasLogistics ? LOG_H : 0) + TH_H + g.students.length * ROW_H + TOTAL_H;
  };

  // Draw one group at (x, y), returns height used
  const drawGroup = (g, x, y, w) => {
    const hasLogistics = g.vehicleName || g.exitTime || g.notes;
    let curY = y;

    // Workplace header bar
    doc.setFillColor(30, 58, 138);
    doc.rect(x, curY, w, HEADER_H, 'F');
    doc.setFont(FONT, 'bold');
    doc.setFontSize(SZ_HEADER);
    doc.setTextColor(255, 255, 255);
    doc.text(rev(g.workplaceName), x + w - 2, curY + HEADER_H - 1.5, { align: 'right' });
    curY += HEADER_H;

    // Logistics bar
    if (hasLogistics) {
      doc.setFillColor(254, 249, 195);
      doc.rect(x, curY, w, LOG_H, 'F');
      doc.setDrawColor(202, 138, 4);
      doc.setLineWidth(0.3);
      doc.line(x, curY + LOG_H, x + w, curY + LOG_H);

      doc.setFont(FONT, 'normal');
      doc.setFontSize(SZ_LOGISTICS);
      doc.setTextColor(30, 58, 138);

      let lx = x + w - 2;
      if (g.vehicleName) {
        const txt = rev('רכב: ' + g.vehicleName);
        doc.setFont(FONT, 'bold');
        doc.text(txt, lx, curY + LOG_H - 1.5, { align: 'right' });
        lx -= doc.getTextWidth(txt) + 4;
      }
      if (g.exitTime) {
        doc.setTextColor(185, 28, 28);
        const txt = rev('יציאה: ' + g.exitTime);
        doc.setFont(FONT, 'bold');
        doc.text(txt, lx, curY + LOG_H - 1.5, { align: 'right' });
        lx -= doc.getTextWidth(txt) + 4;
      }
      if (g.notes) {
        doc.setTextColor(120, 53, 15);
        doc.setFont(FONT, 'normal');
        doc.text(rev(g.notes), lx, curY + LOG_H - 1.5, { align: 'right' });
      }
      curY += LOG_H;
    }

    // Table header
    doc.setFillColor(219, 234, 254);
    doc.rect(x, curY, w, TH_H, 'F');
    doc.setFont(FONT, 'bold');
    doc.setFontSize(SZ_TABLE);
    doc.setTextColor(30, 58, 138);
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.2);
    const roleColW = 22;
    doc.rect(x, curY, w, TH_H, 'S');
    doc.line(x + roleColW, curY, x + roleColW, curY + TH_H);
    doc.text(rev('שם תלמיד'), x + w - 2, curY + TH_H - 1.2, { align: 'right' });
    doc.text(rev('תפקיד'), x + roleColW - 1, curY + TH_H - 1.2, { align: 'right' });
    curY += TH_H;

    // Student rows
    doc.setFont(FONT, 'normal');
    g.students.forEach((s, i) => {
      const bg = i % 2 === 0 ? [255, 255, 255] : [249, 250, 251];
      doc.setFillColor(...bg);
      doc.rect(x, curY, w, ROW_H, 'F');
      doc.setDrawColor(229, 231, 235);
      doc.rect(x, curY, w, ROW_H, 'S');
      doc.line(x + roleColW, curY, x + roleColW, curY + ROW_H);

      doc.setFontSize(SZ_TABLE);
      doc.setTextColor(30, 30, 30);
      doc.text(rev(s.student_name || ''), x + w - 2, curY + ROW_H - 1.2, { align: 'right' });

      const roleMap = { 'נהג': 'נהג', 'ראש צוות': 'ראש צוות', 'אחראי פק"ל': 'פק"ל' };
      const roleLabel = roleMap[s.role] || '';
      if (roleLabel) {
        doc.setFont(FONT, 'bold');
        doc.setTextColor(29, 78, 216);
        doc.text(rev(roleLabel), x + roleColW - 1, curY + ROW_H - 1.2, { align: 'right' });
        doc.setFont(FONT, 'normal');
        doc.setTextColor(30, 30, 30);
      }
      curY += ROW_H;
    });

    // Totals footer
    doc.setFillColor(243, 244, 246);
    doc.rect(x, curY, w, TOTAL_H, 'F');
    doc.setDrawColor(209, 213, 219);
    doc.rect(x, curY, w, TOTAL_H, 'S');
    doc.setFont(FONT, 'normal');
    doc.setFontSize(SZ_TOTAL);
    doc.setTextColor(107, 114, 128);
    doc.text(rev(`סה"כ: ${g.students.length} תלמידים`), x + w - 2, curY + TOTAL_H - 1, { align: 'right' });
    curY += TOTAL_H;

    return curY - y;
  };

  // Layout: two columns, fill left then right greedily per page
  let page = 0;
  const newPage = () => {
    if (page > 0) doc.addPage();
    drawTitle();
    page++;
  };

  newPage();

  const contentTop = margin + titleH;
  const contentH = pageH - margin - contentTop;

  // Assign groups to columns using a two-pass greedy approach
  // We want to fill two columns per page
  const groups = reportGroups;
  let i = 0;

  while (i < groups.length) {
    // Left column: fill as many as fit
    const leftGroups = [];
    let leftUsed = 0;
    let j = i;
    while (j < groups.length) {
      const h = groupHeight(groups[j]) + 3; // 3mm gap
      if (leftUsed + h > contentH && leftGroups.length > 0) break;
      leftGroups.push(groups[j]);
      leftUsed += h;
      j++;
    }

    // Right column: fill as many as fit
    const rightGroups = [];
    let rightUsed = 0;
    let k = j;
    while (k < groups.length) {
      const h = groupHeight(groups[k]) + 3;
      if (rightUsed + h > contentH && rightGroups.length > 0) break;
      rightGroups.push(groups[k]);
      rightUsed += h;
      k++;
    }

    // Draw left column (RTL: left in PDF = right side visually = first col)
    const leftX = margin + colW + colGap;
    const rightX = margin;
    let ly = contentTop;
    leftGroups.forEach(g => {
      const h = drawGroup(g, leftX, ly, colW);
      ly += h + 3;
    });

    let ry = contentTop;
    rightGroups.forEach(g => {
      const h = drawGroup(g, rightX, ry, colW);
      ry += h + 3;
    });

    i = k;
    if (i < groups.length) newPage();
  }

  return doc;
}

export default function DailyReportPDFButton({ date, assignments }) {
  const [exporting, setExporting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedOk, setPublishedOk] = useState(false);

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
    const doc = generatePDF(reportGroups, gregDate, hebrewDate);
    doc.save(`סידור_עבודה_יומי_${date}.pdf`);
    setExporting(false);
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPublishedOk(false);
    const doc = generatePDF(reportGroups, gregDate, hebrewDate);
    const blob = doc.output('blob');
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
    </>
  );
}