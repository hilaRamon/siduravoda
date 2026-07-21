import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { X } from 'lucide-react';

export default function ForbiddenWorkplacesCell({ student, workplaces, onSave }) {
  const [open, setOpen] = useState(false);
  const forbiddenIds = student.forbidden_workplaces || [];
  const forbiddenNames = forbiddenIds
    .map(id => workplaces.find(w => w.id === id)?.name)
    .filter(Boolean);

  const handleAdd = async (workplaceId) => {
    const updated = [...forbiddenIds, workplaceId];
    await base44.entities.Student.update(student.id, { forbidden_workplaces: updated });
    onSave();
    setOpen(false);
  };

  const handleRemove = async (workplaceId) => {
    const updated = forbiddenIds.filter(id => id !== workplaceId);
    await base44.entities.Student.update(student.id, { forbidden_workplaces: updated });
    onSave();
  };

  const availableWorkplaces = workplaces.filter(w => !forbiddenIds.includes(w.id));

  return (
    <td className="px-5 py-3">
      <div className="flex flex-wrap gap-1 items-center">
        {forbiddenNames.length === 0 ? (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button className="text-xs text-muted-foreground hover:text-primary transition-colors">
                — בחר —
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <Command>
                <CommandInput placeholder="חיפוש..." className="h-8 text-xs" />
                <CommandList>
                  <CommandEmpty>לא נמצא</CommandEmpty>
                  <CommandGroup>
                    {availableWorkplaces.map(w => (
                      <CommandItem key={w.id} value={w.name} onSelect={() => handleAdd(w.id)} className="text-xs cursor-pointer">
                        {w.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <>
            {forbiddenNames.map((name, idx) => {
              const workplaceId = forbiddenIds[idx];
              return (
                <span key={workplaceId} className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded-full flex items-center gap-1">
                  {name}
                  <button onClick={() => handleRemove(workplaceId)} className="hover:opacity-70">
                    <X size={10} />
                  </button>
                </span>
              );
            })}
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <button className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  + הוסף
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <Command>
                  <CommandInput placeholder="חיפוש..." className="h-8 text-xs" />
                  <CommandList>
                    <CommandEmpty>לא נמצא</CommandEmpty>
                    <CommandGroup>
                      {availableWorkplaces.map(w => (
                        <CommandItem key={w.id} value={w.name} onSelect={() => handleAdd(w.id)} className="text-xs cursor-pointer">
                          {w.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </>
        )}
      </div>
    </td>
  );
}