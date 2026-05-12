import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Save, Settings2 } from 'lucide-react';

export default function DefaultSettings() {
  const queryClient = useQueryClient();

  const { data: settingsList = [], isLoading } = useQuery({
    queryKey: ['app-settings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const settings = settingsList[0];

  const [rate, setRate] = useState('');
  const [hours, setHours] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setRate(String(settings.default_rate ?? 40));
      setHours(String(settings.default_hours ?? 4.75));
    } else if (!isLoading) {
      setRate('40');
      setHours('4.75');
    }
  }, [settings, isLoading]);

  const handleSave = async () => {
    setSaving(true);
    const data = {
      default_rate: parseFloat(rate) || 40,
      default_hours: parseFloat(hours) || 4.75,
    };
    if (settings) {
      await base44.entities.AppSettings.update(settings.id, data);
    } else {
      await base44.entities.AppSettings.create(data);
    }
    queryClient.invalidateQueries({ queryKey: ['app-settings'] });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">טוען...</div>;

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-primary/10 rounded-xl p-3">
          <Settings2 size={22} className="text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-base">הגדרות ברירות מחדל</h3>
          <p className="text-sm text-muted-foreground">ערכים שיוחלו אוטומטית בשיבוצים ובדוחות</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">

        <div className="space-y-1.5">
          <label className="text-sm font-medium">תעריף שעתי ברירת מחדל (₪)</label>
          <p className="text-xs text-muted-foreground">משמש לחישוב עלות בדוח עבודה לתקופה</p>
          <input
            type="number"
            value={rate}
            onChange={e => setRate(e.target.value)}
            min="0"
            step="1"
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-36"
          />
        </div>

        <div className="h-px bg-border" />

        <div className="space-y-1.5">
          <label className="text-sm font-medium">כמות שעות ברירת מחדל לשיבוץ</label>
          <p className="text-xs text-muted-foreground">מספר השעות שמוצג כברירת מחדל בעמוד השיבוצים היומיים</p>
          <input
            type="number"
            value={hours}
            onChange={e => setHours(e.target.value)}
            min="0"
            step="0.25"
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-36"
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save size={15} />
          {saving ? 'שומר...' : saved ? '✓ נשמר!' : 'שמור הגדרות'}
        </Button>
      </div>
    </div>
  );
}