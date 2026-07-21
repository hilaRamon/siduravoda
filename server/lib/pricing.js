// Pricing helpers for the server deploy. Keep in sync with src/lib/pricing.js.
// Duplicated intentionally so each deploy root is self-contained (no cross-root imports).

export const PRICING_METHODS = {
  HOURLY: "hourly",
  DAILY: "daily",
};

export const PRICING_DEFAULTS = {
  pricing_method: PRICING_METHODS.HOURLY,
  default_rate: 40,
  default_hours: 4.75,
  default_daily_rate: 235,
  hours_per_daily_unit: 4.75,
};

export function round2(value) {
  return Math.round(value * 100) / 100;
}

function finiteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeAppSettings(settings = null) {
  const source = settings || {};
  return {
    pricing_method:
      source.pricing_method === PRICING_METHODS.DAILY
        ? PRICING_METHODS.DAILY
        : PRICING_METHODS.HOURLY,
    default_rate: finiteNumber(
      source.default_rate,
      PRICING_DEFAULTS.default_rate,
    ),
    default_hours: finiteNumber(
      source.default_hours,
      PRICING_DEFAULTS.default_hours,
    ),
    default_daily_rate: finiteNumber(
      source.default_daily_rate,
      PRICING_DEFAULTS.default_daily_rate,
    ),
    hours_per_daily_unit: finiteNumber(
      source.hours_per_daily_unit,
      PRICING_DEFAULTS.hours_per_daily_unit,
    ),
  };
}

export function isDailyPricing(settings) {
  return normalizeAppSettings(settings).pricing_method === PRICING_METHODS.DAILY;
}

export function hourlyToDailyRate(hourlyRate, hoursPerDailyUnit) {
  return round2(hourlyRate * hoursPerDailyUnit);
}

export function dailyToHourlyRate(dailyRate, hoursPerDailyUnit) {
  if (!hoursPerDailyUnit) return dailyRate;
  return dailyRate / hoursPerDailyUnit;
}

export function getAssignmentDefaults(settings) {
  const normalized = normalizeAppSettings(settings);
  if (normalized.pricing_method === PRICING_METHODS.DAILY) {
    return {
      rate: dailyToHourlyRate(
        normalized.default_daily_rate,
        normalized.hours_per_daily_unit,
      ),
      hours: normalized.hours_per_daily_unit,
    };
  }
  return {
    rate: normalized.default_rate,
    hours: normalized.default_hours,
  };
}

export function getDisplayRate(hourlyRate, settings) {
  const normalized = normalizeAppSettings(settings);
  const effectiveHourlyRate = hourlyRate ?? normalized.default_rate;
  if (normalized.pricing_method === PRICING_METHODS.DAILY) {
    return hourlyToDailyRate(
      effectiveHourlyRate,
      normalized.hours_per_daily_unit,
    );
  }
  return effectiveHourlyRate;
}

export function parseDisplayRateInput(displayValue, settings) {
  const normalized = normalizeAppSettings(settings);
  if (normalized.pricing_method === PRICING_METHODS.DAILY) {
    return dailyToHourlyRate(displayValue, normalized.hours_per_daily_unit);
  }
  return displayValue;
}

export function calcAvgDailyUnits(totalHours, studentCount, hoursPerDailyUnit) {
  if (!studentCount || !hoursPerDailyUnit) return 0;
  return round2(totalHours / hoursPerDailyUnit / studentCount);
}

export function calcTotalPrice(totalHours, hourlyRate, bonus = 0) {
  return round2(totalHours * hourlyRate + (bonus || 0));
}

export function formatAssignmentRateForExport(hourlyRate, settings) {
  const normalized = normalizeAppSettings(settings);
  if (normalized.pricing_method === PRICING_METHODS.DAILY) {
    return hourlyToDailyRate(
      hourlyRate ?? 0,
      normalized.hours_per_daily_unit,
    );
  }
  return hourlyRate ?? "";
}

export function parseAssignmentRateFromImport(importedRate, settings) {
  if (importedRate === null || importedRate === undefined || importedRate === "") {
    return null;
  }
  const parsed = Number(importedRate);
  if (!Number.isFinite(parsed)) return null;
  return parseDisplayRateInput(parsed, settings);
}

export function getAssignmentRateColumnLabel(settings) {
  return isDailyPricing(settings) ? "תעריף יומי" : "תעריף";
}

export function mapAssignmentExportRow(assignment, settings) {
  return {
    תאריך: assignment.date || "",
    "שם תלמיד": assignment.student_name || "",
    "מקום עבודה": assignment.workplace_name || "",
    תפקיד: assignment.role || "",
    [getAssignmentRateColumnLabel(settings)]: formatAssignmentRateForExport(
      assignment.rate,
      settings,
    ),
    שעות: assignment.hours ?? "",
    "תשלום נוסף": assignment.bonus ?? "",
    הערות: assignment.notes || "",
  };
}

export function parseImportedAssignmentRate(row, settings) {
  const dailyColumn = row["תעריף יומי"];
  const hourlyColumn = row["תעריף"];
  const raw =
    dailyColumn !== undefined && dailyColumn !== ""
      ? dailyColumn
      : hourlyColumn;
  if (raw === undefined || raw === "") return null;
  return parseAssignmentRateFromImport(raw, settings);
}
