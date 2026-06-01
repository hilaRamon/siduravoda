import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Share2 } from "lucide-react";
import {
  ReportContent,
  buildLookupMaps,
  buildReportGroups,
  generatePDFBlob,
  toGregDate,
  toHebrewDate,
} from "@/components/reports/dailyReportPdf";

export default function DailyReportPDFButton({ date, assignments }) {
  const [exporting, setExporting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedOk, setPublishedOk] = useState(false);
  const hiddenRef = useRef(null);

  const { data: logisticsList = [] } = useQuery({
    queryKey: ["workplace-logistics", date],
    queryFn: () => base44.entities.WorkplaceLogistics.filter({ date }),
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: () => base44.entities.Student.list("-created_date"),
  });

  const { logisticsMap, logisticsMapByName, studentsMap } = buildLookupMaps(
    logisticsList,
    students,
  );

  const gregDate = toGregDate(date);
  const hebrewDate = toHebrewDate(date);
  const reportGroups = buildReportGroups(
    assignments,
    logisticsMap,
    logisticsMapByName,
    studentsMap,
  );

  const handleExport = async () => {
    setExporting(true);
    const blob = await generatePDFBlob(hiddenRef.current);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `סידור_עבודה_יומי_${date}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPublishedOk(false);
    const blob = await generatePDFBlob(hiddenRef.current);
    const file = new File([blob], `schedule_${date}.pdf`, {
      type: "application/pdf",
    });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const existing = await base44.entities.PublishedSchedule.list();
    await Promise.all(
      existing.map((r) => base44.entities.PublishedSchedule.delete(r.id)),
    );
    await base44.entities.PublishedSchedule.create({ date, file_url });
    setPublishedOk(true);
    setPublishing(false);
  };

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        <div className="flex gap-2">
          <Button
            onClick={handleExport}
            disabled={exporting || reportGroups.length === 0}
          >
            {exporting ? (
              <Loader2 size={16} className="animate-spin ml-2" />
            ) : (
              <Download size={16} className="ml-2" />
            )}
            {exporting ? "מייצא..." : "סידור עבודה PDF"}
          </Button>
          <Button
            onClick={handlePublish}
            disabled={publishing || reportGroups.length === 0}
            style={{ backgroundColor: "#166534", color: "white" }}
            className="hover:opacity-90"
          >
            {publishing ? (
              <Loader2 size={16} className="animate-spin ml-2" />
            ) : (
              <Share2 size={16} className="ml-2" />
            )}
            {publishing ? "מפרסם..." : "פרסום סידור"}
          </Button>
        </div>
        {publishedOk && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs">
            <span className="text-green-700 font-medium">
              ✓ הסידור פורסם בהצלחה!
            </span>
          </div>
        )}
      </div>

      <ReportContent
        forwardRef={hiddenRef}
        reportGroups={reportGroups}
        gregDate={gregDate}
        hebrewDate={hebrewDate}
        studentsMap={studentsMap}
      />
    </>
  );
}
