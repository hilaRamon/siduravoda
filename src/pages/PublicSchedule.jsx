import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';

export default function PublicSchedule() {
  const { data: latest, isLoading, isError } = useQuery({
    queryKey: ['published-schedule-public'],
    queryFn: () => base44.public.getPublishedSchedule(),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !latest) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <p className="text-xl font-semibold text-gray-600">
            {isError ? 'לא ניתן לטעון את הסידור' : 'טרם פורסם סידור עבודה'}
          </p>
          <p className="text-sm text-gray-400 mt-2">אנא נסה שנית מאוחר יותר</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">סידור עבודה יומי</h1>
          <p className="text-sm text-gray-500">תאריך: {latest.date}</p>
        </div>
        <a
          href={latest.file_url}
          download
          className="bg-primary text-white text-sm px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          הורד PDF
        </a>
      </div>
      <div className="flex-1">
        <iframe
          src={latest.file_url}
          className="w-full h-full min-h-screen border-0"
          title="סידור עבודה"
        />
      </div>
    </div>
  );
}