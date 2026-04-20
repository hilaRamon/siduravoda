import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const FREE_DAYS = ['א', 'ב', 'ג', 'ד', 'ה'];
const DISTANCES = ['קרוב', 'בינוני', 'רחוק'];

export default function StudentFormModal({ open, onClose, onSave, student }) {
  const [form, setForm] = useState({
    full_name: '',
    cohort: '',
    free_day: '',
    distance_status: '',
  });

  useEffect(() => {
    if (student) {
      setForm({
        full_name: student.full_name || '',
        cohort: student.cohort || '',
        free_day: student.free_day || '',
        distance_status: student.distance_status || '',
      });
    } else {
      setForm({ full_name: '', cohort: '', free_day: '', distance_status: '' });
    }
  }, [student, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{student ? 'עריכת סטודנט' : 'הוספת סטודנט חדש'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label>שם מלא *</Label>
            <Input
              value={form.full_name}
              onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
              placeholder="שם מלא"
              required
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>מחזור</Label>
              <Input
                value={form.cohort}
                onChange={e => setForm(p => ({ ...p, cohort: e.target.value }))}
                placeholder="לדוג׳ 2024א"
                className="mt-1"
              />
            </div>
            <div>
              <Label>יום חופש</Label>
              <Select value={form.free_day} onValueChange={v => setForm(p => ({ ...p, free_day: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="בחר יום" />
                </SelectTrigger>
                <SelectContent>
                  {FREE_DAYS.map(d => (
                    <SelectItem key={d} value={d}>יום {d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>סטטוס מרחק</Label>
            <Select value={form.distance_status} onValueChange={v => setForm(p => ({ ...p, distance_status: v }))}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="בחר סטטוס" />
              </SelectTrigger>
              <SelectContent>
                {DISTANCES.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
            <Button type="submit">{student ? 'שמור שינויים' : 'הוסף סטודנט'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}