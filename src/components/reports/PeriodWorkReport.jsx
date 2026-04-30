import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronsUpDown } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

const SKIP_WORKPLACES = ['לא עובד', 'לימודים'];

export default function PeriodWorkReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedWorkplace, setSelectedWorkplace] = useState('');
  const [wpOpen, setWpOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const reportRef = useRef(null);

  const { data: allAssignments = [], isLoading } = useQuery({
    queryKey: ['assignments-all'],
    queryFn: () => base44.entities.Assignment.list(),
  });

  // Unique workplace names from assignments in range (or all if no range yet)
  const workplaceNames = useMemo(() => {
    const names = new Set(
      allAssignments
        .filter(a => !SKIP_WORKPLACES.includes(a.workplace_name) && a.workplace_name)
        .map(a => a.workplace_name)
    );
    return [...names].sort((a, b) => a.localeCompare(b, 'he'));
  }, [allAssignments]);

  // Group by workplace, then by date within each workplace
  const reportByWorkplace = useMemo(() => {
    if (!startDate || !endDate) return [];

    const filtered = allAssignments.filter(a =>
      a.date >= startDate && a.date <= endDate &&
      !SKIP_WORKPLACES.includes(a.workplace_name)
    );

    // Group by date+workplace
    const grouped = {};
    filtered.forEach(a => {
      const key = `${a.workplace_name}__${a.date}`;
      if (!grouped[key]) grouped[key] = { date: a.date, workplaceName: a.workplace_name, rate: a.rate || 0, students: [] };
      grouped[key].students.push(a);
    });

    // Aggregate rows per workplace
    const byWorkplace = {};
    Object.values(grouped).forEach(g => {
      const totalHours = g.students.reduce((s, a) => s + (a.hours || 0), 0);
      const avgHours = g.students.length ? totalHours / g.students.length : 0;
      const rate = g.rate || 0;
      const row = {
        date: g.date,
        workplaceName: g.workplaceName,
        rate,
        studentCount: g.students.length,
        totalHours: Math.round(totalHours * 10) / 10,
        avgHours: Math.round(avgHours * 10) / 10,
        totalPrice: Math.round(totalHours * rate),
      };
      if (!byWorkplace[g.workplaceName]) byWorkplace[g.workplaceName] = [];
      byWorkplace[g.workplaceName].push(row);
    });

    // Sort rows within each workplace by date
    Object.values(byWorkplace).forEach(rows => rows.sort((a, b) => a.date.localeCompare(b.date)));

    return Object.entries(byWorkplace)
      .filter(([wp]) => !selectedWorkplace || wp === selectedWorkplace)
      .sort(([a], [b]) => a.localeCompare(b, 'he'));
  }, [startDate, endDate, allAssignments, selectedWorkplace]);

  const formatDate = (d) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };

  const handleExportPDF = async () => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 100));
    const el = reportRef.current;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const printW = pageW - margin * 2;
    const maxImgH = pageH - margin * 2;
    const sections = Array.from(el.children);
    let firstPage = true;
    for (const section of sections) {
      const canvas = await html2canvas(section, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' });
      const pxPerMM = canvas.width / printW;
      const pageHeightPx = maxImgH * pxPerMM;
      let srcY = 0;
      while (srcY < canvas.height) {
        const sliceH = Math.min(pageHeightPx, canvas.height - srcY);
        const slice = document.createElement('canvas');
        slice.width = canvas.width; slice.height = sliceH;
        slice.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        if (!firstPage) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/jpeg', 0.88), 'JPEG', margin, margin, printW, sliceH / pxPerMM);
        srcY += sliceH; firstPage = false;
      }
    }
    pdf.save(`דוח_עבודה_לתקופה_${startDate}_${endDate}.pdf`);
    setExporting(false);
  };

  const handleExportXLSX = () => {
    setExportingXlsx(true);
    const rows = [];
    reportByWorkplace.forEach(([wp, wpRows]) => {
      const grandTotalHours = Math.round(wpRows.reduce((s, r) => s + r.totalHours, 0) * 10) / 10;
      const grandTotalPrice = wpRows.reduce((s, r) => s + r.totalPrice, 0);
      wpRows.forEach(r => rows.push({
        'מקום עבודה': wp,
        'תאריך': formatDate(r.date),
        'תעריף': r.rate,
        'כמות תלמידים': r.studentCount,
        'סך שעות': r.totalHours,
        'ממוצע שעות': r.avgHours,
        'מחיר': r.totalPrice,
      }));
      rows.push({ 'מקום עבודה': '', 'תאריך': 'סה"כ', 'תעריף': '', 'כמות תלמידים': '', 'סך שעות': grandTotalHours, 'ממוצע שעות': '', 'מחיר': grandTotalPrice });
      rows.push({});
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'דוח לתקופה');
    XLSX.writeFile(wb, `דוח_עבודה_לתקופה_${startDate}_${endDate}.xlsx`);
    setExportingXlsx(false);
  };

  const hasData = reportByWorkplace.length > 0;
  const canSearch = startDate && endDate;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">תאריך התחלה</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 h-9" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">תאריך סוף</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 h-9" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">מקום עבודה</label>
          <Popover open={wpOpen} onOpenChange={setWpOpen}>
            <PopoverTrigger asChild>
              <button className="h-9 w-52 border border-border rounded-md px-3 text-sm flex items-center justify-between bg-card hover:bg-secondary/40 transition-colors">
                <span className={selectedWorkplace ? '' : 'text-muted-foreground'}>{selectedWorkplace || 'כל מקומות העבודה'}</span>
                <ChevronsUpDown size={14} className="opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-0" align="start">
              <Command>
                <CommandInput placeholder="חיפוש מקום עבודה..." className="h-8 text-xs" />
                <CommandList>
                  <CommandEmpty>לא נמצא</CommandEmpty>
                  <CommandGroup>
                    <CommandItem value="__all__" onSelect={() => { setSelectedWorkplace(''); setWpOpen(false); }} className="text-xs text-muted-foreground">כל מקומות העבודה</CommandItem>
                    {workplaceNames.map(w => (
                      <CommandItem key={w} value={w} onSelect={() => { setSelectedWorkplace(w); setWpOpen(false); }} className="text-xs">{w}</CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        {hasData && (
          <>
            <Button onClick={handleExportPDF} disabled={exporting} size="sm">
              {exporting ? <Loader2 size={14} className="animate-spin ml-1" /> : <Download size={14} className="ml-1" />}
              הורד PDF
            </Button>
            <Button onClick={handleExportXLSX} disabled={exportingXlsx} size="sm" style={{ backgroundColor: '#166534', color: 'white' }} className="hover:opacity-90">
              {exportingXlsx ? <Loader2 size={14} className="animate-spin ml-1" /> : <FileSpreadsheet size={14} className="ml-1" />}
              הורד Excel
            </Button>
          </>
        )}
      </div>

      {!canSearch && <p className="text-sm text-muted-foreground">בחר תאריך התחלה וסוף להצגת הדוח</p>}
      {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}

      {canSearch && !isLoading && (
        <div ref={reportRef} className="bg-white p-4 rounded-xl border border-border space-y-6" dir="rtl">
          {!hasData ? (
            <p className="text-sm text-muted-foreground py-4 text-center">אין נתונים לתקופה זו</p>
          ) : (
            reportByWorkplace.map(([wp, rows]) => {
              const grandTotalHours = Math.round(rows.reduce((s, r) => s + r.totalHours, 0) * 10) / 10;
              const grandTotalPrice = rows.reduce((s, r) => s + r.totalPrice, 0);
              return (
                <div key={wp}>
                  <div className="mb-2">
                    <p className="text-sm font-bold">לכבוד: {wp}</p>
                    <p className="text-xs text-gray-500">דוח עבודה לתקופה — {formatDate(startDate)} עד {formatDate(endDate)}</p>
                  </div>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        {['תאריך','תעריף','כמות תלמידים','סך שעות','ממוצע שעות','מחיר'].map(h => (
                          <th key={h} className="border border-gray-300 px-2 py-1.5 text-right font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border border-gray-300 px-2 py-1.5">{formatDate(r.date)}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">{r.rate}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">{r.studentCount}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">{r.totalHours}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">{r.avgHours}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">{r.totalPrice} ₪</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-200 font-bold">
                        <td colSpan={3} className="border border-gray-300 px-2 py-1.5 text-right">סה"כ</td>
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