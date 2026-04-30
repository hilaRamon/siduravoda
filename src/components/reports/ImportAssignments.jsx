import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

// Expected columns from backup file:
// 'תאריך', 'שם תלמיד', 'מקום עבודה', 'תפקיד', 'תעריף', 'שעות', 'תשלום נוסף', 'הערות'

export default function ImportAssignments() {
  const [status, setStatus] = useState('idle'); // idle | parsing | previewing | importing | done | error
  const [rows, setRows] = useState([]);
  const [progress, setProgress] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('parsing');
    setErrorMsg('');
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!data.length) {
          setErrorMsg('הקובץ ריק');
          setStatus('error');
          return;
        }

        // Validate required columns
        const first = data[0];
        if (!('תאריך' in first) || !('שם תלמיד' in first) || !('מקום עבודה' in first)) {
          setErrorMsg('הקובץ אינו בפורמט הנכון. ודא שהעמודות הן: תאריך, שם תלמיד, מקום עבודה');
          setStatus('error');
          return;
        }

        // Parse rows
        const parsed = data
          .map(r => ({
            date: String(r['תאריך'] || '').trim(),
            studentName: String(r['שם תלמיד'] || '').trim(),
            workplaceName: String(r['מקום עבודה'] || '').trim(),
            role: String(r['תפקיד'] || '').trim(),
            rate: r['תעריף'] !== '' ? parseFloat(r['תעריף']) : null,
            hours: r['שעות'] !== '' ? parseFloat(r['שעות']) : null,
            bonus: r['תשלום נוסף'] !== '' ? parseFloat(r['תשלום נוסף']) : null,
            notes: String(r['הערות'] || '').trim(),
          }))
          .filter(r => r.date && r.studentName && r.workplaceName);

        if (!parsed.length) {
          setErrorMsg('לא נמצאו שורות תקינות בקובץ');
          setStatus('error');
          return;
        }

        setRows(parsed);
        setStatus('previewing');
      } catch {
        setErrorMsg('שגיאה בקריאת הקובץ');
        setStatus('error');
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset file input so same file can be re-selected
    e.target.value = '';
  };

  const handleImport = async () => {
    setStatus('importing');
    setProgress('טוען תלמידים ומקומות עבודה...');

    // Load students and workplaces to resolve IDs
    const [students, workplaces] = await Promise.all([
      base44.entities.Student.list('full_name', 1000),
      base44.entities.Workplace.list('name', 1000),
    ]);

    const studentMap = {};
    students.forEach(s => { studentMap[s.full_name.trim()] = s; });

    const workplaceMap = {};
    workplaces.forEach(w => { workplaceMap[w.name.trim()] = w; });

    const toCreate = [];
    const skipped = [];

    rows.forEach(r => {
      const student = studentMap[r.studentName];
      const workplace = workplaceMap[r.workplaceName];

      if (!student) { skipped.push(`תלמיד לא נמצא: "${r.studentName}"`); return; }
      if (!workplace) { skipped.push(`מקום עבודה לא נמצא: "${r.workplaceName}"`); return; }

      const record = {
        date: r.date,
        student_id: student.id,
        student_name: student.full_name,
        workplace_id: workplace.id,
        workplace_name: workplace.name,
      };
      if (r.role) record.role = r.role;
      if (r.rate !== null && !isNaN(r.rate)) record.rate = r.rate;
      if (r.hours !== null && !isNaN(r.hours)) record.hours = r.hours;
      if (r.bonus !== null && !isNaN(r.bonus)) record.bonus = r.bonus;
      if (r.notes) record.notes = r.notes;

      toCreate.push(record);
    });

    if (!toCreate.length) {
      setImportResult({ created: 0, skipped });
      setStatus('done');
      return;
    }

    // Bulk create in batches of 100
    let created = 0;
    for (let i = 0; i < toCreate.length; i += 100) {
      setProgress(`מייבא... ${Math.min(i + 100, toCreate.length)} / ${toCreate.length}`);
      await base44.entities.Assignment.bulkCreate(toCreate.slice(i, i + 100));
      created += Math.min(100, toCreate.length - i);
    }

    setImportResult({ created, skipped });
    setStatus('done');
  };

  const reset = () => {
    setStatus('idle');
    setRows([]);
    setProgress('');
    setErrorMsg('');
    setImportResult(null);
  };

  // Unique dates summary
  const uniqueDates = [...new Set(rows.map(r => r.date))].length;

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-start gap-4 mb-4">
        <div className="bg-accent/10 rounded-xl p-3">
          <Upload size={22} className="text-accent" />
        </div>
        <div>
          <h3 className="font-semibold text-base">ייבוא שיבוצים יומיים מגיבוי</h3>
          <p className="text-sm text-muted-foreground mt-1">
            העלה קובץ Excel של גיבוי שיבוצים (כפי שיורד מהמערכת) כדי לייבא את כל הנתונים.
          </p>
        </div>
      </div>

      {status === 'idle' && (
        <div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full border-dashed h-14 text-muted-foreground hover:text-foreground">
            <FileSpreadsheet size={18} className="ml-2" />
            לחץ לבחירת קובץ גיבוי שיבוצים (.xlsx)
          </Button>
        </div>
      )}

      {status === 'parsing' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> קורא קובץ...
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle size={16} /> {errorMsg}
          </div>
          <Button variant="outline" size="sm" onClick={reset}>נסה שוב</Button>
        </div>
      )}

      {status === 'previewing' && (
        <div className="space-y-4">
          <div className="bg-secondary/40 rounded-xl p-4 text-sm space-y-1">
            <p><span className="font-medium">שורות תקינות שנמצאו:</span> {rows.length}</p>
            <p><span className="font-medium">ימים ייחודיים:</span> {uniqueDates}</p>
            <p className="text-xs text-muted-foreground mt-2">
              הייבוא יתאים בין שמות התלמידים ומקומות העבודה לנתונים הקיימים במערכת. שיבוצים שלא ניתן להתאים ידולגו.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleImport}>
              <Upload size={15} className="ml-2" /> ייבא {rows.length} שיבוצים
            </Button>
            <Button variant="outline" onClick={reset}>ביטול</Button>
          </div>
        </div>
      )}

      {status === 'importing' && (
        <div className="flex items-center gap-2 text-sm text-primary">
          <Loader2 size={16} className="animate-spin" /> {progress}
        </div>
      )}

      {status === 'done' && importResult && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 size={16} className="text-success mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-success">הייבוא הושלם בהצלחה!</p>
              <p>נוצרו <strong>{importResult.created}</strong> שיבוצים</p>
              {importResult.skipped.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    {importResult.skipped.length} שורות דולגו (לחץ לפרטים)
                  </summary>
                  <ul className="mt-1 text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
                    {importResult.skipped.map((s, i) => <li key={i}>• {s}</li>)}
                  </ul>
                </details>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>ייבוא נוסף</Button>
        </div>
      )}
    </div>
  );
}