import { useRef, useLayoutEffect, useCallback, useState } from "react";
import { ReportContent } from "@/components/reports/dailyReportPdf";

const TV_CONTENT_WIDTH = 1400;
const TV_COLUMN_COUNT = 4;

/**
 * @typedef {import("@/components/reports/dailyReportPdf").ReportContentProps} ReportContentProps
 */

/**
 * @param {{ snapshot: Pick<ReportContentProps, "reportGroups" | "gregDate" | "hebrewDate" | "hebrewWeekday"> }} props
 */
export default function ScheduleScreenView({ snapshot }) {
  const containerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const contentRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [scale, setScale] = useState(1);
  const { reportGroups, gregDate, hebrewDate, hebrewWeekday } = snapshot;

  const updateScale = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const contentW = content.offsetWidth;
    const contentH = content.scrollHeight;
    if (contentW === 0 || contentH === 0) return;

    setScale(Math.min(cw / contentW, ch / contentH));
  }, []);

  useLayoutEffect(() => {
    updateScale();
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const ro = new ResizeObserver(updateScale);
    ro.observe(container);
    ro.observe(content);
    return () => ro.disconnect();
  }, [snapshot, reportGroups, updateScale]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden flex justify-center bg-gray-50"
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top center",
        }}
      >
        <div ref={contentRef} style={{ width: TV_CONTENT_WIDTH }}>
          <ReportContent
            preview
            columnCount={TV_COLUMN_COUNT}
            reportGroups={reportGroups}
            gregDate={gregDate}
            hebrewDate={hebrewDate}
            hebrewWeekday={hebrewWeekday}
          />
        </div>
      </div>
    </div>
  );
}
