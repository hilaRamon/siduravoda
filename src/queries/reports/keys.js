/**
 * @typedef {object} ReportRangeKey
 * @property {string} [startDate]
 * @property {string} [endDate]
 */

/**
 * @typedef {ReportRangeKey & { workplaces?: string[], farms?: string[], groupBy?: 'workplace' | 'farm' }} WorkByWorkplaceKey
 */

/**
 * @typedef {ReportRangeKey & { students?: string[] }} StudentReportKey
 */

export const reportKeys = {
  all: ["reports"],
  /** @param {WorkByWorkplaceKey} params */
  workByWorkplace: ({ startDate, endDate, workplaces, farms, groupBy }) => [
    ...reportKeys.all,
    "work-by-workplace",
    { startDate, endDate, workplaces, farms, groupBy },
  ],
  workplaces: () => [...reportKeys.all, "workplaces"],
  /** @param {StudentReportKey} params */
  studentWork: ({ startDate, endDate, students }) => [
    ...reportKeys.all,
    "student-work",
    { startDate, endDate, students },
  ],
  /** @param {StudentReportKey} params */
  studentAttendance: ({ startDate, endDate, students }) => [
    ...reportKeys.all,
    "student-attendance",
    { startDate, endDate, students },
  ],
  /** @param {ReportRangeKey} params */
  arzenu: ({ startDate, endDate }) => [
    ...reportKeys.all,
    "arzenu",
    { startDate, endDate },
  ],
};
