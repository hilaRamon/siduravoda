import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { farmApi } from '@/api/farmApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronLeft, Plus, Search, Pencil, Trash2, Building2, Upload } from 'lucide-react';
import ImportWorkplacesModal from '@/components/workplaces/ImportWorkplacesModal';
import { confirmAlert, showAlert } from '@/components/AppAlert';
import { useOptimisticListItemUpdate } from '@/hooks/useOptimisticListItemUpdate';
import {
  farmKeys,
  useCreateFarm,
  useDeleteFarm,
  useFarms,
  useUpdateFarm,
} from '@/queries/farmQueries';
import {
  useCreateWorkplace,
  useDeleteWorkplace,
  useUpdateWorkplace,
  useWorkplaces,
  workplaceKeys,
} from '@/queries/workplaceQueries';

const EMPTY_FARM = {
  name: '',
  company_id: '',
  address: '',
  accounting_phone: '',
  accounting_email: '',
};

const EMPTY_WORKPLACE = {
  name: '',
  contact_person: '',
  contact_phone: '',
  notes: '',
};

const UNASSIGNED_KEY = '';

function FarmFormModal({ open, onClose, onSave, farm }) {
  const [form, setForm] = useState(farm || EMPTY_FARM);

  useEffect(() => {
    setForm(farm
      ? {
          name: farm.name || '',
          company_id: farm.company_id || '',
          address: farm.address || '',
          accounting_phone: farm.accounting_phone || '',
          accounting_email: farm.accounting_email || '',
        }
      : EMPTY_FARM);
  }, [open, farm]);

  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{farm ? 'עריכת משק' : 'הוספת משק'}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave(form);
          }}
          className="space-y-4 mt-2"
        >
          <div>
            <Label>שם משק *</Label>
            <Input value={form.name} onChange={set('name')} required className="mt-1" placeholder="שם המשק" />
          </div>
          <div>
            <Label>ח.פ</Label>
            <Input value={form.company_id} onChange={set('company_id')} className="mt-1" placeholder="מספר ח.פ" />
          </div>
          <div>
            <Label>כתובת</Label>
            <Input value={form.address} onChange={set('address')} className="mt-1" placeholder="כתובת המשק" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>טלפון הנה&quot;ח</Label>
              <Input value={form.accounting_phone} onChange={set('accounting_phone')} className="mt-1" placeholder="05X-XXXXXXX" />
            </div>
            <div>
              <Label>מייל הנה&quot;ח</Label>
              <Input type="email" value={form.accounting_email} onChange={set('accounting_email')} className="mt-1" placeholder="accounting@example.com" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
            <Button type="submit">{farm ? 'שמור' : 'הוסף'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WorkplaceFormModal({ open, onClose, onSave, workplace }) {
  const [form, setForm] = useState(workplace || EMPTY_WORKPLACE);

  useEffect(() => {
    setForm(workplace
      ? {
          name: workplace.name || '',
          contact_person: workplace.contact_person || '',
          contact_phone: workplace.contact_phone || '',
          notes: workplace.notes || '',
        }
      : EMPTY_WORKPLACE);
  }, [open, workplace]);

  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{workplace ? 'עריכת מקום עבודה' : 'הוספת מקום עבודה'}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave(form);
          }}
          className="space-y-4 mt-2"
        >
          <div>
            <Label>שם מקום העבודה *</Label>
            <Input value={form.name} onChange={set('name')} required className="mt-1" placeholder="שם מקום העבודה" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>איש קשר</Label>
              <Input value={form.contact_person} onChange={set('contact_person')} className="mt-1" />
            </div>
            <div>
              <Label>טלפון איש קשר</Label>
              <Input value={form.contact_phone} onChange={set('contact_phone')} className="mt-1" placeholder="05X-XXXXXXX" />
            </div>
          </div>
          <div>
            <Label>הערות</Label>
            <Textarea value={form.notes} onChange={set('notes')} className="mt-1" />
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

