import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { resolveUploadUrl } from '@/lib/uploads';
import { Loader2 } from 'lucide-react';
import { useIsTvSchedule } from '@/hooks/use-tv-schedule';
import ScheduleScreenView from '@/components/reports/ScheduleScreenView';

const SCHEDULE_CHANNEL = 'published-schedule';
const REFETCH_MS = 30_000;

export default function PublicSchedule() {
  const queryClient = useQueryClient();
  const isTvSchedule = useIsTvSchedule();

  const { data: latest, isLoading, isError } = useQuery({
    queryKey: ['published-schedule-public'],
    queryFn: () => base44.public.getPublishedSchedule(),
    refetchInterval: REFETCH_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const channel = new BroadcastChannel(SCHEDULE_CHANNEL);
    channel.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ['published-schedule-public'] });
    };
    return () => channel.close();
  }, [queryClient]);

  if (isLoading) {
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
            {isError ? 'לא ניתן לטעון את הסידור' : 'טרם פורסם סידור עבודה'}
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
