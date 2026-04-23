import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
    await new Promise(r => setTimeout(r, 100));
    const el = reportRef.current;
    // Each farm section is a direct child div
    const farmSections = Array.from(el.children);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW - 20;

    for (let i = 0; i < farmSections.length; i++) {
      const section = farmSections[i];
      const canvas = await html2canvas(section, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const ratio = canvas.width / imgW;
      let srcY = 0;
      let firstSlice = true;
      while (srcY < canvas.height) {
        const sliceH = Math.min((pageH - 20) * ratio, canvas.height - srcY);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceH;
        sliceCanvas.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        if (i > 0 || !firstSlice) pdf.addPage();
        pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 10, 10, imgW, sliceH / ratio);
        srcY += sliceH;
        firstSlice = false;
      }
    }

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