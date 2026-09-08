import { useState, useMemo, useEffect } from "react";
import LogisticsSidebar from "@/components/assignments/LogisticsSidebar";
import AssignmentsHeader from "@/components/assignments/AssignmentsHeader";
import AssignmentsDateNav from "@/components/assignments/AssignmentsDateNav";
import AssignmentsBulkToolbar from "@/components/assignments/AssignmentsBulkToolbar";
import AssignmentsTable from "@/components/assignments/AssignmentsTable";
import {
  AddGuestDialog,
  BulkEditDialog,
  CloneDialog,
  CohortSelectDialog,
} from "@/components/assignments/AssignmentDialogs";
import { format } from "date-fns";
import { useAppSettings } from "@/queries/useAppSettings";
import {
  useAbsenceRequests,
  useRejectAbsence,
} from "@/queries/absenceQueries";
import { assignmentApi } from "@/api/assignmentApi";
import {
  assignmentKeys,
  useAssignments,
  useAssignStudent,
  useBulkUpsertAssignments,
  useCloneDayAssignments,
  useCreateAssignment,
  useDeleteAssignment,
} from "@/queries/assignmentQueries";
import { useOptimisticListItemUpdate } from "@/hooks/useOptimisticListItemUpdate";
import { useStudents } from "@/queries/studentQueries";
import { useWorkplaces } from "@/queries/workplaceQueries";
import { useRoles } from "@/queries/roleQueries";
import { useFarmerRequestsByDate } from "@/queries/farmerRequestQueries";
import {
  getAssignmentDefaults,
  getDisplayRate,
  isDailyPricing,
  normalizeAppSettings,
  parseDisplayRateInput,
} from "@/lib/pricing";
import {
  NOT_WORKING_WORKPLACE_NAME,
  PRE_ASSIGNMENT_WORKPLACE_NAME,
  REQUEST_FULFILLED_SNACKBAR_MS,
  assignmentWorkNumber,
  assignmentsByStudentId,
  buildBulkAssignmentOps,
  countStudentsAtWorkplace,
  getRequestedVolunteers,
  warnIfNoAgreement,
} from "@/lib/assignmentHelpers";
import { showAlert } from "@/components/AppAlert";

