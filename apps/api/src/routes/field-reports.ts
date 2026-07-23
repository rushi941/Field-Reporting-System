import { Router } from "express";
import multer from "multer";
import {
  prisma,
  type LineEntryType,
  type QuantitySource,
  type ReportStatus,
  Prisma,
} from "@frs/db";
import {
  attachmentUploadMeta,
  resolveStaSegment,
  singleLocationSegmentSchema,
  staRangeSegmentSchema,
  updateDraftReportSchema,
  upsertDraftReportSchema,
  validateAttachmentFile,
  validateStaSegmentsCoverage,
  resolveStaWorkLimits,
} from "@frs/shared";
import { AppError } from "../lib/app-error.js";
import { fetchCompletedStaRanges } from "../lib/sta-coverage.js";
import { asyncHandler } from "../lib/async-handler.js";
import { routeParam } from "../lib/route-param.js";
import { storeUpload } from "../lib/storage.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/require-permission.js";

export const fieldReportsRouter = Router();

fieldReportsRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: attachmentUploadMeta.maxBytes },
});


const reportInclude = {
  project: {
    select: {
      id: true,
      jobNumber: true,
      name: true,
      location: true,
      clientName: true,
      division: true,
    },
  },
  approvedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  /** Latest return action — who sent it back (no returnedById column yet) */
  auditLogs: {
    where: { action: "RETURNED" as const },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  },
  lineItems: {
    include: {
      projectTask: {
        include: {
          taskMaster: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true,
              formType: true,
              color: true,
              widthInches: true,
              conversionFactor: true,
            },
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

type ReportLoaded = Prisma.ReportGetPayload<{ include: typeof reportInclude }>;

function mapPerson(
  u: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null | undefined,
) {
  if (!u) return null;
  return {
    id: u.id,
    name: `${u.firstName} ${u.lastName}`.trim(),
    email: u.email,
  };
}

function mapLine(item: ReportLoaded["lineItems"][number]) {
  return {
    id: item.id,
    projectTaskId: item.projectTaskId,
    entryType: item.entryType,
    quantitySource: item.quantitySource,
    beginSta: item.beginSta,
    endSta: item.endSta,
    conversionFactor:
      item.conversionFactor != null ? Number(item.conversionFactor) : null,
    calculatedLf:
      item.calculatedLf != null ? Number(item.calculatedLf) : null,
    manualLf: item.manualLf != null ? Number(item.manualLf) : null,
    finalQuantity: Number(item.finalQuantity),
    locationDescription: item.locationDescription,
    symbolItemType: item.symbolItemType,
    sortOrder: item.sortOrder,
    projectTask: {
      id: item.projectTask.id,
      taskMaster: {
        ...item.projectTask.taskMaster,
        conversionFactor:
          item.projectTask.taskMaster.conversionFactor != null
            ? Number(item.projectTask.taskMaster.conversionFactor)
            : null,
      },
    },
  };
}

function mapReport(report: ReportLoaded) {
  const returnAudit = report.auditLogs[0];
  return {
    id: report.id,
    reportNumber: report.reportNumber,
    projectId: report.projectId,
    reportDate: report.reportDate.toISOString().slice(0, 10),
    status: report.status,
    division: report.division,
    crewSize: report.crewSize,
    notes: report.notes,
    returnComment: report.returnComment,
    approvalNotes: report.approvalNotes,
    submittedAt: report.submittedAt,
    approvedAt: report.approvedAt,
    returnedAt: report.returnedAt,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    /** Manager who approved (set when manager clicks Approve) */
    approvedBy: mapPerson(report.approvedBy),
    /** Manager who returned (from RETURNED audit) */
    returnedBy:
      report.status === "RETURNED" ? mapPerson(returnAudit?.user) : null,
    project: report.project,
    lineItems: report.lineItems.map(mapLine),
    attachments: report.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileType: a.fileType,
      category: a.category,
      storageUrl: a.storageUrl,
      uploadedAt: a.uploadedAt,
    })),
    totalsByTask: (() => {
      const map = new Map<string, number>();
      for (const li of report.lineItems) {
        const prev = map.get(li.projectTaskId) ?? 0;
        map.set(li.projectTaskId, prev + Number(li.finalQuantity));
      }
      return Object.fromEntries(map);
    })(),
  };
}

async function nextReportNumber() {
  const date = new Date();
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const prefix = `R-${y}${m}${d}-`;
  const latest = await prisma.report.findFirst({
    where: { reportNumber: { startsWith: prefix } },
    orderBy: { reportNumber: "desc" },
    select: { reportNumber: true },
  });
  const seq = latest
    ? Number(latest.reportNumber.slice(prefix.length)) + 1
    : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

function parseReportDate(value: string): Date {
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new AppError("VALIDATION_ERROR", "Invalid report date", 400);
  }
  return d;
}

function assertEditable(status: ReportStatus) {
  if (status !== "DRAFT" && status !== "RETURNED") {
    throw new AppError(
      "CONFLICT",
      "Report is locked and cannot be edited",
      409,
    );
  }
}

/** List my reports (draft / returned first) */
fieldReportsRouter.get(
  "/summary",
  requirePermission("reports.submit"),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const reports = await prisma.report.findMany({
      where: {
        submittedById: userId,
        status: { in: ["RETURNED", "APPROVED", "APPROVED_WITH_NOTES"] },
      },
      select: {
        id: true,
        status: true,
        returnedAt: true,
        approvedAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    res.json({ reports });
  }),
);

/** List my reports (draft / returned first) */
fieldReportsRouter.get(
  "/",
  requirePermission("reports.submit"),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const reports = await prisma.report.findMany({
      where: { submittedById: userId },
      include: reportInclude,
      orderBy: [{ reportDate: "desc" }, { updatedAt: "desc" }],
      take: 50,
    });
    res.json({ reports: reports.map(mapReport) });
  }),
);

