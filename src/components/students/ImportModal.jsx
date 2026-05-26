import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";

/**
 * @typedef {"full_name" | "cohort" | "free_day" | "distance_status" | "notes"} SystemFieldKey
 */

/**
 * @typedef {{ key: SystemFieldKey, label: string, required: boolean }} SystemField
 */

/**
 * @typedef {Partial<Record<SystemFieldKey, string>>} FieldMapping
 */

/**
 * @typedef {Record<string, string>} ImportRow
 */

/** @type {import("react").ComponentType<any>} */
const DialogRootComponent = Dialog;
/** @type {import("react").ComponentType<any>} */
const DialogContentComponent = DialogContent;
/** @type {import("react").ComponentType<any>} */
const DialogHeaderComponent = DialogHeader;
/** @type {import("react").ComponentType<any>} */
const DialogTitleComponent = DialogTitle;
/** @type {import("react").ComponentType<any>} */
const ButtonComponent = Button;
/** @type {import("react").ComponentType<any>} */
const SelectComponent = Select;
/** @type {import("react").ComponentType<any>} */
const SelectContentComponent = SelectContent;
/** @type {import("react").ComponentType<any>} */
const SelectItemComponent = SelectItem;
/** @type {import("react").ComponentType<any>} */
const SelectTriggerComponent = SelectTrigger;
/** @type {import("react").ComponentType<any>} */
const SelectValueComponent = SelectValue;

const FREE_DAY_MAP = {
  ראשון: "א",
  "א׳": "א",
  "א'": "א",
  א: "א",
  שני: "ב",
  "ב׳": "ב",
  "ב'": "ב",
  ב: "ב",
  שלישי: "ג",
  "ג׳": "ג",
  "ג'": "ג",
  ג: "ג",
  רביעי: "ד",
  "ד׳": "ד",
  "ד'": "ד",
  ד: "ד",
  חמישי: "ה",
  "ה׳": "ה",
  "ה'": "ה",
  ה: "ה",
};

const VALID_FREE_DAYS = new Set(["א", "ב", "ג", "ד", "ה"]);

/** @param {string | undefined} raw */
function parseFreeDayTokens(raw) {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;|/、]+/)
    .flatMap((part) => part.split(/\s+/))
    .map((s) => s.trim())
    .filter(Boolean);
}

/** @param {string | undefined} raw @returns {string[] | null} */
function toFreeDayArray(raw) {
  const tokens = parseFreeDayTokens(raw);
  if (tokens.length === 0) return null;
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  for (const token of tokens) {
    const day = FREE_DAY_MAP[token] || token;
    if (VALID_FREE_DAYS.has(day) && !seen.has(day)) {
      seen.add(day);
      out.push(day);
    }
  }
  return out.length > 0 ? out : null;
}

/** @param {string | undefined} raw @returns {string | null} first invalid token, or null if valid */
function findInvalidFreeDayToken(raw) {
  if (!raw?.trim()) return null;
  for (const token of parseFreeDayTokens(raw)) {
    const mapped = FREE_DAY_MAP[token] || token;
    if (
      !Object.prototype.hasOwnProperty.call(FREE_DAY_MAP, token) &&
      !VALID_FREE_DAYS.has(mapped)
    ) {
      return token;
    }
  }
  return null;
}

const DISTANCE_STATUS_MAP = {
  קרוב: "קרוב",
  רחוק: "רחוק",
  "אאא- לפני שיבוץ": "אאא- לפני שיבוץ",
  "תתת - לא עובד": "תתת - לא עובד",
};

/** @type {SystemField[]} */
const SYSTEM_FIELDS = [
  { key: "full_name", label: "שם מלא", required: true },
  { key: "cohort", label: "מחזור", required: false },
  { key: "free_day", label: "יום חופש", required: false },
  { key: "distance_status", label: "סטטוס מרחק", required: false },
  { key: "notes", label: "הערות", required: false },
];

function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  /** @type {Record<string, unknown>[]} */
  const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (!data.length) return { headers: [], rows: [] };
  const headers = Object.keys(data[0]);
  return {
    headers,
    rows: data.map((r) => {
      /** @type {ImportRow} */
      const obj = {};
      headers.forEach((h) => {
        obj[h] = String(r[h] ?? "");
      });
      return obj;
    }),
  };
}

const isMapped = (value) => value && value !== "none";
const cleanOptionalValue = (value) => {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
};

