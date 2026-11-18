import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Download, Loader2 } from 'lucide-react';
import { useStudents } from '@/queries/studentQueries';

/**
 * @typedef {object} ReportStudent
 * @property {string} id
 * @property {string} [full_name]
 * @property {string} [cohort]
 */

/**
 * @typedef {object} StudentOption
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {object} StudentReportFiltersProps
 * @property {string} fromDate
 * @property {(value: string) => void} onFromDateChange
 * @property {string} toDate
 * @property {(value: string) => void} onToDateChange
 * @property {string[]} cohorts
 * @property {string} selectedCohort
 * @property {(cohort: string) => void} onCohortChange
 * @property {string} searchInput
 * @property {(value: string) => void} onSearchInputChange
 * @property {StudentOption[]} suggestions
 * @property {(id: string) => void} onAddStudent
 * @property {string[]} selectedStudents
 * @property {Record<string, string>} studentNameById
 * @property {(id: string) => void} onRemoveStudent
 * @property {() => void} onClearStudents
 * @property {number} studentCount
 * @property {() => void | Promise<void>} onExport
 * @property {boolean} exporting
 */

export function useStudentReportSelection() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + '-01';
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [selectedStudents, setSelectedStudents] = useState(/** @type {string[]} */ ([]));
  const [selectedCohort, setSelectedCohort] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const studentDirectory = useStudents();
  const students = /** @type {ReportStudent[]} */ (studentDirectory.students);
  const cohorts = /** @type {string[]} */ (studentDirectory.cohorts);
  const studentOptions = /** @type {StudentOption[]} */ (studentDirectory.studentOptions);
  const studentNameById = /** @type {Record<string, string>} */ (studentDirectory.studentNameById);

  /** @param {string} cohort */
  const handleCohortChange = (cohort) => {
    setSelectedCohort(cohort);
    if (cohort && cohort !== 'all') {
      const cohortStudentIds = students
        .filter((s) => s.cohort === cohort)
        .map((s) => s.id);
      setSelectedStudents(cohortStudentIds);
    } else {
      setSelectedStudents([]);
    }
  };

  const filteredSuggestions = useMemo(() => {
    if (!searchInput.trim()) return [];
    return studentOptions.filter(
      (s) => s.name.includes(searchInput) && !selectedStudents.includes(s.id),
    ).slice(0, 8);
  }, [searchInput, studentOptions, selectedStudents]);

  /** @param {string} id */
  const addStudent = (id) => {
    setSelectedStudents((prev) => [...prev, id]);
    setSearchInput('');
    setSelectedCohort('');
  };

  /** @param {string} id */
  const removeStudent = (id) => {
    setSelectedStudents((prev) => prev.filter((s) => s !== id));
    setSelectedCohort('');
  };

  const clearStudents = () => {
    setSelectedStudents([]);
    setSelectedCohort('');
  };

  return {
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    selectedStudents,
    selectedCohort,
    searchInput,
    setSearchInput,
    cohorts,
    studentNameById,
    filteredSuggestions,
    handleCohortChange,
    addStudent,
    removeStudent,
    clearStudents,
  };
}

/** @param {StudentReportFiltersProps} props */
export default function StudentReportFilters({
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  cohorts,
  selectedCohort,
  onCohortChange,
  searchInput,
  onSearchInputChange,
  suggestions,
  onAddStudent,
  selectedStudents,
  studentNameById,
  onRemoveStudent,
  onClearStudents,
  studentCount,
  onExport,
  exporting,
}) {
  return (
    <div className="flex flex-wrap gap-4 items-start bg-card border border-border rounded-xl p-4">
      <div>
        <label className="text-xs text-muted-foreground block mb-1">מתאריך</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => onFromDateChange(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">עד תאריך</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => onToDateChange(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">מחזור</label>
        <Select value={selectedCohort} onValueChange={onCohortChange}>
          <SelectTrigger className="w-36 h-10 text-sm">
            <SelectValue placeholder="כל המחזורים" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל המחזורים</SelectItem>
            {cohorts.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 min-w-52">
        <label className="text-xs text-muted-foreground block mb-1">סינון לפי תלמיד (אפשר לבחור מספר)</label>
        <div className="relative">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            placeholder="חיפוש תלמיד..."
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {suggestions.length > 0 && (
            <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onAddStudent(s.id)}
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
            {selectedStudents.map((id) => (
              <span key={id} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">
                {studentNameById[id] || id}
                <button onClick={() => onRemoveStudent(id)} className="hover:text-destructive">
                  <X size={11} />
                </button>
              </span>
            ))}
            <button
              onClick={onClearStudents}
              className="text-xs text-muted-foreground underline px-1"
            >
              נקה הכל
            </button>
          </div>
        )}
      </div>

      <div className="flex items-end gap-3">
        {studentCount > 0 && (
          <span className="text-sm text-muted-foreground pb-2">{studentCount} תלמידים</span>
        )}
        <Button onClick={onExport} disabled={exporting || studentCount === 0} variant="outline">
          {exporting ? <Loader2 size={15} className="animate-spin ml-1" /> : <Download size={15} className="ml-1" />}
          {exporting ? 'מייצא...' : 'הורד PDF'}
        </Button>
      </div>
    </div>
  );
}
