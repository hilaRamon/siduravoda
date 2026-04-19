import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronRight, ChevronLeft, Copy, CalendarDays, X, ChevronsUpDown } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';

function WorkplaceCell({ student, assignment, workplaces, onAssign, onRemove }) {
  const [open, setOpen] = useState(false);

  const handleSelect = async (workplaceId) => {
    setOpen(false);
    if (!workplaceId) return;
    const workplace = workplaces.find(w => w.id === workplaceId);
    await onAssign(student, workplace, assignment);
  };

  const selectedName = assignment ? workplaces.find(w => w.id === assignment.workplace_id)?.name || assignment.workplace_name : null;

  return (
    <td className="px-3 py-2 border-b border-border">
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button className={`h-8 text-xs w-full border rounded-md px-2 flex items-center justify-between transition-colors ${
              assignment
                ? 'bg-primary/10 border-primary/30 text-primary font-medium hover:bg-primary/20'
                : 'bg-secondary/50 border-dashed text-muted-foreground hover:bg-secondary hover:border-border'
            }`}>
              <span className="truncate">{selectedName || '+ שבץ'}</span>
              <ChevronsUpDown size={12} className="shrink-0 opacity-50 mr-1" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="חיפוש מקום עבודה..." className="h-8 text-xs" />
              <CommandList>
                <CommandEmpty>לא נמצא</CommandEmpty>
                <CommandGroup>
                  {workplaces.map(w => (
                    <CommandItem key={w.id} value={w.name} onSelect={() => handleSelect(w.id)}
                      className="text-xs cursor-pointer">
                      {w.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {assignment && (
          <button onClick={() => onRemove(assignment.id)}
            className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <X size={12} />
          </button>
        )}
      </div>
    </td>
  );
}

function RoleCell({ assignment, roles, onUpdateRole }) {
  return (
    <td className="px-3 py-2 border-b border-border">
      <Select
        value={assignment?.role || ''}
        onValueChange={(v) => assignment && onUpdateRole(assignment, v)}
        disabled={!assignment}
      >
        <SelectTrigger className={`h-8 text-xs w-full border ${assignment ? 'bg-secondary/50 border-border' : 'bg-transparent border-dashed text-muted-foreground opacity-50'}`}>
          <SelectValue placeholder="— בחר תפקיד —" />
        </SelectTrigger>
        <SelectContent align="start">
          <SelectItem value="none">— ללא תפקיד —</SelectItem>
          {roles.map(r => (
            <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </td>
  );
}

// Mini filter input inside table header
function HeaderFilter({ children, filter, onFilter }) {
  return (
    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
      <div className="flex flex-col gap-1">
        <span className="text-xs">{children}</span>
        {filter}
      </div>
    </th>
  );
}

export default function Assignments() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [cloning, setCloning] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [cloneTargetDate, setCloneTargetDate] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterCohort, setFilterCohort] = useState('');
  const [filterWorkplace, setFilterWorkplace] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterAssigned, setFilterAssigned] = useState('');
  const queryClient = useQueryClient();

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments', date],
    queryFn: () => base44.entities.Assignment.filter({ date }),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list('-created_date'),
  });

  const { data: workplaces = [] } = useQuery({
    queryKey: ['workplaces'],
    queryFn: () => base44.entities.Workplace.list(),
    select: (data) => [...data].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he')),
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => base44.entities.Role.list(),
  });

  const assignmentByStudent = useMemo(() => {
    const map = {};
    assignments.forEach(a => { map[a.student_id] = a; });
    return map;
  }, [assignments]);

  const cohorts = useMemo(() => [...new Set(students.map(s => s.cohort).filter(Boolean))], [students]);

  const filteredStudents = useMemo(() => students.filter(s => {
    const a = assignmentByStudent[s.id];
    // Show only active students, OR students that already have an assignment for this date
    if (s.is_active === false && !a) return false;
    if (filterName && !s.full_name?.includes(filterName)) return false;
    if (filterCohort && filterCohort !== 'all' && s.cohort !== filterCohort) return false;
    if (filterWorkplace && filterWorkplace !== 'all') {
      if (!a || a.workplace_id !== filterWorkplace) return false;
    }
    if (filterRole && filterRole !== 'all') {
      if (!a || a.role !== filterRole) return false;
    }
    if (filterAssigned === 'assigned' && !a) return false;
    if (filterAssigned === 'unassigned' && a) return false;
    return true;
  }).sort((a, b) => {
    const aAssign = assignmentByStudent[a.id];
    const bAssign = assignmentByStudent[b.id];
    const aWp = aAssign?.workplace_name || '';
    const bWp = bAssign?.workplace_name || '';
    if (aWp !== bWp) return aWp.localeCompare(bWp, 'he');
    const aCohort = a.cohort || '';
    const bCohort = b.cohort || '';
    if (aCohort !== bCohort) return aCohort.localeCompare(bCohort, 'he');
    return (a.full_name || '').localeCompare(b.full_name || '', 'he');
  }), [students, assignmentByStudent, filterName, filterCohort, filterWorkplace, filterRole, filterAssigned]);

  const handleAssign = async (student, workplace, existingAssignment) => {
    if (existingAssignment) {
      await base44.entities.Assignment.delete(existingAssignment.id);
    }
    await base44.entities.Assignment.create({
      date,
      student_id: student.id,
      student_name: student.full_name,
      workplace_id: workplace.id,
      workplace_name: workplace.name,
    });
    queryClient.invalidateQueries({ queryKey: ['assignments', date] });
  };

  const handleRemove = async (id) => {
    await base44.entities.Assignment.delete(id);
    queryClient.invalidateQueries({ queryKey: ['assignments', date] });
  };

  const handleUpdateRole = async (assignment, roleName) => {
    await base44.entities.Assignment.update(assignment.id, { role: roleName === 'none' ? '' : roleName });
    queryClient.invalidateQueries({ queryKey: ['assignments', date] });
  };

  const handleCloneDay = async () => {
    if (!cloneTargetDate) return;
    setCloning(true);
    const toCreate = assignments.map(a => ({
      date: cloneTargetDate,
      student_id: a.student_id,
      student_name: a.student_name,
      workplace_id: a.workplace_id,
      workplace_name: a.workplace_name,
      role: a.role,
    }));
    await base44.entities.Assignment.bulkCreate(toCreate);
    queryClient.invalidateQueries({ queryKey: ['assignments'] });
    setCloning(false);
    setShowCloneDialog(false);
    setCloneTargetDate('');
    alert(`שוכפלו ${toCreate.length} שיבוצים לתאריך ${cloneTargetDate}`);
  };

  const prevDay = () => setDate(format(subDays(new Date(date + 'T12:00:00'), 1), 'yyyy-MM-dd'));
  const nextDay = () => setDate(format(addDays(new Date(date + 'T12:00:00'), 1), 'yyyy-MM-dd'));

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">שיבוצים יומיים</h2>
          <p className="text-muted-foreground mt-1">
            {assignments.length} משובצים מתוך {students.length} תלמידים
          </p>
        </div>
        <Button variant="outline" onClick={() => { setCloneTargetDate(''); setShowCloneDialog(true); }}>
          <Copy size={16} className="ml-2" /> שכפל שיבוצים
        </Button>
      </div>

      {/* Date Picker */}
      <div className="flex items-center gap-3 mb-5">
        <Button variant="outline" size="icon" onClick={prevDay}><ChevronRight size={18} /></Button>
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-primary" />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <Button variant="outline" size="icon" onClick={nextDay}><ChevronLeft size={18} /></Button>
        <span className="text-sm text-muted-foreground">
          {new Date(date + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {/* Clone Dialog */}
      <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>שכפול שיבוצים</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              שכפל את {assignments.length} השיבוצים מתאריך <strong>{date}</strong> לתאריך:
            </p>
            <input
              type="date"
              value={cloneTargetDate}
              onChange={e => setCloneTargetDate(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setShowCloneDialog(false)}>ביטול</Button>
              <Button onClick={handleCloneDay} disabled={!cloneTargetDate || cloning}>
                <Copy size={14} className="ml-2" /> {cloning ? 'משכפל...' : 'שכפל'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground w-8 text-xs">#</th>

              {/* שם תלמיד */}
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                <div className="flex flex-col gap-1">
                  <span className="text-xs">שם תלמיד</span>
                  <Input
                    value={filterName}
                    onChange={e => setFilterName(e.target.value)}
                    placeholder="חיפוש..."
                    className="h-7 text-xs"
                  />
                </div>
              </th>

              {/* מחזור */}
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                <div className="flex flex-col gap-1">
                  <span className="text-xs">מחזור</span>
                  <Select value={filterCohort} onValueChange={setFilterCohort}>
                    <SelectTrigger className="h-7 text-xs w-full">
                      <SelectValue placeholder="הכל" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">הכל</SelectItem>
                      {cohorts.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </th>

              {/* מקום עבודה */}
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground w-56">
                <div className="flex flex-col gap-1">
                  <span className="text-xs">מקום עבודה</span>
                  <Select value={filterWorkplace} onValueChange={setFilterWorkplace}>
                    <SelectTrigger className="h-7 text-xs w-full">
                      <SelectValue placeholder="הכל" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">הכל</SelectItem>
                      {workplaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </th>

              {/* תפקיד */}
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground w-40">
                <div className="flex flex-col gap-1">
                  <span className="text-xs">תפקיד</span>
                  <Select value={filterRole} onValueChange={setFilterRole}>
                    <SelectTrigger className="h-7 text-xs w-full">
                      <SelectValue placeholder="הכל" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">הכל</SelectItem>
                      {roles.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </th>

              {/* הערות / סטטוס שיבוץ */}
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                <div className="flex flex-col gap-1">
                  <span className="text-xs">שיבוץ</span>
                  <Select value={filterAssigned} onValueChange={setFilterAssigned}>
                    <SelectTrigger className="h-7 text-xs w-full">
                      <SelectValue placeholder="הכל" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">הכל</SelectItem>
                      <SelectItem value="assigned">משובצים</SelectItem>
                      <SelectItem value="unassigned">לא משובצים</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  {students.length === 0 ? 'אין תלמידים במערכת' : 'לא נמצאו תוצאות לסינון'}
                </td>
              </tr>
            ) : (
              filteredStudents.map((student, idx) => {
                const assignment = assignmentByStudent[student.id];
                return (
                  <tr key={student.id} className={`transition-colors ${assignment ? 'bg-primary/5' : 'hover:bg-secondary/20'}`}>
                    <td className="px-3 py-2 border-b border-border text-muted-foreground text-xs">{idx + 1}</td>
                    <td className="px-3 py-2 border-b border-border font-medium">{student.full_name}</td>
                    <td className="px-3 py-2 border-b border-border text-muted-foreground text-xs">{student.cohort || '—'}</td>
                    <WorkplaceCell
                      student={student}
                      assignment={assignment}
                      workplaces={workplaces}
                      onAssign={handleAssign}
                      onRemove={handleRemove}
                    />
                    <RoleCell
                      assignment={assignment}
                      roles={roles}
                      onUpdateRole={handleUpdateRole}
                    />
                    <td className="px-3 py-2 border-b border-border text-muted-foreground text-xs">
                      {assignment?.notes || '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}