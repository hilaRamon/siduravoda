import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

export default function AssignmentsBulkToolbar({
  selectedCount,
  onEdit,
  onClear,
}) {
  if (selectedCount <= 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border shadow-2xl rounded-2xl px-4 py-3 flex items-center gap-3">
      <span className="text-sm font-medium text-primary">
        {selectedCount} שורות נבחרו
      </span>
      <div className="w-px h-5 bg-border" />
      <Button size="sm" onClick={onEdit}>
        <Pencil size={14} className="ml-1" /> עריכה מרובה
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onClear}
        className="text-muted-foreground"
      >
        ביטול
      </Button>
    </div>
  );
}
