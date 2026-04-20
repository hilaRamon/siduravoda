import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Truck, Clock, ChevronDown, X as XIcon } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';

function WorkplaceLogisticsCard({ date, workplaceId, workplaceName, studentCount, logistics, allLogistics, onSave }) {
  const [vehicleOpen, setVehicleOpen] = useState(false);

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const currentData = logistics || {};
  const selectedVehicleIds = [currentData.vehicle_id, currentData.vehicle_id_2].filter(Boolean);

  // Vehicles assigned to ANY workplace today (global pool)
  const allTakenVehicleIds = new Set(
    allLogistics.flatMap(l => [l.vehicle_id, l.vehicle_id_2].filter(Boolean))
  );
  // Show only vehicles that are NOT taken, or are currently selected in this workplace
  const availableVehicles = vehicles.filter(v => !allTakenVehicleIds.has(v.id) || selectedVehicleIds.includes(v.id));



  const handleVehicleSelect = useCallback((vehicleId, vehicleName, slotIndex) => {
    const newData = { ...currentData };
    if (slotIndex === 1) {
      newData.vehicle_id = vehicleId;
      newData.vehicle_name = vehicleName;
    } else if (slotIndex === 2) {
      newData.vehicle_id_2 = vehicleId;
      newData.vehicle_name_2 = vehicleName;
    } else if (slotIndex === 3) {
      newData.vehicle_id_3 = vehicleId;
      newData.vehicle_name_3 = vehicleName;
    }
    onSave(workplaceId, workplaceName, newData);
  }, [currentData, vehicles, workplaceId, workplaceName, onSave]);

  const selectedNames = selectedVehicleIds
    .map(id => vehicles.find(v => v.id === id)?.name)
    .filter(Boolean);

  const [openSlot, setOpenSlot] = useState(null);

  const renderVehicleSelector = (slotIndex) => {
    const vehicleId = slotIndex === 1 ? currentData.vehicle_id : slotIndex === 2 ? currentData.vehicle_id_2 : currentData.vehicle_id_3;
    const vehicleName = slotIndex === 1 ? currentData.vehicle_name : slotIndex === 2 ? currentData.vehicle_name_2 : currentData.vehicle_name_3;
    const otherIds = [
      slotIndex !== 1 && currentData.vehicle_id,
      slotIndex !== 2 && currentData.vehicle_id_2,
      slotIndex !== 3 && currentData.vehicle_id_3
    ].filter(Boolean);

    return (
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground flex items-center gap-1">
          <Truck size={11} /> רכב {slotIndex}
        </label>
        <Popover open={openSlot === slotIndex} onOpenChange={(open) => setOpenSlot(open ? slotIndex : null)}>
          <PopoverTrigger asChild>
            <button className={`w-full h-8 text-xs border rounded-md px-2 flex items-center justify-between transition-colors ${
              vehicleId
                ? 'border-primary bg-primary/5 text-primary font-medium hover:bg-primary/10'
                : 'border-border bg-background text-muted-foreground hover:bg-secondary/40'
            }`}>
              <span>{vehicleName || '— בחר רכב —'}</span>
              {vehicleId ? <XIcon size={12} className="ml-1" /> : <ChevronDown size={12} className="opacity-50 shrink-0" />}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="end">
            <Command>
              <CommandInput placeholder="חיפוש רכב..." className="h-8 text-xs" />
              <CommandList>
                <CommandEmpty>לא נמצא</CommandEmpty>
                <CommandGroup>
                  {availableVehicles.filter(v => !otherIds.includes(v.id)).map(v => (
                    <CommandItem key={v.id} value={v.name} onSelect={() => {
                      handleVehicleSelect(v.id, v.name, slotIndex);
                      setOpenSlot(null);
                    }} className="text-xs cursor-pointer">
                      {v.name}{v.license_plate ? ` (${v.license_plate})` : ''}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm leading-tight">{workplaceName}</span>
        <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full shrink-0">
          {studentCount} תלמידים
        </span>
      </div>

      {/* Exit Time */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock size={11} /> שעת יציאה
        </label>
        <input
          type="time"
          value={currentData.exit_time || ''}
          onChange={e => onSave(workplaceId, workplaceName, { ...currentData, exit_time: e.target.value })}
          className="w-full h-8 text-xs border border-border rounded-md px-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>

      {/* Vehicle Selectors */}
      {renderVehicleSelector(1)}
      {renderVehicleSelector(2)}
      {renderVehicleSelector(3)}
    </div>
  );
}

export default function LogisticsSidebar({ date, assignments }) {
  const queryClient = useQueryClient();

  const { data: logisticsList = [] } = useQuery({
    queryKey: ['workplace-logistics', date],
    queryFn: () => base44.entities.WorkplaceLogistics.filter({ date }),
  });

  // Build map: workplaceId -> logistics record
  const logisticsMap = useMemo(() => {
    const map = {};
    logisticsList.forEach(l => { map[l.workplace_id] = l; });
    return map;
  }, [logisticsList]);

  // Build active workplaces from assignments (skip special)
  const SKIP = ['לא עובד', 'לימודים'];
  const activeWorkplaces = useMemo(() => {
    const map = {};
    assignments.filter(a => !SKIP.includes(a.workplace_name)).forEach(a => {
      if (!map[a.workplace_id]) map[a.workplace_id] = { name: a.workplace_name, count: 0 };
      map[a.workplace_id].count++;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => a.name.localeCompare(b.name, 'he'))
      .map(([id, v]) => ({ id, name: v.name, count: v.count }));
  }, [assignments]);

  const handleSave = async (workplaceId, workplaceName, data) => {
    const existing = logisticsList.find(l => l.workplace_id === workplaceId);
    if (existing) {
      await base44.entities.WorkplaceLogistics.update(existing.id, data);
    } else {
      await base44.entities.WorkplaceLogistics.create({ date, workplace_id: workplaceId, workplace_name: workplaceName, ...data });
    }
    queryClient.invalidateQueries({ queryKey: ['workplace-logistics', date] });
  };

  if (activeWorkplaces.length === 0) {
    return (
      <div className="w-64 shrink-0">
        <div className="sticky top-4 bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Truck size={15} className="text-primary" /> לוגיסטיקה
          </h3>
          <p className="text-xs text-muted-foreground">אין שיבוצים להיום</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0">
      <div className="sticky top-4 bg-secondary/30 border border-border rounded-2xl p-3 space-y-3 max-h-[calc(100vh-8rem)] overflow-y-auto">
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