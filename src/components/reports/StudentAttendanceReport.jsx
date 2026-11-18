import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, isRegularUser } from '@/lib/permissions';
import { useFarms } from '@/queries/farmQueries';
import { reportKeys } from '@/queries/reports/keys';
import { useStudentAttendanceReport } from '@/queries/reports/useStudentAttendanceReport';
import { useWorkplaces } from '@/queries/reports/useWorkplaces';
import StudentReportFilters, { useStudentReportSelection } from '@/components/reports/StudentReportFilters';
import { exportReportElementPdf } from '@/components/reports/exportReportPdf';

/**
 * @typedef {import('@/api/reportApi').AttendanceBuckets} AttendanceBuckets
 * @typedef {import('@/api/reportApi').StudentAttendanceRow} StudentAttendanceRow
 * @typedef {'didNotLeave' | 'didNotWork' | 'studies'} AttendanceColumnKey
 * @typedef {{ id: string, name: string, farm_id?: string }} WorkplaceRecord
 */

/** @type {Array<{ key: AttendanceColumnKey, field: string, label: string }>} */
const COLUMNS = [
  { key: 'didNotLeave', field: 'attendance_did_not_leave', label: 'לא יצא לעבודה' },
  { key: 'didNotWork', field: 'attendance_did_not_work', label: 'לא עבד' },
  { key: 'studies', field: 'attendance_studies', label: 'לימודים' },
];

const NO_CHARGE_FARM = 'ללא חיוב';
const NOT_ASSIGNED_WORKPLACE = 'אאא- לפני שיבוץ';
const DELETED_WORKPLACE_LABEL = 'מקום עבודה שנמחק';

/** @type {AttendanceBuckets} */
const EMPTY_BUCKETS = { didNotLeave: [], didNotWork: [], studies: [] };

/**
 * @param {object} props
 * @param {number} props.worked
 * @param {number} props.absent
 * @param {number} props.studies
 */
function DayBar({ worked, absent, studies }) {
  const total = worked + absent + studies;
  if (!total) return null;
  const parts = [
    { key: 'absent', count: absent, className: 'bg-rose-500' },
    { key: 'studies', count: studies, className: 'bg-amber-400' },
    { key: 'worked', count: worked, className: 'bg-emerald-500' },
  ];
  return (
    <div
      dir="ltr"
      className="flex h-3 w-40 overflow-hidden rounded-full bg-gray-200"
      title={`לא עבד ${absent} · לימודים ${studies} · עבד ${worked}`}
    >
      {parts.map((part) => part.count > 0 && (
        <div
          key={part.key}
          className={part.className}
          style={{ width: `${(part.count / total) * 100}%`, minWidth: 4 }}
        />
      ))}
    </div>
  );
}

/**
 * @param {object} props
 * @param {AttendanceColumnKey | null} props.openKey
 * @param {AttendanceBuckets} props.draft
 * @param {Array<{ id: string, name: string }>} props.options
 * @param {boolean} props.optionsLoading
 * @param {boolean} props.saving
 * @param {string} props.saveError
 * @param {(id: string) => void} props.onToggle
 * @param {() => void | Promise<void>} props.onSave
 * @param {() => void} props.onClose
 */
