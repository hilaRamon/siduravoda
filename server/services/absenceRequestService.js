import { getModel } from "../models/index.js";
import Assignment from "../models/Assignment.js";
import Workplace from "../models/Workplace.js";
import {
  getAssignmentDefaults,
  normalizeAppSettings,
} from "../lib/pricing.js";
import * as absenceRequestRepository from "../repositories/absenceRequestRepository.js";
import * as studentRepository from "../repositories/studentRepository.js";
import {
  NOT_WORKING_WORKPLACE_NAME,
  PNIMIYA_WORKPLACE_NAME,
} from "../lib/cloneWorkplaceDecision.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ABSENCE_WORKPLACE_NAMES = new Set([
  NOT_WORKING_WORKPLACE_NAME,
  PNIMIYA_WORKPLACE_NAME,
]);

export class AbsenceRequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "AbsenceRequestError";
    this.status = status;
  }
}

function assertDate(date) {
  if (!date || !DATE_RE.test(date)) {
    throw new AbsenceRequestError("date must be YYYY-MM-DD");
  }
}

function normalizePhone(phone) {
  if (!phone || typeof phone !== "string") return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972") && digits.length >= 11) {
    return `0${digits.slice(3)}`;
  }
  return digits;
}

async function findStudentIdByPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const students = await studentRepository.find({
    phone: { $exists: true, $ne: "" },
  });

  const matches = students.filter(
    (s) => normalizePhone(s.phone) === normalized,
  );
  if (matches.length !== 1) return null;
  return matches[0].id;
}

function resolveAbsenceWorkplaceName(workplaceName) {
  if (workplaceName == null || workplaceName === "") {
    return NOT_WORKING_WORKPLACE_NAME;
  }
  if (!ABSENCE_WORKPLACE_NAMES.has(workplaceName)) {
    throw new AbsenceRequestError("Invalid workplace_name");
  }
  return workplaceName;
}

async function getWorkplaceByName(name) {
  const workplace = await Workplace.findOne({ name }).lean();
  if (!workplace) {
    throw new AbsenceRequestError(`Workplace "${name}" not found`);
  }
  return {
    id: workplace._id.toString(),
    name: workplace.name,
  };
}

async function getAssignmentDefaultsFromSettings() {
  const AppSettings = getModel("AppSettings");
  const settings = await AppSettings.findOne()
    .sort({ updated_date: -1, created_date: -1 })
    .lean();
  return getAssignmentDefaults(normalizeAppSettings(settings));
}

async function assignNotWorking(
  studentId,
  date,
  workplaceName = NOT_WORKING_WORKPLACE_NAME,
) {
  const workplace = await getWorkplaceByName(
    resolveAbsenceWorkplaceName(workplaceName),
  );
  const student = await studentRepository.findById(studentId);
  const studentName = student?.full_name || "";

  const existing = await Assignment.find({
    date,
    student_id: studentId,
  })
    .sort({ updated_date: -1, created_date: -1 })
    .exec();

  if (existing.length > 0) {
    const primary =
      existing.find((doc) => (doc.work_number ?? 1) === 1) || existing[0];
    const extras = existing.filter((doc) => doc._id.toString() !== primary._id.toString());
    if (extras.length > 0) {
      await Assignment.deleteMany({
        _id: { $in: extras.map((doc) => doc._id) },
      });
    }
    primary.workplace_id = workplace.id;
    primary.workplace_name = workplace.name;
    primary.work_number = 1;
    if (studentName) primary.student_name = studentName;
    await primary.save();
    return;
  }

  const defaults = await getAssignmentDefaultsFromSettings();
  await Assignment.create({
    date,
    student_id: studentId,
    student_name: studentName,
    workplace_id: workplace.id,
    workplace_name: workplace.name,
    work_number: 1,
    rate: defaults.rate,
    hours: defaults.hours,
  });
}

async function clearAssignmentForDate(studentId, date) {
  if (!studentId || !date) return;
  await Assignment.deleteMany({ date, student_id: studentId });
}

export async function listAbsenceRequests(query = {}) {
  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }
  if (query.student_id) {
    filter.student_id = query.student_id;
  }
  if (query.startDate || query.endDate) {
    if (query.startDate) assertDate(query.startDate);
    if (query.endDate) assertDate(query.endDate);
    filter.date = {};
    if (query.startDate) filter.date.$gte = query.startDate;
    if (query.endDate) filter.date.$lte = query.endDate;
  }

  return absenceRequestRepository.find(filter, { limit: 1000 });
}

