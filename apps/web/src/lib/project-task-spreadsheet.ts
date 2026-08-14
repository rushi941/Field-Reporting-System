import * as XLSX from "xlsx";
import {
  PROJECT_TASK_IMPORT_HEADERS,
  PROJECT_TASK_IMPORT_SAMPLE_ROWS,
  normalizeProjectTaskImportRow,
} from "@frs/shared";
import {
  downloadCsvText,
  downloadWorkbook,
  readSpreadsheetRawRows,
} from "./spreadsheet-utils";

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function projectTaskImportSampleCsv(): string {
  const lines = [
    PROJECT_TASK_IMPORT_HEADERS.join(","),
    ...PROJECT_TASK_IMPORT_SAMPLE_ROWS.map((row) =>
      row.map(escapeCsvCell).join(","),
    ),
  ];
  return lines.join("\n");
}

export function downloadProjectTaskSampleCsv(
  filename = "project-tasks-sample.csv",
) {
  downloadCsvText(projectTaskImportSampleCsv(), filename);
}

export function downloadProjectTaskSampleExcel(
  filename = "project-tasks-sample.xlsx",
) {
  const data = [PROJECT_TASK_IMPORT_HEADERS, ...PROJECT_TASK_IMPORT_SAMPLE_ROWS];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tasks");
  downloadWorkbook(wb, filename);
}

function isHeaderLikeRow(row: Record<string, unknown>): boolean {
  const sub = String(row.subBidCode ?? row.code ?? "").trim().toLowerCase();
  return sub === "subbidcode" || sub === "code";
}

export async function parseProjectTaskSpreadsheet(
  file: File,
): Promise<Record<string, unknown>[]> {
  const rawRows = await readSpreadsheetRawRows(file);
  return rawRows
    .map((row) => normalizeProjectTaskImportRow(row))
    .filter((row) => {
      const sub = String(row.subBidCode ?? row.code ?? "").trim();
      const name = String(row.name ?? "").trim();
      if (isHeaderLikeRow(row)) return false;
      if (sub) return true;
      return Boolean(name);
    });
}
