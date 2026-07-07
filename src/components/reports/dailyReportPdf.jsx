import { base44 } from "@/api/base44Client";

export function toHebrewDate(dateStr) {
  try {
    const d = new Date(dateStr + "T12:00:00");
    const formatter = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const formatted = formatter.format(d);

    // המרה של מספרים לגימטריה עברית
    const hebrewDigits = [
      "",
      "א",
      "ב",
      "ג",
      "ד",
      "ה",
      "ו",
      "ז",
      "ח",
      "ט",
      "י",
      "י״א",
      "י״ב",
      "י״ג",
      "י״ד",
      "ט״ו",
      "ט״ז",
      "י״ז",
      "י״ח",
      "י״ט",
      "כ",
      "כ״א",
      "כ״ב",
      "כ״ג",
      "כ״ד",
      "כ״ה",
      "כ״ו",
      "כ״ז",
      "כ״ח",
      "כ״ט",
      "ל",
    ];
    const parts = formatted.split(" ");

    if (parts.length >= 3 && !Number.isNaN(Number(parts[0]))) {
      const day = parseInt(parts[0]);
      const year = parseInt(parts[parts.length - 1]);
      const month = parts.slice(1, -1).join(" ");

      const dayHebrew = hebrewDigits[day] || parts[0];
      const yearHebrew = year
        .toString()
        .split("")
        .map((d, i, arr) => {
          const num = parseInt(d);
          if (i === arr.length - 1) return hebrewDigits[num] || d;
          return hebrewDigits[num * Math.pow(10, arr.length - i - 1)] || d;
        })
        .join("");

      return `${dayHebrew} ${month} תשפ"${hebrewDigits[year % 10]}`;
    }

    return formatted;
  } catch {
    return "";
  }
}

export function toGregDate(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function buildReportGroups(
  assignments,
  logisticsMap,
  logisticsMapByName,
  studentsMap,
) {
  // Include all assignments that have a workplace id and name
  const filtered = assignments.filter(
    (a) => a.workplace_id && a.workplace_name,
  );

  // Deduplicate: keep one assignment per student (most recently updated)
  const bestByStudent = {};
  filtered.forEach((a) => {
    const existing = bestByStudent[a.student_id];
    if (
      !existing ||
      (a.updated_date || a.created_date) >
        (existing.updated_date || existing.created_date)
    ) {
      bestByStudent[a.student_id] = a;
    }
  });

  // Group by workplace
  const byWorkplace = {};
  Object.values(bestByStudent).forEach((a) => {
    const key = a.workplace_id;
    if (!byWorkplace[key])
      byWorkplace[key] = {
        id: a.workplace_id,
        name: a.workplace_name,
        students: [],
      };
    byWorkplace[key].students.push(a);
  });

  // Build result — only workplaces with at least 1 student, sorted alphabetically
  return Object.values(byWorkplace)
    .filter((g) => g.students.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "he"))
    .map((g) => {
      const log = logisticsMap[g.id] || logisticsMapByName[g.name] || {};
      const vehicles = [
        log.vehicle_name,
        log.vehicle_name_2,
        log.vehicle_name_3,
      ]
        .filter(Boolean)
        .join(" + ");

      // Sort students: cohort alphabetically, then name alphabetically
      const sortedStudents = [...g.students].sort((a, b) => {
        const aCohort = studentsMap[a.student_id]?.cohort || "";
        const bCohort = studentsMap[b.student_id]?.cohort || "";
        const cohortCmp = aCohort.localeCompare(bCohort, "he");
        if (cohortCmp !== 0) return cohortCmp;
        return (a.student_name || "").localeCompare(b.student_name || "", "he");
      });

      return {
        workplaceName: g.name,
        students: sortedStudents,
        vehicleName: vehicles || "",
        exitTime: log.exit_time || (g.name.startsWith("תת") ? "" : "06:35"),
        notes: log.notes || "",
      };
    });
}

/** Build the logistics + students lookup maps used by buildReportGroups. */
/** @returns {{ logisticsMap: Record<string, unknown>, logisticsMapByName: Record<string, unknown>, studentsMap: Record<string, unknown> }} */
export function buildLookupMaps(logisticsList, students) {
  /** @type {Record<string, unknown>} */
  const logisticsMap = {};
  /** @type {Record<string, unknown>} */
  const logisticsMapByName = {};
  logisticsList.forEach((l) => {
    if (l.workplace_id) logisticsMap[l.workplace_id] = l;
    if (l.workplace_name) logisticsMapByName[l.workplace_name] = l;
  });

  /** @type {Record<string, unknown>} */
  const studentsMap = {};
  students.forEach((s) => {
    studentsMap[s.id] = s;
  });

  return { logisticsMap, logisticsMapByName, studentsMap };
}

