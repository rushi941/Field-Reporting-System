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
  isQuantityOnlyFormType,
  isStaFormType,
  quantityOnlySegmentSchema,
  resolveStaSegment,
  singleLocationSegmentSchema,
  staRangeSegmentSchema,
  submitReportSchema,
  updateDraftReportSchema,
  upsertDraftReportSchema,
  validateAttachmentFile,
  validateStaSegmentsCoverage,
} from "@frs/shared";
import { AppError } from "../lib/app-error.js";
import { asyncHandler } from "../lib/async-handler.js";
import { fieldLeadAccessWhere } from "../lib/field-lead-access.js";
import { routeParam } from "../lib/route-param.js";
import { storeUpload, deleteStoredFile } from "../lib/storage.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/require-permission.js";
import { requireRole } from "../middleware/require-role.js";

export const fieldReportsRouter = Router();

fieldReportsRouter.use(requireAuth, requireRole("FIELD_LEAD"));

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
      projectManager: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
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
  divisionManager: {
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
  const master = item.projectTask?.taskMaster;
  if (!master) {
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
      lineTypeCode: item.lineTypeCode,
      side: item.side,
      sortOrder: item.sortOrder,
      projectTask: {
        id: item.projectTask.id,
        taskMaster: {
          id: "unknown",
          code: "—",
          name: "Removed task",
          unit: "LF",
          formType: "STA_WITH_CF",
          color: null,
          widthInches: null,
          conversionFactor: null,
        },
      },
    };
  }
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
    /** Division manager selected for approval routing */
    divisionManagerId: report.divisionManagerId,
    divisionManager: mapPerson(report.divisionManager),
    /** Manager who returned (from RETURNED audit) */
    returnedBy:
      report.status === "RETURNED" ? mapPerson(returnAudit?.user) : null,
    project: {
      id: report.project.id,
      jobNumber: report.project.jobNumber,
      name: report.project.name,
      location: report.project.location,
      clientName: report.project.clientName,
      division: report.project.division,
      projectManager: mapPerson(report.project.projectManager),
    },
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

async function createDraftReport(
  data: Prisma.ReportUncheckedCreateInput,
): Promise<ReportLoaded> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.report.create({
        data: {
          ...data,
          reportNumber: data.reportNumber ?? (await nextReportNumber()),
        },
        include: reportInclude,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        attempt < 2
      ) {
        continue;
      }
      throw err;
    }
  }
  throw new AppError("INTERNAL", "Could not create draft report", 500);
}

function projectManagerIds(project: {
  projectManagerId: string | null;
  divisionManagers: { userId: string }[];
}) {
  const ids = project.divisionManagers.map((dm) => dm.userId);
  if (project.projectManagerId && !ids.includes(project.projectManagerId)) {
    return [project.projectManagerId, ...ids];
  }
  return ids.length ? ids : project.projectManagerId ? [project.projectManagerId] : [];
}

function resolveDefaultDivisionManagerId(project: {
  projectManagerId: string | null;
  divisionManagers: { userId: string }[];
}) {
  const ids = projectManagerIds(project);
  return project.projectManagerId ?? ids[0] ?? null;
}

function assertDivisionManagerOnProject(
  managerId: string | null | undefined,
  project: {
    projectManagerId: string | null;
    divisionManagers: { userId: string }[];
  },
) {
  if (!managerId) return null;
  const allowed = new Set(projectManagerIds(project));
  if (!allowed.has(managerId)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Selected division manager is not assigned to this project",
      400,
    );
  }
  return managerId;
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
        ...fieldLeadAccessWhere(userId),
      },
      include: {
        divisionManagers: { select: { userId: true } },
      },
    });
    if (!project) {
      throw new AppError(
        "NOT_FOUND",
        "Project not found or no tasks assigned to you",
        404,
      );
    }

    const defaultManagerId = resolveDefaultDivisionManagerId(project);
    const divisionManagerId =
      body.divisionManagerId !== undefined
        ? assertDivisionManagerOnProject(body.divisionManagerId, project)
        : defaultManagerId;

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
      const needsUpdate =
        body.crewSize !== undefined ||
        body.notes !== undefined ||
        body.divisionManagerId !== undefined ||
        (!existing.divisionManagerId && divisionManagerId);

      if (needsUpdate) {
        const updated = await prisma.report.update({
          where: { id: existing.id },
          data: {
            ...(body.crewSize !== undefined ? { crewSize: body.crewSize } : {}),
            ...(body.notes !== undefined ? { notes: body.notes } : {}),
            ...(body.divisionManagerId !== undefined
              ? {
                  divisionManagerId: assertDivisionManagerOnProject(
                    body.divisionManagerId,
                    project,
                  ),
                }
              : !existing.divisionManagerId && divisionManagerId
                ? { divisionManagerId }
                : {}),
          },
          include: reportInclude,
        });
        return res.json({ report: mapReport(updated) });
      }
      return res.json({ report: mapReport(existing) });
    }

    const report = await createDraftReport({
      projectId: project.id,
      reportDate,
      submittedById: userId,
      division: project.division,
      divisionManagerId,
      crewSize: body.crewSize ?? null,
      notes: body.notes ?? null,
      status: "DRAFT",
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
    const existing = await prisma.report.findUnique({
      where: { id },
      include: {
        project: {
          include: { divisionManagers: { select: { userId: true } } },
        },
      },
    });
    if (!existing || existing.submittedById !== req.user!.id) {
      throw new AppError("NOT_FOUND", "Report not found", 404);
    }
    assertEditable(existing.status);

    const divisionManagerId =
      body.divisionManagerId !== undefined
        ? assertDivisionManagerOnProject(
            body.divisionManagerId,
            existing.project,
          )
        : undefined;

    const report = await prisma.report.update({
      where: { id },
      data: {
        ...(body.reportDate
          ? { reportDate: parseReportDate(body.reportDate) }
          : {}),
        ...(body.crewSize !== undefined ? { crewSize: body.crewSize } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(divisionManagerId !== undefined
          ? { divisionManagerId }
          : {}),
      },
      include: reportInclude,
    });
    res.json({ report: mapReport(report) });
  }),
);

