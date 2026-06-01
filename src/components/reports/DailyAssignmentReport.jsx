import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import {
  ReportContent,
  buildLookupMaps,
  buildReportGroups,
  generatePDFBlob,
  toGregDate,
  toHebrewDate,
} from "@/components/reports/dailyReportPdf";

export default function DailyAssignmentReport() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [exporting, setExporting] = useState(false);
  const hiddenRef = useRef(null);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["assignments", date],
    queryFn: () => base44.entities.Assignment.filter({ date }),
  });

  const { data: logisticsList = [] } = useQuery({
    queryKey: ["workplace-logistics", date],
    queryFn: () => base44.entities.WorkplaceLogistics.filter({ date }),
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: () => base44.entities.Student.list("-created_date"),
  });

  const { logisticsMap, logisticsMapByName, studentsMap } = useMemo(
    () => buildLookupMaps(logisticsList, students),
    [logisticsList, students],
  );

  const reportGroups = useMemo(
    () =>
      buildReportGroups(
        assignments,
        logisticsMap,
        logisticsMapByName,
        studentsMap,
      ),
    [assignments, logisticsMap, logisticsMapByName, studentsMap],
  );

  const gregDate = toGregDate(date);
  const hebrewDate = toHebrewDate(date);

  const handleExportPDF = async () => {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            תאריך
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 h-9"
          />
        </div>
        {reportGroups.length > 0 && (
          <Button onClick={handleExportPDF} disabled={exporting} size="sm">
            {exporting ? (
              <Loader2 size={14} className="animate-spin ml-1" />
            ) : (
              <Download size={14} className="ml-1" />
            )}
            {exporting ? "מייצא..." : "הורד PDF"}
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}

      {/* Hidden layout used by generatePDFBlob to render the PDF */}
      <ReportContent
        forwardRef={hiddenRef}
        reportGroups={reportGroups}
        gregDate={gregDate}
        hebrewDate={hebrewDate}
        studentsMap={studentsMap}
      />

      {!isLoading && reportGroups.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          אין שיבוצים לתאריך זה
        </p>
      )}

      {/* Screen preview — same layout as the PDF */}
      {!isLoading && reportGroups.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-border">
          <ReportContent
            reportGroups={reportGroups}
            gregDate={gregDate}
            hebrewDate={hebrewDate}
            studentsMap={studentsMap}
            preview
          />
        </div>
      )}
    </div>
  );
}
