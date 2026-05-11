import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SRSViewer() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/src/docs/SRS_Regivim_System.md')
      .then(r => r.text())
      .then(text => { setContent(text); setLoading(false); })
      .catch(() => { setContent('# שגיאה בטעינת המסמך'); setLoading(false); });
  }, []);

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SRS_Regivim_System.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="text-muted-foreground text-sm py-8 text-center">טוען מסמך...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">מפרט דרישות מערכת — גרסה 1.0</p>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download size={14} className="ml-1" /> הורד Markdown
        </Button>
      </div>
      <div
        dir="rtl"
        className="bg-card border border-border rounded-2xl p-8 prose prose-sm max-w-none
          prose-headings:font-bold prose-headings:text-foreground
          prose-h1:text-2xl prose-h2:text-xl prose-h2:border-b prose-h2:border-border prose-h2:pb-2
          prose-h3:text-base prose-h3:text-primary
          prose-p:text-foreground prose-p:leading-relaxed
          prose-li:text-foreground
          prose-table:text-sm prose-th:bg-secondary/60 prose-th:text-right prose-td:text-right
          prose-code:bg-secondary prose-code:px-1 prose-code:rounded prose-code:text-xs
          prose-pre:bg-secondary prose-pre:rounded-xl prose-pre:p-4
          prose-strong:text-foreground
          prose-blockquote:border-primary prose-blockquote:text-muted-foreground
          overflow-auto max-h-[75vh]"
      >
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}