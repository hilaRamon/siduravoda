// @ts-nocheck
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';

function workbookToFile(wb, filename) {
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const bytes = new Uint8Array(buf);
  return new File([bytes], filename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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
  try {

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

  const fileDefs = [
    { name: `גיבוי_תלמידים_${dateStr}.xlsx`, wb: wbStudents, label: 'תלמידים וצוות' },
    { name: `גיבוי_מקומות_עבודה_${dateStr}.xlsx`, wb: wbWorkplaces, label: 'מקומות עבודה' },
    { name: `גיבוי_רכבים_${dateStr}.xlsx`, wb: wbVehicles, label: 'רכבים' },
    { name: `גיבוי_שיבוצים_${dateStr}.xlsx`, wb: wbAssignments, label: 'שיבוצים יומיים' },
  ];

  // Upload each file and get a public URL
  const uploadedFiles = [];
  for (const f of fileDefs) {
    const file = workbookToFile(f.wb, f.name);
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    uploadedFiles.push({ label: f.label, url: uploadResult.file_url });
  }

  const monthLabel = new Date().toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
  const subject = `גיבוי חודשי — ${monthLabel}`;

  const fileLinks = uploadedFiles.map(f => `• ${f.label}: ${f.url}`).join('\n');
  const body = `שלום,\n\nמצורפים קישורים להורדת קבצי הגיבוי החודשי לתאריך ${dateStr}:\n\n${fileLinks}\n\n(הקישורים בתוקף למספר ימים)\n\nנשלח אוטומטית מהמערכת — רגבים.`;

  // Send one email per recipient with all links
  const results = {};
  for (const email of emails) {
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({ to: email, subject, body });
      results[email] = { success: true };
    } catch (e) {
      results[email] = { success: false, error: e?.message || String(e) };
      console.error(`Failed to send to ${email}:`, e?.message);
    }
  }

    return Response.json({ ok: true, date: dateStr, files: uploadedFiles.map(f => f.label), results });
  } catch (err) {
    console.error('sendMonthlyBackup error:', err?.message || err);
    return Response.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
});