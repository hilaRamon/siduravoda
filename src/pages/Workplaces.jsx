import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Pencil, Trash2, Building2, Phone, MapPin, Users } from 'lucide-react';

function WorkplaceFormModal({ open, onClose, onSave, workplace }) {
  const [form, setForm] = useState(workplace || {
    name: '', capacity: '', address: '', contact_name: '', contact_phone: '', notes: '', is_active: true,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...form, capacity: form.capacity ? Number(form.capacity) : undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{workplace ? 'עריכת מקום עבודה' : 'הוספת מקום עבודה'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label>שם מקום עבודה *</Label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>קיבולת (סטודנטים ליום)</Label>
              <Input type="number" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))} className="mt-1" min="1" />
            </div>
            <div>
              <Label>איש קשר</Label>
              <Input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>טלפון</Label>
            <Input value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>כתובת</Label>
            <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>הערות</Label>
            <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="mt-1" rows={2} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
            <Button type="submit">{workplace ? 'שמור' : 'הוסף'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Workplaces() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editWp, setEditWp] = useState(null);
  const queryClient = useQueryClient();

  const { data: workplaces = [], isLoading } = useQuery({
    queryKey: ['workplaces'],
    queryFn: () => base44.entities.Workplace.list('-created_date'),
  });

  const filtered = workplaces.filter(w => w.name?.includes(search) || w.address?.includes(search));

  const handleSave = async (form) => {
    if (editWp) {
      await base44.entities.Workplace.update(editWp.id, form);
    } else {
      await base44.entities.Workplace.create(form);
    }
    queryClient.invalidateQueries({ queryKey: ['workplaces'] });
    setShowForm(false);
    setEditWp(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('האם למחוק מקום עבודה זה?')) return;
    await base44.entities.Workplace.delete(id);
    queryClient.invalidateQueries({ queryKey: ['workplaces'] });
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">מקומות עבודה</h2>
          <p className="text-muted-foreground mt-1">{workplaces.length} מקומות במערכת</p>
        </div>
        <Button onClick={() => { setEditWp(null); setShowForm(true); }}>
          <Plus size={16} className="ml-2" /> מקום חדש
        </Button>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש לפי שם או כתובת..." className="pr-9" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-secondary rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 size={48} className="mx-auto mb-3 opacity-30" />
          <p>{search ? 'לא נמצאו תוצאות' : 'אין מקומות עבודה עדיין'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(w => (
            <div key={w.id} className="bg-card rounded-2xl border border-border shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Building2 size={18} className="text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm">{w.name}</h3>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                    onClick={() => { setEditWp(w); setShowForm(true); }}>
                    <Pencil size={13} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(w.id)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                {w.capacity && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users size={13} /> קיבולת: {w.capacity} סטודנטים
                  </div>
                )}
                {w.address && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin size={13} /> {w.address}
                  </div>
                )}
                {w.contact_phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone size={13} /> {w.contact_phone}
                  </div>
                )}
              </div>
              {w.is_active === false && (
                <span className="mt-3 inline-block text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">לא פעיל</span>
              )}
            </div>
          ))}
        </div>
      )}

      <WorkplaceFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditWp(null); }}
        onSave={handleSave}
        workplace={editWp}
      />
    </div>
  );
}