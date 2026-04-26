import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Plus, X, Loader2, Check } from 'lucide-react';

export default function BackupEmailSettings() {
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: settingsList = [] } = useQuery({
    queryKey: ['backup-settings'],
    queryFn: () => base44.entities.BackupSettings.list(),
  });

  const settings = settingsList[0];
  const [emails, setEmails] = useState([]);

  useEffect(() => {
    if (settings?.emails) setEmails(settings.emails);
  }, [settings]);

  const addEmail = () => {
    const trimmed = newEmail.trim();
    if (!trimmed || emails.includes(trimmed)) return;
    setEmails(prev => [...prev, trimmed]);
    setNewEmail('');
  };

  const removeEmail = (email) => {
    setEmails(prev => prev.filter(e => e !== email));
  };

  const handleSave = async () => {
    setSaving(true);
    if (settings) {
      await base44.entities.BackupSettings.update(settings.id, { emails });
    } else {
      await base44.entities.BackupSettings.create({ emails });
    }
    queryClient.invalidateQueries({ queryKey: ['backup-settings'] });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="bg-accent/10 rounded-xl p-3">
          <Mail size={22} className="text-accent" />
        </div>
        <div>
          <h3 className="font-semibold text-base">גיבוי חודשי אוטומטי</h3>
          <p className="text-sm text-muted-foreground">נשלח בכל ראשון לחודש בשעה 9:00 לכתובות הבאות</p>
        </div>
      </div>

      <div className="space-y-2">
        {emails.map(email => (
          <div key={email} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
            <span className="text-sm">{email}</span>
            <button onClick={() => removeEmail(email)} className="text-muted-foreground hover:text-destructive transition-colors">
              <X size={14} />
            </button>
          </div>
        ))}
        {emails.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">לא הוגדרו כתובות מייל</p>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="הוסף כתובת מייל..."
          value={newEmail}
          onChange={e => setNewEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addEmail(); }}
          className="h-9 text-sm"
          dir="ltr"
        />
        <Button size="sm" variant="outline" onClick={addEmail} disabled={!newEmail.trim()}>
          <Plus size={14} />
        </Button>
      </div>

      <Button size="sm" onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <Loader2 size={14} className="animate-spin ml-1" /> : saved ? <Check size={14} className="ml-1" /> : null}
        {saving ? 'שומר...' : saved ? 'נשמר!' : 'שמור הגדרות'}
      </Button>
    </div>
  );
}