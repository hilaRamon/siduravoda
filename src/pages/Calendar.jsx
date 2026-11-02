import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWorkplaces } from '@/queries/workplaceQueries';
import { assignmentApi } from '@/api/assignmentApi';
import { assignmentKeys } from '@/queries/assignmentQueries';
import {
  useAbsenceRequests,
  useDeleteAbsence,
  useSetAbsenceWorkplace,
} from '@/queries/absenceQueries';
import {
  NOT_WORKING_WORKPLACE_NAME,
  PNIMIYA_WORKPLACE_NAME,
} from '@/lib/assignmentHelpers';
import { showAlert } from '@/components/AppAlert';
import {
  useFarmerRequests,
  useDeleteFarmerRequest,
} from '@/queries/farmerRequestQueries';
import { AddFarmerRequestForm, AddAbsenceForm } from '@/components/calendar/AddMultiDayForm';
import { DeleteIconButton } from '@/components/calendar/DeleteIconButton';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ChevronRight, ChevronLeft, CalendarDays, Loader2 } from 'lucide-react';
import { format, addWeeks, subWeeks, startOfWeek, addDays } from 'date-fns';
import { useStudents } from '@/queries/studentQueries';

function getWeekDays(baseDate) {
  const sunday = startOfWeek(baseDate, { weekStartsOn: 0 });
  return Array.from({ length: 5 }, (_, i) => addDays(sunday, i));
}

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];

function DayColumn({ day, farmerRequests, absences, assignments, workplaces, students, studentsById }) {
  const deleteRequestMutation = useDeleteFarmerRequest();
  const deleteAbsenceMutation = useDeleteAbsence();
  const setWorkplaceMutation = useSetAbsenceWorkplace();
  const [deletingId, setDeletingId] = useState(null);
  const dateStr = format(day, 'yyyy-MM-dd');
  const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');

  const dayFarmerRequests = farmerRequests.filter(r => r.date === dateStr);
  const dayAbsences = absences.filter(
    a => a.date === dateStr && a.status === 'אושר' && a.student_id,
  );
  const assignmentByStudent = useMemo(() => {
    const map = {};
    assignments
      .filter((row) => row.date === dateStr && row.student_id)
      .forEach((row) => {
        const current = map[row.student_id];
        if (!current) {
          map[row.student_id] = row;
          return;
        }
        const currentNumber = current.work_number ?? 1;
        const nextNumber = row.work_number ?? 1;
        if (nextNumber < currentNumber) map[row.student_id] = row;
      });
    return map;
  }, [assignments, dateStr]);

  const handleWorkplace = async (absence, workplaceName) => {
    const assignment = assignmentByStudent[absence.student_id];
    if (assignment?.workplace_name === workplaceName) return;
    try {
      await setWorkplaceMutation.mutateAsync({
        id: absence.id,
        workplace_name: workplaceName,
      });
    } catch (error) {
      await showAlert(error.message || 'העדכון נכשל');
    }
  };

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
              const workplacePending =
                setWorkplaceMutation.isPending &&
                setWorkplaceMutation.variables?.id === abs.id;
              const shownWorkplace = workplacePending
                ? setWorkplaceMutation.variables.workplace_name
                : assignmentByStudent[abs.student_id]?.workplace_name;
              const isPnimiya = shownWorkplace === PNIMIYA_WORKPLACE_NAME;
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
                    <label className="mt-0.5 inline-flex items-center gap-1.5 cursor-pointer">
                      <Switch
                        size="xs"
                        checked={isPnimiya}
                        disabled={!!deletingId || workplacePending}
                        onCheckedChange={(checked) =>
                          handleWorkplace(
                            abs,
                            checked
                              ? PNIMIYA_WORKPLACE_NAME
                              : NOT_WORKING_WORKPLACE_NAME,
                          )
                        }
                        aria-label="בפנימיה"
                      />
                      <span
                        className={`text-[11px] leading-none ${
                          isPnimiya
                            ? 'text-primary font-medium'
                            : 'text-muted-foreground'
                        }`}
                      >
                        בפנימיה
                      </span>
                      {workplacePending && (
                        <Loader2
                          size={11}
                          className="animate-spin text-muted-foreground"
                          aria-label="טוען"
                        />
                      )}
                    </label>
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

  const { data: assignments = [] } = useQuery({
    queryKey: [...assignmentKeys.all, 'range', startDate, endDate],
    queryFn: () =>
      assignmentApi.list({ startDate, endDate, limit: 5000 }),
  });

  const { students } = useStudents();

  const studentsById = useMemo(() => {
    const map = {};
    students.forEach(s => { map[s.id] = s; });
    return map;
  }, [students]);

  const { data: workplaces = [] } = useWorkplaces();

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
            assignments={assignments}
            workplaces={workplaces}
            students={students}
            studentsById={studentsById}
          />
        ))}
      </div>
    </div>
  );
}
