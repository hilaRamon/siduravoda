import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight, ChevronLeft, Copy, CalendarDays, Trash2, X } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';

// Cell: shows assigned workplace or empty — click opens dropdown inline
function AssignmentCell({ student, assignment, workplaces, date, onAssign, onRemove }) {
  const [open, setOpen] = useState(false);

  const handleSelect = async (workplaceId) => {
    setOpen(false);
    if (!workplaceId) return;
    const workplace = workplaces.find(w => w.id === workplaceId);
    await onAssign(student, workplace, assignment);
  };

  return (
    <td className="px-4 py-2 border-b border-border">
      <div className="relative flex items-center gap-1">
        <Select
          open={open}
          onOpenChange={setOpen}
          value={assignment?.workplace_id || ''}
          onValueChange={handleSelect}
        >
          <SelectTrigger
            className={`h-8 text-xs w-full border transition-colors ${
              assignment
                ? 'bg-primary/10 border-primary/30 text-primary font-medium hover:bg-primary/20'
                : 'bg-secondary/50 border-dashed text-muted-foreground hover:bg-secondary hover:border-border'
            }`}
          >
            <SelectValue placeholder="+ שבץ" />
          </SelectTrigger>
          <SelectContent align="start">
            {workplaces.map(w => (
              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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

export default function Assignments() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [cloning, setCloning] = useState(false);
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
  });

  // map studentId -> assignment for this date
  const assignmentByStudent = {};
  assignments.forEach(a => { assignmentByStudent[a.student_id] = a; });

  const handleAssign = async (student, workplace, existingAssignment) => {
    if (existingAssignment) {
      // update: delete old, create new
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

  const handleCloneDay = async () => {
    const targetDate = format(addDays(new Date(date), 7), 'yyyy-MM-dd');
    if (!confirm(`שכפל שיבוצים לתאריך ${targetDate}?`)) return;
    setCloning(true);
    const toCreate = assignments.map(a => ({
      date: targetDate,
      student_id: a.student_id,
      student_name: a.student_name,
      workplace_id: a.workplace_id,
      workplace_name: a.workplace_name,
    }));
    await base44.entities.Assignment.bulkCreate(toCreate);
    queryClient.invalidateQueries({ queryKey: ['assignments'] });
    setCloning(false);
    alert(`שוכפלו ${toCreate.length} שיבוצים ל-${targetDate}`);
  };

  const prevDay = () => setDate(format(subDays(new Date(date + 'T12:00:00'), 1), 'yyyy-MM-dd'));
  const nextDay = () => setDate(format(addDays(new Date(date + 'T12:00:00'), 1), 'yyyy-MM-dd'));

  const assignedCount = assignments.length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">שיבוצים יומיים</h2>
          <p className="text-muted-foreground mt-1">
            {assignedCount} משובצים מתוך {students.length} סטודנטים
          </p>
        </div>
        {assignments.length > 0 && (
          <Button variant="outline" onClick={handleCloneDay} disabled={cloning}>
            <Copy size={16} className="ml-2" /> {cloning ? 'משכפל...' : 'שכפל לשבוע הבא'}
          </Button>
        )}
      </div>

      {/* Date Picker */}
      <div className="flex items-center gap-3 mb-6">
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

      {/* Main Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 border-b border-border">
            <tr>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground w-8">#</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">שם סטודנט</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">מחזור</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground w-56">מקום עבודה</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">תפקיד</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">הערות</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  אין סטודנטים במערכת
                </td>
              </tr>
            ) : (
              students.map((student, idx) => {
                const assignment = assignmentByStudent[student.id];
                return (
                  <tr
                    key={student.id}
                    className={`transition-colors ${assignment ? 'bg-primary/5' : 'hover:bg-secondary/20'}`}
                  >
                    <td className="px-4 py-2 border-b border-border text-muted-foreground text-xs">{idx + 1}</td>
                    <td className="px-4 py-2 border-b border-border font-medium">{student.full_name}</td>
                    <td className="px-4 py-2 border-b border-border text-muted-foreground text-xs">{student.cohort || '—'}</td>
                    <AssignmentCell
                      student={student}
                      assignment={assignment}
                      workplaces={workplaces}
                      date={date}
                      onAssign={handleAssign}
                      onRemove={handleRemove}
                    />
                    <td className="px-4 py-2 border-b border-border text-muted-foreground text-xs">
                      {assignment?.role || '—'}
                    </td>
                    <td className="px-4 py-2 border-b border-border text-muted-foreground text-xs">
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