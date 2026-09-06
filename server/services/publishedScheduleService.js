import { buildSort } from "../lib/query.js";
import { isScheduleVisible } from "../lib/scheduleVisibility.js";
import * as publishedScheduleRepository from "../repositories/publishedScheduleRepository.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class PublishedScheduleError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "PublishedScheduleError";
    this.status = status;
  }
}

function assertDate(date) {
  if (!date || !DATE_RE.test(date)) {
    throw new PublishedScheduleError("date must be YYYY-MM-DD");
  }
}

function normalizeInput(body = {}, { partial = false } = {}) {
  const data = {};

  if (body.date !== undefined) {
    assertDate(body.date);
    data.date = body.date;
  } else if (!partial) {
    throw new PublishedScheduleError("date is required");
  }

  if (body.file_url !== undefined) {
    if (!body.file_url) {
      throw new PublishedScheduleError("file_url is required");
    }
    data.file_url = String(body.file_url);
  } else if (!partial) {
    throw new PublishedScheduleError("file_url is required");
  }

  if (body.snapshot !== undefined) {
    data.snapshot = body.snapshot;
  }

  return data;
}

export async function listPublishedSchedules(query = {}) {
  const filter = {};
  if (query.date) {
    assertDate(query.date);
    filter.date = query.date;
  }

  const limitRaw = query.limit !== undefined ? Number(query.limit) : 1000;
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, 10000)
      : 1000;

  return publishedScheduleRepository.find(filter, {
    sort: buildSort(query.sort || "-date"),
    limit,
  });
}

export async function getPublishedSchedule(id) {
  const doc = await publishedScheduleRepository.findById(id);
  if (!doc) {
    throw new PublishedScheduleError("Published schedule not found", 404);
  }
  return doc;
}

export async function createPublishedSchedule(body) {
  const data = normalizeInput(body, { partial: false });
  const existing = await publishedScheduleRepository.findByDate(data.date);
  if (existing) {
    throw new PublishedScheduleError(
      "A published schedule already exists for this date",
      409,
    );
  }
  return publishedScheduleRepository.create(data);
}

export async function upsertPublishedScheduleByDate(body) {
  const data = normalizeInput(body, { partial: false });
  const existing = await publishedScheduleRepository.findByDate(data.date);
  if (existing) {
    return publishedScheduleRepository.updateById(existing.id, data);
  }
  return publishedScheduleRepository.create(data);
}

export async function updatePublishedSchedule(id, body) {
  const data = normalizeInput(body || {}, { partial: true });
  if (Object.keys(data).length === 0) {
    throw new PublishedScheduleError("No fields to update");
  }
  if (data.date) {
    const existing = await publishedScheduleRepository.findByDate(data.date);
    if (existing && existing.id !== id) {
      throw new PublishedScheduleError(
        "A published schedule already exists for this date",
        409,
      );
    }
  }
  const doc = await publishedScheduleRepository.updateById(id, data);
  if (!doc) {
    throw new PublishedScheduleError("Published schedule not found", 404);
  }
  return doc;
}

export async function deletePublishedSchedule(id) {
  const doc = await publishedScheduleRepository.deleteById(id);
  if (!doc) {
    throw new PublishedScheduleError("Published schedule not found", 404);
  }
  return doc;
}

export async function getPublicSchedule(now = new Date()) {
  const records = await publishedScheduleRepository.find(
    {},
    { sort: { date: -1 } },
  );
  return records.find((record) => isScheduleVisible(record.date, now)) || null;
}
