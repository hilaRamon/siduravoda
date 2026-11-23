import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { resolveUploadUrl } from '@/lib/uploads';
import { Loader2 } from 'lucide-react';
import { useIsTvSchedule } from '@/hooks/use-tv-schedule';
import ScheduleScreenView from '@/components/reports/ScheduleScreenView';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { PasswordField } from '@/components/ui/password-field';
import { publishedScheduleApi } from '@/api/publishedScheduleApi';
import {
  clearScheduleAccessToken,
  readScheduleAccessToken,
  saveScheduleAccessToken,
} from '@/lib/scheduleAccess';
import {
  publishedScheduleKeys,
  usePublicPublishedSchedule,
} from '@/queries/publishedScheduleQueries';

const SCHEDULE_CHANNEL = 'published-schedule';

function SchedulePasswordForm({ onUnlocked }) {
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await publishedScheduleApi.unlock(password);
      saveScheduleAccessToken(token, rememberMe);
      onUnlocked(token);
    } catch (err) {
      setError(err?.status === 503 ? 'הסידור אינו זמין כרגע' : 'סיסמה שגויה');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50 px-4" dir="rtl">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <p className="text-xl font-semibold text-gray-600">סידור עבודה יומי</p>
          <p className="text-sm text-gray-400 mt-2">הזן סיסמה כדי לצפות בסידור</p>
        </div>
        <PasswordField
          id="schedule-password"
          value={password}
          onValueChange={setPassword}
          autoComplete="current-password"
          required
          autoFocus
          disabled={loading}
        />
        <div className="flex items-center gap-2">
          <Checkbox
            id="schedule-remember-me"
            type="button"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked === true)}
          />
          <Label htmlFor="schedule-remember-me" className="text-sm font-normal cursor-pointer">
            זכור אותי במחשב זה
          </Label>
        </div>
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={loading || !password}>
          {loading && <Loader2 size={18} className="animate-spin" />}
          כניסה
        </Button>
      </form>
    </div>
  );
}

export default function PublicSchedule() {
  const queryClient = useQueryClient();
  const isTvSchedule = useIsTvSchedule();
  const [token, setToken] = useState(() => readScheduleAccessToken());

  const { data: latest, isPending, isError, error } = usePublicPublishedSchedule({
    enabled: Boolean(token),
  });

  useEffect(() => {
    const channel = new BroadcastChannel(SCHEDULE_CHANNEL);
    channel.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: publishedScheduleKeys.public });
    };
    return () => channel.close();
  }, [queryClient]);

  useEffect(() => {
    if (error?.status !== 401) return;
    clearScheduleAccessToken();
    setToken('');
  }, [error]);

  function handleUnlocked(nextToken) {
    queryClient.removeQueries({ queryKey: publishedScheduleKeys.public });
    setToken(nextToken);
  }

  if (!token || error?.status === 401) {
    return <SchedulePasswordForm onUnlocked={handleUnlocked} />;
  }

  if (isPending) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  const fileUrl = resolveUploadUrl(latest?.file_url);
  const pdfSrc = fileUrl
    ? `${fileUrl}${fileUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(latest.updated_date || latest.id)}`
    : fileUrl;

  if (isError || !latest) {
    return (
      <div className="h-screen flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <p className="text-xl font-semibold text-gray-600">
            {error?.status === 503
              ? 'הסידור אינו זמין כרגע'
              : isError
                ? 'לא ניתן לטעון את הסידור'
                : 'טרם פורסם סידור עבודה'}
          </p>
          <p className="text-sm text-gray-400 mt-2">אנא נסה שנית מאוחר יותר</p>
        </div>
      </div>
    );
  }

  const useHtmlViewer = isTvSchedule && latest.snapshot?.reportGroups?.length > 0;

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden" dir="rtl">
      <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">סידור עבודה יומי</h1>
          <p className="text-sm text-gray-500">תאריך: {latest.date}</p>
        </div>
        {!isTvSchedule && (
          <a
            href={pdfSrc}
            download
            className="bg-primary text-white text-sm px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            הורד PDF
          </a>
        )}
      </div>
      <main className="flex-1 min-h-0">
        {useHtmlViewer ? (
          <ScheduleScreenView
            key={latest.id ?? latest.updated_date}
            snapshot={latest.snapshot}
          />
        ) : (
          <iframe
            key={latest.id ?? pdfSrc}
            src={pdfSrc}
            className="w-full h-full border-0"
            title="סידור עבודה"
          />
        )}
      </main>
    </div>
  );
}
