import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Save, Settings2 } from 'lucide-react';
import {
  PRICING_DEFAULTS,
  PRICING_METHODS,
  normalizeAppSettings,
} from '@/lib/pricing';
import { reportKeys } from '@/queries/reports/keys';

function parsePositiveNumber(value, fallback) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseHoursPerDailyUnit(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : PRICING_DEFAULTS.hours_per_daily_unit;
}

export default function DefaultSettings() {
  const queryClient = useQueryClient();

  const { data: settingsList = [], isLoading } = useQuery({
    queryKey: ['app-settings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const settings = settingsList[0];

  const [pricingMethod, setPricingMethod] = useState(PRICING_METHODS.HOURLY);
  const [rate, setRate] = useState('');
  const [hours, setHours] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [hoursPerDailyUnit, setHoursPerDailyUnit] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      const next = normalizeAppSettings(settings);
      setPricingMethod(next.pricing_method);
      setRate(String(next.default_rate));
      setHours(String(next.default_hours));
      setDailyRate(String(next.default_daily_rate));
      setHoursPerDailyUnit(String(next.hours_per_daily_unit));
    } else if (!isLoading) {
      setPricingMethod(PRICING_DEFAULTS.pricing_method);
      setRate(String(PRICING_DEFAULTS.default_rate));
      setHours(String(PRICING_DEFAULTS.default_hours));
      setDailyRate(String(PRICING_DEFAULTS.default_daily_rate));
      setHoursPerDailyUnit(String(PRICING_DEFAULTS.hours_per_daily_unit));
    }
  }, [settings, isLoading]);

  const handleSave = async () => {
    setSaving(true);
    const data = {
      pricing_method: pricingMethod,
      default_rate: parsePositiveNumber(rate, PRICING_DEFAULTS.default_rate),
      default_hours: parsePositiveNumber(hours, PRICING_DEFAULTS.default_hours),
      default_daily_rate: parsePositiveNumber(
        dailyRate,
        PRICING_DEFAULTS.default_daily_rate,
      ),
      hours_per_daily_unit: parseHoursPerDailyUnit(hoursPerDailyUnit),
    };
    if (settings) {
      await base44.entities.AppSettings.update(settings.id, data);
    } else {
      await base44.entities.AppSettings.create(data);
    }
    queryClient.invalidateQueries({ queryKey: ['app-settings'] });
    queryClient.invalidateQueries({ queryKey: reportKeys.all });
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
        <div className="space-y-2">
          <label className="text-sm font-medium">שיטת תמחור</label>
          <p className="text-xs text-muted-foreground">
            קובעת כיצד מוצגים תעריפים בשיבוצים ובדוחות. הנתונים נשמרים תמיד כשעות ותעריף שעתי.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPricingMethod(PRICING_METHODS.HOURLY)}
              className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                pricingMethod === PRICING_METHODS.HOURLY
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-secondary/40'
              }`}
            >
              תמחור שעתי
            </button>
            <button
              type="button"
              onClick={() => setPricingMethod(PRICING_METHODS.DAILY)}
              className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                pricingMethod === PRICING_METHODS.DAILY
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-secondary/40'
              }`}
            >
              תמחור יומי
            </button>
          </div>
        </div>

        <div className="h-px bg-border" />

        {pricingMethod === PRICING_METHODS.HOURLY ? (
          <>
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
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">תעריף יומי ברירת מחדל (₪)</label>
              <p className="text-xs text-muted-foreground">מוצג בשיבוצים ובדוחות; נשמר פנימית כתעריף שעתי</p>
              <input
                type="number"
                value={dailyRate}
                onChange={e => setDailyRate(e.target.value)}
                min="0"
                step="1"
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-36"
              />
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-1.5">
              <label className="text-sm font-medium">שעות ליחידה יומית</label>
              <p className="text-xs text-muted-foreground">
                משמש להמרה בין תעריף יומי לשעתי ולחישוב יחידות יומיות בדוחות
              </p>
              <input
                type="number"
                value={hoursPerDailyUnit}
                onChange={e => setHoursPerDailyUnit(e.target.value)}
                min="0.01"
                step="0.25"
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-36"
              />
            </div>
          </>
        )}

        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save size={15} />
          {saving ? 'שומר...' : saved ? '✓ נשמר!' : 'שמור הגדרות'}
        </Button>
      </div>
    </div>
  );
}
