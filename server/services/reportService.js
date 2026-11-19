import * as XLSX from "xlsx";
import { getModel } from "../models/index.js";
import Assignment from "../models/Assignment.js";
import Farm from "../models/Farm.js";
import Workplace from "../models/Workplace.js";
import { SKIP_WORKPLACES } from "../lib/reportConstants.js";
import {
  attendanceAbsentPercent,
  classifyAttendanceWorkplace,
  resolveAttendanceBuckets,
} from "../lib/attendanceBuckets.js";
import { canonicalFarmId, resolveArzenuSkipFarms } from "../lib/arzenuSkipFarms.js";
import { primaryWorkNumberMatch } from "../lib/assignmentWorkNumber.js";
import {
  calcAvgDailyUnits,
  calcTotalPrice,
  getAssignmentDefaults,
  hourlyToDailyRate,
  normalizeAppSettings,
  PRICING_METHODS,
  round2,
} from "../lib/pricing.js";
import * as studentRepository from "../repositories/studentRepository.js";
import * as workplaceLogisticsRepository from "../repositories/workplaceLogisticsRepository.js";
import {
  logisticsKey,
  pickCanonicalLogistics,
} from "../lib/pieceworkLogistics.js";
import { markWorkbookRtl } from "../lib/excel.js";

async function findAppSettings() {
  const AppSettings = getModel("AppSettings");
  return AppSettings.findOne()
    .sort({ updated_date: -1, created_date: -1 })
    .lean();
}

async function listWorkplacesWithFarmName() {
  const [workplaces, farms] = await Promise.all([
    Workplace.find().select("name farm_id").lean(),
    Farm.find().select("name company_id").lean(),
  ]);
  const farmById = new Map(
    farms.map((farm) => [
      farm._id.toString(),
      { name: farm.name || "", companyId: farm.company_id || "" },
    ]),
  );
  return {
    farms: farms.map((farm) => ({
      id: farm._id.toString(),
      name: farm.name || "",
    })),
    workplaces: workplaces.map((workplace) => {
      const farmId = canonicalFarmId(workplace.farm_id);
      const farm = farmById.get(farmId);
      return {
        id: workplace._id.toString(),
        name: workplace.name || "",
        farmId,
        farmName: farm?.name || "",
        companyId: farm?.companyId || "",
      };
    }),
  };
}

async function getWorkByWorkplaceMaps() {
  const { workplaces, farms } = await listWorkplacesWithFarmName();
  const byId = {};
  const skipIds = [];

  for (const workplace of workplaces) {
    byId[workplace.id] = {
      name: workplace.name,
      farmId: workplace.farmId,
      farmName: workplace.farmName,
      companyId: workplace.companyId,
    };
    if (SKIP_WORKPLACES.includes(workplace.name)) {
      skipIds.push(workplace.id);
    }
  }

  return { byId, skipIds, farms };
}

async function getStudentWorkWorkplaceMaps() {
  const workplaces = await Workplace.find().select("name").lean();
  const byId = {};
  const skipIds = [];

  for (const workplace of workplaces) {
    const id = workplace._id.toString();
    const name = workplace.name || "";
    byId[id] = name;
    if (SKIP_WORKPLACES.includes(name)) {
      skipIds.push(id);
    }
  }

  return { byId, skipIds };
}

async function getArzenuWorkplaceMaps(skipFarmIds) {
  const { workplaces } = await listWorkplacesWithFarmName();
  const byId = {};
  const skipIds = [];

  for (const workplace of workplaces) {
    byId[workplace.id] = {
      name: workplace.name,
      farmId: workplace.farmId,
      farmName: workplace.farmName,
    };
    if (
      SKIP_WORKPLACES.includes(workplace.name) ||
      skipFarmIds.has(workplace.farmId)
    ) {
      skipIds.push(workplace.id);
    }
  }

  return { byId, skipIds };
}

async function persistAppSettings(settings, stored) {
  const AppSettings = getModel("AppSettings");
  if (settings?._id) {
    await AppSettings.updateOne({ _id: settings._id }, { $set: stored });
    return settings._id.toString();
  }
  const created = await AppSettings.create(stored);
  return created._id.toString();
}

function resolveWorkByWorkplaceName(workplaceId, assignmentName, byId) {
  const canonical = byId[workplaceId]?.name;
  if (canonical) return canonical;
  return assignmentName || "";
}

function resolveStudentWorkWorkplaceName(workplaceId, assignmentName, byId) {
  const canonical = byId[workplaceId];
  if (canonical) return canonical;
  return assignmentName || "";
}

function resolveArzenuWorkplaceName(workplaceId, assignmentName, byId) {
  const canonical = byId[workplaceId]?.name;
  if (canonical) return canonical;
  return assignmentName || "";
}

