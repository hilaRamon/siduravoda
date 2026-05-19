import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Truck, Clock, Check, ChevronDown, ChevronUp } from 'lucide-react';
import VehicleSlot from './VehicleSlot';

function WorkplaceLogisticsCard({ date, workplaceId, workplaceName, studentCount, logistics, allLogistics, onSave }) {
  const [expanded, setExpanded] = useState(false);

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const [localData, setLocalData] = useState(logistics || {});
  useEffect(() => {
    setLocalData(logistics || {});
  }, [logistics]);

  const selectedVehicleIds = [localData.vehicle_id, localData.vehicle_id_2, localData.vehicle_id_3].filter(Boolean);

  const allTakenVehicleIds = new Set(
    allLogistics.flatMap(l => [l.vehicle_id, l.vehicle_id_2, l.vehicle_id_3].filter(Boolean))
  );

  const availableVehicles = vehicles.filter(v => !allTakenVehicleIds.has(v.id) || selectedVehicleIds.includes(v.id));

  const getOtherIds = (slotIndex) => [
    slotIndex !== 1 && localData.vehicle_id,
    slotIndex !== 2 && localData.vehicle_id_2,
    slotIndex !== 3 && localData.vehicle_id_3,
  ].filter(Boolean);

  const handleVehicleSelect = (vehicleId, vehicleName, slotIndex) => {
    const newData = { ...localData };
    if (slotIndex === 1) { newData.vehicle_id = vehicleId || null; newData.vehicle_name = vehicleName || null; }
    else if (slotIndex === 2) { newData.vehicle_id_2 = vehicleId || null; newData.vehicle_name_2 = vehicleName || null; }
    else if (slotIndex === 3) { newData.vehicle_id_3 = vehicleId || null; newData.vehicle_name_3 = vehicleName || null; }
    setLocalData(newData);
    onSave(workplaceId, workplaceName, newData);
  };

  const [timeInput, setTimeInput] = useState(localData.exit_time || '06:35');
  useEffect(() => {
    setTimeInput(localData.exit_time || '06:35');
  }, [localData.exit_time]);

  const handleTimeSave = () => {
    const newData = { ...localData, exit_time: timeInput };
    setLocalData(newData);
    onSave(workplaceId, workplaceName, newData);
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm leading-tight truncate">{workplaceName}</span>
          <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full shrink-0">
            {studentCount}
          </span>
        </div>
        {expanded
          ? <ChevronUp size={14} className="text-muted-foreground shrink-0" />
          : <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        }
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border">
          <div className="space-y-1 pt-2">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock size={11} /> שעת יציאה
            </label>
            <div className="flex gap-1">
              <input
                type="time"
                value={timeInput}
                onChange={e => setTimeInput(e.target.value)}
                className="flex-1 h-8 text-xs border border-border rounded-md px-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <button
                onClick={handleTimeSave}
                className="h-8 w-8 flex items-center justify-center bg-primary text-white rounded-md hover:bg-primary/90 transition-colors shrink-0"
                title="אשר שעה"
              >
                <Check size={14} />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">הערות</label>
            <textarea
              defaultValue={localData.notes || ''}
              key={`notes-${localData.notes || 'empty'}`}
              onBlur={(e) => {
                const newData = { ...localData, notes: e.target.value };
                setLocalData(newData);
                onSave(workplaceId, workplaceName, newData);
              }}
              placeholder="הערות למקום עבודה..."
              rows={2}
              className="w-full text-xs border border-border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
            />
          </div>

          <VehicleSlot slotIndex={1} vehicleId={localData.vehicle_id} vehicleName={localData.vehicle_name} availableVehicles={availableVehicles} otherIds={getOtherIds(1)} onSelect={handleVehicleSelect} />
          <VehicleSlot slotIndex={2} vehicleId={localData.vehicle_id_2} vehicleName={localData.vehicle_name_2} availableVehicles={availableVehicles} otherIds={getOtherIds(2)} onSelect={handleVehicleSelect} />
          <VehicleSlot slotIndex={3} vehicleId={localData.vehicle_id_3} vehicleName={localData.vehicle_name_3} availableVehicles={availableVehicles} otherIds={getOtherIds(3)} onSelect={handleVehicleSelect} />
        </div>
      )}
    </div>
  );
}

export default function LogisticsSidebar({ date, assignments }) {
  const queryClient = useQueryClient();

  const { data: logisticsList = [] } = useQuery({
    queryKey: ['workplace-logistics', date],
    queryFn: () => base44.entities.WorkplaceLogistics.filter({ date }),
  });

  const logisticsMap = useMemo(() => {
    const map = {};
    logisticsList.forEach(l => {
      const existing = map[l.workplace_id];
      if (!existing || l.updated_date > existing.updated_date) {
        map[l.workplace_id] = l;
      }
    });
    return map;
  }, [logisticsList]);

  const activeWorkplaces = useMemo(() => {
    const assignmentByStudent = {};
    assignments.forEach(a => {
      const existing = assignmentByStudent[a.student_id];
      if (!existing || (a.updated_date || a.created_date) > (existing.updated_date || existing.created_date)) {
        assignmentByStudent[a.student_id] = a;
      }
    });
    const deduped = Object.values(assignmentByStudent);

    const map = {};
    deduped
      .filter(a => a.workplace_id && a.workplace_name)
      .forEach(a => {
        if (!map[a.workplace_id]) map[a.workplace_id] = { name: a.workplace_name, students: new Set() };
        map[a.workplace_id].students.add(a.student_id);
      });
    return Object.entries(map)
      .filter(([, v]) => v.students.size > 0)
      .sort(([, a], [, b]) => a.name.localeCompare(b.name, 'he'))
      .map(([id, v]) => ({ id, name: v.name, count: v.students.size }));
  }, [assignments]);

  const handleSave = async (workplaceId, workplaceName, data) => {
    const existing = logisticsMap[workplaceId];
    if (existing) {
      await base44.entities.WorkplaceLogistics.update(existing.id, data);
    } else {
      await base44.entities.WorkplaceLogistics.create({ date, workplace_id: workplaceId, workplace_name: workplaceName, ...data });
    }
    queryClient.invalidateQueries({ queryKey: ['workplace-logistics', date] });
  };

  if (activeWorkplaces.length === 0) {
    return (
      <div className="w-64 shrink-0 self-start sticky top-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Truck size={15} className="text-primary" /> לוגיסטיקה
          </h3>
          <p className="text-xs text-muted-foreground">אין שיבוצים להיום</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 self-start sticky top-4">
      <div className="bg-secondary/30 border border-border rounded-2xl p-3 space-y-2 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <h3 className="font-semibold text-sm flex items-center gap-2 px-1">
          <Truck size={15} className="text-primary" /> לוגיסטיקה יומית
        </h3>
        {activeWorkplaces.map(wp => (
          <WorkplaceLogisticsCard
            key={wp.id}
            date={date}
            workplaceId={wp.id}
            workplaceName={wp.name}
            studentCount={wp.count}
            logistics={logisticsMap[wp.id]}
            allLogistics={logisticsList}
            onSave={handleSave}
          />
        ))}
      </div>
    </div>
  );
}