function AttendanceBucketDialog({
  openKey,
  draft,
  options,
  optionsLoading,
  saving,
  saveError,
  onToggle,
  onSave,
  onClose,
}) {
  const column = COLUMNS.find((item) => item.key === openKey);
  return (
    <Dialog open={!!openKey} onOpenChange={(/** @type {boolean} */ open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle>{column?.label}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          מקומות העבודה שנכללים בעמודה. הרשימה מציגה מקומות ממשק {NO_CHARGE_FARM}.
        </p>
        {optionsLoading ? (
          <p className="text-sm text-muted-foreground">טוען...</p>
        ) : options.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין מקומות עבודה במשק {NO_CHARGE_FARM}</p>
        ) : (
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {options.map((option) => {
              const checked = openKey ? draft[openKey].includes(option.id) : false;
              return (
                <div
                  key={option.id}
                  role="checkbox"
                  aria-checked={checked}
                  tabIndex={0}
                  onClick={() => onToggle(option.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onToggle(option.id);
                    }
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-sm cursor-pointer hover:bg-secondary"
                >
                  <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none" />
                  <span>{option.name}</span>
                </div>
              );
            })}
          </div>
        )}
        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        <DialogFooter className="gap-2 sm:justify-start">
          <Button onClick={onSave} disabled={saving || !openKey}>
            {saving ? 'שומר...' : 'שמור'}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function StudentAttendanceReport() {
  const filters = useStudentReportSelection();
  const { user } = useAuth();
  const canEdit = isAdmin(user) || isRegularUser(user);
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [openKey, setOpenKey] = useState(/** @type {AttendanceColumnKey | null} */ (null));
  const [draft, setDraft] = useState(EMPTY_BUCKETS);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const reportRef = useRef(null);

  const { data, isLoading, isError } = useStudentAttendanceReport({
    startDate: filters.fromDate,
    endDate: filters.toDate,
    students: filters.selectedStudents.length > 0 ? filters.selectedStudents : undefined,
  });

  const workplacesQuery = useWorkplaces();
  const farmsQuery = useFarms({ enabled: canEdit });
  const reportData = /** @type {StudentAttendanceRow[]} */ (data?.students ?? []);
  const buckets = /** @type {AttendanceBuckets} */ (data?.buckets ?? EMPTY_BUCKETS);
  const workplaces = /** @type {WorkplaceRecord[]} */ (workplacesQuery.workplaces ?? []);
  const farms = /** @type {WorkplaceRecord[]} */ (farmsQuery.data ?? []);

  const noChargeOptions = useMemo(() => {
    const farmIds = new Set(
      farms
        .filter((farm) => farm.name === NO_CHARGE_FARM)
        .map((farm) => farm.id),
    );
    return workplaces
      .filter((workplace) => workplace.farm_id && farmIds.has(workplace.farm_id) && workplace.id && workplace.name && workplace.name !== NOT_ASSIGNED_WORKPLACE)
      .map((workplace) => ({ id: workplace.id, name: workplace.name }));
  }, [farms, workplaces]);

  const workplaceNameById = useMemo(() => {
    /** @type {Record<string, string>} */
    const names = {};
    for (const workplace of workplaces) {
      if (workplace.id) names[workplace.id] = workplace.name || workplace.id;
    }
    return names;
  }, [workplaces]);

  const dialogOptions = useMemo(() => {
    if (!openKey) return [];
    const offeredIds = new Set(noChargeOptions.map((option) => option.id));
    const extras = (draft[openKey] ?? [])
      .filter((id) => !offeredIds.has(id))
      .map((id) => ({ id, name: workplaceNameById[id] || DELETED_WORKPLACE_LABEL }));
    return [...noChargeOptions, ...extras].sort((a, b) => a.name.localeCompare(b.name, 'he'));
  }, [openKey, draft, noChargeOptions, workplaceNameById]);

  /** @param {AttendanceColumnKey} key */
  const openColumn = (key) => {
    setDraft({
      didNotLeave: [...(buckets.didNotLeave ?? [])],
      didNotWork: [...(buckets.didNotWork ?? [])],
      studies: [...(buckets.studies ?? [])],
    });
    setSaveError('');
    setOpenKey(key);
  };

  /** @param {string} id */
  const toggleWorkplace = (id) => {
    if (!openKey) return;
    const columnKey = openKey;
    setDraft((prev) => {
      const selected = prev[columnKey].includes(id);
      const next = {
        didNotLeave: prev.didNotLeave.filter((item) => item !== id),
        didNotWork: prev.didNotWork.filter((item) => item !== id),
        studies: prev.studies.filter((item) => item !== id),
      };
      if (!selected) next[columnKey] = [...next[columnKey], id];
      return next;
    });
  };

  const saveBuckets = async () => {
    setSaving(true);
    setSaveError('');
    const payload = {
      attendance_did_not_leave: draft.didNotLeave,
      attendance_did_not_work: draft.didNotWork,
      attendance_studies: draft.studies,
    };
    try {
      if (data?.settingsId) {
        await base44.entities.AppSettings.update(data.settingsId, payload);
      } else {
        await base44.entities.AppSettings.create(payload);
      }
      await queryClient.invalidateQueries({ queryKey: reportKeys.all });
      setOpenKey(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'השמירה נכשלה');
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    await new Promise((r) => setTimeout(r, 100));
    const label = filters.selectedCohort && filters.selectedCohort !== 'all'
      ? `מחזור_${filters.selectedCohort}`
      : `${filters.fromDate}_${filters.toDate}`;
    try {
      await exportReportElementPdf(
        reportRef.current,
        `דוח_נוכחות_תלמידים_${label}.pdf`,
        { orientation: 'landscape' },
      );
    } finally {
      setExporting(false);
    }
  };

  const periodLabel = filters.selectedCohort && filters.selectedCohort !== 'all'
    ? `מחזור ${filters.selectedCohort}`
    : `${filters.fromDate} — ${filters.toDate}`;

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

      {canEdit && (
        <p className="text-xs text-muted-foreground">
          לחיצה על כותרת עמודה מציגה את מקומות העבודה שנכללים בה ומאפשרת לשנות אותם.
        </p>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
      {isError && <p className="text-sm text-destructive">לא ניתן לטעון את הדוח</p>}

      {!isLoading && !isError && (
        <div ref={reportRef} className="bg-white rounded-xl border border-border overflow-hidden" dir="rtl">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
            דוח נוכחות תלמידים | {periodLabel}
          </div>
          <div className="flex flex-wrap gap-4 px-4 py-2 text-xs text-gray-600">
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />עבד</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-500" />לא עבד (כולל לא יצא לעבודה)</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" />לימודים</span>
          </div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-right font-semibold">שם תלמיד</th>
                {COLUMNS.map((column) => (
                  <th key={column.key} className="border border-gray-300 px-3 py-2 text-center font-semibold">
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => openColumn(column.key)}
                        className="font-semibold underline-offset-2 hover:underline"
                      >
                        {column.label}
                      </button>
                    ) : column.label}
                  </th>
                ))}
                <th
                  className="border border-gray-300 px-3 py-2 text-center font-semibold"
                  title="אחוז ימי לא יצא לעבודה ולא עבד מתוך הימים עם שיבוץ. לימודים נשארים במכנה."
                >
                  אחוז לא עבד
                </th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-44">ימים</th>
              </tr>
            </thead>
            <tbody>
              {reportData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border border-gray-300 px-3 py-8 text-center text-muted-foreground">
                    אין נתונים לתקופה זו
                  </td>
                </tr>
              ) : reportData.map((student, index) => (
                <tr key={student.studentId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-300 px-3 py-2 font-medium">{student.name}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">{student.didNotLeave}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">{student.didNotWork}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">{student.studies}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center font-bold">{student.absentPercent}%</td>
                  <td className="border border-gray-300 px-3 py-2">
                    <div className="flex justify-center">
                      <DayBar
                        worked={student.worked}
                        absent={student.didNotLeave + student.didNotWork}
                        studies={student.studies}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && (
        <AttendanceBucketDialog
          openKey={openKey}
          draft={draft}
          options={dialogOptions}
          optionsLoading={workplacesQuery.isLoading || farmsQuery.isLoading}
          saving={saving}
          saveError={saveError}
          onToggle={toggleWorkplace}
          onSave={saveBuckets}
          onClose={() => { if (!saving) setOpenKey(null); }}
        />
      )}
    </div>
  );
}
