import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { getModel } from "../models/index.js";
import { sendVerificationToRecipients, sendWeeklyBackupToRecipients } from "../lib/email.js";
import {
  mapAssignmentExportRow,
  normalizeAppSettings,
} from "../lib/pricing.js";

const BACKUP_DIR = path.resolve(process.cwd(), "uploads", "backups");
const ISRAEL_TZ = "Asia/Jerusalem";

function todayInIsrael() {
  return new Date().toLocaleDateString("en-CA", { timeZone: ISRAEL_TZ });
}

function zipFilenameForDate(exportDateStr) {
  return `גיבוי_מלא_${exportDateStr}.zip`;
}

function workbookToBuffer(wb) {
  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
}

async function loadBackupData() {
  const Student = getModel("Student");
  const Workplace = getModel("Workplace");
  const Vehicle = getModel("Vehicle");
  const Assignment = getModel("Assignment");
  const AppSettings = getModel("AppSettings");

  const [students, workplaces, vehicles, assignments, settingsDoc] = await Promise.all([
    Student.find().sort({ full_name: 1 }).limit(1000).lean(),
    Workplace.find().sort({ name: 1 }).limit(1000).lean(),
    Vehicle.find().sort({ name: 1 }).limit(1000).lean(),
    Assignment.find().sort({ date: 1 }).lean(),
    AppSettings.findOne().sort({ updated_date: -1, created_date: -1 }).lean(),
  ]);

  return {
    students,
    workplaces,
    vehicles,
    assignments,
    appSettings: normalizeAppSettings(settingsDoc),
  };
}

function mapAssignmentRows(assignments, appSettings) {
  return assignments.map((assignment) => mapAssignmentExportRow(assignment, appSettings));
}

function buildWorkbookFiles(data, exportDateStr) {
  const { students, workplaces, vehicles, assignments, appSettings } = data;

  const wsStudents = XLSX.utils.json_to_sheet(
    students.map((s) => ({
      "שם מלא": s.full_name || "",
      מחזור: s.cohort || "",
      "יום חופש": s.free_day || "",
      "סטטוס מרחק": s.distance_status || "",
      פעיל: s.is_active !== false ? "כן" : "לא",
      הערות: s.notes || "",
    })),
  );
  const wbStudents = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbStudents, wsStudents, "תלמידים וצוות");

  const wsWorkplaces = XLSX.utils.json_to_sheet(
    workplaces.map((w) => ({
      "שם מקום העבודה": w.name || "",
      "שם משק": w.farm_name || "",
      כתובת: w.address || "",
      "ח.פ": w.company_id || "",
      "טלפון איש קשר": w.contact_phone || "",
      'טלפון הנה"ח': w.accounting_phone || "",
      'מייל הנה"ח': w.accounting_email || "",
    })),
  );
  const wbWorkplaces = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbWorkplaces, wsWorkplaces, "מקומות עבודה");

  const wsVehicles = XLSX.utils.json_to_sheet(
    vehicles.map((v) => ({
      "שם / מספר רכב": v.name || "",
      "לוחית רישוי": v.license_plate || "",
      ביטוח: v.insurance || "",
    })),
  );
  const wbVehicles = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbVehicles, wsVehicles, "רכבים");

  const sorted = [...assignments].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.student_name || "").localeCompare(b.student_name || "", "he");
  });
  const wsAssignments = XLSX.utils.json_to_sheet(mapAssignmentRows(sorted, appSettings));
  const wbAssignments = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbAssignments, wsAssignments, "שיבוצים");

  return [
    { name: `גיבוי_תלמידים_${exportDateStr}.xlsx`, buffer: workbookToBuffer(wbStudents) },
    { name: `גיבוי_מקומות_עבודה_${exportDateStr}.xlsx`, buffer: workbookToBuffer(wbWorkplaces) },
    { name: `גיבוי_רכבים_${exportDateStr}.xlsx`, buffer: workbookToBuffer(wbVehicles) },
    { name: `גיבוי_שיבוצים_${exportDateStr}.xlsx`, buffer: workbookToBuffer(wbAssignments) },
  ];
}

async function buildZipBuffer(files) {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.name, file.buffer);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

async function ensureCanonicalBackupSettings() {
  const BackupSettings = getModel("BackupSettings");
  const docs = await BackupSettings.find().sort({ updated_date: -1, created_date: -1 });

  if (docs.length === 0) {
    return BackupSettings.create({ emails: [] });
  }

  if (docs.length === 1) {
    return docs[0];
  }

  const allEmails = [...new Set(docs.flatMap((d) => d.emails || []).filter(Boolean))];
  let canonical = docs.find((d) => d.emails?.length) || docs[0];

  for (const doc of docs) {
    if (doc.last_backup_at && (!canonical.last_backup_at || doc.last_backup_at > canonical.last_backup_at)) {
      canonical = doc;
    }
  }

  canonical.emails = allEmails;
  await canonical.save();

  const duplicateIds = docs
    .filter((d) => d._id.toString() !== canonical._id.toString())
    .map((d) => d._id);
  if (duplicateIds.length > 0) {
    await BackupSettings.deleteMany({ _id: { $in: duplicateIds } });
  }

  return canonical;
}

