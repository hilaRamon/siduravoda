import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, X } from "lucide-react";
import {
  EditableNumberCell,
  RoleCell,
  WorkplaceCell,
} from "@/components/assignments/AssignmentCells";

export default function AssignmentsTable({
  filteredStudents,
  guestAssignments,
  students,
  cohorts,
  workplaces,
  roles,
  assignments,
  assignmentByStudent,
  assignmentDefaults,
  selectedIds,
  allVisibleSelected,
  filterName,
  filterCohort,
  filterWorkplace,
  filterRole,
  filterAssigned,
  rateColumnLabel,
  dailyMode,
  formatRateDisplay,
  parseRateInput,
  onFilterNameChange,
  onFilterCohortChange,
  onFilterWorkplaceChange,
  onFilterRoleChange,
  onFilterAssignedChange,
  onToggleSelectAll,
  onToggleSelect,
  onAssign,
  onRemove,
  onUpdateRole,
  onUpdateField,
}) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-secondary/60 border-b border-border">
          <tr>
            <th className="px-3 py-2 w-8">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={onToggleSelectAll}
              />
            </th>
            <th className="px-3 py-2 text-right font-semibold text-muted-foreground w-8 text-xs">
              #
            </th>
            <th className="px-3 py-2 text-right font-semibold text-muted-foreground w-48">
              <div className="flex flex-col gap-1">
                <span className="text-xs">שם תלמיד</span>
                <div className="relative">
                  <Input
                    value={filterName}
                    onChange={(e) => onFilterNameChange(e.target.value)}
                    placeholder="חיפוש..."
                    className={`h-7 w-full text-xs ${filterName ? "pl-7" : ""}`}
                  />
                  {filterName ? (
                    <button
                      type="button"
                      onClick={() => onFilterNameChange("")}
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                      aria-label="נקה חיפוש"
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                </div>
              </div>
            </th>
            <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
              <div className="flex flex-col gap-1">
                <span className="text-xs">מחזור</span>
                <Select value={filterCohort} onValueChange={onFilterCohortChange}>
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
                  onValueChange={onFilterWorkplaceChange}
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
                <Select value={filterRole} onValueChange={onFilterRoleChange}>
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
                  onValueChange={onFilterAssignedChange}
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
                        onToggleSelect(selectKey, idx, e.shiftKey);
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
                    onAssign={onAssign}
                    onRemove={onRemove}
                  />
                  <RoleCell
                    assignment={assignment}
                    roles={roles}
                    onUpdateRole={onUpdateRole}
                  />
                  <EditableNumberCell
                    value={assignment?.rate}
                    defaultValue={assignmentDefaults.rate}
                    assignment={assignment}
                    field="rate"
                    onUpdate={onUpdateField}
                    formatDisplay={dailyMode ? formatRateDisplay : undefined}
                    parseCommit={dailyMode ? parseRateInput : undefined}
                  />
                  <EditableNumberCell
                    value={assignment?.hours}
                    defaultValue={assignmentDefaults.hours}
                    assignment={assignment}
                    field="hours"
                    onUpdate={onUpdateField}
                  />
                  <EditableNumberCell
                    value={assignment?.bonus}
                    defaultValue={null}
                    assignment={assignment}
                    field="bonus"
                    onUpdate={onUpdateField}
                  />
                  <td className="px-3 py-2 border-b border-border text-muted-foreground text-xs">
                    {assignment?.notes || "—"}
                  </td>
                </tr>
              );
            })
          )}
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
                      onToggleSelect(
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
                    <UserPlus size={12} className="text-amber-500 shrink-0" />
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
                  onAssign={onAssign}
                  onRemove={onRemove}
                />
                <RoleCell
                  assignment={ga}
                  roles={roles}
                  onUpdateRole={onUpdateRole}
                />
                <EditableNumberCell
                  value={ga.rate}
                  defaultValue={assignmentDefaults.rate}
                  assignment={ga}
                  field="rate"
                  onUpdate={onUpdateField}
                  formatDisplay={dailyMode ? formatRateDisplay : undefined}
                  parseCommit={dailyMode ? parseRateInput : undefined}
                />
                <EditableNumberCell
                  value={ga.hours}
                  defaultValue={assignmentDefaults.hours}
                  assignment={ga}
                  field="hours"
                  onUpdate={onUpdateField}
                />
                <EditableNumberCell
                  value={ga.bonus}
                  defaultValue={null}
                  assignment={ga}
                  field="bonus"
                  onUpdate={onUpdateField}
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
  );
}
