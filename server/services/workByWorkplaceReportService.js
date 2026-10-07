import { getModel } from "../models/index.js";
import Assignment from "../models/Assignment.js";
import { SKIP_WORKPLACES } from "../lib/reportConstants.js";
import {
  calcAvgDailyUnits,
  calcTotalPrice,
  calcTotalPriceDaily,
  getAssignmentDefaults,
  hourlyToDailyRate,
  normalizeAppSettings,
  PRICING_METHODS,
  round2,
} from "../lib/pricing.js";
import * as workplaceLogisticsRepository from "../repositories/workplaceLogisticsRepository.js";
import {
  logisticsKey,
  pickCanonicalLogistics,
} from "../lib/pieceworkLogistics.js";

async function getAppSettings() {
  const AppSettings = getModel("AppSettings");
  const settings = await AppSettings.findOne()
    .sort({ updated_date: -1, created_date: -1 })
    .lean();
  return normalizeAppSettings(settings);
}

async function getWorkplaceMaps() {
  const Workplace = getModel("Workplace");
  const workplaces = await Workplace.find().select("name farm_name").lean();
  const byId = {};
  const skipIds = [];

  for (const workplace of workplaces) {
    const id = workplace._id.toString();
    const name = workplace.name || "";
    byId[id] = {
      name,
      farmName: workplace.farm_name || "",
    };
    if (SKIP_WORKPLACES.includes(name)) {
      skipIds.push(id);
    }
  }

  return { byId, skipIds };
}

function resolveWorkplaceName(workplaceId, assignmentName, byId) {
  const canonical = byId[workplaceId]?.name;
  if (canonical) return canonical;
  return assignmentName || "";
}

function buildTotals(rows) {
  return {
    bonus: round2(rows.reduce((sum, row) => sum + row.bonus, 0)),
    totalPrice: round2(rows.reduce((sum, row) => sum + row.totalPrice, 0)),
  };
}

function buildDisplayUnits({
  isPiecework,
  isDaily,
  hourlyRate,
  dailyRate,
  totalHours,
  avgHours,
  avgDailyUnits,
  studentCount,
  hoursPerDailyUnit,
  pieceRate,
  reportedUnits,
  unitsName,
}) {
  if (isPiecework) {
    const totalUnits =
      reportedUnits == null || !Number.isFinite(Number(reportedUnits))
        ? null
        : Number(reportedUnits);
    return {
      rate: pieceRate,
      unitName: unitsName || "יחידה",
      totalUnits,
      avgUnitsPerStudent:
        totalUnits == null || !studentCount
          ? null
          : round2(totalUnits / studentCount),
    };
  }

  if (isDaily) {
    return {
      rate: dailyRate,
      unitName: "יומי",
      totalUnits: hoursPerDailyUnit
        ? round2(totalHours / hoursPerDailyUnit)
        : 0,
      avgUnitsPerStudent: avgDailyUnits,
    };
  }

  return {
    rate: hourlyRate,
    unitName: "שעה",
    totalUnits: totalHours,
    avgUnitsPerStudent: avgHours,
  };
}

function toWorkplaceGroups(rowBuckets) {
  return Object.values(rowBuckets)
    .map((group) => {
      const rows = [...group.rows].sort((a, b) => a.date.localeCompare(b.date));
      return {
        workplaceName: group.workplaceName,
        farmName: group.farmName,
        rows,
        totals: buildTotals(rows),
      };
    })
    .sort((a, b) => a.workplaceName.localeCompare(b.workplaceName, "he"));
}

function toFarmGroups(rowBuckets) {
  const farmBuckets = {};

  for (const wpGroup of Object.values(rowBuckets)) {
    const farmName = wpGroup.farmName || wpGroup.workplaceName;
    if (!farmBuckets[farmName]) {
      farmBuckets[farmName] = { farmName, rows: [] };
    }
    farmBuckets[farmName].rows.push(...wpGroup.rows);
  }

  return Object.values(farmBuckets)
    .map((group) => {
      const rows = [...group.rows].sort((a, b) => {
        const byWorkplace = (a.workplaceName || "").localeCompare(
          b.workplaceName || "",
          "he",
        );
        if (byWorkplace !== 0) return byWorkplace;
        return a.date.localeCompare(b.date);
      });
      return {
        farmName: group.farmName,
        rows,
        totals: buildTotals(rows),
      };
    })
    .sort((a, b) => a.farmName.localeCompare(b.farmName, "he"));
}

/**
 * @param {{ startDate: string, endDate: string, workplaces?: string[], farms?: string[], groupBy?: 'workplace' | 'farm' }} params
 */
