import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Truck, Clock, ChevronDown, User } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

function WorkplaceLogisticsCard({ date, workplaceId, workplaceName, studentCount, students, logistics, allLogistics, onSave }) {
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [driverOpen, setDriverOpen] = useState(false);

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const currentData = logistics || {};

  // Vehicles already assigned to OTHER workplaces today
  const takenVehicleIds = new Set(
    allLogistics
      .filter(l => l.workplace_id !== workplaceId && l.vehicle_id)
      .map(l => l.vehicle_id)
  );
  const availableVehicles = vehicles.filter(v => !takenVehicleIds.has(v.id));

  const update = (field, value) => {
    onSave(workplaceId, workplaceName, { ...currentData, [field]: value });
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

      {/* Driver */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground flex items-center gap-1">
          <User size={11} /> נהג
        </label>
        <Popover open={driverOpen} onOpenChange={setDriverOpen}>
          <PopoverTrigger asChild>
            <button className="w-full h-8 text-xs border border-border rounded-md px-2 flex items-center justify-between bg-background hover:bg-secondary/40 transition-colors">
              <span className={currentData.driver_student_name ? '' : 'text-muted-foreground'}>
                {currentData.driver_student_name || '— בחר נהג —'}
              </span>
              <ChevronDown size={12} className="opacity-50 shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="end">
            <Command>
              <CommandInput placeholder="חיפוש נהג..." className="h-8 text-xs" />
              <CommandList>
                <CommandEmpty>לא נמצא</CommandEmpty>
                <CommandGroup>
                  <CommandItem value="__clear__" onSelect={() => {
                    onSave(workplaceId, workplaceName, { ...currentData, driver_student_id: '', driver_student_name: '' });
                    setDriverOpen(false);
                  }} className="text-xs text-muted-foreground">
                    — ללא נהג —
                  </CommandItem>
                  {students.map(s => (
                    <CommandItem key={s.student_id} value={s.student_name || ''} onSelect={() => {
                      onSave(workplaceId, workplaceName, { ...currentData, driver_student_id: s.student_id, driver_student_name: s.student_name });
                      setDriverOpen(false);
                    }} className="text-xs">
                      {s.student_name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Vehicle */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground flex items-center gap-1">
          <Truck size={11} /> רכב
        </label>
        <Popover open={vehicleOpen} onOpenChange={setVehicleOpen}>
          <PopoverTrigger asChild>
            <button className="w-full h-8 text-xs border border-border rounded-md px-2 flex items-center justify-between bg-background hover:bg-secondary/40 transition-colors">
              <span className={currentData.vehicle_name ? '' : 'text-muted-foreground'}>
                {currentData.vehicle_name || '— בחר רכב —'}
              </span>
              <ChevronDown size={12} className="opacity-50 shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="end">
            <Command>
              <CommandInput placeholder="חיפוש רכב..." className="h-8 text-xs" />
              <CommandList>
                <CommandEmpty>לא נמצא</CommandEmpty>
                <CommandGroup>
                  <CommandItem value="__clear__" onSelect={() => { update('vehicle_id', ''); update('vehicle_name', ''); setVehicleOpen(false); }} className="text-xs text-muted-foreground">
                    — ללא רכב —
                  </CommandItem>
                  {availableVehicles.map(v => (
                    <CommandItem key={v.id} value={v.name} onSelect={() => {
                      onSave(workplaceId, workplaceName, { ...currentData, vehicle_id: v.id, vehicle_name: v.name });
                      setVehicleOpen(false);
                    }} className="text-xs">
                      {v.name}{v.license_plate ? ` (${v.license_plate})` : ''}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Exit Time */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock size={11} /> שעת יציאה
        </label>
        <input
          type="time"
          value={currentData.exit_time || ''}
          onChange={e => update('exit_time', e.target.value)}
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
      if (!map[a.workplace_id]) map[a.workplace_id] = { name: a.workplace_name, count: 0, students: [] };
      map[a.workplace_id].count++;
      map[a.workplace_id].students.push(a);
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => a.name.localeCompare(b.name, 'he'))
      .map(([id, v]) => ({ id, name: v.name, count: v.count, students: v.students }));
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
            students={wp.students}
            logistics={logisticsMap[wp.id]}
            allLogistics={logisticsList}
            onSave={handleSave}
          />
        ))}
      </div>
    </div>
  );
}