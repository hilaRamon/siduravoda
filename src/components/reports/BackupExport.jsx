import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Database, Archive } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import JSZip from 'jszip';
import { mapAssignmentExportRow, normalizeAppSettings } from '@/lib/pricing';

function downloadWorkbook(wb, filename) {
  XLSX.writeFile(wb, filename);
}

function workbookToBuffer(wb) {
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

async function buildAllWorkbooks() {
  const [students, workplaces, vehicles, assignments, settingsList] = await Promise.all([
    base44.entities.Student.list('full_name', 1000),
    base44.entities.Workplace.list('name', 1000),
    base44.entities.Vehicle.list('name', 1000),
    base44.entities.Assignment.list('date', 10000),
    base44.entities.AppSettings.list(),
  ]);
  const appSettings = normalizeAppSettings(settingsList[0]);

  const today = format(new Date(), 'yyyy-MM-dd');

  // Students
  const wsStudents = XLSX.utils.json_to_sheet(students.map(s => ({
    'שם מלא': s.full_name || '', 'מחזור': s.cohort || '', 'יום חופש': s.free_day || '',
    'סטטוס מרחק': s.distance_status || '', 'פעיל': s.is_active !== false ? 'כן' : 'לא', 'הערות': s.notes || '',
  })));
  const wbStudents = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbStudents, wsStudents, 'תלמידים וצוות');

  // Workplaces
  const wsWorkplaces = XLSX.utils.json_to_sheet(workplaces.map(w => ({
    'שם מקום העבודה': w.name || '', 'שם משק': w.farm_name || '', 'כתובת': w.address || '',
    'ח.פ': w.company_id || '', 'טלפון איש קשר': w.contact_phone || '',
    'טלפון הנה"ח': w.accounting_phone || '', 'מייל הנה"ח': w.accounting_email || '',
  })));
  const wbWorkplaces = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbWorkplaces, wsWorkplaces, 'מקומות עבודה');

  // Vehicles
  const wsVehicles = XLSX.utils.json_to_sheet(vehicles.map(v => ({
    'שם / מספר רכב': v.name || '', 'לוחית רישוי': v.license_plate || '', 'ביטוח': v.insurance || '',
  })));
  const wbVehicles = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbVehicles, wsVehicles, 'רכבים');

  // Assignments
  const sorted = [...assignments].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.student_name || '').localeCompare(b.student_name || '', 'he');
  });
  const wsAssignments = XLSX.utils.json_to_sheet(sorted.map(a => mapAssignmentExportRow(a, appSettings)));
  const wbAssignments = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbAssignments, wsAssignments, 'שיבוצים');

  return [
    { name: `גיבוי_תלמידים_${today}.xlsx`, wb: wbStudents },
    { name: `גיבוי_מקומות_עבודה_${today}.xlsx`, wb: wbWorkplaces },
    { name: `גיבוי_רכבים_${today}.xlsx`, wb: wbVehicles },
    { name: `גיבוי_שיבוצים_${today}.xlsx`, wb: wbAssignments },
  ];
}

async function exportStudents() {
  const students = await base44.entities.Student.list('full_name', 1000);
  const rows = students.map(s => ({
    'שם מלא': s.full_name || '',
    'מחזור': s.cohort || '',
    'יום חופש': s.free_day || '',
    'סטטוס מרחק': s.distance_status || '',
    'פעיל': s.is_active !== false ? 'כן' : 'לא',
    'הערות': s.notes || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'תלמידים וצוות');
  downloadWorkbook(wb, `גיבוי_תלמידים_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

async function exportWorkplaces() {
  const workplaces = await base44.entities.Workplace.list('name', 1000);
  const rows = workplaces.map(w => ({
    'שם מקום העבודה': w.name || '',
    'שם משק': w.farm_name || '',
    'כתובת': w.address || '',
    'ח.פ': w.company_id || '',
    'טלפון איש קשר': w.contact_phone || '',
    'טלפון הנה"ח': w.accounting_phone || '',
    'מייל הנה"ח': w.accounting_email || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'מקומות עבודה');
  downloadWorkbook(wb, `גיבוי_מקומות_עבודה_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

async function exportVehicles() {
  const vehicles = await base44.entities.Vehicle.list('name', 1000);
  const rows = vehicles.map(v => ({
    'שם / מספר רכב': v.name || '',
    'לוחית רישוי': v.license_plate || '',
    'ביטוח': v.insurance || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'רכבים');
  downloadWorkbook(wb, `גיבוי_רכבים_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

async function exportAssignments() {
  const [assignments, settingsList] = await Promise.all([
    base44.entities.Assignment.list('date', 10000),
    base44.entities.AppSettings.list(),
  ]);
  const appSettings = normalizeAppSettings(settingsList[0]);
  // Sort by date asc, then student name
  const sorted = [...assignments].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.student_name || '').localeCompare(b.student_name || '', 'he');
  });

  const rows = sorted.map(a => mapAssignmentExportRow(a, appSettings));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'שיבוצים');
  downloadWorkbook(wb, `גיבוי_שיבוצים_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

const EXPORTS = [
  {
    key: 'students',
    label: 'תלמידים וצוות',
    desc: 'שם, מחזור, יום חופש, סטטוס מרחק, הערות',
    fn: exportStudents,
  },
  {
    key: 'workplaces',
    label: 'מקומות עבודה',
    desc: 'שם, שם משק, כתובת, ח.פ, טלפונים, מייל',
    fn: exportWorkplaces,
  },
  {
    key: 'vehicles',
    label: 'רכבים',
    desc: 'שם רכב, לוחית רישוי, ביטוח',
    fn: exportVehicles,
  },
  {
    key: 'assignments',
    label: 'שיבוצים יומיים',
    desc: 'תאריך, שם תלמיד, מקום עבודה, תפקיד, שעות, תעריף — שורה לכל שיבוץ',
    fn: exportAssignments,
  },
];

export default function BackupExport() {
  const [loading, setLoading] = useState({});
  const [zipping, setZipping] = useState(false);

  const handleExport = async (item) => {
    setLoading(prev => ({ ...prev, [item.key]: true }));
    await item.fn();
    setLoading(prev => ({ ...prev, [item.key]: false }));
  };

  const handleDownloadAll = async () => {
    setZipping(true);
    const files = await buildAllWorkbooks();
    const zip = new JSZip();
    files.forEach(({ name, wb }) => {
      zip.file(name, workbookToBuffer(wb));
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `גיבוי_מלא_${format(new Date(), 'yyyy-MM-dd')}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setZipping(false);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-xl p-3">
            <Database size={22} className="text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-base">הורדת גיבוי נתונים</h3>
            <p className="text-sm text-muted-foreground">גיבוי יומי מלא — כל הנתונים, כולל כל השיבוצים</p>
          </div>
        </div>
        <Button size="sm" onClick={handleDownloadAll} disabled={zipping} className="shrink-0">
          {zipping ? <Loader2 size={14} className="animate-spin ml-1" /> : <Archive size={14} className="ml-1" />}
          {zipping ? 'מכין...' : 'הורד הכל (ZIP)'}
        </Button>
      </div>


    </div>
  );
}