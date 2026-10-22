// Excel workbook helpers. Keep in sync with src/lib/excel.js.

export function markWorkbookRtl(wb) {
  const views = wb.Workbook?.Views ?? [{}];
  views[0] = { ...views[0], RTL: true };
  wb.Workbook = { ...(wb.Workbook || {}), Views: views };
  return wb;
}
