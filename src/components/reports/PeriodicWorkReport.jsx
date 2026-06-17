import { useMemo, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronsUpDown,
  Download,
  Loader2,
  FileSpreadsheet,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import { format, subMonths } from "date-fns";
import { useWorkByWorkplaceReport } from "@/queries/reports/useWorkByWorkplaceReport";
import { useWorkplaces } from "@/queries/reports/useWorkplaces";

const MONTHS = [
  { value: "01", label: "ינואר" },
  { value: "02", label: "פברואר" },
  { value: "03", label: "מרץ" },
  { value: "04", label: "אפריל" },
  { value: "05", label: "מאי" },
  { value: "06", label: "יוני" },
  { value: "07", label: "יולי" },
  { value: "08", label: "אוגוסט" },
  { value: "09", label: "ספטמבר" },
  { value: "10", label: "אוקטובר" },
  { value: "11", label: "נובמבר" },
  { value: "12", label: "דצמבר" },
];

const YEARS = ["2026", "2025"];

function previousMonthDefaults() {
  const prev = subMonths(new Date(), 1);
  return {
    month: format(prev, "MM"),
    year: format(prev, "yyyy"),
  };
}

function monthDateRange(year, month) {
  const startDate = `${year}-${month}-01`;
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  const endDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
  return { startDate, endDate };
}

export default function PeriodicWorkReport() {
  const [month, setMonth] = useState(() => previousMonthDefaults().month);
  const [year, setYear] = useState(() => previousMonthDefaults().year);
  const [exporting, setExporting] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [selectedFarms, setSelectedFarms] = useState([]); // multi-select
  const [farmOpen, setFarmOpen] = useState(false);
  const reportRef = useRef(null);

  const { startDate, endDate } = useMemo(
    () => monthDateRange(year, month),
    [year, month],
  );

  const { farmNames } = useWorkplaces(); // unique farm names for filter

  const { data, isLoading } = useWorkByWorkplaceReport({
    startDate,
    endDate,
    farms: selectedFarms.length > 0 ? selectedFarms : undefined,
    groupBy: "farm",
  });

  const groups = data?.groups ?? [];

  const toggleFarm = (farm) => {
    setSelectedFarms((prev) =>
      prev.includes(farm) ? prev.filter((f) => f !== farm) : [...prev, farm],
    );
  };

  const formatDate = (d) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const handleExportPDF = async () => {
    setExporting(true);
    await new Promise((r) => setTimeout(r, 100));
    const el = reportRef.current;
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const printW = pageW - margin * 2;
    const maxImgH = pageH - margin * 2;

    const sections = Array.from(el.children);
    let firstPage = true;
    for (const section of sections) {
      const canvas = await html2canvas(section, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const pxPerMM = canvas.width / printW;
      const pageHeightPx = maxImgH * pxPerMM;
      let srcY = 0;
      while (srcY < canvas.height) {
        const sliceH = Math.min(pageHeightPx, canvas.height - srcY);
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
          slice.toDataURL("image/jpeg", 0.88),
          "JPEG",
          margin,
          margin,
          printW,
          sliceH / pxPerMM,
        );
        srcY += sliceH;
        firstPage = false;
      }
    }
    pdf.save(`דוח_עבודה_תקופתי_${month}_${year}.pdf`);
    setExporting(false);
  };

  const handleExportXLSX = () => {
    setExportingXlsx(true);
    const rows = [];
    groups.forEach((group) => {
      const farm = group.farmName;
      const farmRows = group.rows;
      farmRows.forEach((r) =>
        rows.push({
          משק: farm,
          תאריך: formatDate(r.date),
          "מקום עבודה": r.workplaceName,
          תעריף: r.rate,
          "תשלום נוסף": r.bonus,
          "כמות תלמידים": r.studentCount,
          "סך שעות": r.totalHours,
          "ממוצע שעות": r.avgHours,
          מחיר: r.totalPrice,
        }),
      );
      rows.push({
        משק: "",
        תאריך: "",
        "מקום עבודה": 'סה"כ',
        תעריף: "",
        "תשלום נוסף": group.totals.bonus,
        "כמות תלמידים": "",
        "סך שעות": group.totals.totalHours,
        "ממוצע שעות": "",
        מחיר: group.totals.totalPrice,
      });
      rows.push({});
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "דוח חודשי");
    XLSX.writeFile(wb, `דוח_עבודה_חודשי_${month}_${year}.xlsx`);
    setExportingXlsx(false);
  };

  const monthLabel = MONTHS.find((m) => m.value === month)?.label || "";
  const hasData = groups.length > 0;
  const farmLabel =
    selectedFarms.length === 0
      ? "כל המשקים"
      : selectedFarms.length === 1
        ? selectedFarms[0]
        : `${selectedFarms.length} משקים נבחרו`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            חודש
          </label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-32 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            שנה
          </label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            משק (ניתן לבחור מרובים)
          </label>
          <Popover open={farmOpen} onOpenChange={setFarmOpen}>
            <PopoverTrigger asChild>
              <button className="h-9 w-56 border border-border rounded-md px-3 text-sm flex items-center justify-between bg-card hover:bg-secondary/40 transition-colors">
                <span
                  className={
                    selectedFarms.length === 0
                      ? "text-muted-foreground truncate"
                      : "truncate"
                  }
                >
                  {farmLabel}
                </span>
                <ChevronsUpDown
                  size={14}
                  className="opacity-50 shrink-0 mr-1"
                />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start" dir="rtl">
              <Command>
                <CommandInput
                  placeholder="חיפוש משק..."
                  className="h-8 text-xs"
                />
                <CommandList>
                  <CommandEmpty>לא נמצא</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="__all__"
                      onSelect={() => setSelectedFarms([])}
                      className="text-xs text-muted-foreground flex items-center gap-2"
                    >
                      <Checkbox
                        checked={selectedFarms.length === 0}
                        className="shrink-0"
                      />
                      כל המשקים
                    </CommandItem>
                    {farmNames.map((f) => (
                      <CommandItem
                        key={f}
                        value={f}
                        onSelect={() => toggleFarm(f)}
                        className="text-xs flex items-center gap-2"
                      >
                        <Checkbox
                          checked={selectedFarms.includes(f)}
                          className="shrink-0"
                        />
                        {f}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedFarms.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {selectedFarms.map((f) => (
                <span
                  key={f}
                  className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full"
                >
                  {f}
                  <button
                    onClick={() => toggleFarm(f)}
                    className="hover:text-destructive"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <button
                onClick={() => setSelectedFarms([])}
                className="text-xs text-muted-foreground underline px-1"
              >
                נקה
              </button>
            </div>
          )}
        </div>
        {hasData && (
          <>
            <Button onClick={handleExportPDF} disabled={exporting} size="sm">
              {exporting ? (
                <Loader2 size={14} className="animate-spin ml-1" />
              ) : (
                <Download size={14} className="ml-1" />
              )}
              הורד PDF
            </Button>
            <Button
              onClick={handleExportXLSX}
              disabled={exportingXlsx}
              size="sm"
              style={{ backgroundColor: "#166534", color: "white" }}
              className="hover:opacity-90"
            >
              {exportingXlsx ? (
                <Loader2 size={14} className="animate-spin ml-1" />
              ) : (
                <FileSpreadsheet size={14} className="ml-1" />
              )}
              הורד Excel
            </Button>
          </>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}

      {!isLoading && (
        <div
          ref={reportRef}
          className="bg-white p-4 rounded-xl border border-border space-y-6"
          dir="rtl"
        >
          {!hasData ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              אין נתונים לתקופה זו
            </p>
          ) : (
            groups.map((group) => {
              const farm = group.farmName;
              const rows = group.rows;
              return (
                <div key={farm}>
                  <div className="mb-2">
                    <p className="text-sm font-bold">לכבוד: {farm}</p>
                    <p className="text-xs text-gray-500">
                      דוח עבודה תקופתי — {monthLabel} {year}
                    </p>
                  </div>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        {[
                          "תאריך",
                          "שם מקום עבודה",
                          "תעריף",
                          "תשלום נוסף",
                          "כמות תלמידים",
                          "סך שעות",
                          "ממוצע שעות",
                          "מחיר",
                        ].map((h) => (
                          <th
                            key={h}
                            className="border border-gray-300 px-2 py-1.5 text-right font-semibold"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr
                          key={i}
                          className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                        >
                          <td className="border border-gray-300 px-2 py-1.5">
                            {formatDate(r.date)}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5">
                            {r.workplaceName}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">
                            {r.rate}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">
                            {r.bonus}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">
                            {r.studentCount}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">
                            {r.totalHours}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">
                            {r.avgHours}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">
                            {r.totalPrice} ₪
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-200 font-bold">
                        <td
                          colSpan={3}
                          className="border border-gray-300 px-2 py-1.5 text-right"
                        >
                          סה"כ
                        </td>
                        <td className="border border-gray-300 px-2 py-1.5 text-center">
                          {group.totals.bonus}
                        </td>
                        <td className="border border-gray-300 px-2 py-1.5"></td>
                        <td className="border border-gray-300 px-2 py-1.5 text-center">
                          {group.totals.totalHours}
                        </td>
                        <td className="border border-gray-300 px-2 py-1.5"></td>
                        <td className="border border-gray-300 px-2 py-1.5 text-center">
                          {group.totals.totalPrice} ₪
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