export default function Assignments() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [cloning, setCloning] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [cloneTargetDate, setCloneTargetDate] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterCohort, setFilterCohort] = useState("");
  const [filterWorkplace, setFilterWorkplace] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterAssigned, setFilterAssigned] = useState("");

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [lastSelectedIdx, setLastSelectedIdx] = useState(null);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkWorkplace, setBulkWorkplace] = useState("");
  const [bulkHours, setBulkHours] = useState("");
  const [bulkRate, setBulkRate] = useState("");
  const [bulkWorkplaceOpen, setBulkWorkplaceOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  const [showAddGuestDialog, setShowAddGuestDialog] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [showCohortSelectDialog, setShowCohortSelectDialog] = useState(false);
  const [cohortDialogSelected, setCohortDialogSelected] = useState([]);
  const [snackbar, setSnackbar] = useState(null);

  const { data: appSettings = normalizeAppSettings() } = useAppSettings();
  const assignmentDefaults = getAssignmentDefaults(appSettings);
  const dailyMode = isDailyPricing(appSettings);
  const rateColumnLabel = dailyMode ? "תעריף יומי" : "תעריף";

  const formatRateDisplay = (hourlyRate) =>
    getDisplayRate(hourlyRate, appSettings);
  const parseRateInput = (displayRate) =>
    parseDisplayRateInput(displayRate, appSettings);

  const { data: assignments = [] } = useAssignments(date);
  const { students } = useStudents();
  const { data: workplaces = [] } = useWorkplaces();
  const { data: roles = [] } = useRoles();
  const { data: farmerRequests = [] } = useFarmerRequestsByDate(date);
  const { data: approvedAbsences = [] } = useAbsenceRequests({
    startDate: date,
    endDate: date,
    status: "אושר",
  });

  const createMutation = useCreateAssignment();
  const updateAssignmentItem = useOptimisticListItemUpdate({
    queryKey: assignmentKeys.byDate(date),
    updateFn: (id, patch) => assignmentApi.update(id, patch),
  });
  const deleteMutation = useDeleteAssignment();
  const assignMutation = useAssignStudent();
  const rejectAbsence = useRejectAbsence();
  const bulkUpsertMutation = useBulkUpsertAssignments();
  const cloneDayMutation = useCloneDayAssignments();

  useEffect(() => {
    if (!snackbar) return;
    const timer = setTimeout(
      () => setSnackbar(null),
      REQUEST_FULFILLED_SNACKBAR_MS,
    );
    return () => clearTimeout(timer);
  }, [snackbar]);

  const notifyIfRequestFulfilled = (
    workplaceId,
    workplaceName,
    prevCount,
    nextCount,
  ) => {
    const requested = getRequestedVolunteers(farmerRequests, workplaceId);
    if (requested == null) return;
    if (prevCount >= requested || nextCount < requested) return;
    const message =
      nextCount > requested
        ? `השיבוץ ל${workplaceName} עבר את הבקשה (${nextCount} משובצים מתוך ${requested})`
        : `השיבוץ ל${workplaceName} הושלם לפי הבקשה (${requested} מתנדבים)`;
    setSnackbar(message);
  };

  const absentByStudentId = useMemo(() => {
    const map = {};
    approvedAbsences.forEach((a) => {
      if (a.student_id) map[a.student_id] = a;
    });
    return map;
  }, [approvedAbsences]);

  const offerRejectAbsence = async (student, absenceRequest) => {
    let confirmed = false;
    await showAlert(
      `ל${student.full_name} יש היעדרות מאושרת בתאריך זה. לא ניתן לשבץ. האם לבטל את בקשת ההיעדרות?`,
      {
        onConfirm: () => {
          confirmed = true;
        },
        onCancel: () => {
          confirmed = false;
        },
      },
    );
    if (!confirmed) return false;
    await rejectAbsence.mutateAsync(absenceRequest.id);
    return true;
  };

  const assignmentsByStudent = useMemo(
    () => assignmentsByStudentId(assignments),
    [assignments],
  );

  const primaryByStudent = useMemo(() => {
    const map = {};
    Object.entries(assignmentsByStudent).forEach(([id, list]) => {
      map[id] = list.find((a) => assignmentWorkNumber(a) === 1) || list[0];
    });
    return map;
  }, [assignmentsByStudent]);

  const cohorts = useMemo(
    () => [...new Set(students.map((s) => s.cohort).filter(Boolean))],
    [students],
  );

  const guestAssignments = useMemo(
    () => assignments.filter((a) => a.student_id?.startsWith("guest_")),
    [assignments],
  );

  const cloneableAssignments = useMemo(() => {
    const studentById = Object.fromEntries(students.map((s) => [s.id, s]));
    return Object.values(primaryByStudent).filter((a) => {
      if (a.student_id?.startsWith("guest_")) return false;
      return studentById[a.student_id]?.is_active !== false;
    });
  }, [primaryByStudent, students]);

  const filteredStudents = useMemo(
    () =>
      students
        .filter((s) => {
          const list = assignmentsByStudent[s.id] || [];
          const hasAssignment = list.length > 0;
          if (s.is_active === false && !hasAssignment) return false;
          if (!hasAssignment && s.created_date && s.created_date.slice(0, 10) > date)
            return false;
          if (filterName && !s.full_name?.includes(filterName)) return false;
          if (
            filterCohort &&
            filterCohort !== "all" &&
            s.cohort !== filterCohort
          )
            return false;
          if (filterWorkplace && filterWorkplace !== "all") {
            if (!list.some((row) => row.workplace_id === filterWorkplace)) {
              return false;
            }
          }
          if (filterRole && filterRole !== "all") {
            if (!list.some((row) => row.role === filterRole)) return false;
          }
          if (filterAssigned === "assigned" && !hasAssignment) return false;
          if (filterAssigned === "unassigned" && hasAssignment) return false;
          return true;
        })
        .sort((a, b) => {
          const aAssign = primaryByStudent[a.id];
          const bAssign = primaryByStudent[b.id];
          const aWp = aAssign?.workplace_name || "";
          const bWp = bAssign?.workplace_name || "";
          if (aWp !== bWp) return aWp.localeCompare(bWp, "he");
          const aCohort = a.cohort || "";
          const bCohort = b.cohort || "";
          if (aCohort !== bCohort) return aCohort.localeCompare(bCohort, "he");
          return (a.full_name || "").localeCompare(b.full_name || "", "he");
        }),
    [
      students,
      assignmentsByStudent,
      primaryByStudent,
      date,
      filterName,
      filterCohort,
      filterWorkplace,
      filterRole,
      filterAssigned,
    ],
  );

  const tableRows = useMemo(() => {
    const rows = [];
    filteredStudents.forEach((student) => {
      const list = assignmentsByStudent[student.id] || [];
      if (list.length === 0) {
        rows.push({
          key: student.id,
          student,
          assignment: null,
          selectKey: student.id,
        });
        return;
      }
      list
        .filter((a) => {
          if (
            filterWorkplace &&
            filterWorkplace !== "all" &&
            a.workplace_id !== filterWorkplace
          ) {
            return false;
          }
          if (filterRole && filterRole !== "all" && a.role !== filterRole) {
            return false;
          }
          return true;
        })
        .forEach((assignment) => {
          rows.push({
            key: assignment.id,
            student,
            assignment,
            selectKey: assignment.id,
          });
        });
    });
    return rows;
  }, [filteredStudents, assignmentsByStudent, filterWorkplace, filterRole]);

  const allVisibleSelected =
    tableRows.length > 0 &&
    tableRows.every((row) => selectedIds.has(row.selectKey));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tableRows.map((row) => row.selectKey)));
    }
  };

  const toggleSelect = (selectKey, rowIdx, shiftKey) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedIdx !== null) {
        const from = Math.min(lastSelectedIdx, rowIdx);
        const to = Math.max(lastSelectedIdx, rowIdx);
        for (let i = from; i <= to; i++) {
          const row = tableRows[i];
          if (row) next.add(row.selectKey);
        }
      } else if (next.has(selectKey)) {
        next.delete(selectKey);
      } else {
        next.add(selectKey);
      }
      return next;
    });
    setLastSelectedIdx(rowIdx);
  };

  const handleAssign = async (student, workplace, assignment) => {
    const absence = absentByStudentId[student.id];
    if (absence && workplace.name !== NOT_WORKING_WORKPLACE_NAME) {
      await offerRejectAbsence(student, absence);
      return false;
    }

    if (student.forbidden_workplaces?.includes(workplace.id)) {
      await showAlert(
        `לא ניתן לשבץ את ${student.full_name} ל-${workplace.name} — זה מקום עבודה אסור`,
      );
      return false;
    }

    const canAssign = await warnIfNoAgreement(date, workplace);
    if (!canAssign) return false;

    await assignMutation.mutateAsync({
      date,
      student,
      workplace,
      assignment,
      assignments,
      defaults: assignmentDefaults,
    });

    const prevCount = countStudentsAtWorkplace(assignments, workplace.id);
    const nextAssignments = assignment
      ? assignments.map((a) =>
          a.id === assignment.id
            ? {
                ...a,
                workplace_id: workplace.id,
                workplace_name: workplace.name,
              }
            : a,
        )
      : [
          ...assignments,
          {
            student_id: student.id,
            workplace_id: workplace.id,
            work_number: 1,
          },
        ];
    const nextCount = countStudentsAtWorkplace(nextAssignments, workplace.id);
    notifyIfRequestFulfilled(
      workplace.id,
      workplace.name,
      prevCount,
      nextCount,
    );

    return true;
  };

  const handleRemove = async (id) => {
    const assignment = assignments.find((a) => a.id === id);
    const absence =
      assignment?.student_id && absentByStudentId[assignment.student_id];
    if (absence) {
      const student = students.find((s) => s.id === assignment.student_id) || {
        full_name: assignment.student_name || "התלמיד",
      };
      await offerRejectAbsence(student, absence);
      return;
    }
    await deleteMutation.mutateAsync({ id, date });
  };

  const handleUpdateRole = (assignment, roleName) => {
    updateAssignmentItem(assignment.id, {
      role: roleName === "none" ? "" : roleName,
    });
  };

  const handleUpdateField = (assignment, field, value) => {
    updateAssignmentItem(assignment.id, { [field]: value });
  };

  const handleBulkSave = async () => {
    if (bulkSaving) return;
    const wp = bulkWorkplace
      ? workplaces.find((w) => w.id === bulkWorkplace)
      : null;
    const hasChanges = wp || bulkHours !== "" || bulkRate !== "";
    if (!hasChanges) {
      setShowBulkDialog(false);
      return;
    }

    const canAssign = await warnIfNoAgreement(date, wp);
    if (!canAssign) return;

    const { toCreate, toUpdate, skippedAbsent } = buildBulkAssignmentOps({
      selectedIds,
      assignments,
      students,
      absentByStudentId,
      wp,
      bulkHours,
      bulkRate,
      date,
      defaults: assignmentDefaults,
      dailyMode,
      parseRateInput,
    });

    if (skippedAbsent > 0 && toCreate.length === 0 && toUpdate.length === 0) {
      await showAlert(
        `${skippedAbsent} תלמידים עם היעדרות מאושרת דולגו. יש לבטל את ההיעדרות לפני שיבוץ.`,
      );
      return;
    }

    setBulkSaving(true);
    setBulkProgress(0);
    try {
      await bulkUpsertMutation.mutateAsync({
        date,
        toCreate,
        toUpdate,
        onProgress: setBulkProgress,
      });

      if (wp) {
        const prevCount = countStudentsAtWorkplace(assignments, wp.id);
        const updatedById = Object.fromEntries(
          toUpdate.map(({ id, fullRecord }) => [id, fullRecord]),
        );
        const nextList = [
          ...assignments.map((a) =>
            updatedById[a.id] ? { ...a, ...updatedById[a.id] } : a,
          ),
          ...toCreate,
        ];
        const nextCount = countStudentsAtWorkplace(nextList, wp.id);
        notifyIfRequestFulfilled(wp.id, wp.name, prevCount, nextCount);
      }

      setSelectedIds(new Set());
      setShowBulkDialog(false);
      setBulkWorkplace("");
      setBulkHours("");
      setBulkRate("");
      setBulkProgress(0);
      if (skippedAbsent > 0) {
        await showAlert(
          `${skippedAbsent} תלמידים עם היעדרות מאושרת דולגו. יש לבטל את ההיעדרות לפני שיבוץ.`,
        );
      }
    } finally {
      setBulkSaving(false);
    }
  };

  const handleAddGuest = async () => {
    if (!guestName.trim()) return;
    const guestId = `guest_${Date.now()}`;
    const defaultGuestWp = workplaces.find(
      (w) => w.name === PRE_ASSIGNMENT_WORKPLACE_NAME,
    );
    await createMutation.mutateAsync({
      date,
      student_id: guestId,
      student_name: guestName.trim(),
      workplace_id: defaultGuestWp?.id ?? "",
      workplace_name: defaultGuestWp?.name ?? PRE_ASSIGNMENT_WORKPLACE_NAME,
      work_number: 1,
      rate: assignmentDefaults.rate,
      hours: assignmentDefaults.hours,
    });
    setGuestName("");
    setShowAddGuestDialog(false);
  };

  const handleCloneDay = async () => {
    if (!cloneTargetDate) return;
    setCloning(true);
    try {
      await cloneDayMutation.mutateAsync({
        sourceDate: date,
        targetDate: cloneTargetDate,
      });
    } catch (error) {
      await showAlert(`שגיאה בשכפול: ${error.message || "נסה שוב"}`);
    } finally {
      setCloning(false);
      setShowCloneDialog(false);
      setCloneTargetDate("");
    }
  };

  return (
    <div className="p-8 flex gap-6 items-start min-h-full">
      <div className="flex-1 min-w-0">
        <AssignmentsHeader
          date={date}
          assignments={assignments}
          students={students}
          onOpenCohortSelect={() => {
            setCohortDialogSelected([]);
            setShowCohortSelectDialog(true);
          }}
          onOpenAddGuest={() => setShowAddGuestDialog(true)}
          onOpenClone={(targetDate) => {
            setCloneTargetDate(targetDate);
            setShowCloneDialog(true);
          }}
        />

        <AssignmentsDateNav date={date} onDateChange={setDate} />

        <AssignmentsBulkToolbar
          selectedCount={selectedIds.size}
          onEdit={() => setShowBulkDialog(true)}
          onClear={() => setSelectedIds(new Set())}
        />

        <CohortSelectDialog
          open={showCohortSelectDialog}
          onOpenChange={setShowCohortSelectDialog}
          cohorts={cohorts}
          selected={cohortDialogSelected}
          onSelectedChange={setCohortDialogSelected}
          filteredStudents={filteredStudents}
          assignmentsByStudent={assignmentsByStudent}
          onConfirm={setSelectedIds}
        />

        <AddGuestDialog
          open={showAddGuestDialog}
          onOpenChange={setShowAddGuestDialog}
          date={date}
          guestName={guestName}
          onGuestNameChange={setGuestName}
          onAdd={handleAddGuest}
        />

        <CloneDialog
          open={showCloneDialog}
          onOpenChange={(v) => {
            setShowCloneDialog(v);
            if (!v) setCloning(false);
          }}
          cloneableCount={cloneableAssignments.length}
          date={date}
          cloneTargetDate={cloneTargetDate}
          onCloneTargetDateChange={setCloneTargetDate}
          cloning={cloning}
          onClone={handleCloneDay}
        />

        <BulkEditDialog
          open={showBulkDialog}
          onOpenChange={setShowBulkDialog}
          selectedCount={selectedIds.size}
          workplaces={workplaces}
          bulkWorkplace={bulkWorkplace}
          onBulkWorkplaceChange={setBulkWorkplace}
          bulkWorkplaceOpen={bulkWorkplaceOpen}
          onBulkWorkplaceOpenChange={setBulkWorkplaceOpen}
          bulkHours={bulkHours}
          onBulkHoursChange={setBulkHours}
          bulkRate={bulkRate}
          onBulkRateChange={setBulkRate}
          rateColumnLabel={rateColumnLabel}
          bulkSaving={bulkSaving}
          bulkProgress={bulkProgress}
          onSave={handleBulkSave}
        />

        <AssignmentsTable
          tableRows={tableRows}
          guestAssignments={guestAssignments}
          students={students}
          cohorts={cohorts}
          workplaces={workplaces}
          roles={roles}
          assignments={assignments}
          assignmentDefaults={assignmentDefaults}
          selectedIds={selectedIds}
          allVisibleSelected={allVisibleSelected}
          filterName={filterName}
          filterCohort={filterCohort}
          filterWorkplace={filterWorkplace}
          filterRole={filterRole}
          filterAssigned={filterAssigned}
          rateColumnLabel={rateColumnLabel}
          dailyMode={dailyMode}
          formatRateDisplay={formatRateDisplay}
          parseRateInput={parseRateInput}
          onFilterNameChange={setFilterName}
          onFilterCohortChange={setFilterCohort}
          onFilterWorkplaceChange={setFilterWorkplace}
          onFilterRoleChange={setFilterRole}
          onFilterAssignedChange={setFilterAssigned}
          onToggleSelectAll={toggleSelectAll}
          onToggleSelect={toggleSelect}
          onAssign={handleAssign}
          onRemove={handleRemove}
          onUpdateRole={handleUpdateRole}
          onUpdateField={handleUpdateField}
        />
      </div>
      <LogisticsSidebar date={date} assignments={assignments} />
      {snackbar && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-card border border-border shadow-lg rounded-xl px-4 py-3 text-sm font-medium max-w-md text-center">
          {snackbar}
        </div>
      )}
    </div>
  );
}
