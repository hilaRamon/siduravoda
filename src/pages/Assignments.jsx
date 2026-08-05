import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { absenceApi } from "@/api/absenceApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronRight,
  ChevronLeft,
  Copy,
  CalendarDays,
  Pencil,
  UserPlus,
} from "lucide-react";
import DailyReportPDFButton from "@/components/reports/DailyReportPDFButton";
import LogisticsSidebar from "@/components/assignments/LogisticsSidebar";
import {
  EditableNumberCell,
  RoleCell,
  WorkplaceCell,
} from "@/components/assignments/AssignmentCells";
import {
  AddGuestDialog,
  BulkEditDialog,
  CloneDialog,
  CohortSelectDialog,
} from "@/components/assignments/AssignmentDialogs";
import { format, addDays, subDays } from "date-fns";
import { useAppSettings } from "@/queries/useAppSettings";
import {
  useAbsenceRequests,
  absenceKeys,
} from "@/queries/absenceQueries";
import {
  assignmentKeys,
  useAssignments,
} from "@/queries/assignmentQueries";
import { useStudents } from "@/queries/studentQueries";
import { useWorkplaces } from "@/queries/workplaceQueries";
import { useRoles } from "@/queries/roleQueries";
import {
  getAssignmentDefaults,
  getDisplayRate,
  isDailyPricing,
  normalizeAppSettings,
  parseDisplayRateInput,
} from "@/lib/pricing";
import { showAlert } from "@/components/AppAlert";

const NOT_WORKING_WORKPLACE_NAME = "תתת - לא עובד";

async function bulkUpdateAssignments({ toCreate = [], toUpdate = [] }) {
  await Promise.all(
    toUpdate.map(({ id, fullRecord }) =>
      base44.entities.Assignment.update(id, fullRecord),
    ),
  );
  if (toCreate.length > 0) {
    await base44.entities.Assignment.bulkCreate(toCreate);
  }
}

const NO_AGREEMENT_WARNED_KEY = (date) => `no_agreement_warned_${date}`;