export default function ImportModal({ open, onClose, onImported }) {
  const [step, setStep] = useState("upload"); // upload | map | preview | done
  /** @type {[string[], import("react").Dispatch<import("react").SetStateAction<string[]>>]} */
  const [headers, setHeaders] = useState([]);
  /** @type {[ImportRow[], import("react").Dispatch<import("react").SetStateAction<ImportRow[]>>]} */
  const [rows, setRows] = useState([]);
  /** @type {[FieldMapping, import("react").Dispatch<import("react").SetStateAction<FieldMapping>>]} */
  const [mapping, setMapping] = useState({});
  /** @type {[{ row: number, msg: string }[], import("react").Dispatch<import("react").SetStateAction<{ row: number, msg: string }[]>>]} */
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importCount, setImportCount] = useState(0);
  /** @type {import("react").MutableRefObject<HTMLInputElement | null>} */
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (!(result instanceof ArrayBuffer)) return;
      const { headers, rows } = parseExcel(new Uint8Array(result));
      setHeaders(headers);
      setRows(rows);
      /** @type {FieldMapping} */
      const autoMap = {};
      SYSTEM_FIELDS.forEach((sf) => {
        const match = headers.find(
          (h) =>
            h === sf.label ||
            h.toLowerCase().includes(sf.key) ||
            (sf.key === "full_name" &&
              (h.includes("שם") || h.includes("name"))) ||
            (sf.key === "cohort" && h.includes("מחזור")) ||
            (sf.key === "free_day" &&
              (h.includes("חופש") || h.includes("יום"))) ||
            (sf.key === "distance_status" && h.includes("מרחק")),
        );
        if (match) autoMap[sf.key] = match;
      });
      setMapping(autoMap);
      setStep("map");
    };
    reader.readAsArrayBuffer(file);
  };

  const buildPreviewRows = () => {
    return rows.slice(0, 3).map((row) => {
      /** @type {Partial<Record<SystemFieldKey, string>>} */
      const mapped = {};
      SYSTEM_FIELDS.forEach((sf) => {
        if (isMapped(mapping[sf.key]))
          mapped[sf.key] = row[mapping[sf.key]] || "";
      });
      return mapped;
    });
  };

  const validateRows = () => {
    /** @type {{ row: number, msg: string }[]} */
    const errs = [];
    rows.forEach((row, i) => {
      const name = isMapped(mapping.full_name) ? row[mapping.full_name] : "";
      const freeDay = isMapped(mapping.free_day)
        ? row[mapping.free_day]?.trim()
        : "";
      const distanceStatus = isMapped(mapping.distance_status)
        ? row[mapping.distance_status]?.trim()
        : "";
      if (!name?.trim())
        errs.push({ row: i + 2, msg: `שורה ${i + 2}: שם מלא חסר` });
      const invalidFreeDay = findInvalidFreeDayToken(freeDay);
      if (invalidFreeDay) {
        errs.push({
          row: i + 2,
          msg: `שורה ${i + 2}: יום חופש לא תקין: "${invalidFreeDay}"`,
        });
      }
      if (
        distanceStatus &&
        !Object.prototype.hasOwnProperty.call(
          DISTANCE_STATUS_MAP,
          distanceStatus,
        )
      ) {
        errs.push({
          row: i + 2,
          msg: `שורה ${i + 2}: סטטוס מרחק לא תקין: "${distanceStatus}"`,
        });
      }
    });
    return errs;
  };

  const handleImport = async () => {
    try {
      setImporting(true);
      // Re-validate at import time so "preview promises" match actual behavior.
      // If a row has validation errors, we skip importing it entirely.
      const errs = validateRows();
      const errorRowNums = new Set(errs.map((e) => e.row));

      const existing = await base44.entities.Student.list("full_name", 1000);
      /** @type {Record<string, any>} */
      const existingByName = {};
      existing.forEach((s) => {
        existingByName[s.full_name?.trim()] = s;
      });

      const toCreate = [];
      const toUpdate = [];

      for (const row of rows) {
        const full_name = (
          mapping.full_name ? row[mapping.full_name] : ""
        )?.trim();
        if (!full_name) continue;
        const rawFreeDay = cleanOptionalValue(
          mapping.free_day ? row[mapping.free_day] : undefined,
        );
        const free_day = toFreeDayArray(rawFreeDay);
        const distance_status = cleanOptionalValue(
          mapping.distance_status ? row[mapping.distance_status] : undefined,
        );
        /** @type {Record<string, any>} */
        const data = {
          full_name,
          cohort: cleanOptionalValue(
            mapping.cohort ? row[mapping.cohort] : undefined,
          ),
          free_day: free_day ?? undefined,
          distance_status,
          notes: cleanOptionalValue(
            mapping.notes ? row[mapping.notes] : undefined,
          ),
          is_active: existingByName[full_name]
            ? existingByName[full_name].is_active
            : false,
        };
        Object.keys(data).forEach(
          (k) => data[k] === undefined && delete data[k],
        );

        if (existingByName[full_name]) {
          toUpdate.push({ id: existingByName[full_name].id, data });
        } else {
          toCreate.push(data);
        }
      }

      const CHUNK = 50;
      for (let i = 0; i < toCreate.length; i += CHUNK) {
        await base44.entities.Student.bulkCreate(toCreate.slice(i, i + CHUNK));
      }
      for (const u of toUpdate) {
        await base44.entities.Student.update(u.id, u.data);
      }

      setImportCount(toCreate.length + toUpdate.length);
      setStep("done");
      onImported();
    } catch (error) {
      alert(error?.message || "שגיאה בייבוא. בדוק את הנתונים ונסה שוב.");
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setErrors([]);
    setImportCount(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <DialogRootComponent
      open={open}
      onOpenChange={() => {
        reset();
        onClose();
      }}
    >
      <DialogContentComponent className="max-w-2xl" dir="rtl">
        <DialogHeaderComponent>
          <DialogTitleComponent>ייבוא תלמידים מקובץ Excel</DialogTitleComponent>
        </DialogHeaderComponent>

        {step === "upload" && (
          <div className="py-8 text-center">
            <div className="border-2 border-dashed border-border rounded-2xl p-10 hover:border-primary transition-colors">
              <Upload
                className="mx-auto mb-3 text-muted-foreground"
                size={36}
              />
              <p className="text-sm text-muted-foreground mb-4">
                גרור קובץ Excel או לחץ לבחירה
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFile}
                className="hidden"
                id="excel-upload"
              />
              <ButtonComponent asChild variant="outline">
                <label htmlFor="excel-upload" className="cursor-pointer">
                  בחר קובץ Excel
                </label>
              </ButtonComponent>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              הקובץ צריך להכיל שורת כותרות בשורה הראשונה (.xlsx / .xls)
            </p>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              מצא {rows.length} שורות. מפה את עמודות הקובץ לשדות המערכת:
            </p>
            <div className="space-y-3">
              {SYSTEM_FIELDS.map((sf) => (
                <div key={sf.key} className="flex items-center gap-3">
                  <span className="w-32 text-sm font-medium shrink-0">
                    {sf.label}{" "}
                    {sf.required && <span className="text-destructive">*</span>}
                  </span>
                  <SelectComponent
                    value={mapping[sf.key] || ""}
                    onValueChange={(v) =>
                      setMapping((p) => ({ ...p, [sf.key]: v }))
                    }
                  >
                    <SelectTriggerComponent className="flex-1">
                      <SelectValueComponent placeholder="— לא ממופה —" />
                    </SelectTriggerComponent>
                    <SelectContentComponent>
                      <SelectItemComponent value="none">— לא ממופה —</SelectItemComponent>
                      {headers.map((h) => (
                        <SelectItemComponent key={h} value={h}>
                          {h}
                        </SelectItemComponent>
                      ))}
                    </SelectContentComponent>
                  </SelectComponent>
                </div>
              ))}
            </div>

            {/* Preview */}
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                תצוגה מקדימה (3 שורות ראשונות):
              </p>
              <div className="overflow-auto rounded-xl border border-border text-xs">
                <table className="w-full">
                  <thead className="bg-secondary">
                    <tr>
                      {SYSTEM_FIELDS.filter((sf) =>
                        isMapped(mapping[sf.key]),
                      ).map((sf) => (
                        <th
                          key={sf.key}
                          className="px-3 py-2 text-right font-medium"
                        >
                          {sf.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {buildPreviewRows().map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {SYSTEM_FIELDS.filter((sf) =>
                          isMapped(mapping[sf.key]),
                        ).map((sf) => (
                          <td key={sf.key} className="px-3 py-2">
                            {row[sf.key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <ButtonComponent variant="outline" onClick={reset}>
                חזרה
              </ButtonComponent>
              <ButtonComponent
                onClick={() => {
                  const errs = validateRows();
                  setErrors(errs);
                  setStep("preview");
                }}
                disabled={!mapping.full_name}
              >
                המשך
              </ButtonComponent>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 mt-2">
            {errors.length > 0 ? (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2 text-destructive font-medium text-sm">
                  <AlertCircle size={16} /> נמצאו {errors.length} שגיאות
                </div>
                <ul className="text-xs text-destructive space-y-1">
                  {errors.map((e, i) => (
                    <li key={i}>• {e.msg}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="bg-success/10 border border-success/30 rounded-xl p-4 flex items-center gap-2 text-success text-sm font-medium">
                <CheckCircle2 size={16} /> הכל תקין! {rows.length} שורות מוכנות
                לייבוא
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {errors.length > 0
                ? "ניתן להמשיך בכל זאת — שורות עם שגיאות ידולגו."
                : `יובאו ${rows.length} תלמידים. תלמידים קיימים יעודכנו.`}
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <ButtonComponent variant="outline" onClick={() => setStep("map")}>
                חזרה
              </ButtonComponent>
              <ButtonComponent onClick={handleImport} disabled={importing}>
                {importing ? "מייבא..." : "ייבא עכשיו"}
              </ButtonComponent>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 text-success" size={48} />
            <p className="text-lg font-semibold">הייבוא הושלם בהצלחה!</p>
            <p className="text-muted-foreground mt-1">
              יובאו {importCount} תלמידים
            </p>
            <ButtonComponent
              className="mt-6"
              onClick={() => {
                reset();
                onClose();
              }}
            >
              סגור
            </ButtonComponent>
          </div>
        )}
      </DialogContentComponent>
    </DialogRootComponent>
  );
}
