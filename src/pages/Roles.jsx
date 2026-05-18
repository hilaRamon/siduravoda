import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

function RoleFormModal({ open, onClose, onSave, role }) {
  const [form, setForm] = useState(role || { name: '', description: '', color: COLORS[0] });

  useEffect(() => {
    setForm(role || { name: '', description: '', color: COLORS[0] });
  }, [open, role]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>{role ? 'עריכת תפקיד' : 'הוספת תפקיד'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label>שם התפקיד *</Label>
            <Input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              required
              className="mt-1"
              placeholder="לדוגמה: נהג"
            />
          </div>
          <div>
            <Label>תיאור</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="mt-1"
              rows={2}
              placeholder="תיאור קצר של התפקיד..."
            />
          </div>
          <div>
            <Label>צבע</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, color: c }))}
                  className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
            <Button type="submit">{role ? 'שמור' : 'הוסף'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Roles() {
  const [showForm, setShowForm] = useState(false);
  const [editRole, setEditRole] = useState(null);
  const queryClient = useQueryClient();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => base44.entities.Role.list(),
  });

  const handleSave = async (form) => {
    if (editRole) {
      await base44.entities.Role.update(editRole.id, form);
    } else {
      await base44.entities.Role.create(form);
    }
    queryClient.invalidateQueries({ queryKey: ['roles'] });
    setShowForm(false);
    setEditRole(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('למחוק תפקיד זה?')) return;
    await base44.entities.Role.delete(id);
    queryClient.invalidateQueries({ queryKey: ['roles'] });
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">תפקידים</h2>
          <p className="text-muted-foreground mt-1">{roles.length} תפקידים מוגדרים</p>
        </div>
        <Button onClick={() => { setEditRole(null); setShowForm(true); }}>
          <Plus size={16} className="ml-2" /> תפקיד חדש
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-secondary rounded-2xl animate-pulse" />)}
        </div>
      ) : roles.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShieldCheck size={48} className="mx-auto mb-3 opacity-30" />
          <p className="mb-4">אין תפקידים עדיין</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map(role => (
            <div key={role.id} className="bg-card rounded-2xl border border-border shadow-sm p-5 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: role.color ? role.color + '20' : '#6366f120' }}
                >
                  <ShieldCheck size={20} style={{ color: role.color || '#6366f1' }} />
                </div>
                <div>
                  <h3 className="font-semibold">{role.name}</h3>
                  {role.description && (
                    <p className="text-xs text-muted-foreground mt-1">{role.description}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                  onClick={() => { setEditRole(role); setShowForm(true); }}>
                  <Pencil size={13} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(role.id)}>
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <RoleFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditRole(null); }}
        onSave={handleSave}
        role={editRole}
      />
    </div>
  );
}