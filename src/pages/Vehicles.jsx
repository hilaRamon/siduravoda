import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Upload } from 'lucide-react';
import ImportVehiclesModal from '@/components/vehicles/ImportVehiclesModal';

function VehicleFormModal({ vehicle, onSave, onClose }) {
  const [form, setForm] = useState({
    name: vehicle?.name || '',
    license_plate: vehicle?.license_plate || '',
    insurance: vehicle?.insurance || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>{vehicle ? 'עריכת רכב' : 'הוספת רכב'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">שם / מספר רכב *</label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">לוחית רישוי</label>
            <Input value={form.license_plate} onChange={e => setForm({ ...form, license_plate: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">ביטוח</label>
            <Input value={form.insurance} onChange={e => setForm({ ...form, insurance: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
            <Button type="submit">{vehicle ? 'שמור' : 'הוסף'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Vehicles() {
  const [search, setSearch] = useState('');
  const [editVehicle, setEditVehicle] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const queryClient = useQueryClient();

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const filtered = vehicles.filter(v =>
    v.name?.includes(search) || v.license_plate?.includes(search)
  );

  const handleSave = async (data) => {
    if (editVehicle) {
      await base44.entities.Vehicle.update(editVehicle.id, data);
    } else {
      await base44.entities.Vehicle.create(data);
    }
    queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    setShowForm(false);
    setEditVehicle(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('למחוק רכב זה?')) return;
    await base44.entities.Vehicle.delete(id);
    queryClient.invalidateQueries({ queryKey: ['vehicles'] });
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">רכבים</h2>
          <p className="text-muted-foreground mt-1">{vehicles.length} רכבים במערכת</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload size={16} className="ml-2" /> ייבוא מאקסל
          </Button>
          <Button onClick={() => { setEditVehicle(null); setShowForm(true); }}>
            <Plus size={16} className="ml-2" /> הוסף רכב
          </Button>
        </div>
      </div>

      <Input
        placeholder="חיפוש לפי שם או לוחית..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="mb-4 max-w-xs"
      />

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">#</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">שם / מספר רכב</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">לוחית רישוי</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">ביטוח</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">טוען...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">אין רכבים</td></tr>
            ) : (
              filtered.map((v, idx) => (
                <tr key={v.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground text-xs">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium">{v.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.license_plate || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{v.insurance || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => { setEditVehicle(v); setShowForm(true); }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(v.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <VehicleFormModal
          vehicle={editVehicle}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditVehicle(null); }}
        />
      )}

      {showImport && (
        <ImportVehiclesModal
          onClose={() => { setShowImport(false); queryClient.invalidateQueries({ queryKey: ['vehicles'] }); }}
        />
      )}
    </div>
  );
}