/** Field lead: delete own draft report only */
fieldReportsRouter.delete(
  "/:id",
  requirePermission("reports.edit_draft"),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const userId = req.user!.id;
    const report = await prisma.report.findFirst({
      where: { id, submittedById: userId, status: "DRAFT" },
    });
    if (!report) {
      throw new AppError("NOT_FOUND", "Draft report not found", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.deleteMany({ where: { reportId: id } });
      await tx.attachment.deleteMany({ where: { reportId: id } });
      await tx.reportLineItem.deleteMany({ where: { reportId: id } });
      await tx.report.delete({ where: { id } });
    });

    res.json({ ok: true });
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
        OR: [
          { assignedToId: userId },
          { project: { fieldLeads: { some: { userId } } } },
        ],
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
      lineTypeCode: string | null;
      side: string | null;
      sortOrder: number;
    }[] = [];

    if (isStaFormType(formType)) {
      const parsedSegments: { beginSta: string; endSta: string }[] = [];
      rawSegments.forEach((seg: unknown, i: number) => {
        const parsed = staRangeSegmentSchema.parse(seg);
        const resolved = resolveStaSegment(
          parsed,
          projectTask.taskMaster.unit,
        );
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
          lineTypeCode: resolved.lineTypeCode,
          side: resolved.side,
          sortOrder: i,
        });
      });

      const coverage = validateStaSegmentsCoverage(parsedSegments);
      if (!coverage.success) {
        throw new AppError("VALIDATION_ERROR", coverage.message, 400);
      }
    } else if (isQuantityOnlyFormType(formType)) {
      rawSegments.forEach((seg: unknown, i: number) => {
        const parsed = quantityOnlySegmentSchema.parse(seg);
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
          locationDescription: parsed.notes ?? null,
          symbolItemType: null,
          lineTypeCode: null,
          side: null,
          sortOrder: i,
        });
      });
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
          lineTypeCode: null,
          side: null,
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
    const body = submitReportSchema.parse(req.body ?? {});
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

    const staByTask = new Map<string, { beginSta: string; endSta: string }[]>();
    for (const li of report.lineItems) {
      if (!li.beginSta || !li.endSta) continue;
      const list = staByTask.get(li.projectTaskId) ?? [];
      list.push({ beginSta: li.beginSta, endSta: li.endSta });
      staByTask.set(li.projectTaskId, list);
    }

    if (staByTask.size > 0) {
      for (const [projectTaskId, segments] of staByTask) {
        const projectTask = await prisma.projectTask.findUnique({
          where: { id: projectTaskId },
          include: { taskMaster: true },
        });
        if (!projectTask || !isStaFormType(projectTask.taskMaster.formType)) {
          continue;
        }

        const coverage = validateStaSegmentsCoverage(segments);
        if (!coverage.success) {
          throw new AppError("VALIDATION_ERROR", coverage.message, 400);
        }
      }
    }

    const wasReturned = report.status === "RETURNED";

    const project = await prisma.project.findUnique({
      where: { id: report.projectId },
      select: {
        projectManagerId: true,
        division: true,
        divisionManagers: { select: { userId: true } },
      },
    });
    if (!project) {
      throw new AppError("NOT_FOUND", "Project not found", 404);
    }

    const routedManagerId =
      (body.divisionManagerId !== undefined
        ? assertDivisionManagerOnProject(body.divisionManagerId, project)
        : null) ??
      report.divisionManagerId ??
      resolveDefaultDivisionManagerId(project);

    if (!routedManagerId) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Select a division manager for this project",
        400,
      );
    }

    if (routedManagerId) {
      const submitter = await prisma.user.findUnique({
        where: { id: userId },
        select: { managerId: true, division: true },
      });
      if (submitter) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            managerId: routedManagerId,
            division: submitter.division ?? project?.division,
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
        divisionManagerId: routedManagerId,
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

/** Remove an uploaded photo / ticket / receipt from a draft or returned report */
fieldReportsRouter.delete(
  "/:id/attachments/:attachmentId",
  requirePermission("reports.edit_draft"),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const attachmentId = routeParam(req.params.attachmentId, "attachmentId");
    const userId = req.user!.id;
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report || report.submittedById !== userId) {
      throw new AppError("NOT_FOUND", "Report not found", 404);
    }
    assertEditable(report.status);

    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, reportId: id },
    });
    if (!attachment) {
      throw new AppError("NOT_FOUND", "Attachment not found", 404);
    }

    await prisma.attachment.delete({ where: { id: attachment.id } });
    await deleteStoredFile(attachment.storageUrl);

    res.json({ ok: true });
  }),
);
