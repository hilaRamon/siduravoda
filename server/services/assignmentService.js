import mongoose from "mongoose";
import Assignment from "../models/Assignment.js";
import AppSettings from "../models/AppSettings.js";
import Workplace from "../models/Workplace.js";
import {
  getAssignmentDefaults,
  normalizeAppSettings,
} from "../lib/pricing.js";
import { buildSort } from "../lib/query.js";
import {
  CloneWorkplaceError,
  DAY_NUM_TO_HEB,
  DISTANCE_WORKPLACE_NAMES,
  NOT_WORKING_WORKPLACE_NAME,
  PRE_ASSIGNMENT_WORKPLACE_NAME,
  decideCloneWorkplace,
} from "../lib/cloneWorkplaceDecision.js";
import { isPrimaryWorkNumber } from "../lib/assignmentWorkNumber.js";
import * as absenceRequestRepository from "../repositories/absenceRequestRepository.js";
import * as assignmentRepository from "../repositories/assignmentRepository.js";
import * as studentRepository from "../repositories/studentRepository.js";
import * as workplaceLogisticsRepository from "../repositories/workplaceLogisticsRepository.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class AssignmentError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "AssignmentError";
    this.status = status;
  }
}

function assertDate(date) {
  if (!date || !DATE_RE.test(date)) {
    throw new AssignmentError("date must be YYYY-MM-DD");
  }
}

function normalizeAssignmentInput(body = {}, { partial = false } = {}) {
  const data = {};

  if (body.date !== undefined) {
    assertDate(body.date);
    data.date = body.date;
  } else if (!partial) {
    throw new AssignmentError("date is required");
  }

  if (body.student_id !== undefined) {
    if (!body.student_id && body.student_id !== "") {
      throw new AssignmentError("student_id is required");
    }
    data.student_id = String(body.student_id);
  } else if (!partial) {
    throw new AssignmentError("student_id is required");
  }

  if (body.workplace_id !== undefined) {
    data.workplace_id = String(body.workplace_id);
  } else if (!partial) {
    throw new AssignmentError("workplace_id is required");
  }

  if (body.work_number !== undefined) {
    const n = Number(body.work_number);
    if (!Number.isInteger(n) || n < 1) {
      throw new AssignmentError("work_number must be an integer >= 1");
    }
    data.work_number = n;
  } else if (!partial) {
    data.work_number = 1;
  }

  for (const key of [
    "student_name",
    "workplace_name",
    "role",
    "notes",
  ]) {
    if (body[key] !== undefined) data[key] = body[key];
  }

  if (body.is_piecework !== undefined) {
    data.is_piecework = Boolean(body.is_piecework);
  }

  for (const key of ["rate", "hours", "bonus"]) {
    if (body[key] === undefined) continue;
    if (body[key] === null || body[key] === "") {
      data[key] = null;
      continue;
    }
    const num = Number(body[key]);
    if (!Number.isFinite(num)) {
      throw new AssignmentError(`${key} must be a number`);
    }
    data[key] = num;
  }

  return data;
}

async function findLogisticsForWorkplace(date, workplaceId) {
  if (!date || !workplaceId) return null;
  const rows = await workplaceLogisticsRepository.find(
    { date, workplace_id: String(workplaceId) },
    { sort: { is_piecework: -1, updated_date: -1 }, limit: 1 },
  );
  return rows[0] || null;
}

export async function syncAssignmentsPieceworkForWorkplace(date, workplaceId) {
  if (!date || !workplaceId) return;
  const logistics = await findLogisticsForWorkplace(date, workplaceId);
  const isPiecework = Boolean(logistics?.is_piecework);
  const defaults = await getAssignmentDefaultsFromSettings();
  const data = isPiecework
    ? { is_piecework: true, rate: null }
    : { is_piecework: false, rate: defaults.rate };
  await assignmentRepository.updateMany(
    { date, workplace_id: String(workplaceId) },
    data,
  );
}

async function overlayPiecework(data, existing = null) {
  const date = data.date || existing?.date;
  const workplaceId = data.workplace_id || existing?.workplace_id;
  if (!date || !workplaceId) return data;

  const logistics = await findLogisticsForWorkplace(date, workplaceId);
  if (logistics?.is_piecework) {
    data.is_piecework = true;
    data.rate = null;
    return data;
  }

  data.is_piecework = false;
  if (existing?.is_piecework && (data.rate === undefined || data.rate === null)) {
    const defaults = await getAssignmentDefaultsFromSettings();
    data.rate = defaults.rate;
  }
  return data;
}

