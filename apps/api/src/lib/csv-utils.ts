import type { Response } from "express";

export function escapeCsvCell(v: string | number | null | undefined) {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvRow(cells: (string | number | null | undefined)[]) {
  return cells.map(escapeCsvCell).join(",");
}

export function sendCsv(res: Response, filename: string, rows: string[]) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(rows.join("\n"));
}

export function isoDate(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function isoDateTime(d: Date | null | undefined) {
  return d ? d.toISOString() : "";
}

export function personName(u: {
  firstName: string;
  lastName: string;
} | null | undefined) {
  if (!u) return "";
  return `${u.firstName} ${u.lastName}`.trim();
}
