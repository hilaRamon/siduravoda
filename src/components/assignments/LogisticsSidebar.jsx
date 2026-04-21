import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Truck, Clock } from 'lucide-react';
import VehicleSlot from './VehicleSlot';

function WorkplaceLogisticsCard({ date, workplaceId, workplaceName, studentCount, logistics, allLogistics, onSave }) {
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const currentData = logistics || {};

  const selectedVehicleIds = [currentData.vehicle_id, currentData.vehicle_id_2, currentData.vehicle_id_3].filter(Boolean);

  // Vehicles taken globally across all workplaces today
  const allTakenVehicleIds = new Set(
    allLogistics.flatMap(l => [l.vehicle_id, l.vehicle_id_2, l.vehicle_id_3].filter(Boolean))
  );

  // Available = not taken by others, OR already selected in this workplace
  const availableVehicles = vehicles.filter(v => !allTakenVehicleIds.has(v.id) || selectedVehicleIds.includes(v.id));

  const handleVehicleSelect = (vehicleId, vehicleName, slotIndex) => {
    const newData = { ...currentData };
    if (slotIndex === 1) {
      newData.vehicle_id = vehicleId || null;
      newData.vehicle_name = vehicleName || null;
    } else if (slotIndex === 2) {
      newData.vehicle_id_2 = vehicleId || null;
      newData.vehicle_name_2 = vehicleName || null;
    } else if (slotIndex === 3) {
      newData.vehicle_id_3 = vehicleId || null;
      newData.vehicle_name_3 = vehicleName || null;
    }
    onSave(workplaceId, workplaceName, newData);
  };

  const getOtherIds = (slotIndex) => [
    slotIndex !== 1 && currentData.vehicle_id,
    slotIndex !== 2 && currentData.vehicle_id_2,
    slotIndex !== 3 && currentData.vehicle_id_3,
  ].filter(Boolean);

  return (
    <div className="bg-card border border-border rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm leading-tight">{workplaceName}</span>
        <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full shrink-0">
          {studentCount} תלמידים
        </span>
      </div>

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

      <VehicleSlot
        slotIndex={1}
        vehicleId={currentData.vehicle_id}
        vehicleName={currentData.vehicle_name}
        availableVehicles={availableVehicles}
        otherIds={getOtherIds(1)}
        onSelect={handleVehicleSelect}
      />
      <VehicleSlot
        slotIndex={2}
        vehicleId={currentData.vehicle_id_2}
        vehicleName={currentData.vehicle_name_2}
        availableVehicles={availableVehicles}
        otherIds={getOtherIds(2)}
        onSelect={handleVehicleSelect}
      />
      <VehicleSlot
        slotIndex={3}
        vehicleId={currentData.vehicle_id_3}
        vehicleName={currentData.vehicle_name_3}
        availableVehicles={availableVehicles}
        otherIds={getOtherIds(3)}
        onSelect={handleVehicleSelect}
      />
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
    logisticsList.forEach(l => { map[l.workplace_id] = l; });
    return map;
  }, [logisticsList]);

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