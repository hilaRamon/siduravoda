import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, FileSpreadsheet } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import * as XLSX from 'xlsx';
import { useArzenuReport } from '@/queries/reports/useArzenuReport';

// Default range = the full previous calendar month relative to today.
function previousMonthRange() {
  const prev = subMonths(new Date(), 1);
  return {
    start: format(startOfMonth(prev), 'yyyy-MM-dd'),
    end: format(endOfMonth(prev), 'yyyy-MM-dd'),
  };
}

export default function ArzenuReport() {
  const defaults = useMemo(previousMonthRange, []);
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useArzenuReport({ startDate, endDate });
  const rows = data?.rows ?? [];

  const formatDate = (d) => {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  const handleExportXLSX = () => {
    setExporting(true);
    try {
      const sheetData = rows.map((r) => ({
        'תאריך': formatDate(r.date),
        'שם': r.name,
        'מקום עבודה': r.workplace,
      }));
      const ws = XLSX.utils.json_to_sheet(sheetData, {
        header: ['תאריך', 'שם', 'מקום עבודה'],
      });
      ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 28 }];

      const wb = XLSX.utils.book_new();
      // Right-to-left worksheet so Hebrew opens correctly in Excel.
      wb.Workbook = { Views: [{ RTL: true }] };
      XLSX.utils.book_append_sheet(wb, ws, 'דוח לארצנו');
      XLSX.writeFile(wb, `דוח_לארצנו_${startDate}_${endDate}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  const hasData = rows.length > 0;
  const canSearch = startDate && endDate;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">תאריך התחלה</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 h-9"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">תאריך סוף</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 h-9"
          />
        </div>
        {hasData && (
          <Button
            onClick={handleExportXLSX}
            disabled={exporting}
            size="sm"
            style={{ backgroundColor: '#166534', color: 'white' }}
            className="hover:opacity-90"
          >
            {exporting ? (
              <Loader2 size={14} className="animate-spin ml-1" />
            ) : (
              <FileSpreadsheet size={14} className="ml-1" />
            )}
            הורד Excel
          </Button>
        )}
      </div>

      {!canSearch && (
        <p className="text-sm text-muted-foreground">בחר תאריך התחלה וסוף להצגת הדוח</p>
      )}
      {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}

      {canSearch && !isLoading && (
        <div className="bg-white p-4 rounded-xl border border-border" dir="rtl">
          {!hasData ? (
            <p className="text-sm text-muted-foreground py-4 text-center">אין נתונים לתקופה זו</p>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-2">
                דוח לארצנו — {formatDate(startDate)} עד {formatDate(endDate)} ({rows.length} שורות)
              </p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    {['תאריך', 'שם', 'מקום עבודה'].map((h) => (
                      <th key={h} className="border border-gray-300 px-2 py-1.5 text-right font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-2 py-1.5 whitespace-nowrap">{formatDate(r.date)}</td>
                      <td className="border border-gray-300 px-2 py-1.5">{r.name}</td>
                      <td className="border border-gray-300 px-2 py-1.5">{r.workplace}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
