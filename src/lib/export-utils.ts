/**
 * Report export helpers — CSV, Excel and PDF.
 *
 * Everything runs client-side from data already loaded by the dashboard, so an
 * export costs zero extra backend reads.
 */

export type ExportColumn<T> = { key: keyof T & string; label: string };
export type ExportTable = { title: string; columns: { key: string; label: string }[]; rows: Record<string, unknown>[] };

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  return String(v);
}

function csvCell(v: unknown): string {
  const s = cell(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(table: ExportTable): string {
  const head = table.columns.map((c) => csvCell(c.label)).join(",");
  const body = table.rows.map((r) => table.columns.map((c) => csvCell(r[c.key])).join(",")).join("\n");
  return `${head}\n${body}`;
}

function download(name: string, mime: string, content: string) {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const stamp = () => new Date().toISOString().slice(0, 10);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function exportCSV(tables: ExportTable[], filename = "scoobix-report") {
  const content = tables.map((t) => `${t.title}\n${toCSV(t)}`).join("\n\n");
  download(`${slug(filename)}-${stamp()}.csv`, "text/csv", content);
}

/** Excel-readable single-file workbook (HTML table dialect — opens in Excel,
 *  Numbers and Sheets without a heavy xlsx dependency). */
export function exportExcel(tables: ExportTable[], filename = "scoobix-report") {
  const body = tables
    .map(
      (t) => `<h3>${t.title}</h3><table border="1"><thead><tr>${t.columns
        .map((c) => `<th>${c.label}</th>`)
        .join("")}</tr></thead><tbody>${t.rows
        .map((r) => `<tr>${t.columns.map((c) => `<td>${cell(r[c.key])}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`,
    )
    .join("<br/>");
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/></head><body>${body}</body></html>`;
  download(`${slug(filename)}-${stamp()}.xls`, "application/vnd.ms-excel", html);
}

/** PDF export via the browser print pipeline (Save as PDF). */
export function exportPDF(tables: ExportTable[], filename = "scoobix-report", subtitle = "") {
  if (typeof window === "undefined") return;
  const body = tables
    .map(
      (t) => `<section><h2>${t.title}</h2><table><thead><tr>${t.columns
        .map((c) => `<th>${c.label}</th>`)
        .join("")}</tr></thead><tbody>${t.rows
        .map((r) => `<tr>${t.columns.map((c) => `<td>${cell(r[c.key])}</td>`).join("")}</tr>`)
        .join("")}</tbody></table></section>`,
    )
    .join("");
  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${filename}</title>
    <style>
      body{font-family:ui-sans-serif,system-ui,sans-serif;padding:32px;color:#111}
      h1{font-size:22px;margin:0 0 4px}
      p.sub{margin:0 0 24px;color:#666;font-size:12px}
      h2{font-size:15px;margin:24px 0 8px}
      table{border-collapse:collapse;width:100%;font-size:11px}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
      th{background:#f5f5f5}
      section{page-break-inside:avoid}
    </style></head><body>
    <h1>${filename}</h1><p class="sub">${subtitle || `Generated ${new Date().toLocaleString()}`}</p>
    ${body}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export function exportReport(
  format: "csv" | "excel" | "pdf",
  tables: ExportTable[],
  filename: string,
  subtitle?: string,
) {
  if (format === "csv") return exportCSV(tables, filename);
  if (format === "excel") return exportExcel(tables, filename);
  return exportPDF(tables, filename, subtitle);
}
