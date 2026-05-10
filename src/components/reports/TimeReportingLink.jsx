import { useState } from 'react';
import { Link2, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TimeReportingLink() {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/time-reporting`;

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 flex items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <div className="bg-primary/10 rounded-xl p-3">
          <Link2 size={24} className="text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-base">קישור לדיווח זמנים</h3>
          <p className="text-sm text-muted-foreground mt-1">
            קישור קבוע לדיווח שעות כניסה ויציאה יומי. מציג את שיבוצי היום הנוכחי.
          </p>
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline mt-1 inline-block break-all">
            {link}
          </a>
        </div>
      </div>
      <Button variant="outline" onClick={handleCopy} className="shrink-0 gap-2">
        {copied ? <CheckCircle2 size={15} className="text-success" /> : <Copy size={15} />}
        {copied ? 'הועתק!' : 'העתק קישור'}
      </Button>
    </div>
  );
}