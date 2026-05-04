import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import * as XLSX from 'xlsx';

const FREE_DAY_MAP = {
  'ראשון': 'א', 'א׳': 'א', "א'": 'א', 'א': 'א',
  'שני': 'ב', 'ב׳': 'ב', "ב'": 'ב', 'ב': 'ב',
  'שלישי': 'ג', 'ג׳': 'ג', "ג'": 'ג', 'ג': 'ג',
  'רביעי': 'ד', 'ד׳': 'ד', "ד'": 'ד', 'ד': 'ד',
  'חמישי': 'ה', 'ה׳': 'ה', "ה'": 'ה', 'ה': 'ה',
};

const SYSTEM_FIELDS = [
  { key: 'full_name', label: 'שם מלא', required: true },
  { key: 'cohort', label: 'מחזור', required: false },
  { key: 'free_day', label: 'יום חופש', required: false },
  { key: 'distance_status', label: 'סטטוס מרחק', required: false },
  { key: 'notes', label: 'הערות', required: false },
];

function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!data.length) return { headers: [], rows: [] };
  const headers = Object.keys(data[0]);
  return { headers, rows: data.map(r => { const obj = {}; headers.forEach(h => { obj[h] = String(r[h] ?? ''); }); return obj; }) };
}

export default function ImportModal({ open, onClose, onImported }) {
  const [step, setStep] = useState('upload'); // upload | map | preview | done
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const fileRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers, rows } = parseExcel(new Uint8Array(ev.target.result));
      setHeaders(headers);
      setRows(rows);
      const autoMap = {};
      SYSTEM_FIELDS.forEach(sf => {
        const match = headers.find(h =>
          h === sf.label || h.toLowerCase().includes(sf.key) ||
          (sf.key === 'full_name' && (h.includes('שם') || h.includes('name'))) ||
          (sf.key === 'cohort' && h.includes('מחזור')) ||
          (sf.key === 'free_day' && (h.includes('חופש') || h.includes('יום'))) ||
          (sf.key === 'distance_status' && h.includes('מרחק'))
        );
        if (match) autoMap[sf.key] = match;
      });
      setMapping(autoMap);
      setStep('map');
    };
    reader.readAsArrayBuffer(file);
  };

  const buildPreviewRows = () => {
    return rows.slice(0, 3).map(row => {
      const mapped = {};
      SYSTEM_FIELDS.forEach(sf => {
        if (mapping[sf.key]) mapped[sf.key] = row[mapping[sf.key]] || '';
      });
      return mapped;
    });
  };

  const validateRows = () => {
    const errs = [];
    rows.forEach((row, i) => {
      const name = mapping.full_name ? row[mapping.full_name] : '';
      const freeDay = mapping.free_day ? row[mapping.free_day] : '';
      if (!name?.trim()) errs.push({ row: i + 2, msg: `שורה ${i + 2}: שם מלא חסר` });
      if (freeDay && !FREE_DAY_MAP[freeDay.trim()]) {
        errs.push({ row: i + 2, msg: `שורה ${i + 2}: יום חופש לא תקין: "${freeDay}"` });
      }
    });
    return errs;
  };

  const handleImport = async () => {
    setImporting(true);
    const existing = await base44.entities.Student.list('full_name', 1000);
    const existingByName = {};
    existing.forEach(s => { existingByName[s.full_name?.trim()] = s; });

    const toCreate = [];
    const toUpdate = [];

    for (const row of rows) {
      const full_name = (mapping.full_name ? row[mapping.full_name] : '')?.trim();
      if (!full_name) continue;
      const rawFreeDay = mapping.free_day ? row[mapping.free_day]?.trim() : '';
      const free_day = FREE_DAY_MAP[rawFreeDay] || rawFreeDay || undefined;
      const data = {
        full_name,
        cohort: mapping.cohort ? row[mapping.cohort]?.trim() : undefined,
        free_day: free_day || undefined,
        distance_status: mapping.distance_status ? row[mapping.distance_status]?.trim() : undefined,
        notes: mapping.notes ? row[mapping.notes]?.trim() : undefined,
        is_active: existingByName[full_name] ? existingByName[full_name].is_active : false,
      };
      Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

      if (existingByName[full_name]) {
        toUpdate.push({ id: existingByName[full_name].id, data });
      } else {
        toCreate.push(data);
      }
    }

    const CHUNK = 50;
    for (let i = 0; i < toCreate.length; i += CHUNK) {
      await base44.entities.Student.bulkCreate(toCreate.slice(i, i + CHUNK));
    }
    for (const u of toUpdate) {
      await base44.entities.Student.update(u.id, u.data);
    }

    setImportCount(toCreate.length + toUpdate.length);
    setImporting(false);
    setStep('done');
    onImported();
  };

  const reset = () => {
    setStep('upload');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setErrors([]);
    setImportCount(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={() => { reset(); onClose(); }}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>ייבוא סטודנטים מקובץ Excel</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="py-8 text-center">
            <div className="border-2 border-dashed border-border rounded-2xl p-10 hover:border-primary transition-colors">
              <Upload className="mx-auto mb-3 text-muted-foreground" size={36} />
              <p className="text-sm text-muted-foreground mb-4">גרור קובץ Excel או לחץ לבחירה</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" id="excel-upload" />
              <Button asChild variant="outline">
                <label htmlFor="excel-upload" className="cursor-pointer">בחר קובץ Excel</label>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">הקובץ צריך להכיל שורת כותרות בשורה הראשונה (.xlsx / .xls)</p>
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">מצא {rows.length} שורות. מפה את עמודות הקובץ לשדות המערכת:</p>
            <div className="space-y-3">
              {SYSTEM_FIELDS.map(sf => (
                <div key={sf.key} className="flex items-center gap-3">
                  <span className="w-32 text-sm font-medium shrink-0">
                    {sf.label} {sf.required && <span className="text-destructive">*</span>}
                  </span>
                  <Select value={mapping[sf.key] || ''} onValueChange={v => setMapping(p => ({ ...p, [sf.key]: v }))}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="— לא ממופה —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>— לא ממופה —</SelectItem>
                      {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview */}
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">תצוגה מקדימה (3 שורות ראשונות):</p>
              <div className="overflow-auto rounded-xl border border-border text-xs">
                <table className="w-full">
                  <thead className="bg-secondary">
                    <tr>
                      {SYSTEM_FIELDS.filter(sf => mapping[sf.key]).map(sf => (
                        <th key={sf.key} className="px-3 py-2 text-right font-medium">{sf.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {buildPreviewRows().map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {SYSTEM_FIELDS.filter(sf => mapping[sf.key]).map(sf => (
                          <td key={sf.key} className="px-3 py-2">{row[sf.key]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={reset}>חזרה</Button>
              <Button
                onClick={() => {
                  const errs = validateRows();
                  setErrors(errs);
                  setStep('preview');
                }}
                disabled={!mapping.full_name}
              >
                המשך
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 mt-2">
            {errors.length > 0 ? (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2 text-destructive font-medium text-sm">
                  <AlertCircle size={16} /> נמצאו {errors.length} שגיאות
                </div>
                <ul className="text-xs text-destructive space-y-1">
                  {errors.map((e, i) => <li key={i}>• {e.msg}</li>)}
                </ul>
              </div>
            ) : (
              <div className="bg-success/10 border border-success/30 rounded-xl p-4 flex items-center gap-2 text-success text-sm font-medium">
                <CheckCircle2 size={16} /> הכל תקין! {rows.length} שורות מוכנות לייבוא
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {errors.length > 0 ? 'ניתן להמשיך בכל זאת — שורות עם שגיאות ידולגו.' : `יובאו ${rows.length} סטודנטים. סטודנטים קיימים יעודכנו.`}
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setStep('map')}>חזרה</Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? 'מייבא...' : 'ייבא עכשיו'}
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 text-success" size={48} />
            <p className="text-lg font-semibold">הייבוא הושלם בהצלחה!</p>
            <p className="text-muted-foreground mt-1">יובאו {importCount} סטודנטים</p>
            <Button className="mt-6" onClick={() => { reset(); onClose(); }}>סגור</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}