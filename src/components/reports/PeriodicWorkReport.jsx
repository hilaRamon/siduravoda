import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';

const MONTHS = [
  { value: '01', label: 'ינואר' }, { value: '02', label: 'פברואר' },
  { value: '03', label: 'מרץ' }, { value: '04', label: 'אפריל' },
  { value: '05', label: 'מאי' }, { value: '06', label: 'יוני' },
  { value: '07', label: 'יולי' }, { value: '08', label: 'אוגוסט' },
  { value: '09', label: 'ספטמבר' }, { value: '10', label: 'אוקטובר' },
  { value: '11', label: 'נובמבר' }, { value: '12', label: 'דצמבר' },
];

const YEARS = ['2026', '2025'];
const SKIP_WORKPLACES = ['לא עובד', 'לימודים'];

export default function PeriodicWorkReport() {
  const [month, setMonth] = useState('04');
  const [year, setYear] = useState('2026');
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

  const { data: workplaces = [] } = useQuery({
    queryKey: ['workplaces'],
    queryFn: () => base44.entities.Workplace.list(),
  });

  const { data: allAssignments = [], isLoading } = useQuery({
    queryKey: ['assignments-all'],
    queryFn: () => base44.entities.Assignment.list(),
  });

  // Build workplace -> farm_name lookup
  const workplaceFarmMap = useMemo(() => {
    const map = {};
    workplaces.forEach(w => { map[w.id] = w.farm_name || ''; });
    return map;
  }, [workplaces]);

  // Group by farm -> rows
  const reportByFarm = useMemo(() => {
    const prefix = `${year}-${month}`;
    const filtered = allAssignments.filter(a =>
      a.date?.startsWith(prefix) && !SKIP_WORKPLACES.includes(a.workplace_name)
    );

    // Group by date + workplace
    const grouped = {};
    filtered.forEach(a => {
      const farmName = workplaceFarmMap[a.workplace_id] || '';
      const key = `${a.date}__${a.workplace_id}`;
      if (!grouped[key]) grouped[key] = {
        date: a.date,
        workplaceName: a.workplace_name,
        farmName,
        rate: a.rate || 0,
        students: [],
      };
      grouped[key].students.push(a);
    });

    // Collect rows and group by farm
    const byFarm = {};
    Object.values(grouped).forEach(g => {
      const totalHours = g.students.reduce((s, a) => s + (a.hours || 0), 0);
      const avgHours = g.students.length ? totalHours / g.students.length : 0;
      const rate = g.rate || 0;
      const row = {
        date: g.date,
        workplaceName: g.workplaceName,
        rate,
        bonus: 0,
        studentCount: g.students.length,
        totalHours: Math.round(totalHours * 10) / 10,
        avgHours: Math.round(avgHours * 10) / 10,
        totalPrice: Math.round(totalHours * rate),
      };
      const fn = g.farmName || g.workplaceName;
      if (!byFarm[fn]) byFarm[fn] = [];
      byFarm[fn].push(row);
    });

    // Sort each farm's rows by workplace name then date
    Object.values(byFarm).forEach(rows => rows.sort((a, b) => {
      const wpCmp = (a.workplaceName || '').localeCompare(b.workplaceName || '', 'he');
      if (wpCmp !== 0) return wpCmp;
      return a.date.localeCompare(b.date);
    }));

    // Return sorted by farm name
    return Object.entries(byFarm).sort(([a], [b]) => a.localeCompare(b, 'he'));
  }, [month, year, allAssignments, workplaceFarmMap]);

  const formatDate = (d) => {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  const handleExportPDF = async () => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 50));

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const colWidths = [22, 52, 16, 20, 18, 18, 22, 20]; // total ~188 fits in 210-24=186, adjust
    const headers = ['תאריך', 'מקום עבודה', 'תעריף', 'תשלום נוסף', 'תלמידים', 'סך שעות', 'ממוצע שעות', 'מחיר'];
    const rowH = 7;
    const headH = 8;

    const drawRow = (pdf, cols, y, widths, isHeader, isFooter) => {
      const totalW = widths.reduce((a, b) => a + b, 0);
      let x = pageW - margin;
      if (isHeader) {
        pdf.setFillColor(230, 230, 230);
        pdf.rect(margin, y, totalW, headH, 'F');
      } else if (isFooter) {
        pdf.setFillColor(210, 210, 210);
        pdf.rect(margin, y, totalW, rowH, 'F');
      }
      pdf.setDrawColor(180, 180, 180);
      pdf.setLineWidth(0.2);
      pdf.rect(margin, y, totalW, isHeader ? headH : rowH);

      cols.forEach((col, i) => {
        const w = widths[i];
        x -= w;
        pdf.setDrawColor(180, 180, 180);
        pdf.line(x, y, x, y + (isHeader ? headH : rowH));
        pdf.setFontSize(isHeader || isFooter ? 8 : 7.5);
        pdf.setFont('helvetica', isHeader || isFooter ? 'bold' : 'normal');
        pdf.text(String(col ?? ''), x + w / 2, y + (isHeader ? headH : rowH) / 2 + 2.5, { align: 'center', maxWidth: w - 1 });
      });
    };

    let isFirst = true;

    reportByFarm.forEach(([farm, rows]) => {
      if (!isFirst) pdf.addPage();
      isFirst = false;

      const grandTotalHours = Math.round(rows.reduce((s, r) => s + r.totalHours, 0) * 10) / 10;
      const grandTotalPrice = rows.reduce((s, r) => s + r.totalPrice, 0);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text(`לכבוד: ${farm}`, pageW - margin, 16, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.text(`דוח עבודה תקופתי — ${monthLabel} ${year}`, pageW - margin, 22, { align: 'right' });

      let y = 26;
      drawRow(pdf, headers, y, colWidths, true, false);
      y += headH;

      rows.forEach((r, i) => {
        if (y + rowH > pageH - margin) { pdf.addPage(); y = margin; }
        if (i % 2 === 1) {
          pdf.setFillColor(248, 249, 250);
          pdf.rect(margin, y, colWidths.reduce((a, b) => a + b, 0), rowH, 'F');
        }
        drawRow(pdf, [
          formatDate(r.date), r.workplaceName, r.rate, '0',
          r.studentCount, r.totalHours, r.avgHours, `${r.totalPrice} ₪`
        ], y, colWidths, false, false);
        y += rowH;
      });

      if (y + rowH > pageH - margin) { pdf.addPage(); y = margin; }
      drawRow(pdf, ['', '', '', '', 'סה"כ', grandTotalHours, '', `${grandTotalPrice} ₪`], y, colWidths, false, true);
    });

    pdf.save(`דוח_עבודה_תקופתי_${month}_${year}.pdf`);
    setExporting(false);
  };

  const monthLabel = MONTHS.find(m => m.value === month)?.label || '';
  const hasData = reportByFarm.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">חודש</label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">שנה</label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {hasData && (
          <Button onClick={handleExportPDF} disabled={exporting} size="sm">
            {exporting ? <Loader2 size={14} className="animate-spin ml-1" /> : <Download size={14} className="ml-1" />}
            הורד PDF
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}

      {!isLoading && (
        <div ref={reportRef} className="bg-white p-4 rounded-xl border border-border space-y-6" dir="rtl">
          {!hasData ? (
            <p className="text-sm text-muted-foreground py-4 text-center">אין נתונים לתקופה זו</p>
          ) : (
            reportByFarm.map(([farm, rows]) => {
              const grandTotalHours = Math.round(rows.reduce((s, r) => s + r.totalHours, 0) * 10) / 10;
              const grandTotalPrice = rows.reduce((s, r) => s + r.totalPrice, 0);
              return (
                <div key={farm}>
                  <div className="mb-2">
                    <p className="text-sm font-bold">לכבוד: {farm}</p>
                    <p className="text-xs text-gray-500">דוח עבודה תקופתי — {monthLabel} {year}</p>
                  </div>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        {['תאריך','שם מקום עבודה','תעריף','תשלום נוסף','כמות תלמידים','סך שעות','ממוצע שעות','מחיר'].map(h => (
                          <th key={h} className="border border-gray-300 px-2 py-1.5 text-right font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border border-gray-300 px-2 py-1.5">{formatDate(r.date)}</td>
                          <td className="border border-gray-300 px-2 py-1.5">{r.workplaceName}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">{r.rate}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">0</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">{r.studentCount}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">{r.totalHours}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">{r.avgHours}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">{r.totalPrice} ₪</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-200 font-bold">
                        <td colSpan={5} className="border border-gray-300 px-2 py-1.5 text-right">סה"כ</td>
                        <td className="border border-gray-300 px-2 py-1.5 text-center">{grandTotalHours}</td>
                        <td className="border border-gray-300 px-2 py-1.5"></td>
                        <td className="border border-gray-300 px-2 py-1.5 text-center">{grandTotalPrice} ₪</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}