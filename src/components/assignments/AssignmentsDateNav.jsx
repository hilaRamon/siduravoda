import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, format, subDays } from "date-fns";

export default function AssignmentsDateNav({ date, onDateChange }) {
  const prevDay = () =>
    onDateChange(
      format(subDays(new Date(date + "T12:00:00"), 1), "yyyy-MM-dd"),
    );
  const nextDay = () =>
    onDateChange(
      format(addDays(new Date(date + "T12:00:00"), 1), "yyyy-MM-dd"),
    );

  return (
    <div className="flex items-center gap-3 mb-5">
      <Button variant="outline" size="icon" onClick={prevDay}>
        <ChevronRight size={18} />
      </Button>
      <div className="flex items-center gap-2">
        <CalendarDays size={18} className="text-primary" />
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <Button variant="outline" size="icon" onClick={nextDay}>
        <ChevronLeft size={18} />
      </Button>
      <Button
        variant="outline"
        onClick={() => onDateChange(format(new Date(), "yyyy-MM-dd"))}
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
  );
}
