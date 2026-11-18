import { useState, useRef } from 'react';
import { useStudentWorkReport } from '@/queries/reports/useStudentWorkReport';
import StudentReportFilters, { useStudentReportSelection } from '@/components/reports/StudentReportFilters';
import { exportReportElementPdf } from '@/components/reports/exportReportPdf';

/** @typedef {import('@/api/reportApi').StudentWorkRow} StudentWorkRow */

export default function StudentWorkReport() {
  const filters = useStudentReportSelection();
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

  const { data, isLoading } = useStudentWorkReport({
    startDate: filters.fromDate,
    endDate: filters.toDate,
    students: filters.selectedStudents.length > 0 ? filters.selectedStudents : undefined,
  });
  // Report API uses work_number 1 only — extra same-day workplaces are omitted here

  const reportData = /** @type {StudentWorkRow[]} */ (data?.students ?? []);

  const handleExportPDF = async () => {
    setExporting(true);
    await new Promise((r) => setTimeout(r, 100));
    const label = filters.selectedCohort && filters.selectedCohort !== 'all'
      ? `מחזור_${filters.selectedCohort}`
      : `${filters.fromDate}_${filters.toDate}`;
    try {
      await exportReportElementPdf(reportRef.current, `דוח_עבודת_תלמיד_${label}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <StudentReportFilters
        fromDate={filters.fromDate}
        onFromDateChange={filters.setFromDate}
        toDate={filters.toDate}
        onToDateChange={filters.setToDate}
        cohorts={filters.cohorts}
        selectedCohort={filters.selectedCohort}
        onCohortChange={filters.handleCohortChange}
        searchInput={filters.searchInput}
        onSearchInputChange={filters.setSearchInput}
        suggestions={filters.filteredSuggestions}
        onAddStudent={filters.addStudent}
        selectedStudents={filters.selectedStudents}
        studentNameById={filters.studentNameById}
        onRemoveStudent={filters.removeStudent}
        onClearStudents={filters.clearStudents}
        studentCount={reportData.length}
        onExport={handleExportPDF}
        exporting={exporting}
      />

      {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
      {!isLoading && reportData.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">אין נתונים לתקופה זו</p>
      )}

      {!isLoading && reportData.length > 0 && (
        <div ref={reportRef} className="bg-white rounded-xl border border-border overflow-hidden" dir="rtl">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
            דוח עבודת תלמיד
            {filters.selectedCohort && filters.selectedCohort !== 'all' ? ` | מחזור ${filters.selectedCohort}` : ` | ${filters.fromDate} — ${filters.toDate}`}
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
                student.workplaces.map((wp, wi) => (
                  <tr key={`${si}-${wi}`} className={si % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-300 px-3 py-2 font-medium">
                      {wi === 0 ? student.name : ''}
                    </td>
                    <td className="border border-gray-300 px-3 py-2">{wp.workplaceName}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center">{wp.days}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center font-bold">
                      {wi === 0 ? student.totalDays : ''}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
