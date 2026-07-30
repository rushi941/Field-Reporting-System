import {
  csvRow,
  isoDate,
  isoDateTime,
  personName,
} from "./csv-utils.js";
import type { BillingProject, BillingReport } from "./billing-export-data.js";

function projectMeta(project: BillingProject) {
  return {
    jobNumber: project.jobNumber,
    projectName: project.name,
    client: project.clientName ?? "",
    generalContractor: project.generalContractor ?? "",
    location: project.location ?? "",
    division: project.division,
    contractAmount:
      project.contractAmount != null ? Number(project.contractAmount) : "",
    startDate: isoDate(project.startDate),
    endDate: isoDate(project.endDate),
  };
}

/** Pay-app line detail — every approved quantity line with job + report context */
export function buildBillingDetailCsv(
  project: BillingProject,
  reports: BillingReport[],
) {
  const meta = projectMeta(project);
  const headers = [
    "JobNumber",
    "ProjectName",
    "Client",
    "GeneralContractor",
    "Location",
    "Division",
    "ContractAmount",
    "ProjectStart",
    "ProjectEnd",
    "ReportNumber",
    "ReportDate",
    "ReportStatus",
    "CrewSize",
    "FieldNotes",
    "FieldLead",
    "FieldLeadEmail",
    "ApprovedBy",
    "ApprovedDate",
    "ApprovalNotes",
    "LineCode",
    "LineDescription",
    "Unit",
    "Quantity",
    "EntryType",
    "BeginSTA",
    "EndSTA",
    "LocationDescription",
    "SymbolItemType",
  ];

  const rows: string[] = [headers.join(",")];
  for (const r of reports) {
    const lead = personName(r.submittedBy);
    for (const li of r.lineItems) {
      const tm = li.projectTask.taskMaster;
      rows.push(
        csvRow([
          meta.jobNumber,
          meta.projectName,
          meta.client,
          meta.generalContractor,
          meta.location,
          meta.division,
          meta.contractAmount,
          meta.startDate,
          meta.endDate,
          r.reportNumber,
          isoDate(r.reportDate),
          r.status,
          r.crewSize ?? "",
          r.notes ?? "",
          lead,
          r.submittedBy.email,
          personName(r.approvedBy),
          isoDateTime(r.approvedAt),
          r.approvalNotes ?? "",
          tm.code,
          tm.name,
          tm.unit,
          Number(li.finalQuantity),
          li.entryType,
          li.beginSta,
          li.endSta,
          li.locationDescription,
          li.symbolItemType,
        ]),
      );
    }
  }
  return rows;
}

/** Quantity summary by bid item — typical pay-app quantity tab */
export function buildBillingSummaryCsv(
  project: BillingProject,
  reports: BillingReport[],
) {
  const meta = projectMeta(project);
  const totals = new Map<
    string,
    { code: string; name: string; unit: string; quantity: number }
  >();

  for (const r of reports) {
    for (const li of r.lineItems) {
      const tm = li.projectTask.taskMaster;
      const prev = totals.get(tm.code);
      const qty = Number(li.finalQuantity);
      if (prev) prev.quantity += qty;
      else {
        totals.set(tm.code, {
          code: tm.code,
          name: tm.name,
          unit: tm.unit,
          quantity: qty,
        });
      }
    }
  }

  const headers = [
    "JobNumber",
    "ProjectName",
    "Client",
    "GeneralContractor",
    "Location",
    "LineCode",
    "LineDescription",
    "Unit",
    "TotalQuantityApproved",
  ];

  const rows: string[] = [headers.join(",")];
  for (const item of [...totals.values()].sort((a, b) =>
    a.code.localeCompare(b.code),
  )) {
    rows.push(
      csvRow([
        meta.jobNumber,
        meta.projectName,
        meta.client,
        meta.generalContractor,
        meta.location,
        item.code,
        item.name,
        item.unit,
        item.quantity,
      ]),
    );
  }
  return rows;
}

