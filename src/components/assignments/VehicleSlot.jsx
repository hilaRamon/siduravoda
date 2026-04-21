import { useState } from 'react';
import { Truck, ChevronDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export default function VehicleSlot({ slotIndex, vehicleId, vehicleName, availableVehicles, otherIds, onSelect }) {
  const [open, setOpen] = useState(false);

  const handleSelect = (id, name) => {
    onSelect(id, name, slotIndex);
    setOpen(false);
  };

  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground flex items-center gap-1">
        <Truck size={11} /> רכב {slotIndex}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className={`w-full h-8 text-xs border rounded-md px-2 flex items-center justify-between transition-colors ${
            vehicleId
              ? 'border-primary bg-primary/5 text-primary font-medium hover:bg-primary/10'
              : 'border-border bg-background text-muted-foreground hover:bg-secondary/40'
          }`}>
            <span>{vehicleName || '— בחר רכב —'}</span>
            <ChevronDown size={12} className="opacity-50 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="end">
          <Command>
            <CommandInput placeholder="חיפוש רכב..." className="h-8 text-xs" />
            <CommandList>
              <CommandEmpty>לא נמצא</CommandEmpty>
              <CommandGroup>
                {vehicleId && (
                  <CommandItem value="__clear__" onSelect={() => handleSelect('', '')} className="text-xs text-destructive cursor-pointer">
                    ✕ הסר רכב
                  </CommandItem>
                )}
                {availableVehicles
                  .filter(v => !otherIds.includes(v.id))
                  .map(v => (
                    <CommandItem
                      key={v.id}
                      value={v.name}
                      onSelect={() => handleSelect(v.id, v.name)}
                      className="text-xs cursor-pointer"
                    >
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
}