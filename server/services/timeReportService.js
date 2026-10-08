import mongoose from "mongoose";
import Assignment from "../models/Assignment.js";
import { buildSort } from "../lib/query.js";
import { calcDuration } from "../lib/timeReportHours.js";
import * as timeReportRepository from "../repositories/timeReportRepository.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PENDING_STATUS = "ממתין";
const APPROVE_STATUSES = new Set(["אושר", "נדחה"]);
const ALL_STATUSES = new Set(["ממתין", "אושר", "נדחה"]);
const TEXT_FIELDS = [
  "student_name",
  "workplace_name",
  "start_time",
  "end_time",
  "notes",
];

export class TimeReportError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "TimeReportError";
    this.status = status;
  }
}

function assertDate(date) {
  if (!date || !DATE_RE.test(date)) {
    throw new TimeReportError("date must be YYYY-MM-DD");
  }
}

function assertObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new TimeReportError(`Invalid id: ${id}`);
  }
}

function normalizeInput(body = {}, { partial = false } = {}) {
  const data = {};

  if (body.date !== undefined) {
    assertDate(body.date);
    data.date = body.date;
  } else if (!partial) {
    throw new TimeReportError("date is required");
  }

  if (body.student_id !== undefined) {
    if (!body.student_id) {
      throw new TimeReportError("student_id is required");
    }
    data.student_id = String(body.student_id);
  } else if (!partial) {
    throw new TimeReportError("student_id is required");
  }

  if (body.workplace_id !== undefined) {
    if (!body.workplace_id) {
      throw new TimeReportError("workplace_id is required");
    }
    data.workplace_id = String(body.workplace_id);
  } else if (!partial) {
    throw new TimeReportError("workplace_id is required");
  }

  for (const key of TEXT_FIELDS) {
    if (body[key] !== undefined) {
      data[key] = body[key] == null ? "" : String(body[key]);
    }
  }

  data.status = PENDING_STATUS;
  return data;
}

function hoursKey(date, studentId, workplaceId) {
  return `${date}|${studentId}|${workplaceId}`;
}

async function applyReportHours(reports) {
  const hoursByKey = new Map();
  for (const report of reports) {
    const duration = calcDuration(report.start_time, report.end_time);
    if (duration === null) continue;
    hoursByKey.set(
      hoursKey(report.date, report.student_id, report.workplace_id),
      duration,
    );
  }
  if (hoursByKey.size === 0) return;

  const dates = [
    ...new Set([...hoursByKey.keys()].map((key) => key.split("|")[0])),
  ];
  const studentIds = [
    ...new Set([...hoursByKey.keys()].map((key) => key.split("|")[1])),
  ];

  const assignments = await Assignment.find({
    date: { $in: dates },
    student_id: { $in: studentIds },
  })
    .sort({ created_date: -1 })
    .exec();

  const seen = new Set();
  const ops = [];
  for (const assignment of assignments) {
    const key = hoursKey(
      assignment.date,
      assignment.student_id,
      assignment.workplace_id,
    );
    if (seen.has(key) || !hoursByKey.has(key)) continue;
    seen.add(key);
    ops.push({
      updateOne: {
        filter: { _id: assignment._id },
        update: { $set: { hours: hoursByKey.get(key) } },
      },
    });
  }

  if (ops.length > 0) {
    await Assignment.bulkWrite(ops);
  }
}

async function setReportStatus(ids, status) {
  const result = await timeReportRepository.updateMany(
    { _id: { $in: ids } },
    { status, updated_date: new Date() },
  );
  return result.modifiedCount;
}

export async function listTimeReports(query = {}) {
  const filter = {};

  if (query.date) {
    assertDate(query.date);
    filter.date = query.date;
  }
  if (query.status) {
    if (!ALL_STATUSES.has(query.status)) {
      throw new TimeReportError("status is invalid");
    }
    filter.status = query.status;
  }
  if (query.student_id) filter.student_id = String(query.student_id);
  if (query.workplace_id) filter.workplace_id = String(query.workplace_id);

  const limitRaw = query.limit !== undefined ? Number(query.limit) : 2000;
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, 10000)
      : 2000;

  return timeReportRepository.find(filter, {
    sort: buildSort(query.sort || "-created_date"),
    limit,
  });
}

export async function getTimeReport(id) {
  assertObjectId(id);
  const doc = await timeReportRepository.findById(id);
  if (!doc) {
    throw new TimeReportError("Time report not found", 404);
  }
  return doc;
}

export async function createTimeReport(body) {
  const data = normalizeInput(body, { partial: false });
  return timeReportRepository.create(data);
}

export async function updateTimeReport(id, body) {
  assertObjectId(id);
  const existing = await timeReportRepository.findById(id);
  if (!existing) {
    throw new TimeReportError("Time report not found", 404);
  }
  const data = normalizeInput(body, { partial: true });
  const doc = await timeReportRepository.updateById(id, data);
  if (!doc) {
    throw new TimeReportError("Time report not found", 404);
  }
  return doc;
}

export async function bulkUpdateTimeReportStatus({ ids, status } = {}) {
  if (!APPROVE_STATUSES.has(status)) {
    throw new TimeReportError('status must be "אושר" or "נדחה"');
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new TimeReportError("ids must be a non-empty array");
  }

  const objectIds = [];
  for (const id of ids) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new TimeReportError(`Invalid id: ${id}`);
    }
    objectIds.push(new mongoose.Types.ObjectId(id));
  }

  const reports = await timeReportRepository.find({ _id: { $in: objectIds } });
  if (reports.length === 0) {
    return { updated: 0 };
  }

  if (status === "אושר") {
    await applyReportHours(reports);
  }

  const updated = await setReportStatus(
    reports.map((report) => report.id),
    status,
  );
  return { updated };
}

export async function approveTimeReportsForDate(date) {
  if (!date || !DATE_RE.test(date)) {
    throw new TimeReportError("date must be YYYY-MM-DD");
  }

  const reports = await timeReportRepository.find({
    date,
    status: PENDING_STATUS,
  });
  if (reports.length === 0) {
    return { updated: 0 };
  }

  await applyReportHours(reports);
  const updated = await setReportStatus(
    reports.map((report) => report.id),
    "אושר",
  );
  return { updated };
}
