import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Truck, Clock, ChevronDown, X } from 'lucide-react';
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

  // Vehicles already assigned to OTHER workplaces today
  const takenVehicleIds = new Set(
    allLogistics
      .filter(l => l.workplace_id !== workplaceId)
      .flatMap(l => [l.vehicle_id, l.vehicle_id_2].filter(Boolean))
  );
  const availableVehicles = vehicles.filter(v => !takenVehicleIds.has(v.id));

  const toggleVehicle = (vehicleId, vehicleName) => {
    const ids = [...selectedVehicleIds];
    const idx = ids.indexOf(vehicleId);
    if (idx >= 0) {
      ids.splice(idx, 1);
    } else {
      ids.push(vehicleId);
    }
    const newData = {
      ...currentData,
      vehicle_id: ids[0] || '',
      vehicle_name: ids[0] ? vehicles.find(v => v.id === ids[0])?.name : '',
      vehicle_id_2: ids[1] || '',
      vehicle_name_2: ids[1] ? vehicles.find(v => v.id === ids[1])?.name : '',
    };
    onSave(workplaceId, workplaceName, newData);
  };

  const removeVehicle = (vehicleId) => {
    const ids = selectedVehicleIds.filter(id => id !== vehicleId);
    const newData = {
      ...currentData,
      vehicle_id: ids[0] || '',
      vehicle_name: ids[0] ? vehicles.find(v => v.id === ids[0])?.name : '',
      vehicle_id_2: ids[1] || '',
      vehicle_name_2: ids[1] ? vehicles.find(v => v.id === ids[1])?.name : '',
    };
    onSave(workplaceId, workplaceName, newData);
  };

  const selectedNames = selectedVehicleIds
    .map(id => vehicles.find(v => v.id === id)?.name)
    .filter(Boolean);

  return (
    <div className="bg-card border border-border rounded-xl p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm leading-tight">{workplaceName}</span>
        <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full shrink-0">
          {studentCount} תלמידים
        </span>
      </div>

      {/* Vehicles */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground flex items-center gap-1">
          <Truck size={11} /> רכבים
        </label>
        {selectedNames.length === 0 ? (
          <Popover open={vehicleOpen} onOpenChange={setVehicleOpen}>
            <PopoverTrigger asChild>
              <button className="w-full h-8 text-xs border border-border rounded-md px-2 flex items-center justify-between bg-background hover:bg-secondary/40 transition-colors">
                <span className="text-muted-foreground">— בחר רכב —</span>
                <ChevronDown size={12} className="opacity-50 shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="end">
              <Command>
                <CommandInput placeholder="חיפוש רכב..." className="h-8 text-xs" />
                <CommandList>
                  <CommandEmpty>לא נמצא</CommandEmpty>
                  <CommandGroup>
                    {availableVehicles.map(v => (
                      <CommandItem key={v.id} value={v.name} onSelect={() => toggleVehicle(v.id, v.name)} className="text-xs cursor-pointer flex items-center gap-2 px-2 py-1.5">
                        <Checkbox checked={selectedVehicleIds.includes(v.id)} onCheckedChange={() => toggleVehicle(v.id, v.name)} />
                        <span>{v.name}{v.license_plate ? ` (${v.license_plate})` : ''}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1">
              {selectedNames.map((name, idx) => {
                const vehicleId = selectedVehicleIds[idx];
                return (
                  <span key={vehicleId} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                    {name}
                    <button onClick={() => { removeVehicle(vehicleId); setVehicleOpen(false); }} className="hover:opacity-70">
                      <X size={10} />
                    </button>
                  </span>
                );
              })}
            </div>
            <Popover open={vehicleOpen} onOpenChange={setVehicleOpen}>
              <PopoverTrigger asChild>
                <button className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  + הוסף
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0" align="end">
                <Command>
                  <CommandInput placeholder="חיפוש רכב..." className="h-8 text-xs" />
                  <CommandList>
                    <CommandEmpty>לא נמצא</CommandEmpty>
                    <CommandGroup>
                      {availableVehicles.map(v => (
                        <CommandItem key={v.id} value={v.name} onSelect={() => toggleVehicle(v.id, v.name)} className="text-xs cursor-pointer flex items-center gap-2 px-2 py-1.5">
                          <Checkbox checked={selectedVehicleIds.includes(v.id)} onCheckedChange={() => toggleVehicle(v.id, v.name)} />
                          <span>{v.name}{v.license_plate ? ` (${v.license_plate})` : ''}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}
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