/** Daily report log — one row per approved field report */
export function buildBillingReportsLogCsv(
  project: BillingProject,
  reports: BillingReport[],
) {
  const meta = projectMeta(project);
  const headers = [
    "JobNumber",
    "ProjectName",
    "Client",
    "GeneralContractor",
    "ReportNumber",
    "ReportDate",
    "Status",
    "CrewSize",
    "FieldLead",
    "FieldLeadEmail",
    "ApprovedBy",
    "ApprovedDate",
    "LineItemCount",
    "AttachmentCount",
    "FieldNotes",
    "ApprovalNotes",
  ];

  const rows: string[] = [headers.join(",")];
  for (const r of reports) {
    rows.push(
      csvRow([
        meta.jobNumber,
        meta.projectName,
        meta.client,
        meta.generalContractor,
        r.reportNumber,
        isoDate(r.reportDate),
        r.status,
        r.crewSize ?? "",
        personName(r.submittedBy),
        r.submittedBy.email,
        personName(r.approvedBy),
        isoDateTime(r.approvedAt),
        r.lineItems.length,
        r.attachments.length,
        r.notes ?? "",
        r.approvalNotes ?? "",
      ]),
    );
  }
  return rows;
}

/** Attachment manifest for pay-app backup package */
export function buildBillingAttachmentsCsv(
  project: BillingProject,
  reports: BillingReport[],
) {
  const meta = projectMeta(project);
  const headers = [
    "JobNumber",
    "ProjectName",
    "ReportNumber",
    "ReportDate",
    "FileName",
    "Category",
    "FileType",
    "UploadedAt",
    "DownloadURL",
  ];

  const rows: string[] = [headers.join(",")];
  for (const r of reports) {
    for (const a of r.attachments) {
      rows.push(
        csvRow([
          meta.jobNumber,
          meta.projectName,
          r.reportNumber,
          isoDate(r.reportDate),
          a.fileName,
          a.category,
          a.fileType,
          isoDateTime(a.uploadedAt),
          a.storageUrl,
        ]),
      );
    }
  }
  return rows;
}

/** Single report detail export */
export function buildSingleReportCsv(
  project: BillingProject,
  report: BillingReport,
) {
  return buildBillingDetailCsv(project, [report]);
}

function csvSectionTitle(title: string) {
  return csvRow([`=== ${title} ===`]);
}

function appendCsvSection(
  rows: string[],
  title: string,
  sectionRows: string[],
) {
  rows.push(csvSectionTitle(title));
  rows.push(...sectionRows);
  rows.push("");
}

/** Full pay-app backup — job info, summary, reports, line detail, attachments in one file */
export function buildBillingPackageCsv(
  project: BillingProject,
  reports: BillingReport[],
) {
  const meta = projectMeta(project);
  const rows: string[] = [];

  rows.push(csvSectionTitle("JOB INFORMATION"));
  rows.push(
    csvRow([
      "JobNumber",
      "ProjectName",
      "Client",
      "GeneralContractor",
      "Location",
      "Division",
      "ContractAmount",
      "ProjectStart",
      "ProjectEnd",
      "ApprovedReportCount",
    ]),
  );
  rows.push(
    csvRow([
      meta.jobNumber,
      meta.projectName,
      meta.client,
      meta.generalContractor,
      meta.location,
      meta.division,
      meta.contractAmount,
      meta.startDate,
      meta.endDate,
      reports.length,
    ]),
  );
  rows.push("");

  appendCsvSection(
    rows,
    "QUANTITY SUMMARY",
    buildBillingSummaryCsv(project, reports),
  );
  appendCsvSection(
    rows,
    "DAILY REPORTS LOG",
    buildBillingReportsLogCsv(project, reports),
  );
  appendCsvSection(rows, "LINE DETAIL", buildBillingDetailCsv(project, reports));
  appendCsvSection(
    rows,
    "ATTACHMENTS",
    buildBillingAttachmentsCsv(project, reports),
  );

  return rows;
}
