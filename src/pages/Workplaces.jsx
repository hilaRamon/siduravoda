import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronsUpDown, Plus, Search, Pencil, Trash2, Building2, Upload } from 'lucide-react';
import ImportWorkplacesModal from '@/components/workplaces/ImportWorkplacesModal';

function WorkplaceFormModal({ open, onClose, onSave, workplace, existingFarms }) {
  const [form, setForm] = useState(workplace || {
    name: '', farm_name: '', address: '', company_id: '', contact_phone: '', accounting_phone: '', accounting_email: '',
  });
  const [farmOpen, setFarmOpen] = useState(false);
  const [farmInputValue, setFarmInputValue] = useState('');

  useEffect(() => {
    setForm(workplace || { name: '', farm_name: '', address: '', company_id: '', contact_phone: '', accounting_phone: '', accounting_email: '' });
    setFarmInputValue('');
  }, [open, workplace]);

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const filteredFarms = existingFarms.filter(f => !farmInputValue || f.includes(farmInputValue));

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
            <Popover open={farmOpen} onOpenChange={setFarmOpen}>
              <PopoverTrigger asChild>
                <button type="button" className="mt-1 h-9 w-full border border-input rounded-md px-3 text-sm flex items-center justify-between bg-card hover:bg-secondary/40 transition-colors">
                  <span className={form.farm_name ? '' : 'text-muted-foreground'}>{form.farm_name || 'בחר או צור משק...'}</span>
                  <ChevronsUpDown size={14} className="opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="חיפוש או שם משק חדש..."
                    className="h-8 text-xs"
                    value={farmInputValue}
                    onValueChange={setFarmInputValue}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {farmInputValue ? (
                        <button type="button" className="w-full text-xs text-primary px-2 py-1.5 text-right"
                          onClick={() => { setForm(p => ({ ...p, farm_name: farmInputValue })); setFarmOpen(false); setFarmInputValue(''); }}>
                          + צור משק: "{farmInputValue}"
                        </button>
                      ) : 'לא נמצא'}
                    </CommandEmpty>
                    <CommandGroup>
                      {farmInputValue && !existingFarms.includes(farmInputValue) && (
                        <CommandItem value={`__new__${farmInputValue}`} onSelect={() => { setForm(p => ({ ...p, farm_name: farmInputValue })); setFarmOpen(false); setFarmInputValue(''); }} className="text-xs text-primary">
                          + צור משק: "{farmInputValue}"
                        </CommandItem>
                      )}
                      {filteredFarms.map(f => (
                        <CommandItem key={f} value={f} onSelect={() => { setForm(p => ({ ...p, farm_name: f })); setFarmOpen(false); setFarmInputValue(''); }} className="text-xs">{f}</CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>כתובת</Label>
            <Input value={form.address || ''} onChange={set('address')} className="mt-1" placeholder="כתובת המשק" />
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
  const [showImport, setShowImport] = useState(false);
  const [editWp, setEditWp] = useState(null);
  const queryClient = useQueryClient();

  const { data: workplaces = [], isLoading } = useQuery({
    queryKey: ['workplaces'],
    queryFn: () => base44.entities.Workplace.list('-created_date'),
  });

  const existingFarms = useMemo(() => {
    const names = new Set(workplaces.map(w => w.farm_name).filter(Boolean));
    return [...names].sort((a, b) => a.localeCompare(b, 'he'));
  }, [workplaces]);

  const filtered = workplaces
    .filter(w => w.name?.includes(search) || w.farm_name?.includes(search))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload size={16} className="ml-2" /> ייבוא מאקסל
          </Button>
          <Button onClick={() => { setEditWp(null); setShowForm(true); }}>
            <Plus size={16} className="ml-2" /> מקום חדש
          </Button>
        </div>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש לפי שם מקום או משק..." className="pr-9" />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-12 bg-secondary rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 size={48} className="mx-auto mb-3 opacity-30" />
          <p>{search ? 'לא נמצאו תוצאות' : 'אין מקומות עבודה עדיין'}</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary/60 border-b border-border">
              <tr>
                <th className="text-right px-5 py-3 text-sm font-semibold text-muted-foreground">שם מקום עבודה</th>
                <th className="text-right px-5 py-3 text-sm font-semibold text-muted-foreground">שם משק</th>
                <th className="text-right px-5 py-3 text-sm font-semibold text-muted-foreground">כתובת</th>
                <th className="text-right px-5 py-3 text-sm font-semibold text-muted-foreground">ח.פ</th>
                <th className="text-right px-5 py-3 text-sm font-semibold text-muted-foreground">טלפון איש קשר</th>
                <th className="text-right px-5 py-3 text-sm font-semibold text-muted-foreground">טלפון הנה"ח</th>
                <th className="text-right px-5 py-3 text-sm font-semibold text-muted-foreground">מייל הנה"ח</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(w => (
                <tr key={w.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 font-medium">{w.name}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{w.farm_name || '—'}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{w.address || '—'}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{w.company_id || '—'}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{w.contact_phone || '—'}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{w.accounting_phone || '—'}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{w.accounting_email || '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => { setEditWp(w); setShowForm(true); }}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(w.id)}>
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

      <WorkplaceFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditWp(null); }}
        onSave={handleSave}
        workplace={editWp}
        existingFarms={existingFarms}
      />
      <ImportWorkplacesModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => { queryClient.invalidateQueries({ queryKey: ['workplaces'] }); setShowImport(false); }}
      />
    </div>
  );
}