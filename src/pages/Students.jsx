import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Search, Upload, Pencil, Trash2, UserCircle } from 'lucide-react';
import StudentFormModal from '@/components/students/StudentFormModal';
import ImportModal from '@/components/students/ImportModal';

const FREE_DAY_COLORS = {
  'א': 'bg-blue-100 text-blue-700',
  'ב': 'bg-green-100 text-green-700',
  'ג': 'bg-purple-100 text-purple-700',
  'ד': 'bg-orange-100 text-orange-700',
  'ה': 'bg-pink-100 text-pink-700',
};

export default function Students() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const queryClient = useQueryClient();

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list('-created_date'),
  });

  const cohorts = useMemo(() => [...new Set(students.map(s => s.cohort).filter(Boolean))], [students]);

  const filtered = students.filter(s =>
    s.full_name?.includes(search) || s.cohort?.includes(search)
  );

  const handleSave = async (form) => {
    if (editStudent) {
      await base44.entities.Student.update(editStudent.id, form);
    } else {
      await base44.entities.Student.create(form);
    }
    queryClient.invalidateQueries({ queryKey: ['students'] });
    setShowForm(false);
    setEditStudent(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('האם למחוק תלמיד זה?')) return;
    await base44.entities.Student.delete(id);
    queryClient.invalidateQueries({ queryKey: ['students'] });
  };

  const handleToggleActive = async (student) => {
    await base44.entities.Student.update(student.id, { is_active: !student.is_active });
    queryClient.invalidateQueries({ queryKey: ['students'] });
  };

  const handleDeactivateCohort = async (cohort) => {
    if (!confirm(`האם לסמן את כל מחזור "${cohort}" כלא פעיל?`)) return;
    const cohortStudents = students.filter(s => s.cohort === cohort);
    await Promise.all(cohortStudents.map(s => base44.entities.Student.update(s.id, { is_active: false })));
    queryClient.invalidateQueries({ queryKey: ['students'] });
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">תלמידים וצוות</h2>
          <p className="text-muted-foreground mt-1">{students.length} רשומות במערכת</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload size={16} className="ml-2" /> ייבוא מאקסל
          </Button>
          <Button onClick={() => { setEditStudent(null); setShowForm(true); }}>
            <Plus size={16} className="ml-2" /> חדש
          </Button>
        </div>
      </div>

      {/* Deactivate cohort */}
      {cohorts.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5 items-center">
          <span className="text-sm text-muted-foreground">סמן מחזור כלא פעיל:</span>
          {cohorts.map(c => (
            <Button key={c} variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => handleDeactivateCohort(c)}>
              מחזור {c}
            </Button>
          ))}
        </div>
      )}

      <div className="relative mb-6">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם או מחזור..."
          className="pr-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-secondary rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <UserCircle size={48} className="mx-auto mb-3 opacity-30" />
          <p>{search ? 'לא נמצאו תוצאות' : 'אין תלמידים עדיין'}</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary/60 border-b border-border">
              <tr>
                <th className="text-right px-5 py-3 text-sm font-semibold text-muted-foreground">שם מלא</th>
                <th className="text-right px-5 py-3 text-sm font-semibold text-muted-foreground">מחזור</th>
                <th className="text-right px-5 py-3 text-sm font-semibold text-muted-foreground">יום חופש</th>
                <th className="text-right px-5 py-3 text-sm font-semibold text-muted-foreground">מרחק</th>
                <th className="text-right px-5 py-3 text-sm font-semibold text-muted-foreground">הערות</th>
                <th className="text-center px-5 py-3 text-sm font-semibold text-muted-foreground">פעיל</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(s => (
                <tr key={s.id} className={`transition-colors ${s.is_active === false ? 'opacity-50 bg-secondary/20' : 'hover:bg-secondary/30'}`}>
                  <td className="px-5 py-3 font-medium">{s.full_name}</td>
                  <td className="px-5 py-3 text-muted-foreground text-sm">{s.cohort || '—'}</td>
                  <td className="px-5 py-3">
                    {s.free_day ? (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${FREE_DAY_COLORS[s.free_day] || 'bg-secondary text-secondary-foreground'}`}>
                        יום {s.free_day}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{s.distance_status || '—'}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground max-w-[200px] truncate">{s.notes || '—'}</td>
                  <td className="px-5 py-3 text-center">
                    <Checkbox
                      checked={s.is_active !== false}
                      onCheckedChange={() => handleToggleActive(s)}
                    />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon"
                        onClick={() => { setEditStudent(s); setShowForm(true); }}
                        className="h-8 w-8 text-muted-foreground hover:text-primary">
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon"
                        onClick={() => handleDelete(s.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StudentFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditStudent(null); }}
        onSave={handleSave}
        student={editStudent}
      />
      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['students'] })}
      />
    </div>
  );
}