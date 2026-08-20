import { staBillingUnitForEntries } from "@frs/shared";
import type { PendingReportSummary } from "@/components/pending-approval-card";

export type PendingTaskEntry = {
  id: string;
  finalQuantity: number;
  entryType?: string;
  beginSta: string | null;
  endSta: string | null;
  locationDescription: string | null;
  symbolItemType: string | null;
  lineTypeCode?: string | null;
  lineTypeLabel?: string | null;
  taskMaster: { code: string; name: string; unit: string };
};

export type PendingTaskReportSlice = {
  report: PendingReportSummary;
  entries: PendingTaskEntry[];
};

export type PendingTaskGroup = {
  key: string;
  code: string;
  name: string;
  unit: string;
  division: string;
  project: PendingReportSummary["project"];
  totalQty: number;
  entryCount: number;
  reportCount: number;
  ageHours: number;
  ageLabel: string;
  reports: PendingTaskReportSlice[];
};

export function groupPendingReportsByTask(
  reports: PendingReportSummary[],
): PendingTaskGroup[] {
  const order: string[] = [];
  const map = new Map<string, PendingTaskGroup>();

  for (const report of reports) {
    const items = report.lineItems ?? [];
    for (const li of items) {
      const code = li.taskMaster.code;
      const key = `${report.project.id}::${code}`;
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          code,
          name: li.taskMaster.name,
          unit: li.taskMaster.unit,
          division: report.division ?? report.project.division ?? "PAVEMENT_MARKING",
          project: report.project,
          totalQty: 0,
          entryCount: 0,
          reportCount: 0,
          ageHours: report.ageHours,
          ageLabel: report.ageLabel,
          reports: [],
        };
        map.set(key, group);
        order.push(key);
      }

      let slice = group.reports.find((s) => s.report.id === report.id);
      if (!slice) {
        slice = { report, entries: [] };
        group.reports.push(slice);
        group.reportCount += 1;
      }
      slice.entries.push(li);
      group.totalQty += li.finalQuantity;
      group.entryCount += 1;
      if (report.ageHours > group.ageHours) {
        group.ageHours = report.ageHours;
        group.ageLabel = report.ageLabel;
      }
    }
  }

  return order.map((key) => {
    const group = map.get(key)!;
    const allEntries = group.reports.flatMap((s) => s.entries);
    group.unit = staBillingUnitForEntries(group.unit, allEntries);
    return group;
  });
}
