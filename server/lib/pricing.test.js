import test from "node:test";
import assert from "node:assert/strict";
import {
  PRICING_METHODS,
  calcAvgDailyUnits,
  calcTotalPrice,
  dailyToHourlyRate,
  getAssignmentDefaults,
  getDisplayRate,
  hourlyToDailyRate,
  mapAssignmentExportRow,
  normalizeAppSettings,
  parseDisplayRateInput,
  parseImportedAssignmentRate,
} from "./pricing.js";

test("normalizeAppSettings defaults missing documents to hourly mode", () => {
  const settings = normalizeAppSettings(null);
  assert.equal(settings.pricing_method, PRICING_METHODS.HOURLY);
  assert.equal(settings.default_rate, 40);
  assert.equal(settings.default_daily_rate, 235);
  assert.equal(settings.hours_per_daily_unit, 4.75);
});

test("daily and hourly rate conversions are reversible", () => {
  const hourly = dailyToHourlyRate(235, 4.75);
  assert.equal(hourlyToDailyRate(hourly, 4.75), 235);
});

test("assignment defaults use daily settings without persisting daily units", () => {
  const defaults = getAssignmentDefaults({
    pricing_method: PRICING_METHODS.DAILY,
    default_daily_rate: 235,
    hours_per_daily_unit: 4.75,
  });
  assert.equal(defaults.hours, 4.75);
  assert.equal(dailyToHourlyRate(235, 4.75), defaults.rate);
});

test("display and input conversion round-trip for daily mode", () => {
  const settings = {
    pricing_method: PRICING_METHODS.DAILY,
    hours_per_daily_unit: 4.75,
    default_rate: 40,
  };
  const stored = parseDisplayRateInput(235, settings);
  assert.equal(getDisplayRate(stored, settings), 235);
});

test("report totals stay hour-based while daily averages are derived", () => {
  const totalHours = 9.5;
  const hourlyRate = dailyToHourlyRate(235, 4.75);
  const bonus = 10;
  const studentCount = 2;
  const totalPrice = calcTotalPrice(totalHours, hourlyRate, bonus);
  const avgDailyUnits = calcAvgDailyUnits(totalHours, studentCount, 4.75);

  assert.equal(totalPrice, 480);
  assert.equal(avgDailyUnits, 1);
});

test("assignment export stores hourly rate internally and daily label in daily mode", () => {
  const hourlyRate = dailyToHourlyRate(235, 4.75);
  const row = mapAssignmentExportRow(
    {
      date: "2026-04-01",
      student_name: "Test",
      workplace_name: "Farm",
      rate: hourlyRate,
      hours: 4.75,
    },
    { pricing_method: PRICING_METHODS.DAILY, hours_per_daily_unit: 4.75 },
  );
  assert.equal(row["תעריף יומי"], 235);
  assert.equal(row["תעריף"], undefined);
  assert.equal(row["שעות"], 4.75);
});

test("imported daily rate converts back to stored hourly rate", () => {
  const hourly = parseImportedAssignmentRate(
    { "תעריף יומי": 235 },
    { pricing_method: PRICING_METHODS.DAILY, hours_per_daily_unit: 4.75 },
  );
  assert.equal(
    getDisplayRate(hourly, {
      pricing_method: PRICING_METHODS.DAILY,
      hours_per_daily_unit: 4.75,
    }),
    235,
  );
});
