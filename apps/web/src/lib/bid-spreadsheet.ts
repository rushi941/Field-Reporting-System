import * as XLSX from "xlsx";
import {
  BID_IMPORT_HEADERS,
  BID_IMPORT_SAMPLE_ROWS,
  normalizeBidImportRow,
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

export function bidImportSampleCsv(): string {
  const lines = [
    BID_IMPORT_HEADERS.join(","),
    ...BID_IMPORT_SAMPLE_ROWS.map((row) =>
      row.map(escapeCsvCell).join(","),
    ),
  ];
  return lines.join("\n");
}

export function downloadBidSampleCsv(filename = "bid-items-sample.csv") {
  downloadCsvText(bidImportSampleCsv(), filename);
}

export function downloadBidSampleExcel(filename = "bid-items-sample.xlsx") {
  const data = [BID_IMPORT_HEADERS, ...BID_IMPORT_SAMPLE_ROWS];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bid Items");
  downloadWorkbook(wb, filename);
}

function isHeaderLikeRow(row: Record<string, unknown>): boolean {
  const name = String(row.name ?? "").trim().toLowerCase();
  return (
    name === "description" ||
    name === "name" ||
    name === "generic name" ||
    name === "bid item"
  );
}

export async function parseBidSpreadsheet(
  file: File,
): Promise<Record<string, unknown>[]> {
  const rawRows = await readSpreadsheetRawRows(file);
  return rawRows
    .map((row) => normalizeBidImportRow(row))
    .filter((row) => {
      const name = String(row.name ?? "").trim();
      const code = String(row.code ?? "").trim();
      if (!name || !code || isHeaderLikeRow(row)) return false;
      return true;
    });
}
