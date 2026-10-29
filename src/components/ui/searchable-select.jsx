import * as React from "react";
import { ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
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

/** @param {any} item */
function defaultGetValue(item) {
  return item?.id ?? item;
}

/** @param {any} item */
function defaultGetLabel(item) {
  return item?.name ?? String(item ?? "");
}

/** @param {any} text */
function normalize(text) {
  return String(text ?? "")
    .trim()
    .toLowerCase();
}

/**
 * @param {{
 *   items?: any[],
 *   value?: any,
 *   onValueChange?: (value: any, item: any) => void,
 *   getValue?: (item: any) => any,
 *   getLabel?: (item: any) => any,
 *   getSearchText?: (item: any) => any,
 *   placeholder?: string,
 *   searchPlaceholder?: string,
 *   emptyText?: string,
 *   extraItem?: { value: any, label?: any, className?: string },
 *   open?: boolean,
 *   onOpenChange?: (open: boolean) => void,
 *   trigger?: (state: {
 *     selectedLabel: any,
 *     isPlaceholder: boolean,
 *     open: boolean,
 *     placeholder: string,
 *   }) => React.ReactNode,
 *   triggerClassName?: string,
 *   contentClassName?: string,
 *   align?: "start" | "center" | "end",
 *   dir?: string,
 *   itemClassName?: string,
 *   searchInputClassName?: string,
 *   disabled?: boolean,
 *   maxItems?: number,
 *   showChevron?: boolean,
 *   chevronSize?: number,
 * }} props
 */
export function SearchableSelect({
  items = [],
  value,
  onValueChange,
  getValue = defaultGetValue,
  getLabel = defaultGetLabel,
  getSearchText = undefined,
  placeholder = "בחר...",
  searchPlaceholder = "חיפוש...",
  emptyText = "לא נמצא",
  extraItem = undefined,
  open: openProp = undefined,
  onOpenChange = undefined,
  trigger = undefined,
  triggerClassName = undefined,
  contentClassName = undefined,
  align = "start",
  dir = "rtl",
  itemClassName = undefined,
  searchInputClassName = "h-8 text-xs",
  disabled = false,
  maxItems = undefined,
  showChevron = true,
  chevronSize = 14,
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;

  /** @param {boolean} next */
  const handleOpenChange = (next) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
    if (!next) setSearch("");
  };

  const selectedItem = items.find(
    (item) => String(getValue(item)) === String(value),
  );
  const selectedLabel = selectedItem
    ? getLabel(selectedItem)
    : extraItem != null && String(extraItem.value) === String(value)
      ? extraItem.label
      : "";

  const query = normalize(search);
  /** @param {any} text */
  const matchesQuery = (text) => !query || normalize(text).includes(query);
  const filteredItems = items.filter((item) =>
    matchesQuery(getSearchText ? getSearchText(item) : getLabel(item)),
  );
  const visibleItems = maxItems
    ? filteredItems.slice(0, maxItems)
    : filteredItems;
  const visibleExtra =
    extraItem != null && matchesQuery(extraItem.label) ? extraItem : null;

  /** @param {any} item */
  const handleSelectItem = (item) => {
    handleOpenChange(false);
    onValueChange?.(getValue(item), item);
  };

  const handleSelectExtra = () => {
    if (visibleExtra == null) return;
    handleOpenChange(false);
    onValueChange?.(visibleExtra.value, null);
  };

  const triggerNode = trigger
    ? trigger({
        selectedLabel,
        isPlaceholder: !selectedItem,
        open,
        placeholder,
      })
    : (
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50",
            triggerClassName,
          )}
        >
          <span
            className={cn("truncate", !selectedItem && "text-muted-foreground")}
          >
            {selectedLabel || placeholder}
          </span>
          {showChevron ? (
            <ChevronsUpDown
              size={chevronSize}
              className="mr-1 shrink-0 opacity-50"
            />
          ) : null}
        </button>
      );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        {triggerNode}
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-[var(--radix-popover-trigger-width)] max-h-[min(20rem,var(--radix-popover-content-available-height))] overflow-hidden p-0",
          contentClassName,
        )}
        align={align}
        side="bottom"
        avoidCollisions={false}
        dir={dir}
      >
        <Command shouldFilter={false} className="h-full max-h-[inherit]">
          <CommandInput
            placeholder={searchPlaceholder}
            className={searchInputClassName}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="min-h-0 max-h-none flex-1">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {visibleExtra ? (
                <CommandItem
                  value="__extra__"
                  onSelect={handleSelectExtra}
                  className={cn(
                    "cursor-pointer text-xs text-muted-foreground",
                    visibleExtra.className,
                    itemClassName,
                  )}
                >
                  {visibleExtra.label}
                </CommandItem>
              ) : null}
              {visibleItems.map((item) => {
                const itemValue = getValue(item);
                return (
                  <CommandItem
                    key={String(itemValue)}
                    value={`${itemValue} ${getLabel(item)}`}
                    onSelect={() => handleSelectItem(item)}
                    className={cn("cursor-pointer text-xs", itemClassName)}
                  >
                    {getLabel(item)}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