/** Get or create today's draft for a project */
fieldReportsRouter.post(
  "/draft",
  requirePermission("reports.edit_draft"),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const body = upsertDraftReportSchema.parse(req.body);
    const reportDate = parseReportDate(body.reportDate);

    const project = await prisma.project.findFirst({
      where: {
        id: body.projectId,
        status: "ACTIVE",
        tasks: { some: { isActive: true, assignedToId: userId } },
      },
    });
    if (!project) {
      throw new AppError(
        "NOT_FOUND",
        "Project not found or no tasks assigned to you",
        404,
      );
    }

    const existing = await prisma.report.findFirst({
      where: {
        projectId: body.projectId,
        submittedById: userId,
        reportDate,
        status: { in: ["DRAFT", "RETURNED"] },
      },
      include: reportInclude,
    });

    if (existing) {
      if (
        body.crewSize !== undefined ||
        body.notes !== undefined
      ) {
        const updated = await prisma.report.update({
          where: { id: existing.id },
          data: {
            ...(body.crewSize !== undefined ? { crewSize: body.crewSize } : {}),
            ...(body.notes !== undefined ? { notes: body.notes } : {}),
          },
          include: reportInclude,
        });
        return res.json({ report: mapReport(updated) });
      }
      return res.json({ report: mapReport(existing) });
    }

    const report = await prisma.report.create({
      data: {
        reportNumber: await nextReportNumber(),
        projectId: project.id,
        reportDate,
        submittedById: userId,
        division: project.division,
        crewSize: body.crewSize ?? null,
        notes: body.notes ?? null,
        status: "DRAFT",
      },
      include: reportInclude,
    });

    await prisma.auditLog.create({
      data: {
        reportId: report.id,
        userId,
        action: "CREATED",
        comment: "Draft daily report created",
      },
    });

    res.status(201).json({ report: mapReport(report) });
  }),
);

fieldReportsRouter.get(
  "/:id",
  requirePermission("reports.submit"),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const report = await prisma.report.findUnique({
      where: { id },
      include: reportInclude,
    });
    if (!report || report.submittedById !== req.user!.id) {
      throw new AppError("NOT_FOUND", "Report not found", 404);
    }
    res.json({ report: mapReport(report) });
  }),
);

fieldReportsRouter.patch(
  "/:id",
  requirePermission("reports.edit_draft"),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const body = updateDraftReportSchema.parse(req.body);
    const existing = await prisma.report.findUnique({ where: { id } });
    if (!existing || existing.submittedById !== req.user!.id) {
      throw new AppError("NOT_FOUND", "Report not found", 404);
    }
    assertEditable(existing.status);

    const report = await prisma.report.update({
      where: { id },
      data: {
        ...(body.reportDate
          ? { reportDate: parseReportDate(body.reportDate) }
          : {}),
        ...(body.crewSize !== undefined ? { crewSize: body.crewSize } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
      include: reportInclude,
    });
    res.json({ report: mapReport(report) });
  }),
);

