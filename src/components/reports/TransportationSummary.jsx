import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import DailyDateNav from "@/components/DailyDateNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useVehicles } from "@/queries/vehicleQueries";
import { useWorkplaceLogisticsByDate } from "@/queries/workplaceLogisticsQueries";
import {
  useCreateTransportationSummary,
  useTransportationSummaries,
  useUpdateTransportationSummary,
} from "@/queries/transportationSummaryQueries";

const cellClass =
  "w-full h-8 text-sm border border-border rounded-md px-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40";

const DEFAULT_ADD_FORM = {
  vehicleId: "",
  assembly: "טצ",
  destination: "",
  departureTime: "06:35",
  returnTime: "12:00",
};

export default function TransportationSummary() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(DEFAULT_ADD_FORM);
  const [error, setError] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [resetRowId, setResetRowId] = useState("");

  const { data: rows = [], isLoading } = useTransportationSummaries(date);
  const { data: vehicles = [] } = useVehicles();
  const { data: logistics = [] } = useWorkplaceLogisticsByDate(date);
  const createSummary = useCreateTransportationSummary();
  const updateSummary = useUpdateTransportationSummary();

  const transportationVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.is_transportation === true),
    [vehicles],
  );

  const inUseIds = useMemo(() => {
    const ids = new Set();
    for (const row of logistics) {
      for (const id of [row.vehicle_id, row.vehicle_id_2, row.vehicle_id_3]) {
        if (id) ids.add(id);
      }
    }
    return ids;
  }, [logistics]);

  const saveCell = async (row, patch) => {
    setError("");
    try {
      await updateSummary.mutateAsync({ id: row.id, data: patch, date });
    } catch (err) {
      setError(err.message || "השמירה נכשלה");
      setResetRowId(row.id);
      setResetKey((value) => value + 1);
    }
  };

  const openAdd = () => {
    setAddForm(DEFAULT_ADD_FORM);
    setError("");
    setAddOpen(true);
  };

  const handleAdd = async () => {
    setError("");
    if (!addForm.vehicleId) {
      setError("יש לבחור רכב");
      return;
    }
    if (!addForm.departureTime) {
      setError("יש לבחור שעת יציאה");
      return;
    }
    if (!addForm.returnTime) {
      setError("יש לבחור שעת חזרה");
      return;
    }
    try {
      await createSummary.mutateAsync({
        date,
        vehicle_id: addForm.vehicleId,
        assembly: addForm.assembly,
        destination: addForm.destination,
        departure_time: addForm.departureTime,
        return_time: addForm.returnTime,
      });
      setAddOpen(false);
      setAddForm(DEFAULT_ADD_FORM);
    } catch (err) {
      setError(err.message || "ההוספה נכשלה");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <DailyDateNav date={date} onDateChange={setDate} />
        <Button onClick={openAdd}>
          <Plus size={16} className="ml-2" />
          הוסף הסעה
        </Button>
      </div>

      {!addOpen && error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setError("");
        }}
      >
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>הוספת הסעה</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">סוג רכב</label>
              <SearchableSelect
                items={transportationVehicles}
                value={addForm.vehicleId}
                onValueChange={(id) =>
                  setAddForm((form) => ({ ...form, vehicleId: id || "" }))
                }
                getValue={(vehicle) => vehicle.id}
                getSearchText={(vehicle) => vehicle.name || ""}
                getLabel={(vehicle) => (
                  <span className="flex items-center gap-2">
                    <span>{vehicle.name}</span>
                    {inUseIds.has(vehicle.id) ? (
                      <span className="text-[10px] leading-none font-medium bg-primary/10 text-primary rounded-full px-1.5 py-0.5">
                        בשימוש
                      </span>
                    ) : null}
                  </span>
                )}
                placeholder="בחר רכב הסעה"
                searchPlaceholder="חיפוש רכב..."
                emptyText="אין רכבי הסעה"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">התייצבות</label>
              <Input
                value={addForm.assembly}
                onChange={(event) =>
                  setAddForm((form) => ({ ...form, assembly: event.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">יעד</label>
              <Input
                value={addForm.destination}
                onChange={(event) =>
                  setAddForm((form) => ({ ...form, destination: event.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">שעת יציאה</label>
              <input
                type="time"
                dir="ltr"
                value={addForm.departureTime}
                onChange={(event) =>
                  setAddForm((form) => ({ ...form, departureTime: event.target.value }))
                }
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 h-9"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">שעת חזרה</label>
              <input
                type="time"
                dir="ltr"
                value={addForm.returnTime}
                onChange={(event) =>
                  setAddForm((form) => ({ ...form, returnTime: event.target.value }))
                }
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 h-9"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                ביטול
              </Button>
              <Button onClick={handleAdd} disabled={createSummary.isPending}>
                <Plus size={14} className="ml-2" />
                הוסף
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 border-b border-border">
            <tr>
              <th className="px-3 py-3 text-right font-semibold text-muted-foreground text-xs">סוג רכב</th>
              <th className="px-3 py-3 text-right font-semibold text-muted-foreground text-xs">התייצבות</th>
              <th className="px-3 py-3 text-right font-semibold text-muted-foreground text-xs">יעד</th>
              <th className="px-3 py-3 text-right font-semibold text-muted-foreground text-xs">שעת יציאה</th>
              <th className="px-3 py-3 text-right font-semibold text-muted-foreground text-xs">שעת חזרה</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-muted-foreground">
                  טוען...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-muted-foreground">
                  אין הסעות ליום זה
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={`${row.id}-${resetRowId === row.id ? resetKey : 0}`}
                  className="border-t border-border"
                >
                  <td className="px-3 py-2 font-medium">{row.vehicle_name}</td>
                  <td className="px-3 py-2">
                    <input
                      defaultValue={row.assembly || ""}
                      onBlur={(event) => {
                        if (event.target.value !== (row.assembly || "")) {
                          saveCell(row, { assembly: event.target.value });
                        }
                      }}
                      className={cellClass}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      defaultValue={row.destination || ""}
                      onBlur={(event) => {
                        if (event.target.value !== (row.destination || "")) {
                          saveCell(row, { destination: event.target.value });
                        }
                      }}
                      className={cellClass}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="time"
                      dir="ltr"
                      defaultValue={row.departure_time || ""}
                      onBlur={(event) => {
                        if (
                          event.target.value &&
                          event.target.value !== row.departure_time
                        ) {
                          saveCell(row, { departure_time: event.target.value });
                        }
                      }}
                      className={`${cellClass} text-center`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="time"
                      dir="ltr"
                      defaultValue={row.return_time || ""}
                      onBlur={(event) => {
                        if (
                          event.target.value &&
                          event.target.value !== row.return_time
                        ) {
                          saveCell(row, { return_time: event.target.value });
                        }
                      }}
                      className={`${cellClass} text-center`}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