export async function listAssignments(query = {}) {
  const filter = {};

  if (query.date) {
    assertDate(query.date);
    filter.date = query.date;
  } else if (query.startDate || query.endDate) {
    if (query.startDate) assertDate(query.startDate);
    if (query.endDate) assertDate(query.endDate);
    filter.date = {};
    if (query.startDate) filter.date.$gte = query.startDate;
    if (query.endDate) filter.date.$lte = query.endDate;
  }

  if (query.student_id) filter.student_id = query.student_id;
  if (query.workplace_id) filter.workplace_id = query.workplace_id;

  const limitRaw = query.limit !== undefined ? Number(query.limit) : 2000;
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, 10000)
      : 2000;

  return assignmentRepository.find(filter, {
    sort: buildSort(query.sort || "-created_date"),
    limit,
  });
}

export async function getAssignment(id) {
  const doc = await assignmentRepository.findById(id);
  if (!doc) {
    throw new AssignmentError("Assignment not found", 404);
  }
  return doc;
}

export async function createAssignment(body) {
  const data = await overlayPiecework(
    normalizeAssignmentInput(body, { partial: false }),
  );
  return assignmentRepository.create(data);
}

export async function bulkCreateAssignments(items) {
  if (!Array.isArray(items)) {
    throw new AssignmentError("Request body must be an array");
  }
  const normalized = [];
  for (const item of items) {
    normalized.push(
      await overlayPiecework(normalizeAssignmentInput(item, { partial: false })),
    );
  }
  return assignmentRepository.bulkCreate(normalized);
}

export async function updateAssignment(id, body) {
  const data = normalizeAssignmentInput(body || {}, { partial: true });
  if (Object.keys(data).length === 0) {
    throw new AssignmentError("No fields to update");
  }
  let next = data;
  if (data.workplace_id) {
    const existing = await assignmentRepository.findById(id);
    next = await overlayPiecework(data, existing);
  }
  const doc = await assignmentRepository.updateById(id, next);
  if (!doc) {
    throw new AssignmentError("Assignment not found", 404);
  }
  return doc;
}

export async function bulkUpdateAssignments(items) {
  if (!Array.isArray(items)) {
    throw new AssignmentError("Request body must be an array");
  }
  if (items.length === 0) return [];

  const patches = [];
  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new AssignmentError(`Item ${index} must be an object`);
    }
    const { id, ...rest } = item;
    if (!id) {
      throw new AssignmentError("Each item must include id");
    }
    if (!mongoose.isValidObjectId(id)) {
      throw new AssignmentError("Assignment not found", 404);
    }
    let data = normalizeAssignmentInput(rest, { partial: true });
    if (Object.keys(data).length === 0) {
      throw new AssignmentError("No fields to update");
    }
    if (data.workplace_id) {
      const existing = await assignmentRepository.findById(id);
      data = await overlayPiecework(data, existing);
    }
    patches.push({ id: String(id), data });
  }

  const result = await assignmentRepository.bulkUpdate(patches);
  if (result?.missing?.length) {
    throw new AssignmentError("Assignment not found", 404);
  }
  return result;
}

async function compactWorkNumbers(date, studentId) {
  if (!date || !studentId) return;
  const remaining = await Assignment.find({ date, student_id: studentId })
    .sort({ work_number: 1, created_date: 1 })
    .exec();
  let next = 1;
  for (const row of remaining) {
    if (row.work_number !== next) {
      row.work_number = next;
      await row.save();
    }
    next += 1;
  }
}

export async function deleteAssignment(id) {
  const doc = await assignmentRepository.deleteById(id);
  if (!doc) {
    throw new AssignmentError("Assignment not found", 404);
  }
  await compactWorkNumbers(doc.date, doc.student_id);
  return doc;
}

function latestAssignmentByStudent(assignments) {
  const byStudent = {};
  for (const assignment of assignments) {
    const existing = byStudent[assignment.student_id];
    if (
      !existing ||
      (assignment.updated_date || assignment.created_date) >
        (existing.updated_date || existing.created_date)
    ) {
      byStudent[assignment.student_id] = assignment;
    }
  }
  return byStudent;
}

async function loadWorkplacesByName() {
  const docs = await Workplace.find({
    name: { $in: DISTANCE_WORKPLACE_NAMES },
  }).lean();
  const byName = {};
  for (const doc of docs) {
    byName[doc.name] = { id: doc._id.toString(), name: doc.name };
  }
  return byName;
}

async function getAssignmentDefaultsFromSettings() {
  const settings = await AppSettings.findOne()
    .sort({ updated_date: -1, created_date: -1 })
    .lean();
  return getAssignmentDefaults(normalizeAppSettings(settings));
}