/** Replace all line segments for one project task on this report */
fieldReportsRouter.put(
  "/:id/tasks/:projectTaskId",
  requirePermission("reports.edit_draft"),
  asyncHandler(async (req, res) => {
    const reportId = routeParam(req.params.id);
    const projectTaskId = routeParam(req.params.projectTaskId);
    const userId = req.user!.id;

    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report || report.submittedById !== userId) {
      throw new AppError("NOT_FOUND", "Report not found", 404);
    }
    assertEditable(report.status);

    const projectTask = await prisma.projectTask.findFirst({
      where: {
        id: projectTaskId,
        projectId: report.projectId,
        isActive: true,
        assignedToId: userId,
      },
      include: { taskMaster: true },
    });
    if (!projectTask) {
      throw new AppError(
        "NOT_FOUND",
        "Task not found or not assigned to you",
        404,
      );
    }

    const formType = projectTask.taskMaster.formType;
    const rawSegments = Array.isArray(req.body?.segments)
      ? req.body.segments
      : [];
    if (rawSegments.length === 0) {
      throw new AppError("VALIDATION_ERROR", "Add at least one segment", 400);
    }

    const rows: {
      reportId: string;
      projectTaskId: string;
      entryType: LineEntryType;
      quantitySource: QuantitySource;
      beginSta: string | null;
      endSta: string | null;
      conversionFactor: number | null;
      calculatedLf: number | null;
      manualLf: number | null;
      finalQuantity: number;
      locationDescription: string | null;
      symbolItemType: string | null;
      sortOrder: number;
    }[] = [];

    if (formType === "STA_RANGE") {
      const parsedSegments: { beginSta: string; endSta: string }[] = [];
      rawSegments.forEach((seg: unknown, i: number) => {
        const parsed = staRangeSegmentSchema.parse(seg);
        const resolved = resolveStaSegment(parsed);
        parsedSegments.push({
          beginSta: resolved.beginSta,
          endSta: resolved.endSta,
        });
        rows.push({
          reportId,
          projectTaskId,
          entryType: resolved.entryType,
          quantitySource: resolved.quantitySource,
          beginSta: resolved.beginSta,
          endSta: resolved.endSta,
          conversionFactor: resolved.conversionFactor,
          calculatedLf: resolved.calculatedLf,
          manualLf: resolved.manualLf,
          finalQuantity: resolved.finalQuantity,
          locationDescription: null,
          symbolItemType: null,
          sortOrder: i,
        });
      });

      const projectRoute = await prisma.projectRoute.findUnique({
        where: { projectId: report.projectId },
        select: { beginSta: true, endSta: true },
      });
      const workLimits = resolveStaWorkLimits(projectTask, projectRoute);
      if (!workLimits) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Work limits (begin/end STA) are not set for this task. Contact project admin.",
          400,
        );
      }
      const completedMap = await fetchCompletedStaRanges(
        [projectTaskId],
        reportId,
      );
      const coverage = validateStaSegmentsCoverage(
        parsedSegments,
        completedMap.get(projectTaskId) ?? [],
        workLimits,
      );
      if (!coverage.success) {
        throw new AppError("VALIDATION_ERROR", coverage.message, 400);
      }
    } else {
      rawSegments.forEach((seg: unknown, i: number) => {
        const parsed = singleLocationSegmentSchema.parse(seg);
        rows.push({
          reportId,
          projectTaskId,
          entryType: "SINGLE_LOCATION",
          quantitySource: "MANUAL",
          beginSta: null,
          endSta: null,
          conversionFactor: null,
          calculatedLf: null,
          manualLf: null,
          finalQuantity: parsed.quantity,
          locationDescription: parsed.locationDescription,
          symbolItemType: parsed.symbolItemType,
          sortOrder: i,
        });
      });
    }

    await prisma.$transaction([
      prisma.reportLineItem.deleteMany({
        where: { reportId, projectTaskId },
      }),
      prisma.reportLineItem.createMany({ data: rows }),
      prisma.auditLog.create({
        data: {
          reportId,
          userId,
          action: "UPDATED",
          comment: `Saved lines for ${projectTask.taskMaster.code}`,
        },
      }),
    ]);

    const full = await prisma.report.findUniqueOrThrow({
      where: { id: reportId },
      include: reportInclude,
    });
    res.json({ report: mapReport(full) });
  }),
);

