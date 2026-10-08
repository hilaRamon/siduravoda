import { Truck } from "lucide-react";
import WorkplaceLogisticsCard from "./WorkplaceLogisticsCard";
import { useLogisticsByWorkplace } from "@/hooks/assignments/useLogisticsByWorkplace";
import { useLogisticsWorkplaces } from "@/hooks/assignments/useLogisticsWorkplaces";
import {
  useCreateWorkplaceLogistics,
  useUpdateWorkplaceLogistics,
} from "@/queries/workplaceLogisticsQueries";

export default function LogisticsSidebar({ date, assignments }) {
  /** @type {import('@tanstack/react-query').UseMutationResult<any, Error, any>} */
  const createLogistics = useCreateWorkplaceLogistics();
  const updateLogistics = useUpdateWorkplaceLogistics();

  const { logisticsList, logisticsMap } = useLogisticsByWorkplace(date);
  const { workplaces } = useLogisticsWorkplaces(date, assignments);

  const handleSave = async (workplaceId, data) => {
    const payload = {
      vehicle_id: data.vehicle_id || null,
      vehicle_id_2: data.vehicle_id_2 || null,
      vehicle_id_3: data.vehicle_id_3 || null,
      exit_time: data.exit_time,
      notes: data.notes,
      is_piecework: Boolean(data.is_piecework),
      units_name: data.is_piecework ? data.units_name || "" : "",
      rate: data.is_piecework ? (data.rate ?? null) : null,
    };
    const existing = logisticsMap[workplaceId];
    if (existing?.id) {
      await updateLogistics.mutateAsync({
        id: existing.id,
        data: payload,
        date,
      });
    } else {
      await createLogistics.mutateAsync({
        date,
        workplace_id: workplaceId,
        ...payload,
      });
    }
  };

  if (workplaces.length === 0) {
    return (
      <div className="w-64 shrink-0">
        <div className="fixed top-8 bg-card border border-border rounded-2xl p-4 w-64 z-10 flex flex-col gap-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Truck size={15} className="text-primary" /> לוגיסטיקה
          </h3>
          <p className="text-xs text-muted-foreground">אין שיבוצים להיום</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0">
      <div className="fixed top-8 bg-secondary/30 border border-border rounded-2xl p-3 space-y-2 w-64 max-h-[calc(100vh-5rem)] overflow-y-auto z-10">
        <h3 className="font-semibold text-sm flex items-center gap-2 px-1">
          <Truck size={15} className="text-primary" /> לוגיסטיקה יומית
        </h3>
        {workplaces.map((wp) => (
          <WorkplaceLogisticsCard
            key={wp.id}
            date={date}
            workplaceId={wp.id}
            workplaceName={wp.name}
            studentCount={wp.count}
            requestedVolunteers={wp.requestedVolunteers}
            logistics={logisticsMap[wp.id]}
            allLogistics={logisticsList}
            onSave={handleSave}
          />
        ))}
      </div>
    </div>
  );
}