export async function getWorkByWorkplaceReport({
  startDate,
  endDate,
  workplaces = [],
  farms = [],
  groupBy = "workplace",
}) {
  const [appSettings, { byId, skipIds }] = await Promise.all([
    getAppSettings(),
    getWorkplaceMaps(),
  ]);
  const assignmentDefaults = getAssignmentDefaults(appSettings);

  let farmWorkplaceIds = null;
  if (farms.length > 0) {
    farmWorkplaceIds = Object.entries(byId)
      .filter(([, info]) => farms.includes(info.farmName))
      .map(([id]) => id);
    if (farmWorkplaceIds.length === 0) {
      return { groups: [], workplaceOptions: [], pricingMethod: appSettings.pricing_method };
    }
  }

  const match = {
    date: { $gte: startDate, $lte: endDate },
    workplace_name: { $nin: SKIP_WORKPLACES, $exists: true, $ne: "" },
  };

  const workplaceIdFilter = {};
  if (skipIds.length > 0) {
    workplaceIdFilter.$nin = skipIds;
  }
  if (farmWorkplaceIds) {
    workplaceIdFilter.$in = farmWorkplaceIds;
  }
  if (Object.keys(workplaceIdFilter).length > 0) {
    match.workplace_id = workplaceIdFilter;
  }

  const aggregated = await Assignment.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          date: "$date",
          workplace_id: "$workplace_id",
        },
        assignmentWorkplaceName: { $first: "$workplace_name" },
        totalHours: { $sum: { $ifNull: ["$hours", 0] } },
        totalBonus: { $sum: { $ifNull: ["$bonus", 0] } },
        studentCount: { $sum: 1 },
        rate: { $first: "$rate" },
        hasPiecework: {
          $max: { $cond: [{ $eq: ["$is_piecework", true] }, 1, 0] },
        },
      },
    },
    { $sort: { "_id.workplace_id": 1, "_id.date": 1 } },
  ]);

  const workplaceOptionsSet = new Set();
  const rowBuckets = {};

  const workplaceIds = [
    ...new Set(aggregated.map((item) => String(item._id.workplace_id))),
  ];
  const logisticsByKey = {};
  if (workplaceIds.length > 0) {
    const logisticsRows = await workplaceLogisticsRepository.find(
      {
        date: { $gte: startDate, $lte: endDate },
        workplace_id: { $in: workplaceIds },
      },
      { limit: 10000 },
    );
    for (const row of logisticsRows) {
      const key = logisticsKey(row.date, row.workplace_id);
      logisticsByKey[key] = pickCanonicalLogistics(logisticsByKey[key], row);
    }
  }

  for (const item of aggregated) {
    const workplaceId = item._id.workplace_id;
    const workplaceName = resolveWorkplaceName(
      workplaceId,
      item.assignmentWorkplaceName,
      byId,
    );

    if (!workplaceName || SKIP_WORKPLACES.includes(workplaceName)) {
      continue;
    }

    workplaceOptionsSet.add(workplaceName);

    if (workplaces.length > 0 && !workplaces.includes(workplaceName)) {
      continue;
    }

    const logistics = logisticsByKey[logisticsKey(item._id.date, workplaceId)];
    const isPiecework = Boolean(item.hasPiecework || logistics?.is_piecework);
    const isDaily = appSettings.pricing_method === PRICING_METHODS.DAILY;

    const hourlyRate = item.rate ?? assignmentDefaults.rate;
    const totalHours = isPiecework ? 0 : round2(item.totalHours);
    const bonus = round2(item.totalBonus);
    const studentCount = item.studentCount;
    const avgHours = studentCount && !isPiecework ? round2(totalHours / studentCount) : 0;
    const reportedUnits =
      logistics?.units == null || logistics.units === "" ? null : logistics.units;
    const priceUnits = reportedUnits ?? 0;
    const pieceRate =
      logistics?.rate == null || logistics.rate === "" ? null : logistics.rate;
    const unitsName = logistics?.units_name || "";
    const dailyRate = hourlyToDailyRate(
      hourlyRate,
      appSettings.hours_per_daily_unit,
    );
    const avgDailyUnits = isPiecework
      ? 0
      : calcAvgDailyUnits(
          totalHours,
          studentCount,
          appSettings.hours_per_daily_unit,
        );
    const display = buildDisplayUnits({
      isPiecework,
      isDaily,
      hourlyRate,
      dailyRate,
      totalHours,
      avgHours,
      avgDailyUnits,
      studentCount,
      hoursPerDailyUnit: appSettings.hours_per_daily_unit,
      pieceRate,
      reportedUnits,
      unitsName,
    });
    const totalPrice = isPiecework
      ? calcTotalPrice(priceUnits, pieceRate ?? 0, bonus)
      : isDaily
        ? calcTotalPriceDaily(studentCount, avgDailyUnits, dailyRate, bonus)
        : calcTotalPrice(totalHours, hourlyRate, bonus);

    const row = {
      date: item._id.date,
      workplaceName,
      rate: display.rate,
      unitName: display.unitName,
      totalUnits: display.totalUnits,
      avgUnitsPerStudent: display.avgUnitsPerStudent,
      dailyRate: isPiecework ? (pieceRate ?? 0) : dailyRate,
      bonus,
      studentCount,
      totalHours,
      avgHours,
      avgDailyUnits,
      totalPrice,
      is_piecework: isPiecework,
      units: priceUnits,
      units_name: unitsName,
    };

    if (!rowBuckets[workplaceId]) {
      rowBuckets[workplaceId] = {
        workplaceName,
        farmName: byId[workplaceId]?.farmName || "",
        rows: [],
      };
    }
    rowBuckets[workplaceId].rows.push(row);
  }

  const groups =
    groupBy === "farm"
      ? toFarmGroups(rowBuckets)
      : toWorkplaceGroups(rowBuckets);

  const workplaceOptions = [...workplaceOptionsSet].sort((a, b) =>
    a.localeCompare(b, "he"),
  );

  return {
    groups,
    workplaceOptions,
    pricingMethod: appSettings.pricing_method,
  };
}
