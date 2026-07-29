import * as XLSX from "xlsx";
import {
  CLIENT_IMPORT_HEADERS,
  CLIENT_IMPORT_SAMPLE_ROWS,
  normalizeClientImportRow,
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

export function clientImportSampleCsv(): string {
  const lines = [
    CLIENT_IMPORT_HEADERS.join(","),
    ...CLIENT_IMPORT_SAMPLE_ROWS.map((row) =>
      row.map(escapeCsvCell).join(","),
    ),
  ];
  return lines.join("\n");
}

export function downloadClientSampleCsv(filename = "clients-sample.csv") {
  downloadCsvText(clientImportSampleCsv(), filename);
}

export function downloadClientSampleExcel(filename = "clients-sample.xlsx") {
  const data = [CLIENT_IMPORT_HEADERS, ...CLIENT_IMPORT_SAMPLE_ROWS];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clients");
  downloadWorkbook(wb, filename);
}

function isHeaderLikeRow(row: Record<string, unknown>): boolean {
  const name = String(row.name ?? "").trim().toLowerCase();
  return name === "name" || name === "client" || name === "customer";
}

export async function parseClientSpreadsheet(
  file: File,
): Promise<Record<string, unknown>[]> {
  const rawRows = await readSpreadsheetRawRows(file);
  return rawRows
    .map((row) => normalizeClientImportRow(row))
    .filter((row) => {
      const name = String(row.name ?? "").trim();
      if (!name || isHeaderLikeRow(row)) return false;
      return true;
    });
}
