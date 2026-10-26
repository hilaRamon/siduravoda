import { SearchableSelect } from '@/components/ui/searchable-select';
import { X } from 'lucide-react';

export default function ForbiddenWorkplacesCell({ student, workplaces, onUpdate }) {
  const forbiddenIds = student.forbidden_workplaces || [];
  const forbiddenNames = forbiddenIds
    .map(id => workplaces.find(w => w.id === id)?.name)
    .filter(Boolean);

  const handleAdd = async (_id, workplace) => {
    if (!workplace) return;
    const updated = [...forbiddenIds, workplace.id];
    await onUpdate({ forbidden_workplaces: updated });
  };

  const handleRemove = async (workplaceId) => {
    const updated = forbiddenIds.filter(id => id !== workplaceId);
    await onUpdate({ forbidden_workplaces: updated });
  };

  const availableWorkplaces = workplaces.filter(w => !forbiddenIds.includes(w.id));

  return (
    <td className="px-5 py-3">
      <div className="flex flex-wrap gap-1 items-center">
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
        <SearchableSelect
          items={availableWorkplaces}
          value=""
          onValueChange={handleAdd}
          getValue={(w) => w.id}
          getLabel={(w) => w.name}
          placeholder={forbiddenNames.length === 0 ? '— בחר —' : '+ הוסף'}
          searchPlaceholder="חיפוש..."
          showChevron={false}
          contentClassName="w-64"
          trigger={({ placeholder }) => (
            <button type="button" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              {placeholder}
            </button>
          )}
        />
      </div>
    </td>
  );
}
