/** Missing work_number is treated as 1 (first workplace). */
export function assignmentWorkNumber(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function isPrimaryWorkNumber(value) {
  return assignmentWorkNumber(value) === 1;
}

/** Mongo match: first workplace only (missing / null / 1). */
export function primaryWorkNumberMatch() {
  return { $nor: [{ work_number: { $gt: 1 } }] };
}