export async function cloneDayAssignments({ sourceDate, targetDate }) {
  assertDate(sourceDate);
  assertDate(targetDate);

  const [
    sourceAssignments,
    students,
    approvedAbsences,
    targetAssignments,
    workplacesByName,
    defaults,
  ] = await Promise.all([
    assignmentRepository.find(
      { date: sourceDate },
      { sort: { created_date: -1 }, limit: 2000 },
    ),
    studentRepository.find({}, { sort: { created_date: -1 }, limit: 2000 }),
    absenceRequestRepository.find(
      { date: targetDate, status: "אושר" },
      { limit: 2000 },
    ),
    assignmentRepository.find(
      { date: targetDate },
      { sort: { created_date: -1 }, limit: 2000 },
    ),
    loadWorkplacesByName(),
    getAssignmentDefaultsFromSettings(),
  ]);

  const studentById = Object.fromEntries(students.map((s) => [s.id, s]));
  const absentStudentIds = new Set(
    approvedAbsences.map((a) => a.student_id).filter(Boolean),
  );
  const sourceByStudent = latestAssignmentByStudent(
    sourceAssignments.filter(
      (a) =>
        !a.student_id?.startsWith("guest_") &&
        isPrimaryWorkNumber(a.work_number),
    ),
  );
  const targetByStudent = latestAssignmentByStudent(
    targetAssignments.filter((a) => isPrimaryWorkNumber(a.work_number)),
  );

  const seenOnTarget = new Set();
  const duplicatesToDelete = [];
  [...targetAssignments]
    .filter((a) => isPrimaryWorkNumber(a.work_number))
    .sort((a, b) =>
      (b.updated_date || b.created_date) > (a.updated_date || a.created_date)
        ? 1
        : -1,
    )
    .forEach((a) => {
      if (seenOnTarget.has(a.student_id)) {
        duplicatesToDelete.push(a.id);
      } else {
        seenOnTarget.add(a.student_id);
      }
    });
  await Promise.all(
    duplicatesToDelete.map((id) => assignmentRepository.deleteById(id)),
  );

  const targetDayOfWeek = new Date(targetDate + "T12:00:00").getDay();
  const isSunday = targetDayOfWeek === 0;
  const targetDayHeb = DAY_NUM_TO_HEB[targetDayOfWeek];
  const notWorkingWp = workplacesByName[NOT_WORKING_WORKPLACE_NAME];
  const preAssignmentWp = workplacesByName[PRE_ASSIGNMENT_WORKPLACE_NAME];
  const distanceWorkplaceMap = {};
  for (const name of DISTANCE_WORKPLACE_NAMES) {
    if (workplacesByName[name]) {
      distanceWorkplaceMap[name] = workplacesByName[name];
    }
  }

  const toUpdate = [];
  const toCreate = [];

  for (const src of Object.values(sourceByStudent)) {
    const student = studentById[src.student_id];
    let targetWp;
    try {
      targetWp = decideCloneWorkplace({
        src,
        student,
        isSunday,
        targetDayHeb,
        isAbsent: absentStudentIds.has(src.student_id),
        distanceWorkplaceMap,
        notWorkingWp,
        preAssignmentWp,
      });
    } catch (error) {
      if (error instanceof CloneWorkplaceError) {
        throw new AssignmentError(error.message);
      }
      throw error;
    }
    if (!targetWp?.id) continue;

    const existing = targetByStudent[src.student_id];
    if (existing) {
      toUpdate.push({
        id: existing.id,
        data: {
          workplace_id: targetWp.id,
          workplace_name: targetWp.name,
          role: null,
          bonus: null,
        },
      });
    } else {
      toCreate.push({
        date: targetDate,
        student_id: src.student_id,
        student_name: src.student_name,
        workplace_id: targetWp.id,
        workplace_name: targetWp.name,
        work_number: 1,
        rate: defaults.rate,
        hours: defaults.hours,
        role: null,
        bonus: null,
      });
    }
  }

  await Promise.all(
    toUpdate.map(({ id, data }) => assignmentRepository.updateById(id, data)),
  );
  if (toCreate.length > 0) {
    await assignmentRepository.bulkCreate(toCreate);
  }

  const workplaceIds = new Set([
    ...toUpdate.map(({ data }) => data.workplace_id).filter(Boolean),
    ...toCreate.map((row) => row.workplace_id).filter(Boolean),
  ]);
  for (const workplaceId of workplaceIds) {
    await syncAssignmentsPieceworkForWorkplace(targetDate, workplaceId);
  }

  return { created: toCreate.length, updated: toUpdate.length };
}
