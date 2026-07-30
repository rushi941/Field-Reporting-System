import { prisma } from "@frs/db";
import type { Prisma } from "@frs/db";
import { AppError } from "./app-error.js";
import { buildBillingDetailCsv } from "./billing-csv.js";
import type { BillingProject, BillingReport } from "./billing-export-data.js";
import { csvRow, isoDate, isoDateTime, personName } from "./csv-utils.js";

const reportExportInclude = {
  submittedBy: {
    select: { firstName: true, lastName: true, email: true },
  },
  approvedBy: {
    select: { firstName: true, lastName: true, email: true },
  },
  lineItems: {
    include: {
      projectTask: {
        include: {
          taskMaster: {
            select: { code: true, name: true, unit: true, division: true },
          },
        },
      },
    },
    orderBy: { sortOrder: "asc" as const },
  },
  attachments: {
    orderBy: { uploadedAt: "desc" as const },
  },
} as const;

type WorkspaceReport = Prisma.ReportGetPayload<{
  include: typeof reportExportInclude;
}>;

const projectSelect = {
  id: true,
  jobNumber: true,
  name: true,
  location: true,
  division: true,
  clientName: true,
  generalContractor: true,
  contractAmount: true,
  startDate: true,
  endDate: true,
  notes: true,
} as const;

export type WorkspaceExportProject = Prisma.ProjectGetPayload<{
  select: typeof projectSelect;
}>;

export async function loadWorkspaceProjectForExport(
  projectId: string,
  scope: Prisma.ProjectWhereInput,
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...scope },
    select: projectSelect,
  });
  if (!project) throw new AppError("NOT_FOUND", "Project not found", 404);
  return project;
}

export async function loadWorkspaceReportsForExport(projectId: string) {
  return prisma.report.findMany({
    where: { projectId },
    include: reportExportInclude,
    orderBy: [{ reportDate: "desc" }, { reportNumber: "desc" }],
  });
}

export async function loadWorkspaceReportForExport(
  projectId: string,
  reportId: string,
) {
  const report = await prisma.report.findFirst({
    where: { projectId, id: reportId },
    include: reportExportInclude,
  });
  if (!report) throw new AppError("NOT_FOUND", "Report not found", 404);
  return report;
}

/** All field reports for a project — any status */
export function buildWorkspaceReportsLogCsv(
  project: WorkspaceExportProject,
  reports: WorkspaceReport[],
) {
  const headers = [
    "JobNumber",
    "ProjectName",
    "Client",
    "GeneralContractor",
    "Location",
    "Division",
    "ReportNumber",
    "ReportDate",
    "Status",
    "CrewSize",
    "FieldLead",
    "FieldLeadEmail",
    "ApprovedBy",
    "ApprovedDate",
    "SubmittedAt",
    "ReturnedAt",
    "LineItemCount",
    "AttachmentCount",
    "FieldNotes",
    "ReturnComment",
    "ApprovalNotes",
  ];

  const rows: string[] = [headers.join(",")];
  for (const r of reports) {
    rows.push(
      csvRow([
        project.jobNumber,
        project.name,
        project.clientName ?? "",
        project.generalContractor ?? "",
        project.location ?? "",
        project.division,
        r.reportNumber,
        isoDate(r.reportDate),
        r.status,
        r.crewSize ?? "",
        personName(r.submittedBy),
        r.submittedBy.email,
        personName(r.approvedBy),
        isoDateTime(r.approvedAt),
        isoDateTime(r.submittedAt),
        isoDateTime(r.returnedAt),
        r.lineItems.length,
        r.attachments.length,
        r.notes ?? "",
        r.returnComment ?? "",
        r.approvalNotes ?? "",
      ]),
    );
  }
  return rows;
}

export function buildWorkspaceAttachmentsCsv(
  project: WorkspaceExportProject,
  reports: WorkspaceReport[],
) {
  const headers = [
    "JobNumber",
    "ProjectName",
    "ReportNumber",
    "ReportDate",
    "ReportStatus",
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
          project.jobNumber,
          project.name,
          r.reportNumber,
          isoDate(r.reportDate),
          r.status,
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

export function buildWorkspaceSingleReportCsv(
  project: WorkspaceExportProject,
  report: WorkspaceReport,
) {
  return buildBillingDetailCsv(
    project as BillingProject,
    [report as BillingReport],
  );
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

/** Full project reports backup — job info, report log, line detail, attachments */
export function buildWorkspacePackageCsv(
  project: WorkspaceExportProject,
  reports: WorkspaceReport[],
) {
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
      "TotalReports",
    ]),
  );
  rows.push(
    csvRow([
      project.jobNumber,
      project.name,
      project.clientName ?? "",
      project.generalContractor ?? "",
      project.location ?? "",
      project.division,
      project.contractAmount != null ? Number(project.contractAmount) : "",
      isoDate(project.startDate),
      isoDate(project.endDate),
      reports.length,
    ]),
  );
  rows.push("");

  appendCsvSection(
    rows,
    "FIELD REPORTS LOG",
    buildWorkspaceReportsLogCsv(project, reports),
  );
  appendCsvSection(
    rows,
    "LINE DETAIL",
    buildBillingDetailCsv(
      project as BillingProject,
      reports as BillingReport[],
    ),
  );
  appendCsvSection(
    rows,
    "ATTACHMENTS",
    buildWorkspaceAttachmentsCsv(project, reports),
  );

  return rows;
}
