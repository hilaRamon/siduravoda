import { useState, useMemo } from 'react';
import { useCreateManualAbsence } from '@/queries/absenceQueries';
import { useCreateFarmerRequest } from '@/queries/farmerRequestQueries';
import { Button } from '@/components/ui/button';
import { Calendar as DayPickerCalendar } from '@/components/ui/calendar';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Plus, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

function isWeekend(day) {
  const d = day.getDay();
  return d === 5 || d === 6;
}

function dateKey(day) {
  return format(day, 'yyyy-MM-dd');
}

/**
 * Shared multi-day add form used for farmer requests and absences.
 *
 * @param {object} props
 * @param {string} props.date - Seed date (yyyy-MM-dd)
 * @param {string} props.triggerLabel
 * @param {any[]} props.items - Selectable entities (workplaces / students)
 * @param {(item: any) => string} props.getItemLabel
 * @param {string} props.selectPlaceholder
 * @param {{ type: string, placeholder: string, min?: string|number }} [props.detailField]
 * @param {(args: { item: any, detail: string, dates: Date[] }) => Promise<void>} props.onSubmit
 * @param {boolean} [props.pending]
 */
export function AddMultiDayForm({
  date,
  triggerLabel,
  items,
  getItemLabel,
  selectPlaceholder,
  detailField,
  onSubmit,
  pending = false,
}) {
  const [open, setOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detail, setDetail] = useState('');
  const [selectedDates, setSelectedDates] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isBusy = submitting || pending;

  const sortedSelectedDates = useMemo(
    () => [...selectedDates].sort((a, b) => a - b),
    [selectedDates],
  );

  const resetForm = () => {
    setSelectedItem(null);
    setDetail('');
    setSelectedDates([]);
    setDatePickerOpen(false);
    setError('');
    setOpen(false);
  };

  const handleOpen = () => {
    setSelectedDates([parseISO(date)]);
    setError('');
    setOpen(true);
  };

  const removeDate = (day) => {
    const key = dateKey(day);
    setSelectedDates((prev) => prev.filter((d) => dateKey(d) !== key));
  };

  const handleAdd = async () => {
    if (!selectedItem || selectedDates.length === 0) return;
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({
        item: selectedItem,
        detail,
        dates: selectedDates,
      });
      resetForm();
    } catch (err) {
      setError(err.message || 'הוספה נכשלה');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="flex items-center gap-1 text-xs text-primary hover:opacity-70 mt-1"
      >
        <Plus size={13} /> {triggerLabel}
      </button>
    );
  }

  return (
    <div className="mt-1 space-y-1.5 bg-secondary/30 rounded-lg p-2">
      <SearchableSelect
        items={items}
        value={selectedItem?.id || ''}
        onValueChange={(_id, item) => {
          if (item) setSelectedItem(item);
        }}
        getValue={(item) => item.id}
        getLabel={getItemLabel}
        placeholder={selectPlaceholder}
        searchPlaceholder="חיפוש..."
        triggerClassName="h-7 px-2 text-xs bg-card hover:bg-secondary/40 shadow-none"
        searchInputClassName="h-7 text-xs"
        chevronSize={12}
      />

      {detailField && (
        <input
          type={detailField.type}
          min={detailField.min}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder={detailField.placeholder}
          className="w-full h-7 border border-border rounded-md px-2 text-xs bg-card focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      )}

      <div className="space-y-1">
        <div className="flex flex-wrap gap-1">
          {sortedSelectedDates.map((d) => (
            <span
              key={dateKey(d)}
              className="inline-flex items-center gap-0.5 bg-card border border-border rounded px-1.5 py-0.5 text-[11px]"
            >
              {d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}
              <button
                type="button"
                onClick={() => removeDate(d)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="הסר יום"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-primary hover:opacity-70"
            >
              <Plus size={12} /> הוסף ימים
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" dir="rtl">
            <DayPickerCalendar
              className=""
              classNames={{}}
              mode="multiple"
              selected={selectedDates}
              onSelect={(dates) => setSelectedDates(dates || [])}
              disabled={isWeekend}
              defaultMonth={parseISO(date)}
            />
          </PopoverContent>
        </Popover>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-1">
        <Button
          size="sm"
          className="h-6 text-xs flex-1"
          onClick={handleAdd}
          disabled={!selectedItem || selectedDates.length === 0 || isBusy}
        >
          {selectedDates.length > 1 ? `אישור (${selectedDates.length})` : 'אישור'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs"
          onClick={resetForm}
          disabled={isBusy}
        >
          ביטול
        </Button>
      </div>
    </div>
  );
}

export function AddFarmerRequestForm({ date, workplaces }) {
  const createMutation = useCreateFarmerRequest();

  return (
    <AddMultiDayForm
      date={date}
      triggerLabel="הוסף דרישה"
      items={workplaces}
      getItemLabel={(w) => w.name}
      selectPlaceholder="בחר מקום עבודה..."
      detailField={{
        type: 'number',
        min: 1,
        placeholder: 'כמות מבוקשת',
      }}
      pending={createMutation.isPending}
      onSubmit={async ({ item, detail, dates }) => {
        const requested_volunteers = detail !== '' ? parseInt(detail, 10) : null;
        /** @type {(vars: { date: string, workplace_id: string, workplace_name?: string, requested_volunteers?: number|null }) => Promise<unknown>} */
        const createRequest = createMutation.mutateAsync;
        await Promise.all(
          dates.map((d) =>
            createRequest({
              date: dateKey(d),
              workplace_id: item.id,
              workplace_name: item.name,
              requested_volunteers,
            }),
          ),
        );
      }}
    />
  );
}

export function AddAbsenceForm({ date, students }) {
  const createMutation = useCreateManualAbsence();

  return (
    <AddMultiDayForm
      date={date}
      triggerLabel="הוסף היעדרות"
      items={students}
      getItemLabel={(s) => s.full_name || ''}
      selectPlaceholder="בחר תלמיד..."
      detailField={{
        type: 'text',
        placeholder: 'סיבה (אופציונלי)',
      }}
      pending={createMutation.isPending}
      onSubmit={async ({ item, detail, dates }) => {
        /** @type {(vars: { date: string, student_id: string, reason?: string }) => Promise<unknown>} */
        const createAbsence = createMutation.mutateAsync;
        await Promise.all(
          dates.map((d) =>
            createAbsence({
              date: dateKey(d),
              student_id: item.id,
              reason: detail || '',
            }),
          ),
        );
      }}
    />
  );
}
