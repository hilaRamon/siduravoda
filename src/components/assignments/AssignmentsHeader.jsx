import { Button } from "@/components/ui/button";
import DailyReportPDFButton from "@/components/reports/DailyReportPDFButton";
import { Copy, UserPlus } from "lucide-react";
import { addDays, format } from "date-fns";

export default function AssignmentsHeader({
  date,
  assignments,
  students,
  onOpenCohortSelect,
  onOpenAddGuest,
  onOpenClone,
}) {
  const assignedCount = new Set(
    assignments
      .filter(
        (a) =>
          a.workplace_name &&
          !["לא עובד", "לימודים", "לא יצא"].some(
            (kw) => a.workplace_name.trim() === kw,
          ),
      )
      .map((a) => a.student_id),
  ).size;

  const totalStudents = students.filter(
    (s) =>
      s.is_active !== false &&
      (!s.created_date || s.created_date.slice(0, 10) <= date),
  ).length;

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold">שיבוצים יומיים</h2>
        <p className="text-muted-foreground mt-1">
          {assignedCount} משובצים מתוך {totalStudents} תלמידים
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <DailyReportPDFButton
          key={date}
          date={date}
          assignments={assignments}
        />
        <Button variant="outline" onClick={onOpenCohortSelect}>
          בחירה לפי מחזור
        </Button>
        <Button variant="outline" onClick={onOpenAddGuest}>
          <UserPlus size={16} className="ml-2" /> הוסף תלמיד יומי
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            onOpenClone(
              format(addDays(new Date(date + "T12:00:00"), 1), "yyyy-MM-dd"),
            );
          }}
        >
          <Copy size={16} className="ml-2" /> שכפל שיבוצים
        </Button>
      </div>
    </div>
  );
}
