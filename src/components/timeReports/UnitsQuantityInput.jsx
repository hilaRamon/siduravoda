import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  useCreateWorkplaceLogistics,
  useUpdateWorkplaceLogistics,
} from "@/queries/workplaceLogisticsQueries";

export default function UnitsQuantityInput({
  date,
  workplaceId,
  logistics,
  unitsName = "",
  compact = false,
}) {
  const [value, setValue] = useState(
    logistics?.units != null ? String(logistics.units) : "",
  );
  const createLogistics = useCreateWorkplaceLogistics();
  const updateLogistics = useUpdateWorkplaceLogistics();

  useEffect(() => {
    setValue(logistics?.units != null ? String(logistics.units) : "");
  }, [logistics?.units, logistics?.id]);

  const dirty =
    String(value) !== String(logistics?.units ?? "");
  const saving = createLogistics.isPending || updateLogistics.isPending;

  const handleSave = async () => {
    const parsed = value === "" ? null : Number(value);
    const units = parsed == null || !Number.isFinite(parsed) ? null : parsed;
    if (logistics?.id) {
      await updateLogistics.mutateAsync({
        id: logistics.id,
        data: { units },
        date,
      });
      return;
    }
    await createLogistics.mutateAsync({
      date,
      workplace_id: workplaceId,
      is_piecework: true,
      units,
    });
  };

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={unitsName || "כמות"}
        disabled={saving}
        className={`border rounded-md px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-card ${
          compact ? "h-7 w-24 text-xs" : "h-9 w-28"
        } ${dirty ? "border-primary ring-1 ring-primary/40" : "border-border"}`}
        step="1"
        min="0"
      />
      {unitsName ? (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {unitsName}
        </span>
      ) : null}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`flex items-center justify-center rounded-md transition-colors shrink-0 ${
          compact ? "h-7 w-7" : "h-9 w-9"
        } ${dirty ? "bg-primary text-white hover:bg-primary/90" : "bg-secondary text-muted-foreground hover:bg-secondary/80"} disabled:opacity-70`}
        title="שמור כמות"
        type="button"
      >
        {saving ? (
          <Loader2 size={compact ? 13 : 15} className="animate-spin" />
        ) : (
          <Check size={compact ? 13 : 15} />
        )}
      </button>
    </div>
  );
}