function getNoAgreementWarnedIds(date) {
  try {
    const raw = localStorage.getItem(NO_AGREEMENT_WARNED_KEY(date));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function markNoAgreementWarned(date, workplaceId) {
  const ids = getNoAgreementWarnedIds(date);
  if (ids.includes(workplaceId)) return;
  localStorage.setItem(
    NO_AGREEMENT_WARNED_KEY(date),
    JSON.stringify([...ids, workplaceId]),
  );
}

/** Alert once per workplace per schedule date when assigning to a workplace without agreement.
 *  Returns false if the user does not confirm (ביטול or X) — assignment should not proceed. */
async function warnIfNoAgreement(date, workplace) {
  if (!workplace || workplace.has_agreement) return true;
  if (getNoAgreementWarnedIds(date).includes(workplace.id)) return true;
  let confirmed = false;
  await showAlert(`ל${workplace.name} אין הסכם`, {
    onConfirm: () => {
      confirmed = true;
    },
    onCancel: () => {
      confirmed = false;
    },
  });
  markNoAgreementWarned(date, workplace.id);
  return confirmed;
}

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
  const [bulkProgress, setBulkProgress] = useState(0); // 0-100

  const [showAddGuestDialog, setShowAddGuestDialog] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [showCohortSelectDialog, setShowCohortSelectDialog] = useState(false);
  const [cohortDialogSelected, setCohortDialogSelected] = useState([]);

  const queryClient = useQueryClient();
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

  const { data: approvedAbsences = [] } = useAbsenceRequests({
    startDate: date,
    endDate: date,
    status: "אושר",
  });

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
    await absenceApi.reject(absenceRequest.id);
    queryClient.invalidateQueries({ queryKey: absenceKeys.all });
    queryClient.invalidateQueries({ queryKey: assignmentKeys.byDate(date) });
    return true;
  };

  const assignmentByStudent = useMemo(() => {
    const map = {};
    assignments.forEach((a) => {
      const existing = map[a.student_id];
      // Keep the most recently updated record to avoid stale duplicates overwriting fresh data
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

  // Guest assignments (student_id starts with "guest_") — shown as virtual rows
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
          // Hide students added after the selected date (unless they already have an assignment)
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

  const handleAssign = async (student, workplace, existingAssignment) => {
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

    // Find ALL assignments for this student on this date (there may be duplicates)
    const allForStudent = assignments.filter(
      (a) => a.student_id === student.id,
    );

    if (allForStudent.length > 1) {
      // Delete all duplicates, keep only the first, update it
      const [keep, ...extras] = allForStudent;
      await Promise.all(
        extras.map((a) => base44.entities.Assignment.delete(a.id)),
      );
      await base44.entities.Assignment.update(keep.id, {
        workplace_id: workplace.id,
        workplace_name: workplace.name,
      });
    } else if (allForStudent.length === 1) {
      await base44.entities.Assignment.update(allForStudent[0].id, {
        workplace_id: workplace.id,
        workplace_name: workplace.name,
      });
    } else {
      await base44.entities.Assignment.create({
        date,
        student_id: student.id,
        student_name: student.full_name,
        workplace_id: workplace.id,
        workplace_name: workplace.name,
        rate: assignmentDefaults.rate,
        hours: assignmentDefaults.hours,
      });
    }
    queryClient.invalidateQueries({ queryKey: assignmentKeys.byDate(date) });
    return true;
  };

  const handleRemove = async (id) => {
    const assignment = assignments.find((a) => a.id === id);
    const absence =
      assignment?.student_id && absentByStudentId[assignment.student_id];
    if (absence) {
      const student =
        students.find((s) => s.id === assignment.student_id) || {
          full_name: assignment.student_name || "התלמיד",
        };
      await offerRejectAbsence(student, absence);
      return;
    }
    await base44.entities.Assignment.delete(id);
    queryClient.invalidateQueries({ queryKey: assignmentKeys.byDate(date) });
  };

  const handleUpdateRole = async (assignment, roleName) => {
    await base44.entities.Assignment.update(assignment.id, {
      role: roleName === "none" ? "" : roleName,
    });
    queryClient.invalidateQueries({ queryKey: assignmentKeys.byDate(date) });
  };

  const handleUpdateField = async (assignment, field, value) => {
    await base44.entities.Assignment.update(assignment.id, { [field]: value });
    queryClient.invalidateQueries({ queryKey: assignmentKeys.byDate(date) });
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

    // Build a map: assignmentId -> assignment, and studentId -> assignment
    const assignmentById = {};
    const assignmentByStudentId = {};
    assignments.forEach((a) => {
      assignmentById[a.id] = a;
      assignmentByStudentId[a.student_id] = a;
    });
    const studentById = {};
    students.forEach((s) => {
      studentById[s.id] = s;
    });

    const toCreate = [];
    const toUpdate = []; // { id, updates }
    let skippedAbsent = 0;

    for (const selId of selectedIds) {
      const existingAssignment =
        assignmentById[selId] || assignmentByStudentId[selId];
      const studentId = existingAssignment?.student_id || selId;
      const isAbsent = !!absentByStudentId[studentId];
      const changingWorkplace =
        wp && wp.name !== NOT_WORKING_WORKPLACE_NAME;

      if (isAbsent && changingWorkplace) {
        skippedAbsent++;
        continue;
      }

      if (existingAssignment) {
        const { id, created_date, updated_date, created_by, ...rest } =
          existingAssignment;
        const fullRecord = { ...rest };
        if (wp) {
          fullRecord.workplace_id = wp.id;
          fullRecord.workplace_name = wp.name;
        }
        if (bulkHours !== "") fullRecord.hours = parseFloat(bulkHours);
        if (bulkRate !== "") {
          const parsedRate = parseFloat(bulkRate);
          fullRecord.rate = dailyMode
            ? parseRateInput(parsedRate)
            : parsedRate;
        }
        toUpdate.push({ id, fullRecord });
      } else if (wp) {
        const student = studentById[selId];
        if (student) {
          toCreate.push({
            date,
            student_id: student.id,
            student_name: student.full_name,
            workplace_id: wp.id,
            workplace_name: wp.name,
            rate: bulkRate !== "" ? (dailyMode ? parseRateInput(parseFloat(bulkRate)) : parseFloat(bulkRate)) : assignmentDefaults.rate,
            hours: bulkHours !== "" ? parseFloat(bulkHours) : assignmentDefaults.hours,
          });
        }
      }
    }

    if (skippedAbsent > 0 && toCreate.length === 0 && toUpdate.length === 0) {
      await showAlert(
        `${skippedAbsent} תלמידים עם היעדרות מאושרת דולגו. יש לבטל את ההיעדרות לפני שיבוץ.`,
      );
      return;
    }

    setBulkSaving(true);
    setBulkProgress(0);
    try {
      const CHUNK_SIZE = 5;
      const delay = (ms) => new Promise((r) => setTimeout(r, ms));
      const totalOps =
        Math.ceil(toCreate.length / CHUNK_SIZE) +
        Math.ceil(toUpdate.length / CHUNK_SIZE);
      let doneOps = 0;

      for (let i = 0; i < toCreate.length; i += CHUNK_SIZE) {
        await Promise.all(
          toCreate
            .slice(i, i + CHUNK_SIZE)
            .map((record) => base44.entities.Assignment.create(record)),
        );
        doneOps++;
        setBulkProgress(Math.round((doneOps / Math.max(totalOps, 1)) * 100));
        if (i + CHUNK_SIZE < toCreate.length) await delay(300);
      }
      for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
        await Promise.all(
          toUpdate
            .slice(i, i + CHUNK_SIZE)
            .map(({ id, fullRecord }) =>
              base44.entities.Assignment.update(id, fullRecord),
            ),
        );
        doneOps++;
        setBulkProgress(Math.round((doneOps / Math.max(totalOps, 1)) * 100));
        if (i + CHUNK_SIZE < toUpdate.length) await delay(300);
      }
      setBulkProgress(100);
      await new Promise((r) => setTimeout(r, 400)); // brief moment to show 100%
      queryClient.invalidateQueries({ queryKey: assignmentKeys.byDate(date) });
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
      (w) => w.name === "אאא- לפני שיבוץ",
    );
    await base44.entities.Assignment.create({
      date,
      student_id: guestId,
      student_name: guestName.trim(),
      workplace_id: defaultGuestWp?.id ?? "",
      workplace_name: defaultGuestWp?.name ?? "אאא- לפני שיבוץ",
      rate: assignmentDefaults.rate,
      hours: assignmentDefaults.hours,
    });
    queryClient.invalidateQueries({ queryKey: assignmentKeys.byDate(date) });
    setGuestName("");
    setShowAddGuestDialog(false);
  };

  const handleCloneDay = async () => {
    if (!cloneTargetDate) return;
    setCloning(true);
    setCloneProgress(0);
    setCloneStep("טוען נתונים...");
    try {
      // Check if target date is Sunday (day 0)
      const targetDayOfWeek = new Date(cloneTargetDate + "T12:00:00").getDay();
      const isSunday = targetDayOfWeek === 0;

      // Distance → workplace mapping for Sunday mode
      const DISTANCE_WORKPLACE_MAP = {};
      ["קרוב", "רחוק", "תתת - לא עובד", "אאא- לפני שיבוץ"].forEach(
        (distStatus) => {
          const wp = workplaces.find((w) => w.name === distStatus);
          if (wp) {
            DISTANCE_WORKPLACE_MAP[distStatus] = { id: wp.id, name: wp.name };
          }
        },
      );

      setCloneProgress(10);
      setCloneStep("טוען תלמידים...");
      const freshStudents = await base44.entities.Student.list(
        "-created_date",
        2000,
      );
      const studentById = {};
      freshStudents.forEach((s) => {
        studentById[s.id] = s;
      });

      setCloneProgress(25);
      setCloneStep("בודק היעדרויות...");
      const approvedAbsences = await absenceApi.list({
        startDate: cloneTargetDate,
        endDate: cloneTargetDate,
        status: "אושר",
      });
      const absentStudentIds = new Set(
        approvedAbsences.map((a) => a.student_id).filter(Boolean),
      );

      setCloneProgress(40);
      setCloneStep("טוען שיבוצים קיימים...");
      const targetAssignments = await base44.entities.Assignment.filter(
        { date: cloneTargetDate },
        "-created_date",
        2000,
      );

      const targetByStudent = {};
      targetAssignments.forEach((a) => {
        const existing = targetByStudent[a.student_id];
        if (
          !existing ||
          (a.updated_date || a.created_date) >
            (existing.updated_date || existing.created_date)
        ) {
          targetByStudent[a.student_id] = a;
        }
      });

      setCloneProgress(50);
      setCloneStep("מנקה כפילויות...");
      const duplicatesToDelete = [];
      const seenOnTarget = new Set();
      [...targetAssignments]
        .sort((a, b) =>
          (b.updated_date || b.created_date) >
          (a.updated_date || a.created_date)
            ? 1
            : -1,
        )
        .forEach((a) => {
          if (seenOnTarget.has(a.student_id)) {
            duplicatesToDelete.push(a.id);
          } else {
            seenOnTarget.add(a.student_id);
          }
        });
      for (const id of duplicatesToDelete) {
        await base44.entities.Assignment.delete(id);
      }

      const sourceAssignments = Object.values(assignmentByStudent).filter(
        (a) => !a.student_id?.startsWith("guest_"),
      );

      const DAY_NUM_TO_HEB = { 0: "א", 1: "ב", 2: "ג", 3: "ד", 4: "ה" };
      const targetDayHeb = DAY_NUM_TO_HEB[targetDayOfWeek];
      const notWorkingWp = workplaces.find((w) => w.name === "תתת - לא עובד");

      const toUpdate = [];
      const toCreate = [];

      setCloneProgress(60);
      setCloneStep("מכין שיבוצים...");

      for (const src of sourceAssignments) {
        const student = studentById[src.student_id];
        const isCrew = student?.cohort?.includes("צוות");

        let targetWp;
        if (absentStudentIds.has(src.student_id)) {
          targetWp = notWorkingWp
            ? { id: notWorkingWp.id, name: notWorkingWp.name }
            : { id: "", name: NOT_WORKING_WORKPLACE_NAME };
        } else if (isSunday) {
          const distanceStatus = student?.distance_status;
          if (distanceStatus && DISTANCE_WORKPLACE_MAP[distanceStatus]) {
            targetWp = DISTANCE_WORKPLACE_MAP[distanceStatus];
          } else {
            targetWp = { id: src.workplace_id, name: src.workplace_name };
          }
        } else if (isCrew && targetDayHeb) {
          const freeDays = Array.isArray(student?.free_day)
            ? student.free_day
            : student?.free_day
              ? [student.free_day]
              : [];
          if (freeDays.includes(targetDayHeb)) {
            targetWp = notWorkingWp
              ? { id: notWorkingWp.id, name: notWorkingWp.name }
              : { id: src.workplace_id, name: "תתת - לא עובד" };
          } else {
            targetWp = { id: "", name: "" };
          }
        } else {
          targetWp = { id: src.workplace_id, name: src.workplace_name };
        }

        const existing = targetByStudent[src.student_id];
        if (existing) {
          toUpdate.push({
            id: existing.id,
            fullRecord: {
              workplace_id: targetWp.id,
              workplace_name: targetWp.name,
              role: null,
              bonus: null,
            },
          });
        } else {
          toCreate.push({
            date: cloneTargetDate,
            student_id: src.student_id,
            student_name: src.student_name,
            workplace_id: targetWp.id,
            workplace_name: targetWp.name,
            rate: assignmentDefaults.rate,
            hours: assignmentDefaults.hours,
            role: null,
            bonus: null,
          });
        }
      }

      // Process in chunks
      const CHUNK = 40;
      for (let i = 0; i < toUpdate.length; i += CHUNK) {
        await bulkUpdateAssignments({
          toCreate: [],
          toUpdate: toUpdate.slice(i, i + CHUNK),
        });
      }
      if (toCreate.length > 0) {
        await bulkUpdateAssignments({ toCreate, toUpdate: [] });
      }

      const totalCloned = toCreate.length + toUpdate.length;
      queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
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

  const prevDay = () =>
    setDate(format(subDays(new Date(date + "T12:00:00"), 1), "yyyy-MM-dd"));
  const nextDay = () =>
    setDate(format(addDays(new Date(date + "T12:00:00"), 1), "yyyy-MM-dd"));

  return (
    <div className="p-8 flex gap-6 items-start min-h-full">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">שיבוצים יומיים</h2>
            <p className="text-muted-foreground mt-1">
              {
                new Set(
                  assignments
                    .filter(
                      (a) =>
                        a.workplace_name &&
                        !["לא עובד", "לימודים", "לא יצא"].some(
                          (kw) => a.workplace_name.trim() === kw,
                        ),
                    )
                    .map((a) => a.student_id),
                ).size
              }{" "}
              משובצים מתוך{" "}
              {
                students.filter(
                  (s) =>
                    s.is_active !== false &&
                    (!s.created_date || s.created_date.slice(0, 10) <= date),
                ).length
              }{" "}
              תלמידים
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <DailyReportPDFButton key={date} date={date} assignments={assignments} />
            <Button
              variant="outline"
              onClick={() => {
                setCohortDialogSelected([]);
                setShowCohortSelectDialog(true);
              }}
            >
              בחירה לפי מחזור
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowAddGuestDialog(true)}
            >
              <UserPlus size={16} className="ml-2" /> הוסף תלמיד יומי
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCloneTargetDate(
                  format(
                    addDays(new Date(date + "T12:00:00"), 1),
                    "yyyy-MM-dd",
                  ),
                );
                setShowCloneDialog(true);
              }}
            >
              <Copy size={16} className="ml-2" /> שכפל שיבוצים
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <Button variant="outline" size="icon" onClick={prevDay}>
            <ChevronRight size={18} />
          </Button>
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-primary" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <Button variant="outline" size="icon" onClick={nextDay}>
            <ChevronLeft size={18} />
          </Button>
          <Button
            variant="outline"
            onClick={() => setDate(format(new Date(), "yyyy-MM-dd"))}
            className="text-xs"
          >
            היום
          </Button>
          <span className="text-sm text-muted-foreground">
            {new Date(date + "T12:00:00").toLocaleDateString("he-IL", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>

        {/* Floating Bulk Edit Toolbar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border shadow-2xl rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-sm font-medium text-primary">
              {selectedIds.size} שורות נבחרו
            </span>
            <div className="w-px h-5 bg-border" />
            <Button size="sm" onClick={() => setShowBulkDialog(true)}>
              <Pencil size={14} className="ml-1" /> עריכה מרובה
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="text-muted-foreground"
            >
              ביטול
            </Button>
          </div>
        )}

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

        {/* Main Table */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 border-b border-border">
              <tr>
                <th className="px-3 py-2 w-8">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground w-8 text-xs">
                  #
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs">שם תלמיד</span>
                    <Input
                      value={filterName}
                      onChange={(e) => setFilterName(e.target.value)}
                      placeholder="חיפוש..."
                      className="h-7 text-xs"
                    />
                  </div>
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs">מחזור</span>
                    <Select
                      value={filterCohort}
                      onValueChange={setFilterCohort}
                    >
                      <SelectTrigger className="h-7 text-xs w-full">
                        <SelectValue placeholder="הכל" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">הכל</SelectItem>
                        {cohorts.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground w-56">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs">מקום עבודה</span>
                    <Select
                      value={filterWorkplace}
                      onValueChange={setFilterWorkplace}
                    >
                      <SelectTrigger className="h-7 text-xs w-full">
                        <SelectValue placeholder="הכל" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">הכל</SelectItem>
                        {workplaces
                          .filter((w) =>
                            assignments.some((a) => a.workplace_id === w.id),
                          )
                          .map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground w-40">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs">תפקיד</span>
                    <Select value={filterRole} onValueChange={setFilterRole}>
                      <SelectTrigger className="h-7 text-xs w-full">
                        <SelectValue placeholder="הכל" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">הכל</SelectItem>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.name}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground w-20">
                  <span className="text-xs">{rateColumnLabel}</span>
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground w-20">
                  <span className="text-xs">שעות</span>
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground w-24">
                  <span className="text-xs">תשלום נוסף</span>
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs">שיבוץ</span>
                    <Select
                      value={filterAssigned}
                      onValueChange={setFilterAssigned}
                    >
                      <SelectTrigger className="h-7 text-xs w-full">
                        <SelectValue placeholder="הכל" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">הכל</SelectItem>
                        <SelectItem value="assigned">משובצים</SelectItem>
                        <SelectItem value="unassigned">לא משובצים</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="text-center py-12 text-muted-foreground"
                  >
                    {students.length === 0
                      ? "אין תלמידים במערכת"
                      : "לא נמצאו תוצאות לסינון"}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => {
                  const assignment = assignmentByStudent[student.id];
                  const selectKey = assignment?.id || student.id;
                  const isSelected = selectedIds.has(selectKey);
                  return (
                    <tr
                      key={student.id}
                      className={`transition-colors ${isSelected ? "bg-primary/10" : assignment ? "bg-primary/5" : "hover:bg-secondary/20"}`}
                    >
                      <td className="px-3 py-2 border-b border-border">
                        <Checkbox
                          checked={!!isSelected}
                          onClick={(e) => {
                            e.preventDefault();
                            toggleSelect(selectKey, idx, e.shiftKey);
                          }}
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border text-muted-foreground text-xs">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2 border-b border-border font-medium">
                        {student.full_name}
                      </td>
                      <td className="px-3 py-2 border-b border-border text-muted-foreground text-xs">
                        {student.cohort || "—"}
                      </td>
                      <WorkplaceCell
                        student={student}
                        assignment={assignment}
                        workplaces={workplaces}
                        onAssign={handleAssign}
                        onRemove={handleRemove}
                      />
                      <RoleCell
                        assignment={assignment}
                        roles={roles}
                        onUpdateRole={handleUpdateRole}
                      />
                      <EditableNumberCell
                        value={assignment?.rate}
                        defaultValue={assignmentDefaults.rate}
                        assignment={assignment}
                        field="rate"
                        onUpdate={handleUpdateField}
                        formatDisplay={dailyMode ? formatRateDisplay : undefined}
                        parseCommit={dailyMode ? parseRateInput : undefined}
                      />
                      <EditableNumberCell
                        value={assignment?.hours}
                        defaultValue={assignmentDefaults.hours}
                        assignment={assignment}
                        field="hours"
                        onUpdate={handleUpdateField}
                      />
                      <EditableNumberCell
                        value={assignment?.bonus}
                        defaultValue={null}
                        assignment={assignment}
                        field="bonus"
                        onUpdate={handleUpdateField}
                      />
                      <td className="px-3 py-2 border-b border-border text-muted-foreground text-xs">
                        {assignment?.notes || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
              {/* Guest rows */}
              {guestAssignments.map((ga, idx) => {
                const guestStudent = {
                  id: ga.student_id,
                  full_name: ga.student_name,
                  cohort: null,
                  forbidden_workplaces: [],
                };
                const selectKey = ga.id;
                const isSelected = selectedIds.has(selectKey);
                return (
                  <tr
                    key={ga.id}
                    className={`transition-colors border-t-2 border-dashed border-amber-200 align-middle ${isSelected ? "bg-primary/10" : "bg-amber-50/60 hover:bg-amber-50"}`}
                  >
                    <td className="px-3 py-2 border-b border-border">
                      <Checkbox
                        checked={!!isSelected}
                        onClick={(e) => {
                          e.preventDefault();
                          toggleSelect(
                            selectKey,
                            filteredStudents.length + idx,
                            e.shiftKey,
                          );
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 border-b border-border text-muted-foreground text-xs">
                      {filteredStudents.length + idx + 1}
                    </td>
                    <td className="px-3 py-2 border-b border-border font-medium align-middle">
                      <span className="flex items-center gap-1">
                        <UserPlus
                          size={12}
                          className="text-amber-500 shrink-0"
                        />
                        {ga.student_name}
                      </span>
                    </td>
                    <td className="px-3 py-2 border-b border-border text-muted-foreground text-xs">
                      —
                    </td>
                    <WorkplaceCell
                      student={guestStudent}
                      assignment={ga}
                      workplaces={workplaces}
                      onAssign={handleAssign}
                      onRemove={(id) => handleRemove(id)}
                    />
                    <RoleCell
                      assignment={ga}
                      roles={roles}
                      onUpdateRole={handleUpdateRole}
                    />
                    <EditableNumberCell
                      value={ga.rate}
                      defaultValue={assignmentDefaults.rate}
                      assignment={ga}
                      field="rate"
                      onUpdate={handleUpdateField}
                      formatDisplay={dailyMode ? formatRateDisplay : undefined}
                      parseCommit={dailyMode ? parseRateInput : undefined}
                    />
                    <EditableNumberCell
                      value={ga.hours}
                      defaultValue={assignmentDefaults.hours}
                      assignment={ga}
                      field="hours"
                      onUpdate={handleUpdateField}
                    />
                    <EditableNumberCell
                      value={ga.bonus}
                      defaultValue={null}
                      assignment={ga}
                      field="bonus"
                      onUpdate={handleUpdateField}
                    />
                    <td className="px-3 py-2 border-b border-border text-muted-foreground text-xs">
                      {ga.notes || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <LogisticsSidebar date={date} assignments={assignments} />
    </div>
  );
}
