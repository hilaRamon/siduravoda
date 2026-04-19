import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ChevronRight, ChevronLeft, Plus, Trash2, Copy, CalendarDays } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';

function AssignmentFormModal({ open, onClose, onSave, students, workplaces, date }) {
  const [studentId, setStudentId] = useState('');
  const [workplaceId, setWorkplaceId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const student = students.find(s => s.id === studentId);
    const workplace = workplaces.find(w => w.id === workplaceId);
    onSave({
      date,
      student_id: studentId,
      student_name: student?.full_name || '',
      workplace_id: workplaceId,
      workplace_name: workplace?.name || '',
    });
    setStudentId('');
    setWorkplaceId('');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>הוספת שיבוץ ל-{date}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label>סטודנט</Label>
            <Select value={studentId} onValueChange={setStudentId} required>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="בחר סטודנט" />
              </SelectTrigger>
              <SelectContent>
                {students.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>מקום עבודה</Label>
            <Select value={workplaceId} onValueChange={setWorkplaceId} required>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="בחר מקום עבודה" />
              </SelectTrigger>
              <SelectContent>
                {workplaces.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
            <Button type="submit" disabled={!studentId || !workplaceId}>הוסף שיבוץ</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Assignments() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showForm, setShowForm] = useState(false);
  const [cloning, setCloning] = useState(false);
  const queryClient = useQueryClient();

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments', date],
    queryFn: () => base44.entities.Assignment.filter({ date }),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list(),
  });

  const { data: workplaces = [] } = useQuery({
    queryKey: ['workplaces'],
    queryFn: () => base44.entities.Workplace.list(),
  });

  // Group assignments by workplace
  const byWorkplace = {};
  assignments.forEach(a => {
    if (!byWorkplace[a.workplace_id]) {
      byWorkplace[a.workplace_id] = { name: a.workplace_name, items: [] };
    }
    byWorkplace[a.workplace_id].items.push(a);
  });

  const unassigned = students.filter(s => !assignments.find(a => a.student_id === s.id));

  const handleSave = async (data) => {
    await base44.entities.Assignment.create(data);
    queryClient.invalidateQueries({ queryKey: ['assignments', date] });
    setShowForm(false);
  };

  const handleDelete = async (id) => {
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

  const prevDay = () => setDate(format(subDays(new Date(date), 1), 'yyyy-MM-dd'));
  const nextDay = () => setDate(format(addDays(new Date(date), 1), 'yyyy-MM-dd'));

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">שיבוצים יומיים</h2>
          <p className="text-muted-foreground mt-1">{assignments.length} שיבוצים ביום זה</p>
        </div>
        <div className="flex gap-2">
          {assignments.length > 0 && (
            <Button variant="outline" onClick={handleCloneDay} disabled={cloning}>
              <Copy size={16} className="ml-2" /> {cloning ? 'משכפל...' : 'שכפל לשבוע הבא'}
            </Button>
          )}
          <Button onClick={() => setShowForm(true)}>
            <Plus size={16} className="ml-2" /> שיבוץ חדש
          </Button>
        </div>
      </div>

      {/* Date Picker */}
      <div className="flex items-center gap-3 mb-8">
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
          {new Date(date).toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workplaces & Assignments */}
        <div className="lg:col-span-2 space-y-4">
          {Object.keys(byWorkplace).length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-12 text-center text-muted-foreground">
              <CalendarDays size={40} className="mx-auto mb-3 opacity-30" />
              <p>אין שיבוצים לתאריך זה</p>
            </div>
          ) : (
            Object.entries(byWorkplace).map(([wpId, { name, items }]) => (
              <div key={wpId} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-primary/5 border-b border-border flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{name}</h3>
                  <span className="text-xs text-muted-foreground">{items.length} סטודנטים</span>
                </div>
                <div className="divide-y divide-border">
                  {items.map(a => (
                    <div key={a.id} className="flex items-center justify-between px-5 py-3">
                      <span className="text-sm font-medium">{a.student_name}</span>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(a.id)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Unassigned */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-secondary/60 border-b border-border">
            <h3 className="font-semibold text-sm">ללא שיבוץ ({unassigned.length})</h3>
          </div>
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {unassigned.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">כל הסטודנטים משובצים</p>
            ) : (
              unassigned.map(s => (
                <div key={s.id} className="px-4 py-2.5 flex items-center justify-between">
                  <span className="text-sm">{s.full_name}</span>
                  {s.free_day && (
                    <span className="text-xs text-muted-foreground">חופש: יום {s.free_day}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <AssignmentFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        students={students}
        workplaces={workplaces}
        date={date}
      />
    </div>
  );
}