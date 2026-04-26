import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';
import JSZip from 'npm:jszip@3.10.1';

function workbookToBuffer(wb) {
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

function buildSheet(data, columns) {
  const ws = XLSX.utils.json_to_sheet(data.map(columns));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'גיליון1');
  return wb;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Fetch all data in parallel
  const [students, workplaces, vehicles, assignments, settingsList] = await Promise.all([
    base44.asServiceRole.entities.Student.list('full_name', 1000),
    base44.asServiceRole.entities.Workplace.list('name', 1000),
    base44.asServiceRole.entities.Vehicle.list('name', 1000),
    base44.asServiceRole.entities.Assignment.list('date', 10000),
    base44.asServiceRole.entities.BackupSettings.list(),
  ]);

  const settings = settingsList[0];
  const emails = settings?.emails || [];

  if (emails.length === 0) {
    return Response.json({ ok: false, message: 'לא הוגדרו כתובות מייל לגיבוי' });
  }

  const dateStr = today();

  // Build workbooks
  const wbStudents = buildSheet(students, s => ({
    'שם מלא': s.full_name || '', 'מחזור': s.cohort || '', 'יום חופש': s.free_day || '',
    'סטטוס מרחק': s.distance_status || '', 'פעיל': s.is_active !== false ? 'כן' : 'לא', 'הערות': s.notes || '',
  }));

  const wbWorkplaces = buildSheet(workplaces, w => ({
    'שם מקום העבודה': w.name || '', 'שם משק': w.farm_name || '', 'כתובת': w.address || '',
    'ח.פ': w.company_id || '', 'טלפון איש קשר': w.contact_phone || '',
    'טלפון הנה"ח': w.accounting_phone || '', 'מייל הנה"ח': w.accounting_email || '',
  }));

  const wbVehicles = buildSheet(vehicles, v => ({
    'שם / מספר רכב': v.name || '', 'לוחית רישוי': v.license_plate || '', 'ביטוח': v.insurance || '',
  }));

  const sortedAssignments = [...assignments].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.student_name || '').localeCompare(b.student_name || '', 'he');
  });
  const wbAssignments = buildSheet(sortedAssignments, a => ({
    'תאריך': a.date || '', 'שם תלמיד': a.student_name || '', 'מקום עבודה': a.workplace_name || '',
    'תפקיד': a.role || '', 'תעריף': a.rate ?? '', 'שעות': a.hours ?? '',
    'תשלום נוסף': a.bonus ?? '', 'הערות': a.notes || '',
  }));

  // Build ZIP
  const zip = new JSZip();
  zip.file(`גיבוי_תלמידים_${dateStr}.xlsx`, workbookToBuffer(wbStudents));
  zip.file(`גיבוי_מקומות_עבודה_${dateStr}.xlsx`, workbookToBuffer(wbWorkplaces));
  zip.file(`גיבוי_רכבים_${dateStr}.xlsx`, workbookToBuffer(wbVehicles));
  zip.file(`גיבוי_שיבוצים_${dateStr}.xlsx`, workbookToBuffer(wbAssignments));

  const zipBuffer = await zip.generateAsync({ type: 'uint8array' });
  const zipBase64 = btoa(String.fromCharCode(...zipBuffer));

  // Send email to each recipient
  const monthLabel = new Date().toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
  const subject = `גיבוי חודשי — ${monthLabel}`;
  const body = `שלום,\n\nמצורף גיבוי חודשי של נתוני המערכת לתאריך ${dateStr}.\n\nהגיבוי כולל:\n- תלמידים וצוות\n- מקומות עבודה\n- רכבים\n- שיבוצים יומיים\n\nנשלח אוטומטית מהמערכת.`;

  await Promise.all(emails.map(email =>
    base44.asServiceRole.integrations.Core.SendEmail({ to: email, subject, body })
  ));

  return Response.json({ ok: true, sent_to: emails, date: dateStr });
});