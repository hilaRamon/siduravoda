export function formatPayReportRate(row, isDailyPricing) {
  if (row?.is_piecework) {
    const name = row.units_name || "יחידה";
    const rateLabel =
      row.rate == null || row.rate === "" ? name : `${row.rate} ₪ / ${name}`;
    return `קבלנות · ${rateLabel}`;
  }
  return isDailyPricing ? row.dailyRate : row.rate;
}

export function formatPayReportHoursOrUnits(row) {
  if (row?.is_piecework) {
    if (row.units == null || row.units === "") return "—";
    return row.units_name ? `${row.units} ${row.units_name}` : row.units;
  }
  return row.totalHours;
}

export function formatPayReportAvgHours(row) {
  if (row?.is_piecework) return "—";
  return row.avgHours;
}

export function formatPayReportDailyUnits(row) {
  if (row?.is_piecework) {
    if (row.units == null || row.units === "") return "—";
    return row.units_name ? `${row.units} ${row.units_name}` : row.units;
  }
  return row.avgDailyUnits;
}