/** @type {Record<string, import('react').CSSProperties>} */
const S = {
  // The hidden container — A4 width at 96dpi ≈ 794px, we use 760px with padding
  wrap: {
    display: "none",
    width: "760px",
    background: "#ffffff",
    padding: "12px",
    fontFamily: "'Heebo', Arial, sans-serif",
    direction: "rtl",
    boxSizing: "border-box",
  },
  titleBox: {
    textAlign: "center",
    borderBottom: "2px solid #1e3a8a",
    paddingBottom: "5px",
    marginBottom: "8px",
  },
  titleText: {
    fontSize: "18px",
    fontWeight: "800",
    color: "#1e3a8a",
    margin: 0,
  },
  subtitle: { fontSize: "9px", color: "#555", margin: "2px 0 0" },
  cols: { columnCount: 2, columnGap: "6px" },
  group: {
    marginBottom: "12px",
    border: "1px solid #9ca3af",
    borderRadius: "3px",
    overflow: "hidden",
    pageBreakInside: "avoid",
    breakInside: "avoid",
  },
  groupHeader: {
    background: "#1e3a8a",
    color: "#fff",
    padding: "3px 6px",
    fontWeight: "800",
    fontSize: "10px",
    pageBreakInside: "avoid",
    display: "flex",
    alignItems: "center",
    minHeight: "16px",
  },
  logRow: {
    background: "#fef9c3",
    borderBottom: "1px solid #ca8a04",
    padding: "2px 5px",
    display: "flex",
    gap: "8px",
    alignItems: "center",
    fontSize: "8.5px",
    flexWrap: "wrap",
    minHeight: "14px",
    lineHeight: "1.3",
  },
  logLabel: { color: "#78716c", fontSize: "7.5px", verticalAlign: "middle" },
  logVal: { fontWeight: "bold", color: "#1e3a8a", verticalAlign: "middle" },
  logValRed: { fontWeight: "bold", color: "#b91c1c", verticalAlign: "middle" },
  table: {
    width: "100%",
    fontSize: "8.5px",
    borderCollapse: "collapse",
    pageBreakInside: "avoid",
  },
  th: {
    background: "#dbeafe",
    border: "1px solid #d1d5db",
    padding: "1.5px 4px",
    textAlign: "right",
    fontSize: "7px",
    fontWeight: "bold",
    color: "#1e3a8a",
    verticalAlign: "middle",
  },
  tdEven: {
    border: "1px solid #e5e7eb",
    padding: "1.5px 4px",
    background: "#fff",
    fontSize: "8px",
    fontWeight: "500",
    color: "#1f2937",
    verticalAlign: "middle",
    display: "table-cell",
    lineHeight: "1",
  },
  tdOdd: {
    border: "1px solid #e5e7eb",
    padding: "1.5px 4px",
    background: "#f9fafb",
    fontSize: "8px",
    fontWeight: "500",
    color: "#1f2937",
    verticalAlign: "middle",
    display: "table-cell",
    lineHeight: "1",
  },
  tdRole: { fontWeight: "700", color: "#1d4ed8" },
  tfootTd: {
    border: "1px solid #d1d5db",
    padding: "3px 5px",
    fontSize: "8px",
    color: "#1f2937",
    background: "#f3f4f6",
    fontWeight: "800",
    verticalAlign: "middle",
    display: "table-cell",
    lineHeight: "1",
  },
};

// Inline SVG icons (currentColor) so they render reliably in the PDF without
// needing an emoji font embedded in headless Chrome.
/** @type {import('react').SVGProps<SVGSVGElement>} */
const iconBase = {
  width: 11,
  height: 11,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};
const iconStyle = {
  display: "inline-block",
  verticalAlign: "middle",
  marginLeft: "2px",
};