async function getStudentMap() {
  const students = await studentRepository.find({});
  const byId = {};

  for (const student of students) {
    byId[student.id] = student.full_name || "";
  }

  return byId;
}

function resolveStudentName(studentId, assignmentName, byId) {
  const canonical = byId[studentId];
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

function toFarmGroups(rowBuckets, skipFarmIds = new Set()) {
  const farmBuckets = {};

  for (const wpGroup of Object.values(rowBuckets)) {
    const farmId = String(wpGroup.farmId || "").trim();
    const key = farmId || `workplace:${wpGroup.workplaceId}`;
    if (!farmBuckets[key]) {
      farmBuckets[key] = {
        id: key,
        farmId,
        farmName: farmId ? wpGroup.farmName || "" : wpGroup.workplaceName || "",
        companyId: farmId ? wpGroup.companyId || "" : "",
        excludedFromCharge: Boolean(farmId) && skipFarmIds.has(farmId),
        rows: [],
      };
    } else if (farmId && !farmBuckets[key].companyId && wpGroup.companyId) {
      farmBuckets[key].companyId = wpGroup.companyId;
    }
    if (farmId && !farmBuckets[key].farmName && wpGroup.farmName) {
      farmBuckets[key].farmName = wpGroup.farmName;
    }
    farmBuckets[key].rows.push(...wpGroup.rows);
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
        id: group.id,
        farmId: group.farmId,
        farmName: group.farmName,
        companyId: group.companyId || "",
        excludedFromCharge: group.excludedFromCharge,
        rows,
        totals: buildTotals(rows),
      };
    })
    .sort((a, b) => a.farmName.localeCompare(b.farmName, "he"));
}

function shouldSkipArzenuAssignment(workplaceId, workplaceName, byId) {
  const info = byId[workplaceId];
  if (info) return SKIP_WORKPLACES.includes(info.name);
  return SKIP_WORKPLACES.includes(workplaceName);
}

function emptyWorkReport(groupBy, pricingMethod) {
  if (groupBy === "farm") {
    return {
      chargedGroups: [],
      skipGroups: [],
      chargeTotal: 0,
      workplaceOptions: [],
      pricingMethod,
    };
  }
  return { groups: [], workplaceOptions: [], pricingMethod };
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
  const [settingsDoc, { byId, skipIds, farms: farmRecords }] = await Promise.all([
    findAppSettings(),
    getWorkByWorkplaceMaps(),
  ]);
  const appSettings = normalizeAppSettings(settingsDoc);
  const skipFarmIds =
    groupBy === "farm"
      ? new Set(resolveArzenuSkipFarms(settingsDoc, farmRecords).ids)
      : new Set();
  const assignmentDefaults = getAssignmentDefaults(appSettings);

  let farmWorkplaceIds = null;
  if (farms.length > 0) {
    const selectedFarms = new Set(farms.map((farmId) => canonicalFarmId(farmId)));
    farmWorkplaceIds = Object.entries(byId)
      .filter(([, info]) => selectedFarms.has(info.farmId))
      .map(([id]) => id);
    if (farmWorkplaceIds.length === 0) {
      return emptyWorkReport(groupBy, appSettings.pricing_method);
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
    const workplaceName = resolveWorkByWorkplaceName(
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
    const totalPrice = calcTotalPrice(
      display.totalUnits ?? 0,
      display.rate ?? 0,
      bonus,
    );

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
        workplaceId,
        workplaceName,
        farmId: byId[workplaceId]?.farmId || "",
        farmName: byId[workplaceId]?.farmName || "",
        companyId: byId[workplaceId]?.companyId || "",
        rows: [],
      };
    }
    rowBuckets[workplaceId].rows.push(row);
  }

  const workplaceOptions = [...workplaceOptionsSet].sort((a, b) =>
    a.localeCompare(b, "he"),
  );

  if (groupBy === "farm") {
    const groups = toFarmGroups(rowBuckets, skipFarmIds);
    const chargedGroups = groups.filter((group) => !group.excludedFromCharge);
    const skipGroups = groups.filter((group) => group.excludedFromCharge);
    const chargeTotal = round2(
      chargedGroups.reduce((sum, group) => sum + (group.totals?.totalPrice || 0), 0),
    );
    return {
      chargedGroups,
      skipGroups,
      chargeTotal,
      workplaceOptions,
      pricingMethod: appSettings.pricing_method,
    };
  }

  return {
    groups: toWorkplaceGroups(rowBuckets),
    workplaceOptions,
    pricingMethod: appSettings.pricing_method,
  };
}

/**
 * @param {{ startDate: string, endDate: string, students?: string[] }} params
 */
