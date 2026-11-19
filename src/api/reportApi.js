import { API_BASE_URL, apiRequest, getAuthToken } from "@/api/base44Client";

/**
 * @typedef {object} ReportRangeParams
 * @property {string} [startDate]
 * @property {string} [endDate]
 */

/**
 * @typedef {ReportRangeParams & { students?: string[] }} StudentReportParams
 */

/**
 * @typedef {ReportRangeParams & { workplaces?: string[], farms?: string[], groupBy?: 'workplace' | 'farm' }} WorkByWorkplaceParams
 */

/**
 * @typedef {object} StudentWorkWorkplace
 * @property {string} workplaceName
 * @property {number} days
 */

/**
 * @typedef {object} StudentWorkRow
 * @property {string} studentId
 * @property {string} name
 * @property {StudentWorkWorkplace[]} workplaces
 * @property {number} totalDays
 */

/**
 * @typedef {object} StudentWorkReportData
 * @property {StudentWorkRow[]} students
 */

/**
 * @typedef {object} AttendanceBuckets
 * @property {string[]} didNotLeave
 * @property {string[]} didNotWork
 * @property {string[]} studies
 */

/**
 * @typedef {object} StudentAttendanceRow
 * @property {string} studentId
 * @property {string} name
 * @property {number} didNotLeave
 * @property {number} didNotWork
 * @property {number} studies
 * @property {number} worked
 * @property {number} assignedDays
 * @property {number} absentPercent
 */

/**
 * @typedef {object} StudentAttendanceReportData
 * @property {StudentAttendanceRow[]} students
 * @property {AttendanceBuckets} buckets
 * @property {string | null} settingsId
 */

/**
 * @param {Record<string, string | number | boolean | null | undefined>} [params]
 */
function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

/**
 * @param {string[] | undefined} values
 * @returns {string | undefined}
 */
function joinList(values) {
  if (!values?.length) return undefined;
  return values.join(",");
}

const BASE = "/api/reports";

/**
 * @param {string} path
 * @param {string} filename
 */
async function downloadReportFile(path, filename) {
  /** @type {Record<string, string>} */
  const headers = {};
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const payload = await response.json();
      message = payload?.message || message;
    } catch {
      // The error response had no JSON body.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const reportApi = {
  /**
   * @param {WorkByWorkplaceParams} params
   */
  workByWorkplace({ startDate, endDate, workplaces, farms, groupBy }) {
    return apiRequest(
      `${BASE}/work-by-workplace${buildQuery({
        startDate,
        endDate,
        workplaces: joinList(workplaces),
        farms: joinList(farms),
        groupBy,
      })}`,
    );
  },

  /**
   * @param {StudentReportParams} params
   * @returns {Promise<StudentWorkReportData>}
   */
  studentWork({ startDate, endDate, students }) {
    return apiRequest(
      `${BASE}/student-work${buildQuery({
        startDate,
        endDate,
        students: joinList(students),
      })}`,
    );
  },

  /**
   * @param {StudentReportParams} params
   * @returns {Promise<StudentAttendanceReportData>}
   */
  studentAttendance({ startDate, endDate, students }) {
    return apiRequest(
      `${BASE}/student-attendance${buildQuery({
        startDate,
        endDate,
        students: joinList(students),
      })}`,
    );
  },

  /**
   * @param {ReportRangeParams} params
   */
  arzenu({ startDate, endDate }) {
    return apiRequest(
      `${BASE}/arzenu${buildQuery({ startDate, endDate })}`,
    );
  },

  /**
   * @param {WorkByWorkplaceParams} params
   * @param {string} filename
   */
  downloadWorkByWorkplace({ startDate, endDate, workplaces, farms }, filename) {
    return downloadReportFile(
      `${BASE}/work-by-workplace/export${buildQuery({
        startDate,
        endDate,
        workplaces: joinList(workplaces),
        farms: joinList(farms),
        groupBy: "farm",
      })}`,
      filename,
    );
  },

  /**
   * @param {ReportRangeParams} params
   * @param {string} filename
   */
  downloadArzenu({ startDate, endDate }, filename) {
    return downloadReportFile(
      `${BASE}/arzenu/export${buildQuery({ startDate, endDate })}`,
      filename,
    );
  },
};
