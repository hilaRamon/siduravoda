import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

const FIELDS = [
  { key: 'name', label: 'שם / מספר רכב', required: true },
  { key: 'license_plate', label: 'לוחית רישוי', required: false },
  { key: 'notes', label: 'הערות', required: false },
];

function guessMapping(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const lower = (h || '').toLowerCase();
    if (!map.name && (lower.includes('שם') || lower.includes('רכב') || lower.includes('name'))) map.name = i;
    if (!map.license_plate && (lower.includes('לוחית') || lower.includes('רישוי') || lower.includes('plate'))) map.license_plate = i;
    if (!map.notes && (lower.includes('הערה') || lower.includes('note'))) map.notes = i;
  });
  return map;
}

export default function ImportVehiclesModal({ onClose }) {
  const [step, setStep] = useState('upload'); // upload | map | result
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (data.length < 2) return;
      const hdrs = data[0].map(String);
      setHeaders(hdrs);
      setRows(data.slice(1).filter(r => r.some(c => c !== undefined && c !== '')));
      setMapping(guessMapping(hdrs));
      setStep('map');
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    setLoading(true);
    const existing = await base44.entities.Vehicle.list();
    const existingByName = {};
    existing.forEach(v => { existingByName[v.name?.trim()] = v; });

    let created = 0, updated = 0, errors = 0;

    for (const row of rows) {
      const name = mapping.name !== undefined ? String(row[mapping.name] || '').trim() : '';
      if (!name) { errors++; continue; }
      const data = { name };
      if (mapping.license_plate !== undefined && row[mapping.license_plate]) data.license_plate = String(row[mapping.license_plate]).trim();
      if (mapping.notes !== undefined && row[mapping.notes]) data.notes = String(row[mapping.notes]).trim();

      if (existingByName[name]) {
        await base44.entities.Vehicle.update(existingByName[name].id, data);
        updated++;
      } else {
        await base44.entities.Vehicle.create(data);
        created++;
      }
    }

    setResult({ created, updated, errors });
    setStep('result');
    setLoading(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>ייבוא רכבים מאקסל</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">העלה קובץ Excel עם עמודות: שם רכב, לוחית רישוי, הערות.</p>
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={28} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">לחץ לבחירת קובץ</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>ביטול</Button>
            </div>
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">נמצאו <strong>{rows.length}</strong> שורות. בדוק את מיפוי העמודות:</p>
            <div className="space-y-2">
              {FIELDS.map(f => (
                <div key={f.key} className="flex items-center gap-3">
                  <span className="text-sm w-36 shrink-0">{f.label}{f.required ? ' *' : ''}</span>
                  <select
                    value={mapping[f.key] !== undefined ? mapping[f.key] : ''}
                    onChange={e => setMapping({ ...mapping, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="flex-1 h-8 text-xs border border-border rounded-md px-2 bg-card"
                  >
                    <option value="">— לא ממופה —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setStep('upload')}>חזרה</Button>
              <Button onClick={handleImport} disabled={loading || mapping.name === undefined}>
                {loading ? 'מייבא...' : 'ייבא'}
              </Button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 size={20} />
              <span className="font-medium">ייבוא הושלם</span>
            </div>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>נוצרו: <strong>{result.created}</strong> רכבים חדשים</li>
              <li>עודכנו: <strong>{result.updated}</strong> רכבים קיימים</li>
              {result.errors > 0 && (
                <li className="text-destructive flex items-center gap-1">
                  <AlertCircle size={14} /> דולגו: <strong>{result.errors}</strong> שורות (חסר שם)
                </li>
              )}
            </ul>
            <div className="flex justify-end">
              <Button onClick={onClose}>סגור</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}