export async function getAbsenceRequest(id) {
  const doc = await absenceRequestRepository.findById(id);
  if (!doc) {
    throw new AbsenceRequestError("Absence request not found", 404);
  }
  return doc;
}

export async function createManualAbsence({
  date,
  student_id,
  reason,
  notes,
  workplace_name,
}) {
  assertDate(date);
  if (!student_id) {
    throw new AbsenceRequestError("student_id is required for manual absences");
  }
  const workplaceName = resolveAbsenceWorkplaceName(workplace_name);

  const created = await absenceRequestRepository.create({
    date,
    student_id,
    reason: reason || "",
    notes: notes || "",
    source: "manual",
    status: "אושר",
  });
  await assignNotWorking(student_id, date, workplaceName);
  return created;
}

export async function setAbsenceWorkplace(id, workplaceName) {
  const existing = await getAbsenceRequest(id);
  if (existing.status !== "אושר") {
    throw new AbsenceRequestError(
      "Only an approved absence can set the workplace",
    );
  }
  if (!existing.student_id || !existing.date) {
    throw new AbsenceRequestError("student_id and date are required");
  }
  await assignNotWorking(
    existing.student_id,
    existing.date,
    resolveAbsenceWorkplaceName(workplaceName),
  );
  return existing;
}

export async function createFromSms({
  phone,
  dest,
  message,
  sms_date,
  date,
  reason,
  submitted_name,
  student_id: providedStudentId,
}) {
  if (!message || !phone) {
    throw new AbsenceRequestError("phone and message are required");
  }
  if (date) assertDate(date);

  let student_id = providedStudentId || null;
  if (!student_id) {
    student_id = await findStudentIdByPhone(phone);
  }

  return absenceRequestRepository.create({
    date: date || null,
    student_id,
    submitted_name: submitted_name || "",
    reason: reason || "",
    source: "sms",
    status: "ממתין",
    phone,
    dest: dest || "",
    message,
    sms_date: sms_date || new Date().toISOString(),
  });
}

export async function updateAbsenceRequest(id, updates = {}) {
  const allowed = ["student_id", "reason", "notes", "date", "phone", "dest", "submitted_name"];
  const data = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      data[key] = updates[key];
    }
  }
  if (data.date) assertDate(data.date);

  const existing = await getAbsenceRequest(id);
  if (existing.status === "אושר" && data.student_id === null) {
    throw new AbsenceRequestError(
      "Cannot clear student_id on an approved absence",
    );
  }

  const updated = await absenceRequestRepository.updateById(id, data);
  if (!updated) {
    throw new AbsenceRequestError("Absence request not found", 404);
  }
  return updated;
}

export async function approveAbsenceRequest(id, { student_id, date } = {}) {
  const existing = await getAbsenceRequest(id);
  const nextStudentId = student_id || existing.student_id;
  if (!nextStudentId) {
    throw new AbsenceRequestError(
      "student_id is required to approve an absence",
    );
  }
  const nextDate = date || existing.date;
  if (!nextDate) {
    throw new AbsenceRequestError("date is required to approve an absence");
  }
  assertDate(nextDate);

  const updated = await absenceRequestRepository.updateById(id, {
    student_id: nextStudentId,
    date: nextDate,
    status: "אושר",
  });
  await assignNotWorking(nextStudentId, nextDate);
  return updated;
}

export async function rejectAbsenceRequest(id) {
  const existing = await getAbsenceRequest(id);
  const updated = await absenceRequestRepository.updateById(id, {
    status: "נדחה",
  });
  await clearAssignmentForDate(existing.student_id, existing.date);
  return updated;
}

export async function deleteAbsenceRequest(id) {
  const existing = await getAbsenceRequest(id);
  const deleted = await absenceRequestRepository.deleteById(id);
  if (!deleted) {
    throw new AbsenceRequestError("Absence request not found", 404);
  }
  if (existing.status === "אושר" && existing.student_id && existing.date) {
    await clearAssignmentForDate(existing.student_id, existing.date);
  }
  return deleted;
}
