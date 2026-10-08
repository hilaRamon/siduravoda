import { formatPieceworkUnits } from "@/lib/assignmentHelpers";

export default function PieceworkFields({ localData, onPersist }) {
  const unitsLabel = formatPieceworkUnits(localData);

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">שם יחידה</label>
        <input
          type="text"
          defaultValue={localData.units_name || ""}
          key={`units-name-${localData.units_name || "empty"}`}
          onBlur={(e) => onPersist({ units_name: e.target.value })}
          placeholder="ארגז, ק״ג..."
          className="w-full h-8 text-xs border border-border rounded-md px-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">תעריף ליחידה</label>
        <input
          type="number"
          defaultValue={localData.rate ?? ""}
          key={`rate-${localData.rate ?? "empty"}`}
          onBlur={(e) => {
            const val = e.target.value === "" ? null : Number(e.target.value);
            onPersist({ rate: Number.isFinite(val) ? val : null });
          }}
          placeholder="0"
          className="w-full h-8 text-xs border border-border rounded-md px-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
          step="0.5"
        />
      </div>
      {unitsLabel ? (
        <p className="text-xs text-muted-foreground bg-secondary/60 rounded-md px-2 py-1.5">
          כמות: {unitsLabel}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">הכמות תדווח בדיווח הזמנים</p>
      )}
    </div>
  );
}
