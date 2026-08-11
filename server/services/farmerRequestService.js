import * as farmerRequestRepository from "../repositories/farmerRequestRepository.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class FarmerRequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "FarmerRequestError";
    this.status = status;
  }
}

function assertDate(date) {
  if (!date || !DATE_RE.test(date)) {
    throw new FarmerRequestError("date must be YYYY-MM-DD");
  }
}

export async function listFarmerRequests(query = {}) {
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

  if (query.workplace_id) {
    filter.workplace_id = query.workplace_id;
  }

  return farmerRequestRepository.find(filter, {
    sort: { date: -1 },
    limit: 1000,
  });
}

export async function getFarmerRequest(id) {
  const doc = await farmerRequestRepository.findById(id);
  if (!doc) {
    throw new FarmerRequestError("Farmer request not found", 404);
  }
  return doc;
}

export async function createFarmerRequest({
  date,
  workplace_id,
  workplace_name,
  requested_volunteers,
}) {
  assertDate(date);
  if (!workplace_id) {
    throw new FarmerRequestError("workplace_id is required");
  }

  let volunteers = null;
  if (
    requested_volunteers !== undefined &&
    requested_volunteers !== null &&
    requested_volunteers !== ""
  ) {
    volunteers = Number(requested_volunteers);
    if (!Number.isFinite(volunteers)) {
      throw new FarmerRequestError("requested_volunteers must be a number");
    }
  }

  return farmerRequestRepository.create({
    date,
    workplace_id,
    workplace_name: workplace_name || "",
    requested_volunteers: volunteers,
  });
}

export async function deleteFarmerRequest(id) {
  const doc = await farmerRequestRepository.deleteById(id);
  if (!doc) {
    throw new FarmerRequestError("Farmer request not found", 404);
  }
  return doc;
}
