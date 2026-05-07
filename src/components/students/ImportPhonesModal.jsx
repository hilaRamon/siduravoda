import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Phone } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ImportPhonesModal({ open, onClose, students, onImported }) {
  const [step, setStep] = useState('upload'); // upload | preview | done
  const [rows, setRows] = useState([]); // { name, phone, matchedStudent, status }
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState({ updated: 0, notFound: 0 });
  const fileRef = useRef();

  const reset = () => {
    setStep('upload');
    setRows([]);
    setResults({ updated: 0, notFound: 0 });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Find header row — look for a row that has both name-like and phone-like columns
      let headerIdx = 0;
      let nameCol = -1;
      let phoneCol = -1;

      for (let i = 0; i < Math.min(data.length, 10); i++) {
        const row = data[i].map(c => String(c || '').toLowerCase());
        const ni = row.findIndex(c => c.includes('שם') || c.includes('name'));
        const pi = row.findIndex(c => c.includes('טלפון') || c.includes('phone') || c.includes('נייד') || c.includes('mobile'));
        if (ni !== -1 && pi !== -1) {
          headerIdx = i;
          nameCol = ni;
          phoneCol = pi;
          break;
        }
      }

      // If no headers found, assume first col = name, second col = phone
      if (nameCol === -1) {
        nameCol = 0;
        phoneCol = 1;
        headerIdx = 0;
      }

      const parsed = [];
      for (let i = headerIdx + 1; i < data.length; i++) {
        const row = data[i];
        const name = String(row[nameCol] || '').trim();
        const phone = String(row[phoneCol] || '').trim().replace(/[-\s]/g, '');
        if (!name || !phone) continue;

        // Try to match student by name (exact or contains)
        const matchedStudent =
          students.find(s => s.full_name === name) ||
          students.find(s => s.full_name?.includes(name) || name.includes(s.full_name));

        parsed.push({ name, phone, matchedStudent, status: matchedStudent ? 'matched' : 'not_found' });
      }

      setRows(parsed);
      setStep('preview');
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    setImporting(true);
    let updated = 0;
    let notFound = 0;

    for (const row of rows) {
      if (row.matchedStudent) {
        await base44.entities.Student.update(row.matchedStudent.id, { phone: row.phone });
        updated++;
      } else {
        notFound++;
      }
    }

    setResults({ updated, notFound });
    setStep('done');
    setImporting(false);
    onImported();
  };

  const matched = rows.filter(r => r.status === 'matched');
  const notFound = rows.filter(r => r.status === 'not_found');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone size={18} /> ייבוא מספרי טלפון מאקסל
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              העלה קובץ אקסל עם עמודות שם תלמיד וטלפון. המערכת תתאים לפי שם ותעדכן את מספר הטלפון לתלמידים הקיימים בלבד.
            </p>
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:bg-secondary/20 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={32} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">לחץ לבחירת קובץ</p>
              <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls</p>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleClose}>ביטול</Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 mt-2">
            <div className="flex gap-4 text-sm">
              <span className="text-green-600 font-medium">✓ {matched.length} תלמידים זוהו</span>
              {notFound.length > 0 && <span className="text-red-500 font-medium">✗ {notFound.length} לא נמצאו</span>}
            </div>

            <div className="max-h-64 overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {rows.map((r, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-2 text-sm ${r.status === 'not_found' ? 'bg-red-50 text-red-700' : 'bg-green-50/50'}`}>
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground font-mono text-xs">{r.phone}</span>
                  <span className="text-xs">{r.status === 'matched' ? `→ ${r.matchedStudent.full_name}` : 'לא נמצא'}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={reset}>חזרה</Button>
              <Button onClick={handleImport} disabled={importing || matched.length === 0}>
                {importing ? 'מייבא...' : `עדכן ${matched.length} תלמידים`}
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 mt-2 text-center">
            <div className="text-4xl">✅</div>
            <p className="font-semibold">הייבוא הושלם</p>
            <p className="text-sm text-muted-foreground">עודכנו {results.updated} תלמידים. {results.notFound > 0 ? `${results.notFound} לא נמצאו ולא עודכנו.` : ''}</p>
            <Button onClick={handleClose} className="w-full">סגור</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}