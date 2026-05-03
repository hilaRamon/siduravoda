import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRight, ChevronLeft, Copy, CalendarDays, X, ChevronsUpDown, Pencil, AlertCircle } from 'lucide-react';
import DailyReportPDFButton from '@/components/reports/DailyReportPDFButton';
import LogisticsSidebar from '@/components/assignments/LogisticsSidebar';
import { format, addDays, subDays } from 'date-fns';

function WorkplaceCell({ student, assignment, workplaces, onAssign, onRemove }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredWorkplaces = workplaces.filter(w =>
    !search || w.name.includes(search)
  );

  const handleSelect = async (workplace) => {
    setOpen(false);
    setSearch('');
    if (!workplace) return;
    const canAssign = await onAssign(student, workplace, assignment);
    if (!canAssign) setOpen(true);
  };

  const selectedName = assignment ? workplaces.find(w => w.id === assignment.workplace_id)?.name || assignment.workplace_name : null;

  return (
    <td className="px-3 py-2 border-b border-border">
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(''); }}>
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
                  {filteredWorkplaces.map(w => (
                    <CommandItem key={w.id} value={w.name} onSelect={() => handleSelect(w)}
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
  const handleRoleChange = (v) => {
    if (!assignment) return;
    onUpdateRole(assignment, v);
  };

  return (
    <td className="px-3 py-2 border-b border-border">
      <Select
        value={assignment?.role || ''}
        onValueChange={handleRoleChange}
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

function EditableNumberCell({ value, defaultValue, assignment, field, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState('');

  const displayValue = (value != null && value !== '' && value !== undefined) ? value : defaultValue;

  const startEdit = () => {
    if (!assignment) return;
    setLocalVal(displayValue != null ? String(displayValue) : '');
    setEditing(true);
  };

  const commit = async () => {
    setEditing(false);
    const num = localVal === '' ? null : parseFloat(localVal);
    if (num !== displayValue) {
      await onUpdate(assignment, field, num);
    }
  };

  if (!assignment) {
    return <td className="px-3 py-2 border-b border-border text-muted-foreground text-xs text-center">—</td>;
  }

  return (
    <td className="px-3 py-2 border-b border-border">
      {editing ? (
        <input
          autoFocus
          type="number"
          value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          className="w-full h-8 border border-primary rounded-md px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-card"
          step="0.5"
        />
      ) : (
        <button
          onClick={startEdit}
          className="w-full h-8 text-xs text-right px-2 rounded-md hover:bg-secondary/60 transition-colors flex items-center justify-between group"
        >
          <span>{displayValue ?? '—'}</span>
          <Pencil size={10} className="opacity-0 group-hover:opacity-40 transition-opacity" />
        </button>
      )}
    </td>
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

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [lastSelectedIdx, setLastSelectedIdx] = useState(null);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkWorkplace, setBulkWorkplace] = useState('');
  const [bulkHours, setBulkHours] = useState('');
  const [bulkRate, setBulkRate] = useState('');
  const [bulkWorkplaceOpen, setBulkWorkplaceOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments', date],
    queryFn: () => base44.entities.Assignment.filter({ date }, '-created_date', 500),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list('-created_date'),
  });

  const { data: workplaces = [] } = useQuery({
    queryKey: ['workplaces'],
    queryFn: () => base44.entities.Workplace.list('name', 1000),
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
    if (s.is_active === false && !a) return false;
    // Hide students added after the selected date (unless they already have an assignment)
    if (!a && s.created_date && s.created_date.slice(0, 10) > date) return false;
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

  const allVisibleSelected = filteredStudents.length > 0 &&
    filteredStudents.every(s => selectedIds.has(assignmentByStudent[s.id]?.id || s.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map(s => assignmentByStudent[s.id]?.id || s.id)));
    }
  };

  const toggleSelect = (studentId, rowIdx, shiftKey) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedIdx !== null) {
        const from = Math.min(lastSelectedIdx, rowIdx);
        const to = Math.max(lastSelectedIdx, rowIdx);
        for (let i = from; i <= to; i++) {
          const s = filteredStudents[i];
          if (s) next.add(assignmentByStudent[s.id]?.id || s.id);
        }
      } else {
        if (next.has(studentId)) next.delete(studentId);
        else next.add(studentId);
      }
      return next;
    });
    setLastSelectedIdx(rowIdx);
  };

  const handleAssign = async (student, workplace, existingAssignment) => {
    if (student.forbidden_workplaces?.includes(workplace.id)) {
      alert(`⛔ לא ניתן לשבץ את ${student.full_name} ל-${workplace.name} — זה מקום עבודה אסור`);
      return false;
    }

    // Find ALL assignments for this student on this date (there may be duplicates)
    const allForStudent = assignments.filter(a => a.student_id === student.id);

    if (allForStudent.length > 1) {
      // Delete all duplicates, keep only the first, update it
      const [keep, ...extras] = allForStudent;
      await Promise.all(extras.map(a => base44.entities.Assignment.delete(a.id)));
      await base44.entities.Assignment.update(keep.id, {
        workplace_id: workplace.id,
        workplace_name: workplace.name,
      });
    } else if (allForStudent.length === 1) {
      await base44.entities.Assignment.update(allForStudent[0].id, {
        workplace_id: workplace.id,
        workplace_name: workplace.name,
      });
    } else {
      await base44.entities.Assignment.create({
        date,
        student_id: student.id,
        student_name: student.full_name,
        workplace_id: workplace.id,
        workplace_name: workplace.name,
        rate: 40,
        hours: 4.75,
      });
    }
    queryClient.invalidateQueries({ queryKey: ['assignments', date] });
    return true;
  };

  const handleRemove = async (id) => {
    await base44.entities.Assignment.delete(id);
    queryClient.invalidateQueries({ queryKey: ['assignments', date] });
  };

  const handleUpdateRole = async (assignment, roleName) => {
    await base44.entities.Assignment.update(assignment.id, { role: roleName === 'none' ? '' : roleName });
    queryClient.invalidateQueries({ queryKey: ['assignments', date] });
  };



  const handleUpdateField = async (assignment, field, value) => {
    await base44.entities.Assignment.update(assignment.id, { [field]: value });
    queryClient.invalidateQueries({ queryKey: ['assignments', date] });
  };

  const handleBulkSave = async () => {
    const wp = bulkWorkplace ? workplaces.find(w => w.id === bulkWorkplace) : null;
    const hasChanges = wp || bulkHours !== '' || bulkRate !== '';
    if (!hasChanges) { setShowBulkDialog(false); return; }

    // Build a map: assignmentId -> assignment, and studentId -> assignment
    const assignmentById = {};
    const assignmentByStudentId = {};
    assignments.forEach(a => {
      assignmentById[a.id] = a;
      assignmentByStudentId[a.student_id] = a;
    });
    const studentById = {};
    students.forEach(s => { studentById[s.id] = s; });

    const toCreate = [];
    const toUpdate = []; // { id, updates }

    for (const selId of selectedIds) {
      const existingAssignment = assignmentById[selId] || assignmentByStudentId[selId];

      if (existingAssignment) {
        const { id, created_date, updated_date, created_by, ...rest } = existingAssignment;
        const fullRecord = { ...rest };
        if (wp) { fullRecord.workplace_id = wp.id; fullRecord.workplace_name = wp.name; }
        if (bulkHours !== '') fullRecord.hours = parseFloat(bulkHours);
        if (bulkRate !== '') fullRecord.rate = parseFloat(bulkRate);
        toUpdate.push({ id, fullRecord });
      } else if (wp) {
        const student = studentById[selId];
        if (student) {
          toCreate.push({
            date,
            student_id: student.id,
            student_name: student.full_name,
            workplace_id: wp.id,
            workplace_name: wp.name,
            rate: bulkRate !== '' ? parseFloat(bulkRate) : 40,
            hours: bulkHours !== '' ? parseFloat(bulkHours) : 4.75,
          });
        }
      }
    }

    // Send all updates/creates to backend function (no rate limit)
    await base44.functions.invoke('bulkUpdateAssignments', { toCreate, toUpdate });
    queryClient.invalidateQueries({ queryKey: ['assignments', date] });
    setSelectedIds(new Set());
    setShowBulkDialog(false);
    setBulkWorkplace('');
    setBulkHours('');
    setBulkRate('');
  };

  const handleCloneDay = async () => {
    if (!cloneTargetDate) return;
    setCloning(true);
    const activeStudentIds = new Set(students.filter(s => s.is_active !== false).map(s => s.id));
    const toCreate = assignments
      .filter(a => activeStudentIds.has(a.student_id))
      .map(a => ({
        date: cloneTargetDate,
        student_id: a.student_id,
        student_name: a.student_name,
        workplace_id: a.workplace_id,
        workplace_name: a.workplace_name,
        rate: a.rate ?? 40,
        hours: a.hours ?? 4.75,
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
    <div className="p-8 flex gap-6 items-start">
      <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">שיבוצים יומיים</h2>
          <p className="text-muted-foreground mt-1">
            {new Set(assignments.filter(a => a.workplace_name && !['לא עובד','לימודים','לא יצא'].some(kw => a.workplace_name.trim() === kw)).map(a => a.student_id)).size} משובצים מתוך {students.filter(s => s.is_active !== false && (!s.created_date || s.created_date.slice(0, 10) <= date)).length} תלמידים
          </p>
        </div>
        <div className="flex gap-2">
          <DailyReportPDFButton date={date} assignments={assignments} />
          <Button variant="outline" onClick={() => { setCloneTargetDate(format(addDays(new Date(date + 'T12:00:00'), 1), 'yyyy-MM-dd')); setShowCloneDialog(true); }}>
            <Copy size={16} className="ml-2" /> שכפל שיבוצים
          </Button>
        </div>
      </div>

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
        <Button variant="outline" onClick={() => setDate(format(new Date(), 'yyyy-MM-dd'))} className="text-xs">
          היום
        </Button>
        <span className="text-sm text-muted-foreground">
          {new Date(date + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {/* Floating Bulk Edit Toolbar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border shadow-2xl rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-medium text-primary">{selectedIds.size} שורות נבחרו</span>
          <div className="w-px h-5 bg-border" />
          <Button size="sm" onClick={() => setShowBulkDialog(true)}>
            <Pencil size={14} className="ml-1" /> עריכה מרובה
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="text-muted-foreground">
            ביטול
          </Button>
        </div>
      )}

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

      {/* Bulk Edit Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכה מרובה — {selectedIds.size} שורות</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-xs text-muted-foreground">השדות שתמלא יעודכנו בכל השורות הנבחרות. שדה ריק לא ישתנה.</p>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">מקום עבודה</label>
              <Popover open={bulkWorkplaceOpen} onOpenChange={setBulkWorkplaceOpen}>
                <PopoverTrigger asChild>
                  <button className="h-9 w-full border border-border rounded-md px-3 text-sm flex items-center justify-between bg-card hover:bg-secondary/40 transition-colors">
                    <span className={bulkWorkplace ? '' : 'text-muted-foreground'}>
                      {bulkWorkplace ? workplaces.find(w => w.id === bulkWorkplace)?.name : '— ללא שינוי —'}
                    </span>
                    <ChevronsUpDown size={14} className="opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="חיפוש..." className="h-8 text-xs" />
                    <CommandList>
                      <CommandEmpty>לא נמצא</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="__clear__" onSelect={() => { setBulkWorkplace(''); setBulkWorkplaceOpen(false); }} className="text-xs text-muted-foreground">
                          — ללא שינוי —
                        </CommandItem>
                        {workplaces.map(w => (
                          <CommandItem key={w.id} value={w.name} onSelect={() => { setBulkWorkplace(w.id); setBulkWorkplaceOpen(false); }} className="text-xs">
                            {w.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">כמות שעות</label>
              <Input
                type="number"
                step="0.5"
                value={bulkHours}
                onChange={e => setBulkHours(e.target.value)}
                placeholder="— ללא שינוי —"
                className="h-9 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">תעריף</label>
              <Input
                type="number"
                value={bulkRate}
                onChange={e => setBulkRate(e.target.value)}
                placeholder="— ללא שינוי —"
                className="h-9 text-sm"
              />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setShowBulkDialog(false)}>ביטול</Button>
              <Button onClick={handleBulkSave}>שמור שינויים</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 border-b border-border">
            <tr>
              <th className="px-3 py-2 w-8">
                <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAll} />
              </th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground w-8 text-xs">#</th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                <div className="flex flex-col gap-1">
                  <span className="text-xs">שם תלמיד</span>
                  <Input value={filterName} onChange={e => setFilterName(e.target.value)} placeholder="חיפוש..." className="h-7 text-xs" />
                </div>
              </th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                <div className="flex flex-col gap-1">
                  <span className="text-xs">מחזור</span>
                  <Select value={filterCohort} onValueChange={setFilterCohort}>
                    <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="הכל" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">הכל</SelectItem>
                      {cohorts.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground w-56">
                <div className="flex flex-col gap-1">
                  <span className="text-xs">מקום עבודה</span>
                  <Select value={filterWorkplace} onValueChange={setFilterWorkplace}>
                    <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="הכל" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">הכל</SelectItem>
                      {workplaces.filter(w => assignments.some(a => a.workplace_id === w.id)).map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground w-40">
                <div className="flex flex-col gap-1">
                  <span className="text-xs">תפקיד</span>
                  <Select value={filterRole} onValueChange={setFilterRole}>
                    <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="הכל" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">הכל</SelectItem>
                      {roles.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground w-20"><span className="text-xs">תעריף</span></th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground w-20"><span className="text-xs">שעות</span></th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground w-24"><span className="text-xs">תשלום נוסף</span></th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                <div className="flex flex-col gap-1">
                  <span className="text-xs">שיבוץ</span>
                  <Select value={filterAssigned} onValueChange={setFilterAssigned}>
                    <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="הכל" /></SelectTrigger>
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
                <td colSpan={10} className="text-center py-12 text-muted-foreground">
                  {students.length === 0 ? 'אין תלמידים במערכת' : 'לא נמצאו תוצאות לסינון'}
                </td>
              </tr>
            ) : (
              filteredStudents.map((student, idx) => {
                const assignment = assignmentByStudent[student.id];
                const selectKey = assignment?.id || student.id;
                const isSelected = selectedIds.has(selectKey);
                return (
                  <tr key={student.id} className={`transition-colors ${isSelected ? 'bg-primary/10' : assignment ? 'bg-primary/5' : 'hover:bg-secondary/20'}`}>
                    <td className="px-3 py-2 border-b border-border">
                      <Checkbox
                        checked={!!isSelected}
                        onClick={(e) => {
                          e.preventDefault();
                          toggleSelect(selectKey, idx, e.shiftKey);
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 border-b border-border text-muted-foreground text-xs">{idx + 1}</td>
                    <td className="px-3 py-2 border-b border-border font-medium">{student.full_name}</td>
                    <td className="px-3 py-2 border-b border-border text-muted-foreground text-xs">{student.cohort || '—'}</td>
                    <WorkplaceCell student={student} assignment={assignment} workplaces={workplaces} onAssign={handleAssign} onRemove={handleRemove} />
                    <RoleCell assignment={assignment} roles={roles} onUpdateRole={handleUpdateRole} />
                    <EditableNumberCell value={assignment?.rate} defaultValue={40} assignment={assignment} field="rate" onUpdate={handleUpdateField} />
                    <EditableNumberCell value={assignment?.hours} defaultValue={4.75} assignment={assignment} field="hours" onUpdate={handleUpdateField} />
                    <EditableNumberCell value={assignment?.bonus} defaultValue={null} assignment={assignment} field="bonus" onUpdate={handleUpdateField} />
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
      <LogisticsSidebar date={date} assignments={assignments} />
    </div>
  );
}