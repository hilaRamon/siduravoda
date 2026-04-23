import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const SKIP_WORKPLACES = ['לא עובד', 'לימודים'];

export default function StudentWorkReport() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + '-01';
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [selectedStudents, setSelectedStudents] = useState([]); // array of student_id
  const [searchInput, setSearchInput] = useState('');
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

  const { data: allAssignments = [], isLoading } = useQuery({
    queryKey: ['assignments-all'],
    queryFn: () => base44.entities.Assignment.list(),
  });

  // Unique students from assignments
  const allStudents = useMemo(() => {
    const map = {};
    allAssignments.forEach(a => {
      if (a.student_id && a.student_name) map[a.student_id] = a.student_name;
    });
    return Object.entries(map)
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'he'));
  }, [allAssignments]);

  const filteredSuggestions = useMemo(() => {
    if (!searchInput.trim()) return [];
    return allStudents.filter(
      s => s.name.includes(searchInput) && !selectedStudents.includes(s.id)
    ).slice(0, 8);
  }, [searchInput, allStudents, selectedStudents]);

  const addStudent = (id) => {
    setSelectedStudents(prev => [...prev, id]);
    setSearchInput('');
  };

  const removeStudent = (id) => setSelectedStudents(prev => prev.filter(s => s !== id));

  const reportData = useMemo(() => {
    const filtered = allAssignments.filter(a =>
      !SKIP_WORKPLACES.includes(a.workplace_name) &&
      a.date >= fromDate &&
      a.date <= toDate &&
      (selectedStudents.length === 0 || selectedStudents.includes(a.student_id))
    );

    const byStudent = {};
    filtered.forEach(a => {
      if (!byStudent[a.student_id]) {
        byStudent[a.student_id] = { name: a.student_name, workplaces: {} };
      }
      const wp = a.workplace_name || '';
      byStudent[a.student_id].workplaces[wp] = (byStudent[a.student_id].workplaces[wp] || 0) + 1;
    });

    return Object.values(byStudent)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'))
      .map(s => ({
        name: s.name,
        workplaces: Object.entries(s.workplaces).sort(([a], [b]) => a.localeCompare(b, 'he')),
        totalDays: Object.values(s.workplaces).reduce((sum, d) => sum + d, 0),
      }));
  }, [allAssignments, fromDate, toDate, selectedStudents]);

  const handleExportPDF = async () => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 100));
    const el = reportRef.current;
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW - 20;
    const ratio = canvas.width / imgW;
    let srcY = 0;
    while (srcY < canvas.height) {
      const sliceH = Math.min((pageH - 20) * ratio, canvas.height - srcY);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceH;
      sliceCanvas.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      if (srcY > 0) pdf.addPage();
      pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 10, 10, imgW, sliceH / ratio);
      srcY += sliceH;
    }
    pdf.save(`דוח_עבודת_תלמיד_${fromDate}_${toDate}.pdf`);
    setExporting(false);
  };

  const studentNameById = Object.fromEntries(allStudents.map(s => [s.id, s.name]));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-start bg-card border border-border rounded-xl p-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">מתאריך</label>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">עד תאריך</label>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Student search/select */}
        <div className="flex-1 min-w-52">
          <label className="text-xs text-muted-foreground block mb-1">סינון לפי תלמיד (אפשר לבחור מספר)</label>
          <div className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="חיפוש תלמיד..."
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {filteredSuggestions.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                {filteredSuggestions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => addStudent(s.id)}
                    className="w-full text-right px-3 py-2 text-sm hover:bg-secondary transition-colors"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Selected students tags */}
          {selectedStudents.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedStudents.map(id => (
                <span key={id} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">
                  {studentNameById[id]}
                  <button onClick={() => removeStudent(id)} className="hover:text-destructive">
                    <X size={11} />
                  </button>
                </span>
              ))}
              <button onClick={() => setSelectedStudents([])} className="text-xs text-muted-foreground underline px-1">
                נקה הכל
              </button>
            </div>
          )}
        </div>

        <div className="flex items-end gap-3">
          {reportData.length > 0 && (
            <span className="text-sm text-muted-foreground pb-2">{reportData.length} תלמידים</span>
          )}
          <Button onClick={handleExportPDF} disabled={exporting || reportData.length === 0} variant="outline">
            {exporting ? <Loader2 size={15} className="animate-spin ml-1" /> : <Download size={15} className="ml-1" />}
            {exporting ? 'מייצא...' : 'הורד PDF'}
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
      {!isLoading && reportData.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">אין נתונים לתקופה זו</p>
      )}

      {!isLoading && reportData.length > 0 && (
        <div ref={reportRef} className="bg-white rounded-xl border border-border overflow-hidden" dir="rtl">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
            דוח עבודת תלמיד | {fromDate} — {toDate}
          </div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-right font-semibold">שם תלמיד</th>
                <th className="border border-gray-300 px-3 py-2 text-right font-semibold">מקום עבודה</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-24">כמות ימים</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-24">סה"כ ימים</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((student, si) =>
                student.workplaces.map(([wpName, days], wi) => (
                  <tr key={`${si}-${wi}`} className={si % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {wi === 0 && (
                      <td rowSpan={student.workplaces.length} className="border border-gray-300 px-3 py-2 font-medium align-top">
                        {student.name}
                      </td>
                    )}
                    <td className="border border-gray-300 px-3 py-2">{wpName}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center">{days}</td>
                    {wi === 0 && (
                      <td rowSpan={student.workplaces.length} className="border border-gray-300 px-3 py-2 text-center font-bold align-middle">
                        {student.totalDays}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}