fieldReportsRouter.post(
  "/:id/submit",
  requirePermission("reports.submit"),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const userId = req.user!.id;
    const report = await prisma.report.findUnique({
      where: { id },
      include: { lineItems: true },
    });
    if (!report || report.submittedById !== userId) {
      throw new AppError("NOT_FOUND", "Report not found", 404);
    }
    assertEditable(report.status);
    if (report.lineItems.length === 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Add at least one quantity before submitting",
        400,
      );
    }

    const projectRoute = await prisma.projectRoute.findUnique({
      where: { projectId: report.projectId },
      select: { beginSta: true, endSta: true },
    });
    const staTaskIds = [
      ...new Set(
        report.lineItems
          .filter((li) => li.beginSta && li.endSta)
          .map((li) => li.projectTaskId),
      ),
    ];
    const completedMap = await fetchCompletedStaRanges(staTaskIds, id);
    const projectTasks = await prisma.projectTask.findMany({
      where: { id: { in: staTaskIds } },
      select: { id: true, beginSta: true, endSta: true },
    });
    const taskById = new Map(projectTasks.map((t) => [t.id, t]));
    const byTask = new Map<string, { beginSta: string; endSta: string }[]>();
    for (const li of report.lineItems) {
      if (!li.beginSta || !li.endSta) continue;
      const list = byTask.get(li.projectTaskId) ?? [];
      list.push({ beginSta: li.beginSta, endSta: li.endSta });
      byTask.set(li.projectTaskId, list);
    }
    for (const [taskId, segments] of byTask) {
      const workLimits = resolveStaWorkLimits(
        taskById.get(taskId),
        projectRoute,
      );
      if (!workLimits) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Work limits (begin/end STA) are not set for this task. Contact project admin.",
          400,
        );
      }
      const coverage = validateStaSegmentsCoverage(
        segments,
        completedMap.get(taskId) ?? [],
        workLimits,
      );
      if (!coverage.success) {
        throw new AppError("VALIDATION_ERROR", coverage.message, 400);
      }
    }

    const wasReturned = report.status === "RETURNED";

    const project = await prisma.project.findUnique({
      where: { id: report.projectId },
      select: { projectManagerId: true, division: true },
    });
    if (project?.projectManagerId) {
      const submitter = await prisma.user.findUnique({
        where: { id: userId },
        select: { managerId: true, division: true },
      });
      if (submitter) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            managerId: project.projectManagerId,
            division: submitter.division ?? project.division,
          },
        });
      }
    }

    const updated = await prisma.report.update({
      where: { id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        returnComment: null,
      },
      include: reportInclude,
    });

    await prisma.auditLog.create({
      data: {
        reportId: id,
        userId,
        action: wasReturned ? "RESUBMITTED" : "SUBMITTED",
        comment: wasReturned ? "Report resubmitted" : "Report submitted",
      },
    });

    res.json({ report: mapReport(updated) });
  }),
);

/** Upload photo / ticket / receipt — local disk now; S3 via STORAGE_DRIVER=s3 later */
fieldReportsRouter.post(
  "/:id/attachments",
  requirePermission("reports.edit_draft"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const userId = req.user!.id;
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report || report.submittedById !== userId) {
      throw new AppError("NOT_FOUND", "Report not found", 404);
    }
    assertEditable(report.status);

    const file = req.file;
    if (!file) {
      throw new AppError("VALIDATION_ERROR", "Choose a file to upload", 400);
    }

    const fileCheck = validateAttachmentFile({
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
    });
    if (!fileCheck.ok) {
      throw new AppError("VALIDATION_ERROR", fileCheck.message, 400);
    }

    const categoryRaw =
      typeof req.body?.category === "string" ? req.body.category : "PHOTO";
    const category =
      categoryRaw === "TICKET" ||
      categoryRaw === "RECEIPT" ||
      categoryRaw === "CERTIFICATION" ||
      categoryRaw === "PHOTO"
        ? categoryRaw
        : "OTHER";

    let stored;
    try {
      stored = await storeUpload({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        folder: `reports/${id}`,
      });
    } catch (err) {
      throw new AppError(
        "INTERNAL",
        err instanceof Error ? err.message : "Upload failed",
        500,
      );
    }

    const attachment = await prisma.attachment.create({
      data: {
        reportId: id,
        projectId: report.projectId,
        fileName: stored.fileName,
        fileType: stored.fileType,
        fileSizeBytes: stored.fileSizeBytes,
        category,
        storageUrl: stored.storageUrl,
        uploadedById: userId,
      },
    });

    res.status(201).json({
      attachment: {
        id: attachment.id,
        fileName: attachment.fileName,
        fileType: attachment.fileType,
        category: attachment.category,
        storageUrl: attachment.storageUrl,
        uploadedAt: attachment.uploadedAt,
      },
    });
  }),
);
