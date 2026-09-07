import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAbsenceRequests, useDeleteAbsence } from '@/queries/absenceQueries';
import {
  useFarmerRequests,
  useDeleteFarmerRequest,
} from '@/queries/farmerRequestQueries';
import { AddFarmerRequestForm, AddAbsenceForm } from '@/components/calendar/AddMultiDayForm';
import { DeleteIconButton } from '@/components/calendar/DeleteIconButton';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, CalendarDays } from 'lucide-react';
import { format, addWeeks, subWeeks, startOfWeek, addDays } from 'date-fns';
import { useStudents } from '@/queries/studentQueries';

function getWeekDays(baseDate) {
  const sunday = startOfWeek(baseDate, { weekStartsOn: 0 });
  return Array.from({ length: 5 }, (_, i) => addDays(sunday, i));
}

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];

function DayColumn({ day, farmerRequests, absences, workplaces, students, studentsById }) {
  const deleteRequestMutation = useDeleteFarmerRequest();
  const deleteAbsenceMutation = useDeleteAbsence();
  const [deletingId, setDeletingId] = useState(null);
  const dateStr = format(day, 'yyyy-MM-dd');
  const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');

  const dayFarmerRequests = farmerRequests.filter(r => r.date === dateStr);
  const dayAbsences = absences.filter(
    a => a.date === dateStr && a.status === 'אושר' && a.student_id,
  );

  const handleDelete = async (id, mutateAsync) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await mutateAsync(id);
    } finally {
      setDeletingId(null);
    }
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
            {dayFarmerRequests.map(req => {
              const isDeleting = deletingId === req.id;
              return (
                <div
                  key={req.id}
                  className={`flex items-center justify-between gap-1 bg-primary/5 border border-primary/15 rounded-md px-2 py-1 ${isDeleting ? 'opacity-60' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{req.workplace_name}</div>
                    {req.requested_volunteers && (
                      <div className="text-sm text-muted-foreground">{req.requested_volunteers} מתנדבים</div>
                    )}
                  </div>
                  <DeleteIconButton
                    onClick={() => handleDelete(req.id, deleteRequestMutation.mutateAsync)}
                    disabled={!!deletingId}
                    isDeleting={isDeleting}
                    ariaLabel="מחק דרישה"
                  />
                </div>
              );
            })}
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
            {dayAbsences.map(abs => {
              const isDeleting = deletingId === abs.id;
              return (
                <div
                  key={abs.id}
                  className={`flex items-center justify-between gap-1 bg-destructive/5 border border-destructive/15 rounded-md px-2 py-1 ${isDeleting ? 'opacity-60' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {studentsById[abs.student_id]?.full_name || '—'}
                    </div>
                    {abs.reason && (
                      <div className="text-sm text-muted-foreground truncate">{abs.reason}</div>
                    )}
                  </div>
                  <DeleteIconButton
                    onClick={() => handleDelete(abs.id, deleteAbsenceMutation.mutateAsync)}
                    disabled={!!deletingId}
                    isDeleting={isDeleting}
                    ariaLabel="מחק היעדרות"
                  />
                </div>
              );
            })}
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

  const { data: farmerRequests = [] } = useFarmerRequests({
    startDate,
    endDate,
  });

  const { data: absences = [] } = useAbsenceRequests({
    startDate,
    endDate,
    status: 'אושר',
  });

  const { students } = useStudents();

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