function VehicleIcon() {
  return (
    <svg {...iconBase} style={iconStyle}>
      <path d="M8 6v6M15 6v6M2 12h19.6M18 18h3l.8-3a4 4 0 0 0-.2-2.4l-1.4-4.6A2 2 0 0 0 18.3 6H4a2 2 0 0 0-2 2v10h3" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="16" cy="18" r="2" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg {...iconBase} style={iconStyle}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg {...iconBase} style={iconStyle}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="14 3 14 9 20 9" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </svg>
  );
}

function WorkplaceCard({ group, studentsMap }) {
  const roleMap = { נהג: "נהג", "ראש צוות": "ראש צוות", 'אחראי פק"ל': 'פק"ל' };
  const hasLog = group.vehicleName || group.exitTime || group.notes;

  return (
    <div style={S.group} data-report-group="true">
      <div style={S.groupHeader}>{group.workplaceName}</div>
      {hasLog && (
        <div style={S.logRow}>
          {group.vehicleName && (
            <span>
              <span style={S.logLabel}>רכב: </span>
              <span style={S.logVal}>
                <VehicleIcon /> {group.vehicleName}
              </span>
            </span>
          )}
          {group.exitTime && (
            <span>
              <span style={S.logLabel}>יציאה: </span>
              <span style={S.logValRed}>
                <ClockIcon /> {group.exitTime}
              </span>
            </span>
          )}
          {group.notes && (
            <span
              style={{
                fontSize: "8.5px",
                fontWeight: "700",
                color: "#78350f",
                verticalAlign: "middle",
                lineHeight: "1.45",
              }}
            >
              <NoteIcon /> {group.notes}
            </span>
          )}
        </div>
      )}
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>שם</th>
            <th style={{ ...S.th, width: "45px" }}>תפקיד</th>
          </tr>
        </thead>
        <tbody>
          {group.students.map((s, i) => {
            const role = roleMap[s.role] || "";
            return (
              <tr key={i}>
                <td style={i % 2 === 0 ? S.tdEven : S.tdOdd}>
                  {s.student_name}
                </td>
                <td
                  style={{
                    ...(i % 2 === 0 ? S.tdEven : S.tdOdd),
                    ...(role ? S.tdRole : {}),
                  }}
                >
                  {role}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} style={S.tfootTd}>
              סה"כ: {group.students.length} תלמידים
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * @typedef {object} ReportContentProps
 * @property {import('react').Ref<HTMLDivElement> | null} [forwardRef]
 * @property {ReturnType<typeof buildReportGroups>} reportGroups
 * @property {string} gregDate
 * @property {string} hebrewDate
 * @property {Record<string, unknown>} [studentsMap]
 * @property {boolean} [preview]
 * @property {number} [columnCount]
 */

/**
 * Hidden (or preview) A4 layout that html2canvas captures into a PDF.
 * Pass `preview` to render it visibly in normal flow instead of hidden.
 * @param {ReportContentProps} props
 */
export function ReportContent({
  forwardRef = null,
  reportGroups,
  gregDate,
  hebrewDate,
  studentsMap = {},
  preview = false,
  columnCount = 2,
}) {
  const wrapStyle = preview
    ? { ...S.wrap, display: "block", width: "100%", margin: "0 auto" }
    : S.wrap;

  return (
    <div ref={forwardRef} style={wrapStyle}>
      <div style={S.titleBox}>
        <h2 style={S.titleText}>סידור עבודה</h2>
        <p style={S.subtitle}>
          {gregDate} — {hebrewDate}
        </p>
      </div>
      <div style={{ ...S.cols, columnCount }}>
        {reportGroups.map((g) => (
          <WorkplaceCard
            key={g.workplaceName}
            group={g}
            studentsMap={studentsMap}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Serialize a rendered ReportContent container and ask the server (Puppeteer)
 * to turn it into a real, vector A4 PDF. Returns a PDF Blob.
 */
export async function htmlToPdfBlob(container) {
  // Clone so we can force the hidden wrapper to be visible/full-width in the
  // serialized markup without touching the on-page node.
  const clone = container.cloneNode(true);
  clone.style.display = "block";
  clone.style.position = "static";
  clone.style.top = "auto";
  clone.style.left = "auto";
  // A4 (210mm) minus the 8mm server print margins leaves ~733px of printable
  // width at 96dpi; keep the layout narrower so nothing is clipped (RTL clips
  // on the left).
  clone.style.width = "720px";
  clone.style.maxWidth = "720px";
  clone.style.margin = "0 auto";

  const html = clone.outerHTML;
  return base44.integrations.Core.HtmlToPdf({ html });
}
