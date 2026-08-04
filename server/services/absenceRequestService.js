import { getModel } from "../models/index.js";
import {
  getAssignmentDefaults,
  normalizeAppSettings,
} from "../lib/pricing.js";
import * as absenceRequestRepository from "../repositories/absenceRequestRepository.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NOT_WORKING_WORKPLACE_NAME = "תתת - לא עובד";

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

  const Student = getModel("Student");
  const students = await Student.find({ phone: { $exists: true, $ne: "" } })
    .select("_id phone")
    .lean();

  const matches = students.filter(
    (s) => normalizePhone(s.phone) === normalized,
  );
  if (matches.length !== 1) return null;
  return matches[0]._id.toString();
}

async function getNotWorkingWorkplace() {
  const Workplace = getModel("Workplace");
  const workplace = await Workplace.findOne({
    name: NOT_WORKING_WORKPLACE_NAME,
  }).lean();
  if (!workplace) {
    throw new AbsenceRequestError(
      `Workplace "${NOT_WORKING_WORKPLACE_NAME}" not found`,
    );
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

async function assignNotWorking(studentId, date) {
  const Assignment = getModel("Assignment");
  const Student = getModel("Student");
  const workplace = await getNotWorkingWorkplace();
  const student = await Student.findById(studentId).select("full_name").lean();
  const studentName = student?.full_name || "";

  const existing = await Assignment.find({
    date,
    student_id: studentId,
  })
    .sort({ updated_date: -1, created_date: -1 })
    .exec();

  if (existing.length > 0) {
    const [keep, ...extras] = existing;
    if (extras.length > 0) {
      await Assignment.deleteMany({
        _id: { $in: extras.map((doc) => doc._id) },
      });
    }
    keep.workplace_id = workplace.id;
    keep.workplace_name = workplace.name;
    if (studentName) keep.student_name = studentName;
    await keep.save();
    return;
  }

  const defaults = await getAssignmentDefaultsFromSettings();
  await Assignment.create({
    date,
    student_id: studentId,
    student_name: studentName,
    workplace_id: workplace.id,
    workplace_name: workplace.name,
    rate: defaults.rate,
    hours: defaults.hours,
  });
}

async function clearAssignmentForDate(studentId, date) {
  if (!studentId || !date) return;
  const Assignment = getModel("Assignment");
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

export async function createManualAbsence({ date, student_id, reason, notes }) {
  assertDate(date);
  if (!student_id) {
    throw new AbsenceRequestError("student_id is required for manual absences");
  }

  const created = await absenceRequestRepository.create({
    date,
    student_id,
    reason: reason || "",
    notes: notes || "",
    source: "manual",
    status: "אושר",
  });
  await assignNotWorking(student_id, date);
  return created;
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
  const deleted = await absenceRequestRepository.deleteById(id);
  if (!deleted) {
    throw new AbsenceRequestError("Absence request not found", 404);
  }
  return deleted;
}
