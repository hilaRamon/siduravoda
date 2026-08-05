import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronsUpDown, Copy, UserPlus } from "lucide-react";

export function CohortSelectDialog({
  open,
  onOpenChange,
  cohorts,
  selected,
  onSelectedChange,
  filteredStudents,
  assignmentByStudent,
  onConfirm,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>בחירה לפי מחזור</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <p className="text-xs text-muted-foreground">
            בחר מחזורים — כל תלמידי המחזור יסומנו בטבלה.
          </p>
          <div className="grid grid-cols-2 gap-1">
            {cohorts.map((c) => (
              <label
                key={c}
                className="flex items-center gap-2 cursor-pointer hover:bg-secondary/30 rounded-lg px-3 py-2 transition-colors"
              >
                <Checkbox
                  checked={selected.includes(c)}
                  onCheckedChange={(checked) => {
                    onSelectedChange((prev) =>
                      checked ? [...prev, c] : prev.filter((x) => x !== c),
                    );
                  }}
                />
                <span className="text-sm font-medium truncate">{c}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button
              disabled={selected.length === 0}
              onClick={() => {
                const ids = new Set();
                filteredStudents.forEach((s) => {
                  if (selected.includes(s.cohort)) {
                    ids.add(assignmentByStudent[s.id]?.id || s.id);
                  }
                });
                onConfirm(ids);
                onOpenChange(false);
              }}
            >
              אשר (
              {selected.length > 0
                ? filteredStudents.filter((s) => selected.includes(s.cohort))
                    .length
                : 0}{" "}
              תלמידים)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AddGuestDialog({
  open,
  onOpenChange,
  date,
  guestName,
  onGuestNameChange,
  onAdd,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>הוספת תלמיד יומי</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <p className="text-xs text-muted-foreground">
            תלמיד זה יופיע רק ביום {date} ולא יועתק בשכפול שיבוצים.
          </p>
          <Input
            autoFocus
            placeholder="שם התלמיד..."
            value={guestName}
            onChange={(e) => onGuestNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAdd();
            }}
            className="h-9 text-sm"
          />
          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onGuestNameChange("");
              }}
            >
              ביטול
            </Button>
            <Button onClick={onAdd} disabled={!guestName.trim()}>
              <UserPlus size={14} className="ml-2" /> הוסף
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CloneDialog({
  open,
  onOpenChange,
  assignmentByStudent,
  date,
  cloneTargetDate,
  onCloneTargetDateChange,
  cloning,
  cloneStep,
  cloneProgress,
  onClone,
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>שכפול שיבוצים</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">
            שכפל את{" "}
            {
              Object.values(assignmentByStudent).filter(
                (a) => !a.student_id?.startsWith("guest_"),
              ).length
            }{" "}
            השיבוצים מתאריך <strong>{date}</strong> לתאריך:
          </p>
          <input
            type="date"
            value={cloneTargetDate}
            onChange={(e) => onCloneTargetDateChange(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {cloneTargetDate &&
            new Date(cloneTargetDate + "T12:00:00").getDay() === 0 && (
              <div className="bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 text-xs text-primary">
                📅 יום ראשון — שיבוץ אוטומטי לפי <strong>סטטוס מרחק</strong>{" "}
                (קרוב / רחוק)
              </div>
            )}
          {cloneTargetDate &&
            new Date(cloneTargetDate + "T12:00:00").getDay() !== 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                👥 תלמידי <strong>צוות</strong>: אם היום הוא יום חופשי שלהם →
                יוגדרו "תתת - לא עובד". אחרת → יישארו ללא שיבוץ.
              </div>
            )}
          {cloning && (
            <div className="space-y-2 pt-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">{cloneStep}</span>
                <span className="font-semibold text-primary">
                  {cloneProgress}%
                </span>
              </div>
              <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${cloneProgress}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={cloning}
            >
              ביטול
            </Button>
            <Button onClick={onClone} disabled={!cloneTargetDate || cloning}>
              <Copy size={14} className="ml-2" />{" "}
              {cloning ? "משכפל..." : "שכפל"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BulkEditDialog({
  open,
  onOpenChange,
  selectedCount,
  workplaces,
  bulkWorkplace,
  onBulkWorkplaceChange,
  bulkWorkplaceOpen,
  onBulkWorkplaceOpenChange,
  bulkHours,
  onBulkHoursChange,
  bulkRate,
  onBulkRateChange,
  rateColumnLabel,
  bulkSaving,
  bulkProgress,
  onSave,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>עריכה מרובה — {selectedCount} שורות</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <p className="text-xs text-muted-foreground">
            השדות שתמלא יעודכנו בכל השורות הנבחרות. שדה ריק לא ישתנה.
          </p>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              מקום עבודה
            </label>
            <Popover
              open={bulkWorkplaceOpen}
              onOpenChange={onBulkWorkplaceOpenChange}
            >
              <PopoverTrigger asChild>
                <button className="h-9 w-full border border-border rounded-md px-3 text-sm flex items-center justify-between bg-card hover:bg-secondary/40 transition-colors">
                  <span
                    className={bulkWorkplace ? "" : "text-muted-foreground"}
                  >
                    {bulkWorkplace
                      ? workplaces.find((w) => w.id === bulkWorkplace)?.name
                      : "— ללא שינוי —"}
                  </span>
                  <ChevronsUpDown size={14} className="opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="חיפוש..."
                    className="h-8 text-xs"
                  />
                  <CommandList>
                    <CommandEmpty>לא נמצא</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__clear__"
                        onSelect={() => {
                          onBulkWorkplaceChange("");
                          onBulkWorkplaceOpenChange(false);
                        }}
                        className="text-xs text-muted-foreground"
                      >
                        — ללא שינוי —
                      </CommandItem>
                      {workplaces.map((w) => (
                        <CommandItem
                          key={w.id}
                          value={w.name}
                          onSelect={() => {
                            onBulkWorkplaceChange(w.id);
                            onBulkWorkplaceOpenChange(false);
                          }}
                          className="text-xs"
                        >
                          {w.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              כמות שעות
            </label>
            <Input
              type="number"
              step="0.5"
              value={bulkHours}
              onChange={(e) => onBulkHoursChange(e.target.value)}
              placeholder="— ללא שינוי —"
              className="h-9 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {rateColumnLabel}
            </label>
            <Input
              type="number"
              value={bulkRate}
              onChange={(e) => onBulkRateChange(e.target.value)}
              placeholder="— ללא שינוי —"
              className="h-9 text-sm"
            />
          </div>

          {bulkSaving && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>מעדכן שורות...</span>
                <span className="font-medium text-primary">
                  {bulkProgress}%
                </span>
              </div>
              <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${bulkProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={bulkSaving}
            >
              ביטול
            </Button>
            <Button onClick={onSave} disabled={bulkSaving}>
              {bulkSaving ? "מעדכן..." : "שמור שינויים"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
