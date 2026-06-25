import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link2 } from 'lucide-react';

const PERMANENT_URL = `${window.location.origin}/schedule`;

export default function PublishedScheduleCard() {
  const { data: records = [] } = useQuery({
    queryKey: ['published-schedule'],
    queryFn: () => base44.entities.PublishedSchedule.list(),
  });

  const latest = records[0];

  return (
    <div className="bg-card border border-border rounded-2xl p-6 flex items-start gap-4">
      <div className="bg-blue-50 rounded-xl p-3">
        <Link2 size={24} className="text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-base">קישור קבוע לסידור העבודה</h3>
        {latest ? (
          <>
            <p className="text-sm text-muted-foreground mt-1">
              סידור אחרון: <span className="font-medium text-foreground">{latest.date}</span>
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground mt-1">טרם פורסם סידור. לחץ "פרסום סידור" בדף השיבוצים.</p>
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
        <p className="text-xs text-muted-foreground mt-2">הקישור הזה קבוע לעולם — הסידור מתעדכן אוטומטית בכל פרסום חדש.</p>
      </div>
    </div>
  );
}