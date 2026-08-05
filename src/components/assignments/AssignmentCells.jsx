import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronsUpDown, Pencil, X } from "lucide-react";

export function WorkplaceCell({
  student,
  assignment,
  workplaces,
  onAssign,
  onRemove,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredWorkplaces = workplaces.filter(
    (w) => !search || w.name.includes(search),
  );

  const handleSelect = async (workplace) => {
    setOpen(false);
    setSearch("");
    if (!workplace) return;
    const canAssign = await onAssign(student, workplace, assignment);
    if (!canAssign) setOpen(true);
  };

  const selectedName = assignment
    ? workplaces.find((w) => w.id === assignment.workplace_id)?.name ||
      assignment.workplace_name
    : null;

  return (
    <td className="px-3 py-2 border-b border-border">
      <div className="flex items-center gap-1">
        <Popover
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setSearch("");
          }}
        >
          <PopoverTrigger asChild>
            <button
              className={`h-8 text-xs w-full border rounded-md px-2 flex items-center justify-between transition-colors ${
                assignment
                  ? "bg-primary/10 border-primary/30 text-primary font-medium hover:bg-primary/20"
                  : "bg-secondary/50 border-dashed text-muted-foreground hover:bg-secondary hover:border-border"
              }`}
            >
              <span className="truncate">{selectedName || "+ שבץ"}</span>
              <ChevronsUpDown size={12} className="shrink-0 opacity-50 mr-1" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="חיפוש מקום עבודה..."
                className="h-8 text-xs"
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                <CommandEmpty>לא נמצא</CommandEmpty>
                <CommandGroup>
                  {filteredWorkplaces.map((w) => (
                    <CommandItem
                      key={w.id}
                      value={w.name}
                      onSelect={() => handleSelect(w)}
                      className="text-xs cursor-pointer"
                    >
                      {w.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {assignment && (
          <button
            onClick={() => onRemove(assignment.id)}
            className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </td>
  );
}

export function RoleCell({ assignment, roles, onUpdateRole }) {
  const handleRoleChange = (v) => {
    if (!assignment) return;
    onUpdateRole(assignment, v);
  };

  return (
    <td className="px-3 py-2 border-b border-border">
      <Select
        value={assignment?.role || ""}
        onValueChange={handleRoleChange}
        disabled={!assignment}
      >
        <SelectTrigger
          className={`h-8 text-xs w-full border ${assignment ? "bg-secondary/50 border-border" : "bg-transparent border-dashed text-muted-foreground opacity-50"}`}
        >
          <SelectValue placeholder="— בחר תפקיד —" />
        </SelectTrigger>
        <SelectContent align="start">
          <SelectItem value="none">— ללא תפקיד —</SelectItem>
          {roles.map((r) => (
            <SelectItem key={r.id} value={r.name}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </td>
  );
}

export function EditableNumberCell({
  value,
  defaultValue,
  assignment,
  field,
  onUpdate,
  formatDisplay = undefined,
  parseCommit = undefined,
}) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState("");

  const rawValue =
    value != null && value !== "" && value !== undefined ? value : defaultValue;
  const displayValue = formatDisplay ? formatDisplay(rawValue) : rawValue;

  const startEdit = () => {
    if (!assignment) return;
    setLocalVal(displayValue != null ? String(displayValue) : "");
    setEditing(true);
  };

  const commit = async () => {
    setEditing(false);
    const num = localVal === "" ? null : parseFloat(localVal);
    const stored =
      num == null ? null : parseCommit ? parseCommit(num) : num;
    const currentStored =
      value != null && value !== "" && value !== undefined ? value : null;
    if (stored !== currentStored) {
      await onUpdate(assignment, field, stored);
    }
  };

  if (!assignment) {
    return (
      <td className="px-3 py-2 border-b border-border text-muted-foreground text-xs text-center">
        —
      </td>
    );
  }

  return (
    <td className="px-3 py-2 border-b border-border">
      {editing ? (
        <input
          autoFocus
          type="number"
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-full h-8 border border-primary rounded-md px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-card"
          step="0.5"
        />
      ) : (
        <button
          onClick={startEdit}
          className="w-full h-8 text-xs text-right px-2 rounded-md hover:bg-secondary/60 transition-colors flex items-center justify-between group"
        >
          <span>{displayValue ?? "—"}</span>
          <Pencil
            size={10}
            className="opacity-0 group-hover:opacity-40 transition-opacity"
          />
        </button>
      )}
    </td>
  );
}