function WorkplaceRows({ workplaces, onEdit, onDelete }) {
  if (workplaces.length === 0) {
    return <p className="px-5 py-3 text-sm text-muted-foreground">אין מקומות עבודה</p>;
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="text-muted-foreground">
          <th className="text-right px-5 py-2 text-xs font-semibold">שם מקום עבודה</th>
          <th className="text-right px-5 py-2 text-xs font-semibold">איש קשר</th>
          <th className="text-right px-5 py-2 text-xs font-semibold">טלפון</th>
          <th className="text-right px-5 py-2 text-xs font-semibold">הערות</th>
          <th className="px-5 py-2" />
        </tr>
      </thead>
      <tbody>
        {workplaces.map((workplace) => (
          <tr key={workplace.id}>
            <td className="px-5 py-2 text-sm font-medium">{workplace.name}</td>
            <td className="px-5 py-2 text-sm text-muted-foreground">{workplace.contact_person || '—'}</td>
            <td className="px-5 py-2 text-sm text-muted-foreground">{workplace.contact_phone || '—'}</td>
            <td className="px-5 py-2 text-sm text-muted-foreground">{workplace.notes || '—'}</td>
            <td className="px-5 py-2">
              <div className="flex gap-1 justify-end">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => onEdit(workplace)}>
                  <Pencil size={14} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(workplace.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Workplaces() {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [showImport, setShowImport] = useState(false);
  const [farmFormOpen, setFarmFormOpen] = useState(false);
  const [editFarm, setEditFarm] = useState(null);
  const [workplaceForm, setWorkplaceForm] = useState(null);
  const queryClient = useQueryClient();

  const { data: farms = [], isLoading: farmsLoading } = useFarms();
  const { data: workplaces = [], isLoading: workplacesLoading } = useWorkplaces();
  const createFarm = useCreateFarm();
  const updateFarm = useUpdateFarm();
  const deleteFarmMutation = useDeleteFarm();
  const createWorkplace = useCreateWorkplace();
  const updateWorkplace = useUpdateWorkplace();
  const deleteWorkplaceMutation = useDeleteWorkplace();
  const updateFarmItem = useOptimisticListItemUpdate({
    queryKey: farmKeys.all,
    updateFn: (id, patch) => farmApi.update(id, patch),
    fallbackMessage: 'שגיאה בעדכון הסכם. נסה שוב.',
  });

  const workplacesByFarm = useMemo(() => {
    const grouped = new Map();
    for (const workplace of workplaces) {
      const key = workplace.farm_id || UNASSIGNED_KEY;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(workplace);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));
    }
    return grouped;
  }, [workplaces]);

  const query = search.trim();

  const workplaceMatches = (workplace) =>
    !query || workplace.name?.includes(query) || workplace.contact_person?.includes(query);

  const farmFieldsMatch = (farm) =>
    !!query && (
      farm.name?.includes(query) ||
      farm.company_id?.includes(query) ||
      farm.address?.includes(query)
    );

  const visibleFarms = useMemo(() => {
    return [...farms]
      .filter((farm) => {
        if (!query) return true;
        if (farmFieldsMatch(farm)) return true;
        return (workplacesByFarm.get(farm.id) || []).some(workplaceMatches);
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));
  }, [farms, query, workplacesByFarm]);

  const unassigned = (workplacesByFarm.get(UNASSIGNED_KEY) || []).filter(workplaceMatches);

  const isLoading = farmsLoading || workplacesLoading;
  const nothingToShow = visibleFarms.length === 0 && unassigned.length === 0;

  const childrenOf = (farm) => {
    const children = workplacesByFarm.get(farm.id) || [];
    if (!query || farmFieldsMatch(farm)) return children;
    return children.filter(workplaceMatches);
  };

  const rowOpen = (id) => (query ? true : !!expanded[id]);

  const toggle = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSaveFarm = async (form) => {
    if (editFarm) {
      await updateFarm.mutateAsync({ id: editFarm.id, data: form });
    } else {
      await createFarm.mutateAsync(form);
    }
    setFarmFormOpen(false);
    setEditFarm(null);
  };

  const handleDeleteFarm = async (farm) => {
    const children = workplacesByFarm.get(farm.id) || [];
    if (children.length > 0) {
      await showAlert('לא ניתן למחוק משק שעדיין יש לו מקומות עבודה');
      return;
    }
    if (!(await confirmAlert('האם למחוק משק זה?'))) return;
    try {
      await deleteFarmMutation.mutateAsync(farm.id);
    } catch (error) {
      await showAlert(error?.message || 'שגיאה במחיקת משק');
    }
  };

  const handleSaveWorkplace = async (form) => {
    const payload = {
      name: form.name,
      contact_person: form.contact_person,
      contact_phone: form.contact_phone,
      notes: form.notes,
      farm_id: workplaceForm?.farmId || '',
    };
    if (workplaceForm?.workplace) {
      await updateWorkplace.mutateAsync({ id: workplaceForm.workplace.id, data: payload });
    } else {
      await createWorkplace.mutateAsync(payload);
    }
    setWorkplaceForm(null);
  };

  const handleDeleteWorkplace = async (id) => {
    if (!(await confirmAlert('האם למחוק מקום עבודה זה?'))) return;
    await deleteWorkplaceMutation.mutateAsync(id);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">משקים</h2>
          <p className="text-muted-foreground mt-1">{farms.length} משקים במערכת</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload size={16} className="ml-2" /> ייבוא מאקסל
          </Button>
          <Button onClick={() => { setEditFarm(null); setFarmFormOpen(true); }}>
            <Plus size={16} className="ml-2" /> משק חדש
          </Button>
        </div>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="חיפוש לפי משק, ח.פ, כתובת או מקום עבודה..."
          className="pr-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-secondary rounded-xl animate-pulse" />)}
        </div>
      ) : nothingToShow ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 size={48} className="mx-auto mb-3 opacity-30" />
          <p>{search ? 'לא נמצאו תוצאות' : 'אין משקים עדיין'}</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary/60 border-b border-border">
              <tr>
                <th className="w-10 px-3 py-3" />
                <th className="text-right px-5 py-3 text-sm font-semibold text-muted-foreground">שם משק</th>
                <th className="text-right px-5 py-3 text-sm font-semibold text-muted-foreground">ח.פ</th>
                <th className="text-right px-5 py-3 text-sm font-semibold text-muted-foreground">כתובת</th>
                <th className="text-right px-5 py-3 text-sm font-semibold text-muted-foreground">טלפון הנה&quot;ח</th>
                <th className="text-right px-5 py-3 text-sm font-semibold text-muted-foreground">מייל הנה&quot;ח</th>
                <th className="text-center px-5 py-3 text-sm font-semibold text-muted-foreground">הסכם</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleFarms.map((farm) => {
                const open = rowOpen(farm.id);
                const children = childrenOf(farm);
                return (
                  <Fragment key={farm.id}>
                    <tr className="hover:bg-secondary/30 transition-colors">
                      <td className="px-3 py-3">
                        <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => toggle(farm.id)} aria-label="הצג מקומות עבודה">
                          {open ? <ChevronDown size={16} /> : <ChevronLeft size={16} />}
                        </button>
                      </td>
                      <td className="px-5 py-3 font-medium">{farm.name}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{farm.company_id || '—'}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{farm.address || '—'}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{farm.accounting_phone || '—'}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{farm.accounting_email || '—'}</td>
                      <td className="px-5 py-3 text-center">
                        <Switch
                          checked={!!farm.has_agreement}
                          onCheckedChange={() => updateFarmItem(farm.id, { has_agreement: !farm.has_agreement })}
                        />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => { setEditFarm(farm); setFarmFormOpen(true); }}>
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteFarm(farm)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-secondary/20">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="flex justify-end mb-2">
                            <Button size="sm" variant="outline" onClick={() => setWorkplaceForm({ farmId: farm.id, workplace: null })}>
                              <Plus size={14} className="ml-1" /> מקום עבודה
                            </Button>
                          </div>
                          <WorkplaceRows
                            workplaces={children}
                            onEdit={(workplace) => setWorkplaceForm({ farmId: farm.id, workplace })}
                            onDelete={handleDeleteWorkplace}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {unassigned.length > 0 && (
                <>
                  <tr className="hover:bg-secondary/30 transition-colors">
                    <td className="px-3 py-3">
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => toggle(UNASSIGNED_KEY)} aria-label="הצג מקומות ללא משק">
                        {rowOpen(UNASSIGNED_KEY) ? <ChevronDown size={16} /> : <ChevronLeft size={16} />}
                      </button>
                    </td>
                    <td className="px-5 py-3 font-medium text-muted-foreground" colSpan={7}>ללא משק</td>
                  </tr>
                  {rowOpen(UNASSIGNED_KEY) && (
                    <tr className="bg-secondary/20">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="flex justify-end mb-2">
                          <Button size="sm" variant="outline" onClick={() => setWorkplaceForm({ farmId: '', workplace: null })}>
                            <Plus size={14} className="ml-1" /> מקום עבודה
                          </Button>
                        </div>
                        <WorkplaceRows
                          workplaces={unassigned}
                          onEdit={(workplace) => setWorkplaceForm({ farmId: '', workplace })}
                          onDelete={handleDeleteWorkplace}
                        />
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      <FarmFormModal
        open={farmFormOpen}
        onClose={() => { setFarmFormOpen(false); setEditFarm(null); }}
        onSave={handleSaveFarm}
        farm={editFarm}
      />
      <WorkplaceFormModal
        open={!!workplaceForm}
        onClose={() => setWorkplaceForm(null)}
        onSave={handleSaveWorkplace}
        workplace={workplaceForm?.workplace}
      />
      <ImportWorkplacesModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => {
          queryClient.invalidateQueries({ queryKey: farmKeys.all });
          queryClient.invalidateQueries({ queryKey: workplaceKeys.all });
          setShowImport(false);
        }}
      />
    </div>
  );
}
