import { ChevronsUpDown, Truck } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';

export default function VehicleSlot({ slotIndex, vehicleId, vehicleName, availableVehicles, otherIds, onSelect }) {
  const handleSelect = (id, vehicle) => {
    if (!id) {
      onSelect('', '', slotIndex);
      return;
    }
    onSelect(id, vehicle?.name || '', slotIndex);
  };

  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground flex items-center gap-1">
        <Truck size={11} /> רכב {slotIndex}
      </label>
      <SearchableSelect
        items={availableVehicles.filter((v) => !otherIds.includes(v.id))}
        value={vehicleId || ''}
        onValueChange={handleSelect}
        getValue={(v) => v.id}
        getLabel={(v) => v.license_plate ? `${v.name} (${v.license_plate})` : v.name}
        getSearchText={(v) => `${v.name}${v.license_plate ? ` ${v.license_plate}` : ''}`}
        placeholder="— בחר רכב —"
        searchPlaceholder="חיפוש רכב..."
        extraItem={
          vehicleId
            ? { value: '', label: '✕ הסר רכב', className: 'text-destructive' }
            : undefined
        }
        align="end"
        contentClassName="w-56"
        chevronSize={12}
        trigger={({ placeholder: triggerPlaceholder }) => (
          <button
            type="button"
            className={`w-full h-8 text-xs border rounded-md px-2 flex items-center justify-between transition-colors ${
              vehicleId
                ? 'border-primary bg-primary/5 text-primary font-medium hover:bg-primary/10'
                : 'border-border bg-background text-muted-foreground hover:bg-secondary/40'
            }`}
          >
            <span>{vehicleName || triggerPlaceholder}</span>
            <ChevronsUpDown size={12} className="opacity-50 shrink-0" />
          </button>
        )}
      />
    </div>
  );
}
