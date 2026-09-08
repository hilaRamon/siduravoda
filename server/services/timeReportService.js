import mongoose from "mongoose";
import Assignment from "../models/Assignment.js";
import { getModel } from "../models/index.js";
import { calcDuration, isCustomHours } from "../lib/timeReportHours.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set(["אושר", "נדחה"]);

export class TimeReportError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "TimeReportError";
    this.status = status;
  }
}

function timeReportModel() {
  return getModel("TimeReport");
}

function hoursKey(date, studentId, workplaceId) {
  return `${date}|${studentId}|${workplaceId}`;
}

async function applyCustomHours(reports) {
  const hoursByKey = new Map();
  for (const report of reports) {
    if (!isCustomHours(report)) continue;
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
  const TimeReport = timeReportModel();
  const result = await TimeReport.updateMany(
    { _id: { $in: ids } },
    { $set: { status, updated_date: new Date() } },
  );
  return result.modifiedCount;
}

export async function bulkUpdateTimeReportStatus({ ids, status } = {}) {
  if (!STATUSES.has(status)) {
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

  const reports = await timeReportModel()
    .find({ _id: { $in: objectIds } })
    .exec();
  if (reports.length === 0) {
    return { updated: 0 };
  }

  if (status === "אושר") {
    await applyCustomHours(reports);
  }

  const updated = await setReportStatus(
    reports.map((report) => report._id),
    status,
  );
  return { updated };
}

export async function approveTimeReportsForDate(date) {
  if (!date || !DATE_RE.test(date)) {
    throw new TimeReportError("date must be YYYY-MM-DD");
  }

  const reports = await timeReportModel()
    .find({ date, status: "ממתין" })
    .exec();
  if (reports.length === 0) {
    return { updated: 0 };
  }

  await applyCustomHours(reports);
  const updated = await setReportStatus(
    reports.map((report) => report._id),
    "אושר",
  );
  return { updated };
}
