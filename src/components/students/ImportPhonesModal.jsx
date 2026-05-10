import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Phone, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Normalize name for fuzzy matching: remove extra spaces, normalize chars
function normalizeName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[״"]/g, '"')
    .replace(/[׳']/g, "'")
    .toLowerCase();
}

function findBestMatch(name, students) {
  const norm = normalizeName(name);
  if (!norm) return null;

  // 1. Exact match
  let m = students.find(s => normalizeName(s.full_name) === norm);
  if (m) return m;

  // 2. Exact match ignoring case/spaces on both sides
  m = students.find(s => normalizeName(s.full_name).replace(/\s/g, '') === norm.replace(/\s/g, ''));
  if (m) return m;

  // 3. One side fully contains the other (must be >3 chars to avoid false positives)
  if (norm.length > 3) {
    m = students.find(s => {
      const sn = normalizeName(s.full_name);
      return sn.length > 3 && (sn.includes(norm) || norm.includes(sn));
    });
    if (m) return m;
  }

  return null;
}

function ManualMatchPopover({ students, onSelect }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = students.filter(s =>
    !search || s.full_name?.includes(search)
  ).slice(0, 50);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="text-xs underline text-primary hover:opacity-70">התאם ידנית</button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start" dir="rtl">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="חיפוש תלמיד..."
            className="h-8 text-xs"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>לא נמצא</CommandEmpty>
            <CommandGroup>
              {filtered.map(s => (
                <CommandItem
                  key={s.id}
                  value={s.full_name}
                  onSelect={() => { onSelect(s); setOpen(false); setSearch(''); }}
                  className="text-xs cursor-pointer"
                >
                  {s.full_name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function ImportPhonesModal({ open, onClose, students, onImported }) {
  const [step, setStep] = useState('upload');
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState({ updated: 0, notFound: 0 });
  const fileRef = useRef();

  const reset = () => {
    setStep('upload');
    setRows([]);
    setResults({ updated: 0, notFound: 0 });
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const isCSV = file.name.endsWith('.csv');
      const wb = XLSX.read(ev.target.result, { type: isCSV ? 'string' : 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      let headerIdx = 0;
      let nameCol = -1;
      let phoneCol = -1;

      for (let i = 0; i < Math.min(data.length, 10); i++) {
        const row = (data[i] || []).map(c => String(c ?? '').toLowerCase());
        const ni = row.findIndex(c => c && (c.includes('שם') || c.includes('name')));
        const pi = row.findIndex(c => c && (c.includes('טלפון') || c.includes('phone') || c.includes('נייד') || c.includes('mobile')));
        if (ni !== -1 && pi !== -1) {
          headerIdx = i;
          nameCol = ni;
          phoneCol = pi;
          break;
        }
      }

      if (nameCol === -1) { nameCol = 0; phoneCol = 1; headerIdx = 0; }

      const parsed = [];
      for (let i = headerIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;
        const name = String(row[nameCol] ?? '').trim();
        const phone = String(row[phoneCol] ?? '').trim().replace(/[-\s]/g, '');
        if (!name || !phone) continue;

        const matchedStudent = findBestMatch(name, students);
        const hasPhone = matchedStudent && matchedStudent.phone && matchedStudent.phone.trim() !== '';
        parsed.push({ name, phone, matchedStudent, status: matchedStudent ? (hasPhone ? 'has_phone' : 'matched') : 'not_found' });
      }

      setRows(parsed);
      setStep('preview');
    };
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const handleManualMatch = (rowIdx, student) => {
    setRows(prev => prev.map((r, i) =>
      i === rowIdx ? { ...r, matchedStudent: student, status: 'matched' } : r
    ));
  };

  const handleRemoveMatch = (rowIdx) => {
    setRows(prev => prev.map((r, i) =>
      i === rowIdx ? { ...r, matchedStudent: null, status: 'not_found' } : r
    ));
  };

  const handleImport = async () => {
    setImporting(true);
    let updated = 0;
    let skipped = 0;
    let notFound = 0;
    for (const row of rows) {
      if (row.status === 'matched') {
        await base44.entities.Student.update(row.matchedStudent.id, { phone: row.phone });
        updated++;
      } else if (row.status === 'has_phone') {
        skipped++;
      } else {
        notFound++;
      }
    }
    setResults({ updated, skipped, notFound });
    setStep('done');
    setImporting(false);
    onImported();
  };

  const matched = rows.filter(r => r.status === 'matched');
  const hasPhone = rows.filter(r => r.status === 'has_phone');
  const notFound = rows.filter(r => r.status === 'not_found');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone size={18} /> ייבוא מספרי טלפון מאקסל / CSV
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              העלה קובץ אקסל או CSV עם עמודות שם תלמיד וטלפון. המערכת תתאים לפי שם ותעדכן את מספר הטלפון לתלמידים הקיימים בלבד.
            </p>
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:bg-secondary/20 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={32} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">לחץ לבחירת קובץ</p>
              <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls, .csv</p>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleClose}>ביטול</Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 mt-2">
            <div className="flex gap-2 flex-wrap text-sm">
              <span className="text-green-600 font-medium">✓ {matched.length} יעודכנו</span>
              {hasPhone.length > 0 && <span className="text-muted-foreground font-medium">⏭ {hasPhone.length} כבר יש להם טלפון</span>}
              {notFound.length > 0 && <span className="text-red-500 font-medium">✗ {notFound.length} לא נמצאו</span>}
            </div>

            <div className="max-h-72 overflow-y-auto border border-border rounded-lg divide-y divide-border text-sm">
              {rows.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-2 ${r.status === 'not_found' ? 'bg-red-50' : r.status === 'has_phone' ? 'bg-gray-50' : 'bg-green-50/40'}`}>
                  <span className="font-medium flex-1 truncate">{r.name}</span>
                  <span className="text-muted-foreground font-mono text-xs shrink-0">{r.phone}</span>
                  {r.status === 'matched' ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-green-700 truncate max-w-[100px]">→ {r.matchedStudent.full_name}</span>
                      <button onClick={() => handleRemoveMatch(i)} className="text-muted-foreground hover:text-destructive">
                        <X size={12} />
                      </button>
                    </div>
                  ) : r.status === 'has_phone' ? (
                    <span className="text-xs text-muted-foreground shrink-0">כבר קיים טלפון</span>
                  ) : (
                    <div className="shrink-0">
                      <ManualMatchPopover students={students} onSelect={(s) => handleManualMatch(i, s)} />
                    </div>
                  )}
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
            <p className="text-sm text-muted-foreground">
              עודכנו {results.updated} תלמידים.{results.skipped > 0 ? ` ${results.skipped} דולגו (כבר יש להם טלפון).` : ''}{results.notFound > 0 ? ` ${results.notFound} לא נמצאו.` : ''}
            </p>
            <Button onClick={handleClose} className="w-full">סגור</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}