async function updateBackupMetadata(filename) {
  const doc = await ensureCanonicalBackupSettings();
  doc.last_backup_at = new Date();
  doc.last_backup_filename = filename;
  await doc.save();
}

export async function getBackupRecipients() {
  const doc = await ensureCanonicalBackupSettings();
  return doc.emails || [];
}

function extractDateFromFilename(filename) {
  const rangeMatch = filename.match(/גיבוי_מלא_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})\.zip$/);
  if (rangeMatch) {
    return rangeMatch[2];
  }
  const singleMatch = filename.match(/גיבוי_מלא_(\d{4}-\d{2}-\d{2})\.zip$/);
  if (singleMatch) {
    return singleMatch[1];
  }
  return null;
}

export async function getLatestBackup() {
  const doc = await ensureCanonicalBackupSettings();
  const candidates = [];

  if (doc.last_backup_filename) {
    const zipPath = path.join(BACKUP_DIR, doc.last_backup_filename);
    if (fs.existsSync(zipPath)) {
      candidates.push({
        zipPath,
        filename: doc.last_backup_filename,
        exportDateStr: extractDateFromFilename(doc.last_backup_filename),
        mtime: fs.statSync(zipPath).mtimeMs,
      });
    }
  }

  if (fs.existsSync(BACKUP_DIR)) {
    for (const entry of fs.readdirSync(BACKUP_DIR)) {
      if (!entry.endsWith(".zip")) continue;
      const zipPath = path.join(BACKUP_DIR, entry);
      const mtime = fs.statSync(zipPath).mtimeMs;
      if (candidates.some((c) => c.filename === entry)) continue;
      candidates.push({
        zipPath,
        filename: entry,
        exportDateStr: extractDateFromFilename(entry),
        mtime,
      });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.mtime - a.mtime);
  const latest = candidates[0];
  const zipBuffer = fs.readFileSync(latest.zipPath);

  return {
    zipPath: latest.zipPath,
    zipBuffer,
    filename: latest.filename,
    exportDateStr: latest.exportDateStr || todayInIsrael(),
  };
}

export async function generateAndPersistBackup() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const exportDateStr = todayInIsrael();
  const data = await loadBackupData();
  const files = buildWorkbookFiles(data, exportDateStr);
  const zipBuffer = await buildZipBuffer(files);
  const filename = zipFilenameForDate(exportDateStr);
  const zipPath = path.join(BACKUP_DIR, filename);

  fs.writeFileSync(zipPath, zipBuffer);
  await updateBackupMetadata(filename);

  return {
    exportDateStr,
    zipPath,
    zipBuffer,
    filename,
    fileNames: files.map((f) => f.name),
  };
}

export async function runWeeklyBackup() {
  const archive = await generateAndPersistBackup();
  const recipients = await getBackupRecipients();

  if (recipients.length === 0) {
    return {
      ok: false,
      message: "לא הוגדרו כתובות מייל לגיבוי",
      exportDateStr: archive.exportDateStr,
      filename: archive.filename,
      results: {},
    };
  }

  const results = await sendWeeklyBackupToRecipients({
    recipients,
    exportDateStr: archive.exportDateStr,
    zipBuffer: archive.zipBuffer,
    zipFilename: archive.filename,
  });

  return {
    ok: true,
    exportDateStr: archive.exportDateStr,
    filename: archive.filename,
    fileNames: archive.fileNames,
    results,
  };
}

export async function sendVerificationBackup(newEmails) {
  const trimmed = [...new Set(newEmails.map((e) => String(e).trim()).filter(Boolean))];
  if (trimmed.length === 0) {
    return { ok: true, sentTo: [], backupDate: null, generatedFresh: false, results: {} };
  }

  let latest = await getLatestBackup();
  let generatedFresh = false;

  if (!latest) {
    const archive = await generateAndPersistBackup();
    latest = {
      zipBuffer: archive.zipBuffer,
      filename: archive.filename,
      exportDateStr: archive.exportDateStr,
    };
    generatedFresh = true;
  }

  const results = await sendVerificationToRecipients({
    recipients: trimmed,
    exportDateStr: latest.exportDateStr,
    zipBuffer: latest.zipBuffer,
    zipFilename: latest.filename,
  });

  return {
    ok: Object.values(results).every((r) => r.success),
    sentTo: trimmed,
    exportDateStr: latest.exportDateStr,
    generatedFresh,
    results,
  };
}
