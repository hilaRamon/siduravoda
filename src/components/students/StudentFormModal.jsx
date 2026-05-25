import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const FREE_DAYS = [
  { value: "א", label: "ראשון" },
  { value: "ב", label: "שני" },
  { value: "ג", label: "שלישי" },
  { value: "ד", label: "רביעי" },
  { value: "ה", label: "חמישי" },
];
const DISTANCES = ["קרוב", "רחוק", "אאא- לפני שיבוץ", "תתת - לא עובד"];

export default function StudentFormModal({ open, onClose, onSave, student }) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    cohort: "",
    free_day: [],
    distance_status: "",
  });

  useEffect(() => {
    if (student) {
      // Support legacy string value migration
      const fd = student.free_day;
      const freeDayArr = Array.isArray(fd) ? fd : fd ? [fd] : [];
      setForm({
        full_name: student.full_name || "",
        phone: student.phone || "",
        cohort: student.cohort || "",
        free_day: freeDayArr,
        distance_status: student.distance_status || "",
      });
    } else {
      setForm({
        full_name: "",
        phone: "",
        cohort: "",
        free_day: [],
        distance_status: "",
      });
    }
  }, [student, open]);

  const toggleFreeDay = (day) => {
    setForm((p) => ({
      ...p,
      free_day: p.free_day.includes(day)
        ? p.free_day.filter((d) => d !== day)
        : [...p.free_day, day],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const free_day =
      Array.isArray(form.free_day) && form.free_day.length > 0
        ? form.free_day
        : null;
    const payload = { ...form, free_day };
    if (student) {
      // Merge with existing student data to preserve fields not in this form
      onSave({ ...student, ...payload });
    } else {
      onSave({ ...payload, is_active: true });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {student ? "עריכת תלמיד" : "הוספת תלמיד חדש"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label>שם מלא *</Label>
            <Input
              value={form.full_name}
              onChange={(e) =>
                setForm((p) => ({ ...p, full_name: e.target.value }))
              }
              placeholder="שם מלא"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label>טלפון (במקום 0 בתחילה יש לרשום 972)</Label>
            <Input
              value={form.phone}
              onChange={(e) =>
                setForm((p) => ({ ...p, phone: e.target.value }))
              }
              placeholder="9725X-XXXXXXX"
              className="mt-1"
              type="tel"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>מחזור</Label>
              <Input
                value={form.cohort}
                onChange={(e) =>
                  setForm((p) => ({ ...p, cohort: e.target.value }))
                }
                placeholder="לדוג׳ 2024א"
                className="mt-1"
              />
            </div>
            <div>
              <Label>ימי חופש</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {FREE_DAYS.map((d) => (
                  <label
                    key={d.value}
                    className="flex items-center gap-1.5 cursor-pointer select-none"
                  >
                    <Checkbox
                      checked={form.free_day.includes(d.value)}
                      onCheckedChange={() => toggleFreeDay(d.value)}
                    />
                    <span className="text-sm">{d.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div>
            <Label>סטטוס מרחק</Label>
            <Select
              value={form.distance_status}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, distance_status: v }))
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="בחר סטטוס" />
              </SelectTrigger>
              <SelectContent>
                {DISTANCES.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              ביטול
            </Button>
            <Button type="submit">
              {student ? "שמור שינויים" : "הוסף תלמיד"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
