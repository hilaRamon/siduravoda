export const DEFAULT_ASSEMBLY = "טצ";
export const DEFAULT_RETURN_TIME = "12:00";
export const DEFAULT_DEPARTURE_TIME = "06:35";

export function isTransportationVehicle(vehicle) {
  return vehicle?.is_transportation === true;
}

export function logisticsDepartureTime(exitTime) {
  const value = typeof exitTime === "string" ? exitTime.trim() : "";
  return value || DEFAULT_DEPARTURE_TIME;
}

function rowsForVehicle(existingRows, date, vehicleId) {
  return existingRows.filter(
    (row) => row.date === date && row.vehicle_id === vehicleId,
  );
}

export function planLogisticsInsert({
  date,
  vehicleId,
  exitTime,
  workplaceName,
  existingRows = [],
}) {
  const rows = rowsForVehicle(existingRows, date, vehicleId);
  if (rows.some((row) => row.source === "logistics")) {
    return { action: "skip", reason: "exists" };
  }
  const departureTime = logisticsDepartureTime(exitTime);
  if (rows.some((row) => row.departure_time === departureTime)) {
    return { action: "skip", reason: "hour-taken" };
  }
  return {
    action: "insert",
    values: {
      date,
      vehicle_id: vehicleId,
      source: "logistics",
      assembly: DEFAULT_ASSEMBLY,
      destination: workplaceName || "",
      departure_time: departureTime,
      return_time: DEFAULT_RETURN_TIME,
    },
  };
}

export function planManualInsert({
  date,
  vehicleId,
  departureTime,
  isTransportation,
  existingRows = [],
  assembly,
  destination,
  returnTime,
}) {
  if (!isTransportation) {
    return { action: "reject", reason: "not-transportation" };
  }
  const time = typeof departureTime === "string" ? departureTime.trim() : "";
  if (!time) {
    return { action: "reject", reason: "departure-required" };
  }
  const rows = rowsForVehicle(existingRows, date, vehicleId);
  if (rows.some((row) => row.departure_time === time)) {
    return { action: "reject", reason: "hour-taken" };
  }
  const returnValue =
    typeof returnTime === "string" && returnTime.trim()
      ? returnTime.trim()
      : DEFAULT_RETURN_TIME;
  return {
    action: "insert",
    values: {
      date,
      vehicle_id: vehicleId,
      source: "manual",
      assembly: assembly == null ? DEFAULT_ASSEMBLY : String(assembly),
      destination: destination == null ? "" : String(destination),
      departure_time: time,
      return_time: returnValue,
    },
  };
}

export function departureChangeAllowed(
  existingRows,
  { id, date, vehicleId, departureTime },
) {
  const time = typeof departureTime === "string" ? departureTime.trim() : "";
  if (!time) return false;
  return !existingRows.some(
    (row) =>
      row.id !== id &&
      row.date === date &&
      row.vehicle_id === vehicleId &&
      row.departure_time === time,
  );
}

export function isSummaryRowVisible({ source, isTransportation, assigned }) {
  if (!isTransportation) return false;
  if (source === "manual") return true;
  return Boolean(assigned);
}
