import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Loader2, FileSpreadsheet, ChevronsUpDown, X } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { useWorkByWorkplaceReport } from '@/queries/reports/useWorkByWorkplaceReport';

export default function PeriodWorkReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedWorkplaces, setSelectedWorkplaces] = useState([]);
  const [wpOpen, setWpOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const reportRef = useRef(null);

  const { data, isLoading } = useWorkByWorkplaceReport({
    startDate,
    endDate,
    workplaces: selectedWorkplaces.length > 0 ? selectedWorkplaces : undefined,
  });

  const groups = data?.groups ?? [];
  const workplaceOptions = data?.workplaceOptions ?? []; // workplaces in range (from report API)

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
    groups.forEach((group) => {
      const wp = group.workplaceName;
      group.rows.forEach((r) => rows.push({
        'מקום עבודה': wp,
        'תאריך': formatDate(r.date),
        'תעריף': r.rate,
        'תשלום נוסף': r.bonus,
        'כמות תלמידים': r.studentCount,
        'סך שעות': r.totalHours,
        'ממוצע שעות': r.avgHours,
        'מחיר': r.totalPrice,
      }));
      rows.push({
        'מקום עבודה': '',
        'תאריך': 'סה"כ',
        'תעריף': '',
        'תשלום נוסף': group.totals.bonus,
        'כמות תלמידים': '',
        'סך שעות': group.totals.totalHours,
        'ממוצע שעות': '',
        'מחיר': group.totals.totalPrice,
      });
      rows.push({});
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'דוח לתקופה');
    XLSX.writeFile(wb, `דוח_עבודה_לתקופה_${startDate}_${endDate}.xlsx`);
    setExportingXlsx(false);
  };

  const hasData = groups.length > 0;
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
          <label className="text-xs text-muted-foreground block mb-1">מקום עבודה (ניתן לבחור מרובים)</label>
          <Popover open={wpOpen} onOpenChange={setWpOpen}>
            <PopoverTrigger asChild>
              <button className="h-9 w-56 border border-border rounded-md px-3 text-sm flex items-center justify-between bg-card hover:bg-secondary/40 transition-colors">
                <span className={`truncate ${selectedWorkplaces.length === 0 ? 'text-muted-foreground' : ''}`}>
                  {selectedWorkplaces.length === 0 ? 'כל מקומות העבודה' : selectedWorkplaces.length === 1 ? selectedWorkplaces[0] : `${selectedWorkplaces.length} נבחרו`}
                </span>
                <ChevronsUpDown size={14} className="opacity-50 shrink-0 mr-1" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start" dir="rtl">
              <Command>
                <CommandInput placeholder="חיפוש מקום עבודה..." className="h-8 text-xs" />
                <CommandList>
                  <CommandEmpty>לא נמצא</CommandEmpty>
                  <CommandGroup>
                    <CommandItem value="__all__" onSelect={() => setSelectedWorkplaces([])} className="text-xs text-muted-foreground flex items-center gap-2">
                      <Checkbox checked={selectedWorkplaces.length === 0} className="shrink-0" />
                      כל מקומות העבודה
                    </CommandItem>
                    {workplaceOptions.map(w => (
                      <CommandItem key={w} value={w} onSelect={() => setSelectedWorkplaces(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w])} className="text-xs flex items-center gap-2">
                        <Checkbox checked={selectedWorkplaces.includes(w)} className="shrink-0" />
                        {w}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedWorkplaces.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {selectedWorkplaces.map(w => (
                <span key={w} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                  {w}
                  <button onClick={() => setSelectedWorkplaces(prev => prev.filter(x => x !== w))} className="hover:text-destructive"><X size={10} /></button>
                </span>
              ))}
              <button onClick={() => setSelectedWorkplaces([])} className="text-xs text-muted-foreground underline px-1">נקה</button>
            </div>
          )}
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
            groups.map((group) => {
              const wp = group.workplaceName;
              const rows = group.rows;
              return (
                <div key={wp}>
                  <div className="mb-2">
                    <p className="text-sm font-bold">לכבוד: {wp}</p>
                    <p className="text-xs text-gray-500">דוח עבודה לתקופה — {formatDate(startDate)} עד {formatDate(endDate)}</p>
                  </div>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        {['תאריך', 'תעריף', 'תשלום נוסף', 'כמות תלמידים', 'סך שעות', 'ממוצע שעות', 'מחיר'].map(h => (
                          <th key={h} className="border border-gray-300 px-2 py-1.5 text-right font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border border-gray-300 px-2 py-1.5">{formatDate(r.date)}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">{r.rate}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">{r.bonus}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">{r.studentCount}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">{r.totalHours}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">{r.avgHours}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">{r.totalPrice} ₪</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-200 font-bold">
                        <td colSpan={2} className="border border-gray-300 px-2 py-1.5 text-right">סה"כ</td>
                        <td className="border border-gray-300 px-2 py-1.5 text-center">{group.totals.bonus}</td>
                        <td className="border border-gray-300 px-2 py-1.5"></td>
                        <td className="border border-gray-300 px-2 py-1.5 text-center">{group.totals.totalHours}</td>
                        <td className="border border-gray-300 px-2 py-1.5"></td>
                        <td className="border border-gray-300 px-2 py-1.5 text-center">{group.totals.totalPrice} ₪</td>
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
