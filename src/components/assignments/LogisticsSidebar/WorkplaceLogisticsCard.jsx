import { useState, useEffect } from "react";
import { Clock, ChevronDown, ChevronUp } from "lucide-react";
import VehicleSlot from "./VehicleSlot";
import PieceworkFields from "./PieceworkFields";
import { Switch } from "@/components/ui/switch";
import { useVehicles } from "@/queries/vehicleQueries";

export default function WorkplaceLogisticsCard({
  date,
  workplaceId,
  workplaceName,
  studentCount,
  requestedVolunteers,
  logistics,
  allLogistics,
  onSave,
}) {
  const [expanded, setExpanded] = useState(false);

  const { data: vehicles = [] } = useVehicles();

  const [localData, setLocalData] = useState(logistics || {});
  useEffect(() => {
    setLocalData(logistics || {});
  }, [logistics]);

  const selectedVehicleIds = [
    localData.vehicle_id,
    localData.vehicle_id_2,
    localData.vehicle_id_3,
  ].filter(Boolean);

  const allTakenVehicleIds = new Set(
    allLogistics.flatMap((l) =>
      [l.vehicle_id, l.vehicle_id_2, l.vehicle_id_3].filter(Boolean),
    ),
  );

  const availableVehicles = vehicles.filter(
    (v) => !allTakenVehicleIds.has(v.id) || selectedVehicleIds.includes(v.id),
  );

  const getOtherIds = (slotIndex) =>
    [
      slotIndex !== 1 && localData.vehicle_id,
      slotIndex !== 2 && localData.vehicle_id_2,
      slotIndex !== 3 && localData.vehicle_id_3,
    ].filter(Boolean);

  const vehicleNameById = (vehicleId) =>
    vehicles.find((vehicle) => vehicle.id === vehicleId)?.name;

  const handleVehicleSelect = (vehicleId, _vehicleName, slotIndex) => {
    const newData = { ...localData };
    if (slotIndex === 1) newData.vehicle_id = vehicleId || null;
    else if (slotIndex === 2) newData.vehicle_id_2 = vehicleId || null;
    else if (slotIndex === 3) newData.vehicle_id_3 = vehicleId || null;
    setLocalData(newData);
    onSave(workplaceId, newData);
  };

  const [timeInput, setTimeInput] = useState(localData.exit_time || "06:35");
  useEffect(() => {
    setTimeInput(localData.exit_time || "06:35");
  }, [localData.exit_time]);

  const persist = (patch) => {
    const newData = { ...localData, ...patch };
    setLocalData(newData);
    onSave(workplaceId, newData);
  };

  const isPiecework = Boolean(logistics?.is_piecework);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-secondary/40 transition-colors min-h-[40px]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm leading-none truncate">
            {workplaceName}
          </span>
          <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full shrink-0 leading-none">
            {studentCount}
          </span>
          {Boolean(logistics?.is_piecework) && (
            <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full shrink-0 leading-none">
              קבלנות
            </span>
          )}
          {requestedVolunteers != null && (
            <span
              className="text-xs bg-orange-100 text-orange-600 font-medium px-2 py-0.5 rounded-full shrink-0 leading-none"
              title="מתנדבים מבוקשים"
            >
              {requestedVolunteers}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={14} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border">
          <div className="space-y-1 pt-2">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock size={11} /> שעת יציאה
            </label>
            <input
              type="time"
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              onBlur={() => persist({ exit_time: timeInput })}
              dir="ltr"
              className="w-full h-8 text-xs border border-border rounded-md px-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 text-center"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">הערות</label>
            <textarea
              defaultValue={localData.notes || ""}
              key={`notes-${localData.notes || "empty"}`}
              onBlur={(e) => {
                const newData = { ...localData, notes: e.target.value };
                setLocalData(newData);
                onSave(workplaceId, newData);
              }}
              placeholder="הערות למקום עבודה..."
              rows={2}
              className="w-full text-xs border border-border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
            />
          </div>

          <div className="space-y-2 pt-1">
            <div className="text-xs text-muted-foreground flex items-center justify-between gap-2">
              <span>עבודת קבלנות</span>
              <Switch
                checked={isPiecework}
                onCheckedChange={(checked) =>
                  persist({ is_piecework: checked })
                }
              />
            </div>
            {isPiecework && (
              <PieceworkFields localData={localData} onPersist={persist} />
            )}
          </div>

          <VehicleSlot
            slotIndex={1}
            vehicleId={localData.vehicle_id}
            vehicleName={vehicleNameById(localData.vehicle_id)}
            availableVehicles={availableVehicles}
            otherIds={getOtherIds(1)}
            onSelect={handleVehicleSelect}
          />
          <VehicleSlot
            slotIndex={2}
            vehicleId={localData.vehicle_id_2}
            vehicleName={vehicleNameById(localData.vehicle_id_2)}
            availableVehicles={availableVehicles}
            otherIds={getOtherIds(2)}
            onSelect={handleVehicleSelect}
          />
          <VehicleSlot
            slotIndex={3}
            vehicleId={localData.vehicle_id_3}
            vehicleName={vehicleNameById(localData.vehicle_id_3)}
            availableVehicles={availableVehicles}
            otherIds={getOtherIds(3)}
            onSelect={handleVehicleSelect}
          />
        </div>
      )}
    </div>
  );
}
