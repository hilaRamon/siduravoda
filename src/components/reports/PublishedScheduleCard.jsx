import { Link2 } from 'lucide-react';
import { usePublishedSchedules } from '@/queries/publishedScheduleQueries';
import {
  formatDayMonth,
  getScheduleVisibleDate,
  isScheduleVisible,
} from '@/lib/scheduleVisibility';

const PERMANENT_URL = `${window.location.origin}/schedule`;

export default function PublishedScheduleCard() {
  const { data: records = [] } = usePublishedSchedules();

  const live = records.find((record) => isScheduleVisible(record.date));
  const pending = records.find((record) => !isScheduleVisible(record.date));

  return (
    <div className="bg-card border border-border rounded-2xl p-6 flex items-start gap-4">
      <div className="bg-blue-50 rounded-xl p-3">
        <Link2 size={24} className="text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-base">קישור קבוע לסידור העבודה</h3>
        {live ? (
          <p className="text-sm text-muted-foreground mt-1">
            סידור ציבורי כעת:{' '}
            <span className="font-medium text-foreground">{live.date}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mt-1">
            טרם פורסם סידור לציבור. לחץ &quot;פרסום סידור&quot; בדף השיבוצים.
          </p>
        )}
        {pending && (
          <p className="text-sm text-muted-foreground mt-1">
            נשמר לתאריך{' '}
            <span className="font-medium text-foreground">{pending.date}</span>
            {' — '}
            יוצג לציבור ב-16:00 ב-{formatDayMonth(getScheduleVisibleDate(pending.date))}
          </p>
        )}
        <div className="flex items-center gap-3 mt-3">
          <a
            href={PERMANENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 underline truncate max-w-xs"
          >
            {PERMANENT_URL}
          </a>
          <button
            onClick={() => navigator.clipboard.writeText(PERMANENT_URL)}
            className="text-xs bg-secondary hover:bg-secondary/80 px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0"
          >
            העתק קישור
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">הקישור הזה קבוע לעולם — הסידור מתעדכן אוטומטית בכל פרסום חדש, ב-16:00 ביום שלפני תאריך הסידור.</p>
      </div>
    </div>
  );
}