export async function getStudentWorkReport({
  startDate,
  endDate,
  students = [],
}) {
  const [{ byId: workplaceById, skipIds }, studentById] = await Promise.all([
    getStudentWorkWorkplaceMaps(),
    getStudentMap(),
  ]);

  const match = {
    date: { $gte: startDate, $lte: endDate },
    workplace_name: { $nin: SKIP_WORKPLACES, $exists: true, $ne: "" },
    student_id: { $exists: true, $ne: "" },
    ...primaryWorkNumberMatch(),
  };

  if (skipIds.length > 0) {
    match.workplace_id = { $nin: skipIds };
  }
  if (students.length > 0) {
    match.student_id = { $in: students };
  }

  const aggregated = await Assignment.aggregate([
    { $match: match },
    { $sort: { updated_date: -1, created_date: -1 } },
    {
      $group: {
        _id: { student_id: "$student_id", date: "$date" },
        workplace_id: { $first: "$workplace_id" },
        student_name: { $first: "$student_name" },
        workplace_name: { $first: "$workplace_name" },
      },
    },
    {
      $group: {
        _id: {
          student_id: "$_id.student_id",
          workplace_id: "$workplace_id",
        },
        days: { $sum: 1 },
        student_name: { $first: "$student_name" },
        workplace_name: { $first: "$workplace_name" },
      },
    },
  ]);

  const studentBuckets = {};

  for (const item of aggregated) {
    const studentId = item._id.student_id;
    const workplaceId = item._id.workplace_id;
    const workplaceName = resolveStudentWorkWorkplaceName(
      workplaceId,
      item.workplace_name,
      workplaceById,
    );

    if (!workplaceName || SKIP_WORKPLACES.includes(workplaceName)) {
      continue;
    }

    const name = resolveStudentName(studentId, item.student_name, studentById);
    if (!studentBuckets[studentId]) {
      studentBuckets[studentId] = {
        studentId,
        name,
        workplaces: {},
      };
    }

    studentBuckets[studentId].workplaces[workplaceName] =
      (studentBuckets[studentId].workplaces[workplaceName] || 0) + item.days;
  }

  const result = Object.values(studentBuckets)
    .map((student) => {
      const workplaces = Object.entries(student.workplaces)
        .map(([workplaceName, days]) => ({ workplaceName, days }))
        .sort((a, b) => a.workplaceName.localeCompare(b.workplaceName, "he"));
      const totalDays = workplaces.reduce((sum, wp) => sum + wp.days, 0);
      return {
        studentId: student.studentId,
        name: student.name,
        workplaces,
        totalDays,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  return { students: result };
}

/**
 * @param {{ startDate: string, endDate: string, students?: string[] }} params
 */
export async function getStudentAttendanceReport({
  startDate,
  endDate,
  students = [],
}) {
  const [settings, workplaceDocs, activeStudents] = await Promise.all([
    findAppSettings(),
    Workplace.find().select("name").lean(),
    studentRepository.find({ is_active: { $ne: false } }),
  ]);
  const studentById = {};
  for (const student of activeStudents) {
    if (!student?.id) continue;
    studentById[student.id] = student.full_name || "";
  }
  const activeIds = Object.keys(studentById);
  const countedIds = students.length > 0
    ? students.filter((id) => Object.prototype.hasOwnProperty.call(studentById, id))
    : activeIds;
  const workplaceRecords = workplaceDocs.map((workplace) => ({
    id: workplace._id.toString(),
    name: workplace.name || "",
  }));
  const resolved = resolveAttendanceBuckets(settings, workplaceRecords);
  const AppSettings = getModel("AppSettings");
  let settingsId = settings?._id ? settings._id.toString() : null;
  if (resolved.changed) {
    if (settingsId) {
      await AppSettings.updateOne({ _id: settings._id }, { $set: resolved.stored });
    } else {
      const created = await AppSettings.create(resolved.stored);
      settingsId = created._id.toString();
    }
  }
  const { buckets, notAssignedIds } = resolved;

  if (countedIds.length === 0) {
    return { students: [], buckets, settingsId };
  }

  const match = {
    date: { $gte: startDate, $lte: endDate },
    workplace_name: { $exists: true, $ne: "" },
    student_id: { $in: countedIds },
    ...primaryWorkNumberMatch(),
  };

  const rows = await Assignment.aggregate([
    { $match: match },
    { $sort: { updated_date: -1, created_date: -1 } },
    {
      $group: {
        _id: { student_id: "$student_id", date: "$date" },
        workplace_id: { $first: "$workplace_id" },
        student_name: { $first: "$student_name" },
      },
    },
  ]);

  const studentBuckets = {};

  for (const item of rows) {
    const studentId = item._id.student_id;
    const kind = classifyAttendanceWorkplace(
      item.workplace_id,
      buckets,
      notAssignedIds,
    );
    if (!kind) continue;

    if (!studentBuckets[studentId]) {
      studentBuckets[studentId] = {
        studentId,
        name: resolveStudentName(studentId, item.student_name, studentById),
        didNotLeave: 0,
        didNotWork: 0,
        studies: 0,
        worked: 0,
      };
    }
    studentBuckets[studentId][kind] += 1;
  }

  const result = Object.values(studentBuckets)
    .map((student) => {
      const assignedDays =
        student.didNotLeave + student.didNotWork + student.studies + student.worked;
      return {
        ...student,
        assignedDays,
        absentPercent: attendanceAbsentPercent(
          student.didNotLeave,
          student.didNotWork,
          assignedDays,
        ),
      };
    })
    .filter((student) => student.assignedDays > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  return {
    students: result,
    buckets,
    settingsId,
  };
}

/**
 * @param {{ startDate: string, endDate: string }} params
 */
export async function getArzenuReport({ startDate, endDate }) {
  const [settings, farmDocs, studentById] = await Promise.all([
    findAppSettings(),
    Farm.find().select("name").lean(),
    getStudentMap(),
  ]);
  const resolved = resolveArzenuSkipFarms(
    settings,
    farmDocs.map((farm) => ({ id: farm._id.toString(), name: farm.name || "" })),
  );
  if (resolved.changed) {
    await persistAppSettings(settings, resolved.stored);
  }
  const skipFarmIds = new Set(resolved.ids);
  const { byId: workplaceById, skipIds } = await getArzenuWorkplaceMaps(skipFarmIds);

  const match = {
    date: { $gte: startDate, $lte: endDate },
    workplace_name: { $nin: SKIP_WORKPLACES, $exists: true, $ne: "" },
    ...primaryWorkNumberMatch(),
  };

  if (skipIds.length > 0) {
    match.workplace_id = { $nin: skipIds };
  }

  const assignments = await Assignment.find(match)
    .select("date student_id student_name workplace_name workplace_id")
    .lean();

  const rows = [];

  for (const assignment of assignments) {
    const workplace = resolveArzenuWorkplaceName(
      assignment.workplace_id,
      assignment.workplace_name,
      workplaceById,
    );

    if (
      !workplace ||
      shouldSkipArzenuAssignment(
        assignment.workplace_id,
        assignment.workplace_name,
        workplaceById,
      )
    ) {
      continue;
    }

    rows.push({
      date: assignment.date,
      name: resolveStudentName(
        assignment.student_id,
        assignment.student_name,
        studentById,
      ),
      workplace,
    });
  }

  rows.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return a.name.localeCompare(b.name, "he");
  });

  return { rows, totalRows: rows.length };
}

function formatReportDate(value) {
  const [year, month, day] = String(value || "").split("-");
  if (!year || !month || !day) return value || "";
  return `${day}/${month}/${year}`;
}

function displayCell(value) {
  if (value == null || value === "") return "—";
  return value;
}

function monthlySheetRows(groups) {
  const rows = [];
  for (const group of groups) {
    for (const row of group.rows) {
      rows.push({
        משק: group.farmName,
        "ח.פ": group.companyId || "",
        תאריך: formatReportDate(row.date),
        "מקום עבודה": row.workplaceName,
        תעריף: displayCell(row.rate),
        יחידה: row.unitName || "",
        "סה״כ יחידות": displayCell(row.totalUnits),
        מחיר: row.totalPrice,
      });
    }
    rows.push({
      משק: "",
      "ח.פ": "",
      תאריך: "",
      "מקום עבודה": 'סה"כ',
      תעריף: "",
      יחידה: "",
      "סה״כ יחידות": "",
      מחיר: group.totals.totalPrice,
    });
    rows.push({});
  }
  return rows;
}

export function buildMonthlyWorkWorkbook({ chargedGroups = [], skipGroups = [], chargeTotal = 0 }) {
  const chargedRows = monthlySheetRows(chargedGroups);
  chargedRows.push({
    משק: "",
    "ח.פ": "",
    תאריך: "",
    "מקום עבודה": 'סה"כ חיוב',
    תעריף: "",
    יחידה: "",
    "סה״כ יחידות": "",
    מחיר: chargeTotal,
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(chargedRows), "דוח חודשי");
  if (skipGroups.length > 0) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(monthlySheetRows(skipGroups)),
      "מחוץ לחיוב",
    );
  }
  markWorkbookRtl(workbook);
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
}

export function buildArzenuWorkbook(rows = []) {
  const sheetRows = rows.map((row) => ({
    תאריך: formatReportDate(row.date),
    שם: row.name,
    "מקום עבודה": row.workplace,
  }));
  const worksheet = XLSX.utils.json_to_sheet(
    sheetRows.length > 0 ? sheetRows : [{ תאריך: "", שם: "", "מקום עבודה": "" }],
    { header: ["תאריך", "שם", "מקום עבודה"] },
  );
  worksheet["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 28 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "דוח לארצנו");
  markWorkbookRtl(workbook);
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
}
