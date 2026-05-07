import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const SKIP_WORKPLACES = ['לא עובד', 'לימודים'];

export default function StudentWorkReport() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + '-01';
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

  const { data: allAssignments = [], isLoading } = useQuery({
    queryKey: ['assignments-all'],
    queryFn: () => base44.entities.Assignment.list(),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list(),
  });

  const cohorts = useMemo(() => {
    const s = new Set(students.map(s => s.cohort).filter(Boolean));
    return [...s].sort();
  }, [students]);

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

  const studentNameById = Object.fromEntries(allStudents.map(s => [s.id, s.name]));

  // When cohort selected, auto-fill selectedStudents with that cohort's students
  const handleCohortChange = (cohort) => {
    setSelectedCohort(cohort);
    if (cohort && cohort !== 'all') {
      const cohortStudentIds = students
        .filter(s => s.cohort === cohort)
        .map(s => s.id)
        .filter(id => allStudents.some(a => a.id === id));
      setSelectedStudents(cohortStudentIds);
    } else {
      setSelectedStudents([]);
    }
  };

  const filteredSuggestions = useMemo(() => {
    if (!searchInput.trim()) return [];
    return allStudents.filter(
      s => s.name.includes(searchInput) && !selectedStudents.includes(s.id)
    ).slice(0, 8);
  }, [searchInput, allStudents, selectedStudents]);

  const addStudent = (id) => {
    setSelectedStudents(prev => [...prev, id]);
    setSearchInput('');
    setSelectedCohort('');
  };

  const removeStudent = (id) => {
    setSelectedStudents(prev => prev.filter(s => s !== id));
    setSelectedCohort('');
  };

  const reportData = useMemo(() => {
    // Deduplicate by (student_id, date) — a student can only work one day per date
    const seen = new Set();
    const deduped = allAssignments.filter(a => {
      const key = `${a.student_id}__${a.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const filtered = deduped.filter(a =>
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
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentW = pageW - margin * 2;
    const contentH = pageH - margin * 2;

    // Scale 1.5 = good quality without huge file size
    const SCALE = 1.5;
    const canvas = await html2canvas(el, {
      scale: SCALE,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const pxPerMM = canvas.width / contentW;
    const pageHeightPx = contentH * pxPerMM;

    // Find safe cut points between student rows (avoid cutting in the middle of a rowspan)
    // We cut only at page boundaries — no smart row detection needed for this table layout
    let srcY = 0;
    let firstPage = true;
    while (srcY < canvas.height) {
      const sliceH = Math.min(pageHeightPx, canvas.height - srcY);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceH;
      slice.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      if (!firstPage) pdf.addPage();
      // JPEG at quality 0.88 keeps text crisp and reduces file size significantly vs PNG
      pdf.addImage(slice.toDataURL('image/jpeg', 0.88), 'JPEG', margin, margin, contentW, sliceH / pxPerMM);
      srcY += sliceH;
      firstPage = false;
    }

    const label = selectedCohort && selectedCohort !== 'all' ? `מחזור_${selectedCohort}` : `${fromDate}_${toDate}`;
    pdf.save(`דוח_עבודת_תלמיד_${label}.pdf`);
    setExporting(false);
  };

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

        {/* Cohort filter */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">מחזור</label>
          <Select value={selectedCohort} onValueChange={handleCohortChange}>
            <SelectTrigger className="w-36 h-10 text-sm">
              <SelectValue placeholder="כל המחזורים" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל המחזורים</SelectItem>
              {cohorts.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
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
          {selectedStudents.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedStudents.map(id => (
                <span key={id} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">
                  {studentNameById[id] || id}
                  <button onClick={() => removeStudent(id)} className="hover:text-destructive">
                    <X size={11} />
                  </button>
                </span>
              ))}
              <button onClick={() => { setSelectedStudents([]); setSelectedCohort(''); }} className="text-xs text-muted-foreground underline px-1">
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
            דוח עבודת תלמיד
            {selectedCohort && selectedCohort !== 'all' ? ` | מחזור ${selectedCohort}` : ` | ${fromDate} — ${toDate}`}
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