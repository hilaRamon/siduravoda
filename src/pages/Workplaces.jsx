import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, Pencil, Trash2, Building2, Phone, Mail } from 'lucide-react';

function WorkplaceFormModal({ open, onClose, onSave, workplace }) {
  const [form, setForm] = useState(workplace || {
    name: '', farm_name: '', company_id: '', contact_phone: '', accounting_phone: '', accounting_email: '',
  });

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{workplace ? 'עריכת מקום עבודה' : 'הוספת מקום עבודה'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label>שם מקום העבודה *</Label>
            <Input value={form.name} onChange={set('name')} required className="mt-1" placeholder="שם מקום העבודה" />
          </div>
          <div>
            <Label>שם משק</Label>
            <Input value={form.farm_name} onChange={set('farm_name')} className="mt-1" placeholder="שם המשק" />
          </div>
          <div>
            <Label>ח.פ</Label>
            <Input value={form.company_id} onChange={set('company_id')} className="mt-1" placeholder="מספר ח.פ" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>טלפון איש קשר</Label>
              <Input value={form.contact_phone} onChange={set('contact_phone')} className="mt-1" placeholder="05X-XXXXXXX" />
            </div>
            <div>
              <Label>טלפון הנה"ח</Label>
              <Input value={form.accounting_phone} onChange={set('accounting_phone')} className="mt-1" placeholder="05X-XXXXXXX" />
            </div>
          </div>
          <div>
            <Label>מייל הנה"ח</Label>
            <Input type="email" value={form.accounting_email} onChange={set('accounting_email')} className="mt-1" placeholder="accounting@example.com" />
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

  const filtered = workplaces.filter(w =>
    w.name?.includes(search) || w.farm_name?.includes(search)
  );

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
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש לפי שם מקום או משק..." className="pr-9" />
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
                  <div>
                    <h3 className="font-semibold text-sm">{w.name}</h3>
                    {w.farm_name && <p className="text-xs text-muted-foreground">{w.farm_name}</p>}
                  </div>
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
                {w.company_id && (
                  <div className="text-xs text-muted-foreground">ח.פ: {w.company_id}</div>
                )}
                {w.contact_phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone size={12} /> איש קשר: {w.contact_phone}
                  </div>
                )}
                {w.accounting_phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone size={12} /> הנה"ח: {w.accounting_phone}
                  </div>
                )}
                {w.accounting_email && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail size={12} /> {w.accounting_email}
                  </div>
                )}
              </div>
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