import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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
export function buildLookupMaps(logisticsList, students) {
  const logisticsMap = {};
  const logisticsMapByName = {};
  logisticsList.forEach((l) => {
    if (l.workplace_id) logisticsMap[l.workplace_id] = l;
    if (l.workplace_name) logisticsMapByName[l.workplace_name] = l;
  });

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
  cols: { display: "flex", gap: "6px", alignItems: "flex-start" },
  col: { flex: 1, minWidth: 0 },
  group: {
    marginBottom: "12px",
    border: "1px solid #9ca3af",
    borderRadius: "3px",
    overflow: "hidden",
    pageBreakInside: "avoid",
  },
  groupHeader: {
    background: "#1e3a8a",
    color: "#fff",
    padding: "5px 6px",
    fontWeight: "800",
    fontSize: "10px",
    pageBreakInside: "avoid",
    display: "flex",
    alignItems: "center",
    minHeight: "20px",
  },
  logRow: {
    background: "#fef9c3",
    borderBottom: "1px solid #ca8a04",
    padding: "4px 5px",
    display: "flex",
    gap: "8px",
    alignItems: "center",
    fontSize: "8.5px",
    flexWrap: "wrap",
    minHeight: "20px",
    lineHeight: "1.4",
  },
  logLabel: { color: "#78716c", fontSize: "7.5px", verticalAlign: "middle" },
  logVal: { fontWeight: "bold", color: "#1e3a8a", verticalAlign: "middle" },
  logValRed: { fontWeight: "bold", color: "#b91c1c", verticalAlign: "middle" },
  table: {
    width: "100%",
    fontSize: "8.5px",
    borderCollapse: "collapse",
    minHeight: "30px",
    pageBreakInside: "avoid",
  },
  th: {
    background: "#dbeafe",
    border: "1px solid #d1d5db",
    padding: "2.5px 4px",
    textAlign: "right",
    fontSize: "7.5px",
    fontWeight: "bold",
    color: "#1e3a8a",
    verticalAlign: "middle",
  },
  tdEven: {
    border: "1px solid #e5e7eb",
    padding: "5px 4px",
    background: "#fff",
    fontSize: "8.5px",
    fontWeight: "500",
    color: "#1f2937",
    verticalAlign: "middle",
    display: "table-cell",
    lineHeight: "0.8",
  },
  tdOdd: {
    border: "1px solid #e5e7eb",
    padding: "5px 4px",
    background: "#f9fafb",
    fontSize: "8.5px",
    fontWeight: "500",
    color: "#1f2937",
    verticalAlign: "middle",
    display: "table-cell",
    lineHeight: "0.8",
  },
  tdRole: { fontWeight: "700", color: "#1d4ed8" },
  tfootTd: {
    border: "1px solid #d1d5db",
    padding: "6px 5px",
    fontSize: "9px",
    color: "#1f2937",
    background: "#f3f4f6",
    fontWeight: "800",
    verticalAlign: "middle",
    display: "table-cell",
    lineHeight: "0.8",
  },
};

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
              <span style={S.logVal}>🚐 {group.vehicleName}</span>
            </span>
          )}
          {group.exitTime && (
            <span>
              <span style={S.logLabel}>יציאה: </span>
              <span style={S.logValRed}>⏰ {group.exitTime}</span>
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
              📝 {group.notes}
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
 * Hidden (or preview) A4 layout that html2canvas captures into a PDF.
 * Pass `preview` to render it visibly in normal flow instead of hidden.
 */
export function ReportContent({
  forwardRef,
  reportGroups,
  gregDate,
  hebrewDate,
  studentsMap,
  preview = false,
}) {
  const leftCol = reportGroups.filter((_, i) => i % 2 === 0);
  const rightCol = reportGroups.filter((_, i) => i % 2 === 1);

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
      <div style={S.cols}>
        <div style={S.col}>
          {leftCol.map((g) => (
            <WorkplaceCard
              key={g.workplaceName}
              group={g}
              studentsMap={studentsMap}
            />
          ))}
        </div>
        <div style={S.col}>
          {rightCol.map((g) => (
            <WorkplaceCard
              key={g.workplaceName}
              group={g}
              studentsMap={studentsMap}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function buildAvoidBreakRanges(container, canvas) {
  const containerRect = container.getBoundingClientRect();
  const pxScale =
    containerRect.width > 0 ? canvas.width / containerRect.width : 1;
  const MIN_BLOCK_START_PX = 52 * pxScale; // header + table head + at least one row
  const groups = Array.from(
    container.querySelectorAll('[data-report-group="true"]'),
  );

  return groups
    .map((el) => {
      const r = el.getBoundingClientRect();
      const top = Math.max(0, (r.top - containerRect.top) * pxScale);
      return {
        start: top,
        end: top + MIN_BLOCK_START_PX,
      };
    })
    .sort((a, b) => a.start - b.start);
}

function buildNoCutRowRanges(container, canvas) {
  const containerRect = container.getBoundingClientRect();
  const pxScale =
    containerRect.width > 0 ? canvas.width / containerRect.width : 1;
  const rows = Array.from(
    container.querySelectorAll('[data-report-group="true"] tr'),
  );

  return rows
    .map((row) => {
      const r = row.getBoundingClientRect();
      return {
        start: Math.max(0, (r.top - containerRect.top) * pxScale),
        end: Math.max(0, (r.bottom - containerRect.top) * pxScale),
      };
    })
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);
}

function adjustPageBreak(
  targetEnd,
  srcY,
  pageHeightPx,
  avoidRanges,
  noCutRanges,
) {
  const MIN_SLICE_RATIO = 0.55;
  const minSlicePx = pageHeightPx * MIN_SLICE_RATIO;
  const MAX_ITERATIONS = 8;

  let adjustedEnd = targetEnd;
  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    // Highest priority: never split an existing table row/cell.
    const rowBlocking = noCutRanges.find(
      (r) => adjustedEnd > r.start && adjustedEnd < r.end,
    );
    if (rowBlocking) {
      if (rowBlocking.start - srcY >= minSlicePx) {
        adjustedEnd = rowBlocking.start;
        continue;
      }
      if (rowBlocking.end - srcY <= pageHeightPx) {
        adjustedEnd = rowBlocking.end;
        continue;
      }
      break;
    }

    // Secondary rule: don't start a new page with only a table title/header tail.
    const blocking = avoidRanges.find(
      (r) => adjustedEnd > r.start && adjustedEnd < r.end,
    );
    if (!blocking) {
      return adjustedEnd;
    }
    if (blocking.start - srcY >= minSlicePx) {
      adjustedEnd = blocking.start;
      continue;
    }
    if (blocking.end - srcY <= pageHeightPx) {
      adjustedEnd = blocking.end;
      continue;
    }
    break;
  }

  return adjustedEnd;
}

export async function generatePDFBlob(container) {
  container.style.display = "block";
  container.style.position = "fixed";
  container.style.top = "-9999px";
  container.style.left = "0";
  await new Promise((r) => setTimeout(r, 200));

  const SCALE = 3; // high-res for crisp text
  const canvas = await html2canvas(container, {
    scale: SCALE,
    useCORS: true,
    backgroundColor: "#ffffff",
  });
  const avoidRanges = buildAvoidBreakRanges(container, canvas);
  const noCutRanges = buildNoCutRowRanges(container, canvas);

  container.style.display = "none";

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth(); // 210
  const pageH = pdf.internal.pageSize.getHeight(); // 297
  const margin = 8;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;

  // How many canvas pixels fit in one PDF page (height)
  const mmPerPx = contentW / canvas.width;
  const pageHeightPx = contentH / mmPerPx;

  let srcY = 0;
  let firstPage = true;

  while (srcY < canvas.height) {
    let targetEnd = Math.min(srcY + pageHeightPx, canvas.height);
    if (targetEnd < canvas.height) {
      targetEnd = adjustPageBreak(
        targetEnd,
        srcY,
        pageHeightPx,
        avoidRanges,
        noCutRanges,
      );
      if (targetEnd <= srcY) {
        targetEnd = Math.min(srcY + pageHeightPx, canvas.height);
      }
    }

    const sliceH = targetEnd - srcY;
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH;
    slice
      .getContext("2d")
      .drawImage(
        canvas,
        0,
        srcY,
        canvas.width,
        sliceH,
        0,
        0,
        canvas.width,
        sliceH,
      );

    if (!firstPage) pdf.addPage();
    pdf.addImage(
      slice.toDataURL("image/jpeg", 0.92),
      "JPEG",
      margin,
      margin,
      contentW,
      sliceH * mmPerPx,
    );
    firstPage = false;
    srcY = targetEnd;
  }

  return pdf.output("blob");
}
