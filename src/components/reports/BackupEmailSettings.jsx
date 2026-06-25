import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Plus, X, Loader2, Check, Send } from 'lucide-react';

function pickCanonicalSettings(list) {
  if (!list?.length) return null;
  const withEmails = list.find(s => Array.isArray(s.emails) && s.emails.length > 0);
  if (withEmails) return withEmails;
  return [...list].sort(
    (a, b) => new Date(b.updated_date || 0).getTime() - new Date(a.updated_date || 0).getTime(),
  )[0];
}

export default function BackupEmailSettings() {
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [saved, setSaved] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const { data: settingsList = [] } = useQuery({
    queryKey: ['backup-settings'],
    queryFn: () => base44.entities.BackupSettings.list(),
  });

  const settings = pickCanonicalSettings(settingsList);
  const [emails, setEmails] = useState([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty && settings) {
      setEmails(Array.isArray(settings.emails) ? settings.emails : []);
    }
  }, [settings, dirty]);

  const addEmail = () => {
    const trimmed = newEmail.trim();
    if (!trimmed || emails.includes(trimmed)) return;
    setEmails(prev => [...prev, trimmed]);
    setNewEmail('');
    setDirty(true);
  };

  const removeEmail = (email) => {
    setEmails(prev => prev.filter(e => e !== email));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage('');
    setErrorMessage('');

    let emailsToSave = emails;
    const pending = newEmail.trim();
    if (pending && !emailsToSave.includes(pending)) {
      emailsToSave = [...emailsToSave, pending];
      setEmails(emailsToSave);
      setNewEmail('');
    }

    const previous = settings?.emails || [];
    const added = emailsToSave.filter(e => !previous.includes(e));

    try {
      const target = pickCanonicalSettings(settingsList);
      if (target) {
        await base44.entities.BackupSettings.update(target.id, { emails: emailsToSave });
      } else {
        await base44.entities.BackupSettings.create({ emails: emailsToSave });
      }
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['backup-settings'] });

      if (added.length > 0) {
        try {
          const result = await base44.admin.sendBackupVerification(added);
          const failed = Object.entries(result.results || {}).filter(([, r]) => !r.success);
          if (failed.length > 0) {
            setErrorMessage(`ההגדרות נשמרו, אך שליחת אימות נכשלה ל: ${failed.map(([e]) => e).join(', ')}`);
          } else {
            const label = added.length === 1 ? added[0] : `${added.length} כתובות`;
            setStatusMessage(`נשמר! נשלח גיבוי אימות ל-${label}`);
          }
        } catch (verifyError) {
          setErrorMessage(verifyError?.message || 'ההגדרות נשמרו, אך שליחת גיבוי האימות נכשלה');
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setErrorMessage(error?.message || 'שמירה נכשלה');
    } finally {
      setSaving(false);
    }
  };

  const handleRunBackup = async () => {
    setRunningBackup(true);
    setStatusMessage('');
    setErrorMessage('');
    try {
      const result = await base44.admin.runBackup();
      if (!result.ok) {
        setErrorMessage(result.message || 'הגיבוי נכשל');
      } else {
        setStatusMessage(`גיבוי נשלח בהצלחה ל-${Object.keys(result.results || {}).length} כתובות`);
      }
    } catch (error) {
      setErrorMessage(error?.message || 'הגיבוי נכשל');
    } finally {
      setRunningBackup(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-3">
          <div className="bg-accent/10 rounded-xl p-3">
            <Mail size={22} className="text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-base">גיבוי שבועי אוטומטי</h3>
            <p className="text-sm text-muted-foreground">נשלח בכל יום ראשון בשעה 9:00 — קובץ שיבוצים לכל יום בשבוע + מצב עדכני של ישויות</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={handleRunBackup} disabled={runningBackup || saving} className="shrink-0">
          {runningBackup ? <Loader2 size={14} className="animate-spin ml-1" /> : <Send size={14} className="ml-1" />}
          {runningBackup ? 'שולח...' : 'שלח גיבוי עכשיו'}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">כתובת חדשה תקבל את גיבוי השבוע האחרון לאימות</p>

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

      {statusMessage && (
        <p className="text-sm text-green-600 dark:text-green-400">{statusMessage}</p>
      )}
      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}

      <Button size="sm" onClick={handleSave} disabled={saving || runningBackup} className="w-full">
        {saving ? <Loader2 size={14} className="animate-spin ml-1" /> : saved ? <Check size={14} className="ml-1" /> : null}
        {saving ? 'שומר...' : saved ? 'נשמר!' : 'שמור הגדרות'}
      </Button>
    </div>
  );
}
