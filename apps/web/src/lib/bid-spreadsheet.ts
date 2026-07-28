import * as XLSX from "xlsx";
import {
  BID_IMPORT_HEADERS,
  BID_IMPORT_SAMPLE_ROWS,
  normalizeBidImportRow,
} from "@frs/shared";

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
  const blob = new Blob([bidImportSampleCsv()], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadBidSampleExcel(filename = "bid-items-sample.xlsx") {
  const data = [BID_IMPORT_HEADERS, ...BID_IMPORT_SAMPLE_ROWS];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bid Items");
  XLSX.writeFile(wb, filename);
}

function parseCsvText(text: string): Record<string, unknown>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const cols =
      line.match(/("([^"]|"")*"|[^,]*)/g)?.map((c) =>
        c.replace(/^"|"$/g, "").replace(/""/g, '"').trim(),
      ) ?? line.split(",").map((c) => c.trim());
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return normalizeBidImportRow(row);
  });
}

export async function parseBidSpreadsheet(
  file: File,
): Promise<Record<string, unknown>[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") {
    return parseCsvText(await file.text());
  }

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  return json.map((row) => normalizeBidImportRow(row));
}
