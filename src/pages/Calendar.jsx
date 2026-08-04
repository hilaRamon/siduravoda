import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  useAbsenceRequests,
  useCreateManualAbsence,
} from '@/queries/absenceQueries';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, Plus, Trash2, CalendarDays } from 'lucide-react';
import { format, addWeeks, subWeeks, startOfWeek, addDays } from 'date-fns';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

function getWeekDays(baseDate) {
  const sunday = startOfWeek(baseDate, { weekStartsOn: 0 });
  return Array.from({ length: 5 }, (_, i) => addDays(sunday, i));
}

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];

function AddFarmerRequestForm({ date, workplaces }) {
  const [open, setOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedWorkplace, setSelectedWorkplace] = useState(null);
  const [volunteers, setVolunteers] = useState('');
  const queryClient = useQueryClient();

  const filtered = workplaces.filter(w =>
    !search || w.name.includes(search)
  );

  const handleAdd = async () => {
    if (!selectedWorkplace) return;
    await base44.entities.FarmerRequest.create({
      date,
      workplace_id: selectedWorkplace.id,
      workplace_name: selectedWorkplace.name,
      requested_volunteers: volunteers !== '' ? parseInt(volunteers) : null,
    });
    queryClient.invalidateQueries({ queryKey: ['farmer-requests'] });
    setSelectedWorkplace(null);
    setVolunteers('');
    setSearch('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-primary hover:opacity-70 mt-1"
      >
        <Plus size={13} /> הוסף דרישה
      </button>
    );
  }

  return (
    <div className="mt-1 space-y-1.5 bg-secondary/30 rounded-lg p-2">
      <Popover open={popoverOpen} onOpenChange={(v) => { setPopoverOpen(v); if (!v) setSearch(''); }}>
        <PopoverTrigger asChild>
          <button className="w-full h-7 border border-border rounded-md px-2 text-xs flex items-center justify-between bg-card hover:bg-secondary/40">
            <span className={selectedWorkplace ? '' : 'text-muted-foreground'}>
              {selectedWorkplace ? selectedWorkplace.name : 'בחר מקום עבודה...'}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start" dir="rtl">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="חיפוש..."
              className="h-7 text-xs"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>לא נמצא</CommandEmpty>
              <CommandGroup>
                {filtered.map(w => (
                  <CommandItem
                    key={w.id}
                    value={w.name}
                    onSelect={() => { setSelectedWorkplace(w); setPopoverOpen(false); setSearch(''); }}
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

      <input
        type="number"
        min="1"
        value={volunteers}
        onChange={e => setVolunteers(e.target.value)}
        placeholder="כמות מבוקשת"
        className="w-full h-7 border border-border rounded-md px-2 text-xs bg-card focus:outline-none focus:ring-1 focus:ring-primary/40"
      />

      <div className="flex gap-1">
        <Button size="sm" className="h-6 text-xs flex-1" onClick={handleAdd} disabled={!selectedWorkplace}>
          אישור
        </Button>
        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setOpen(false); setSelectedWorkplace(null); setVolunteers(''); }}>
          ביטול
        </Button>
      </div>
    </div>
  );
}

function AddAbsenceForm({ date, students }) {
  const [open, setOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const createMutation = useCreateManualAbsence();

  const filtered = students.filter(s =>
    !search || (s.full_name || '').includes(search)
  );

  const handleAdd = async () => {
    if (!selectedStudent) return;
    setError('');
    try {
      await createMutation.mutateAsync({
        date,
        student_id: selectedStudent.id,
        reason: reason || '',
      });
      setSelectedStudent(null);
      setReason('');
      setSearch('');
      setOpen(false);
    } catch (err) {
      setError(err.message || 'הוספה נכשלה');
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-primary hover:opacity-70 mt-1"
      >
        <Plus size={13} /> הוסף היעדרות
      </button>
    );
  }

  return (
    <div className="mt-1 space-y-1.5 bg-secondary/30 rounded-lg p-2">
      <Popover open={popoverOpen} onOpenChange={(v) => { setPopoverOpen(v); if (!v) setSearch(''); }}>
        <PopoverTrigger asChild>
          <button className="w-full h-7 border border-border rounded-md px-2 text-xs flex items-center justify-between bg-card hover:bg-secondary/40">
            <span className={selectedStudent ? '' : 'text-muted-foreground'}>
              {selectedStudent ? selectedStudent.full_name : 'בחר תלמיד...'}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start" dir="rtl">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="חיפוש..."
              className="h-7 text-xs"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>לא נמצא</CommandEmpty>
              <CommandGroup>
                {filtered.map(s => (
                  <CommandItem
                    key={s.id}
                    value={s.full_name}
                    onSelect={() => { setSelectedStudent(s); setPopoverOpen(false); setSearch(''); }}
                    className="text-xs cursor-pointer"
                  >
                    {s.full_name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <input
        type="text"
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="סיבה (אופציונלי)"
        className="w-full h-7 border border-border rounded-md px-2 text-xs bg-card focus:outline-none focus:ring-1 focus:ring-primary/40"
      />

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-1">
        <Button size="sm" className="h-6 text-xs flex-1" onClick={handleAdd} disabled={!selectedStudent || createMutation.isPending}>
          אישור
        </Button>
        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setOpen(false); setSelectedStudent(null); setReason(''); setError(''); }}>
          ביטול
        </Button>
      </div>
    </div>
  );
}

function DayColumn({ day, farmerRequests, absences, workplaces, students, studentsById }) {
  const queryClient = useQueryClient();
  const dateStr = format(day, 'yyyy-MM-dd');
  const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');

  const dayFarmerRequests = farmerRequests.filter(r => r.date === dateStr);
  const dayAbsences = absences.filter(
    a => a.date === dateStr && a.status === 'אושר' && a.student_id,
  );

  const handleDeleteRequest = async (id) => {
    await base44.entities.FarmerRequest.delete(id);
    queryClient.invalidateQueries({ queryKey: ['farmer-requests'] });
  };

  return (
    <div className={`flex-1 min-w-0 bg-card rounded-xl border ${isToday ? 'border-primary shadow-sm' : 'border-border'} p-3 space-y-3`}>
      <div className={`text-center pb-2 border-b border-border`}>
        <div className={`text-lg font-semibold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
          {DAY_NAMES[day.getDay()]}
        </div>
        <div className={`text-xl font-bold mt-0.5 ${isToday ? 'text-primary' : ''}`}>
          {day.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}
        </div>
      </div>

      <div>
        <div className="text-base font-bold text-foreground mb-2">🌾 חקלאים</div>
        {dayFarmerRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין דרישות</p>
        ) : (
          <div className="space-y-1">
            {dayFarmerRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between gap-1 bg-primary/5 border border-primary/15 rounded-md px-2 py-1">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{req.workplace_name}</div>
                  {req.requested_volunteers && (
                    <div className="text-sm text-muted-foreground">{req.requested_volunteers} מתנדבים</div>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteRequest(req.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <AddFarmerRequestForm date={dateStr} workplaces={workplaces} />
      </div>

      <div>
        <div className="text-base font-bold text-foreground mb-2">🚫 היעדרויות</div>
        {dayAbsences.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין היעדרויות</p>
        ) : (
          <div className="space-y-1">
            {dayAbsences.map(abs => (
              <div key={abs.id} className="bg-destructive/5 border border-destructive/15 rounded-md px-2 py-1">
                <div className="text-sm font-medium">
                  {studentsById[abs.student_id]?.full_name || '—'}
                </div>
                {abs.reason && (
                  <div className="text-sm text-muted-foreground truncate">{abs.reason}</div>
                )}
              </div>
            ))}
          </div>
        )}
        <AddAbsenceForm date={dateStr} students={students} />
      </div>
    </div>
  );
}

export default function Calendar() {
  const [weekBase, setWeekBase] = useState(new Date());
  const days = useMemo(() => getWeekDays(weekBase), [weekBase]);

  const startDate = format(days[0], 'yyyy-MM-dd');
  const endDate = format(days[4], 'yyyy-MM-dd');

  const { data: farmerRequests = [] } = useQuery({
    queryKey: ['farmer-requests'],
    queryFn: () => base44.entities.FarmerRequest.list('-date', 500),
  });

  const { data: absences = [] } = useAbsenceRequests({
    startDate,
    endDate,
    status: 'אושר',
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list('full_name', 1000),
  });

  const studentsById = useMemo(() => {
    const map = {};
    students.forEach(s => { map[s.id] = s; });
    return map;
  }, [students]);

  const { data: workplaces = [] } = useQuery({
    queryKey: ['workplaces'],
    queryFn: () => base44.entities.Workplace.list('name', 1000),
    select: (data) => [...data].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he')),
  });

  const weekLabel = `${days[0].toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })} – ${days[4].toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays size={22} className="text-primary" />
            יומן שבועי
          </h2>
          <p className="text-muted-foreground text-sm mt-0.5">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekBase(w => subWeeks(w, 1))}>
            <ChevronRight size={16} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekBase(new Date())}>
            השבוע
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekBase(w => addWeeks(w, 1))}>
            <ChevronLeft size={16} />
          </Button>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {days.map(day => (
          <DayColumn
            key={day.toISOString()}
            day={day}
            farmerRequests={farmerRequests}
            absences={absences}
            workplaces={workplaces}
            students={students}
            studentsById={studentsById}
          />
        ))}
      </div>
    </div>
  );
}
