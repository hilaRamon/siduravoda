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
import {
  useAssignments,
  useAssignStudent,
  useBulkUpsertAssignments,
  useCloneDayAssignments,
  useCreateAssignment,
  useDeleteAssignment,
  useUpdateAssignment,
} from "@/queries/assignmentQueries";
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
  buildBulkAssignmentOps,
  countStudentsAtWorkplace,
  dedupeLatestAssignments,
  getRequestedVolunteers,
  warnIfNoAgreement,
} from "@/lib/assignmentHelpers";
import { showAlert } from "@/components/AppAlert";

export default function Assignments() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [cloning, setCloning] = useState(false);
  const [cloneProgress, setCloneProgress] = useState(0);
  const [cloneStep, setCloneStep] = useState("");
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
  const updateMutation = useUpdateAssignment();
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

  const assignmentByStudent = useMemo(() => {
    const map = {};
    assignments.forEach((a) => {
      const existing = map[a.student_id];
      if (
        !existing ||
        (a.updated_date || a.created_date) >
          (existing.updated_date || existing.created_date)
      ) {
        map[a.student_id] = a;
      }
    });
    return map;
  }, [assignments]);

  const cohorts = useMemo(
    () => [...new Set(students.map((s) => s.cohort).filter(Boolean))],
    [students],
  );

  const guestAssignments = useMemo(
    () => assignments.filter((a) => a.student_id?.startsWith("guest_")),
    [assignments],
  );

  const filteredStudents = useMemo(
    () =>
      students
        .filter((s) => {
          const a = assignmentByStudent[s.id];
          if (s.is_active === false && !a) return false;
          if (!a && s.created_date && s.created_date.slice(0, 10) > date)
            return false;
          if (filterName && !s.full_name?.includes(filterName)) return false;
          if (
            filterCohort &&
            filterCohort !== "all" &&
            s.cohort !== filterCohort
          )
            return false;
          if (filterWorkplace && filterWorkplace !== "all") {
            if (!a || a.workplace_id !== filterWorkplace) return false;
          }
          if (filterRole && filterRole !== "all") {
            if (!a || a.role !== filterRole) return false;
          }
          if (filterAssigned === "assigned" && !a) return false;
          if (filterAssigned === "unassigned" && a) return false;
          return true;
        })
        .sort((a, b) => {
          const aAssign = assignmentByStudent[a.id];
          const bAssign = assignmentByStudent[b.id];
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
      assignmentByStudent,
      date,
      filterName,
      filterCohort,
      filterWorkplace,
      filterRole,
      filterAssigned,
    ],
  );

  const allVisibleSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) =>
      selectedIds.has(assignmentByStudent[s.id]?.id || s.id),
    );

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(
        new Set(
          filteredStudents.map((s) => assignmentByStudent[s.id]?.id || s.id),
        ),
      );
    }
  };

  const toggleSelect = (studentId, rowIdx, shiftKey) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedIdx !== null) {
        const from = Math.min(lastSelectedIdx, rowIdx);
        const to = Math.max(lastSelectedIdx, rowIdx);
        for (let i = from; i <= to; i++) {
          const s = filteredStudents[i];
          if (s) next.add(assignmentByStudent[s.id]?.id || s.id);
        }
      } else {
        if (next.has(studentId)) next.delete(studentId);
        else next.add(studentId);
      }
      return next;
    });
    setLastSelectedIdx(rowIdx);
  };

  const handleAssign = async (student, workplace) => {
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
      assignments,
      defaults: assignmentDefaults,
    });

    const prevCount = countStudentsAtWorkplace(assignments, workplace.id);
    const currentForStudent = dedupeLatestAssignments(assignments).find(
      (a) => a.student_id === student.id,
    );
    const nextCount =
      currentForStudent?.workplace_id === workplace.id
        ? prevCount
        : prevCount + 1;
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

  const handleUpdateRole = async (assignment, roleName) => {
    await updateMutation.mutateAsync({
      id: assignment.id,
      data: { role: roleName === "none" ? "" : roleName },
      date,
    });
  };

  const handleUpdateField = async (assignment, field, value) => {
    await updateMutation.mutateAsync({
      id: assignment.id,
      data: { [field]: value },
      date,
    });
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
        const byStudent = {};
        dedupeLatestAssignments(assignments).forEach((a) => {
          byStudent[a.student_id] = a;
        });
        const prevCount = Object.values(byStudent).filter(
          (a) => a.workplace_id === wp.id,
        ).length;
        toUpdate.forEach(({ fullRecord }) => {
          if (!fullRecord.student_id) return;
          byStudent[fullRecord.student_id] = {
            ...byStudent[fullRecord.student_id],
            ...fullRecord,
          };
        });
        toCreate.forEach((record) => {
          byStudent[record.student_id] = record;
        });
        const nextCount = Object.values(byStudent).filter(
          (a) => a.workplace_id === wp.id,
        ).length;
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
      rate: assignmentDefaults.rate,
      hours: assignmentDefaults.hours,
    });
    setGuestName("");
    setShowAddGuestDialog(false);
  };

  const handleCloneDay = async () => {
    if (!cloneTargetDate) return;
    setCloning(true);
    setCloneProgress(0);
    setCloneStep("טוען נתונים...");
    try {
      const sourceAssignments = Object.values(assignmentByStudent).filter(
        (a) => !a.student_id?.startsWith("guest_"),
      );
      await cloneDayMutation.mutateAsync({
        sourceAssignments,
        targetDate: cloneTargetDate,
        workplaces,
        defaults: assignmentDefaults,
        onProgress: ({ progress, step }) => {
          setCloneProgress(progress);
          if (step !== undefined) setCloneStep(step);
        },
      });
    } catch (error) {
      await showAlert(`שגיאה בשכפול: ${error.message || "נסה שוב"}`);
    } finally {
      setCloning(false);
      setCloneProgress(0);
      setCloneStep("");
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
          assignmentByStudent={assignmentByStudent}
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
          assignmentByStudent={assignmentByStudent}
          date={date}
          cloneTargetDate={cloneTargetDate}
          onCloneTargetDateChange={setCloneTargetDate}
          cloning={cloning}
          cloneStep={cloneStep}
          cloneProgress={cloneProgress}
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
          filteredStudents={filteredStudents}
          guestAssignments={guestAssignments}
          students={students}
          cohorts={cohorts}
          workplaces={workplaces}
          roles={roles}
          assignments={assignments}
          assignmentByStudent={assignmentByStudent}
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
