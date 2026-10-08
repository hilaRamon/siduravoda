import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

function hasUnits(units) {
  return typeof units === "number" && Number.isFinite(units);
}

export default function PieceworkFields({ localData, onPersist, saving = false }) {
  const [value, setValue] = useState(
    hasUnits(localData.units) ? String(localData.units) : "",
  );

  useEffect(() => {
    setValue(hasUnits(localData.units) ? String(localData.units) : "");
  }, [localData.units]);

  const dirty = String(value) !== String(localData.units ?? "");
  const locked = Boolean(saving);

  const handleSave = () => {
    const parsed = value === "" ? null : Number(value);
    const units = parsed == null || !Number.isFinite(parsed) ? null : parsed;
    const saved = hasUnits(localData.units) ? localData.units : null;
    if (units === saved) return;
    onPersist({ units });
  };

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
      {hasUnits(localData.units) ? (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">כמות</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={locked}
              className={`h-8 min-w-0 flex-1 border rounded-md px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-background ${
                dirty ? "border-primary ring-1 ring-primary/40" : "border-border"
              }`}
              step="1"
              min="0"
            />
            {localData.units_name ? (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {localData.units_name}
              </span>
            ) : null}
            <button
              onClick={handleSave}
              disabled={locked}
              className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors shrink-0 ${
                dirty
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              } disabled:opacity-70`}
              title="שמור כמות"
              type="button"
            >
              {locked ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Check size={13} />
              )}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">הכמות תדווח בדיווח הזמנים</p>
      )}
    </div>
  );
}
