import { z } from "zod";
import { divisionEnum } from "./projects.js";
import {
  normalizeSta,
  parseStaToDecimal,
  physicalLfFromSta,
  reportedLfFromSta,
  staRangesOverlap,
} from "./sta.js";

export const reportStatusEnum = z.enum([
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "APPROVED",
  "APPROVED_WITH_NOTES",
]);

/**
 * FRD §8.3 diagram labels → stored ReportStatus (Phase 1 simplified machine).
 * - Draft → DRAFT
 * - Submitted / UnderReview / Resubmitted → SUBMITTED (manager queue)
 * - Returned / Revised (while editing) → RETURNED
 * - Approved / ApprovedWithNotes → APPROVED / APPROVED_WITH_NOTES (admin-visible)
 * - Exported → AuditAction.EXPORTED (not a report status)
 */
export const frdStatusLabels: Record<
  z.infer<typeof reportStatusEnum>,
  string
> = {
  DRAFT: "Draft",
  SUBMITTED: "Under review",
  RETURNED: "Returned",
  APPROVED: "Approved",
  APPROVED_WITH_NOTES: "Approved with notes",
};

export const APPROVED_REPORT_STATUSES = [
  "APPROVED",
  "APPROVED_WITH_NOTES",
] as const;

export const approveReportSchema = z.object({
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const approveWithNotesSchema = z.object({
  notes: z.string().trim().min(1, "Approval notes are required").max(2000),
});

/** BR-004 — return comment is mandatory */
export const returnReportSchema = z.object({
  comment: z
    .string()
    .trim()
    .min(1, "Return comment is required")
    .max(2000),
});

export type ApproveReportInput = z.infer<typeof approveReportSchema>;
export type ApproveWithNotesInput = z.infer<typeof approveWithNotesSchema>;
export type ReturnReportInput = z.infer<typeof returnReportSchema>;

export const lineEntryTypeEnum = z.enum([
  "STA_RANGE",
  "SINGLE_LOCATION",
  "MANUAL_FOOTAGE",
]);

export const quantitySourceEnum = z.enum(["STATION_CALCULATED", "MANUAL"]);

const optionalSta = z
  .string()
  .trim()
  .min(1)
  .transform((v) => normalizeSta(v));

export const staRangeSegmentSchema = z
  .object({
    beginSta: z.string().min(1),
    endSta: z.string().min(1),
    conversionFactor: z.number().nonnegative(),
    useManualLf: z.boolean().optional().default(false),
    manualLf: z.number().nonnegative().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    try {
      normalizeSta(val.beginSta);
      normalizeSta(val.endSta);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : "Invalid station",
        path: ["beginSta"],
      });
      return;
    }
    if (val.useManualLf) {
      if (val.manualLf == null || val.manualLf <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Manual LF is required",
          path: ["manualLf"],
        });
      }
    } else {
      try {
        physicalLfFromSta(val.beginSta, val.endSta);
      } catch (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err instanceof Error ? err.message : "Invalid STA range",
          path: ["endSta"],
        });
      }
    }
  });

export const singleLocationSegmentSchema = z.object({
  locationDescription: z.string().min(1).max(300),
  symbolItemType: z.string().min(1).max(120),
  quantity: z.number().positive(),
});

export const saveTaskLinesSchema = z.object({
  projectTaskId: z.string().min(1),
  entryType: lineEntryTypeEnum,
  segments: z.array(z.unknown()).min(1),
});

export const upsertDraftReportSchema = z.object({
  projectId: z.string().min(1),
  reportDate: z.string().min(1),
  crewSize: z.number().int().positive().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateDraftReportSchema = z.object({
  reportDate: z.string().min(1).optional(),
  crewSize: z.number().int().positive().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type StaRangeSegmentInput = z.infer<typeof staRangeSegmentSchema>;
export type SingleLocationSegmentInput = z.infer<
  typeof singleLocationSegmentSchema
>;
export type UpsertDraftReportInput = z.infer<typeof upsertDraftReportSchema>;

/** Per-row field errors keyed by segment index → field name → message */
export type SegmentFieldErrors = Record<number, Record<string, string>>;

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const ATTACHMENT_MIME_ALLOW = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

export const attachmentUploadMeta = {
  maxBytes: MAX_ATTACHMENT_BYTES,
  maxLabel: "15 MB",
  accept: "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.pdf",
  allowedMime: ATTACHMENT_MIME_ALLOW,
} as const;

/** Client + API: validate a photo/ticket file before upload */
export function validateAttachmentFile(file: {
  name: string;
  size: number;
  type: string;
}): { ok: true } | { ok: false; message: string } {
  if (!file.size) {
    return { ok: false, message: "File is empty" };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      message: `File must be ${attachmentUploadMeta.maxLabel} or smaller`,
    };
  }
  const mime = (file.type || "").toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeOk =
    !mime ||
    (ATTACHMENT_MIME_ALLOW as readonly string[]).includes(mime) ||
    mime.startsWith("image/");
  const extOk = ["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf"].includes(
    ext,
  );
  if (!mimeOk && !extOk) {
    return { ok: false, message: "Use a photo (JPG/PNG/WEBP/HEIC) or PDF" };
  }
  return { ok: true };
}

function zodPathErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Validate STA / single-location segments using shared Zod schemas.
 * Used by field UI before PUT and mirrors API validation.
 */
export function validateReportTaskSegments(
  formType: "STA_RANGE" | "SINGLE_LOCATION",
  segments: unknown[],
):
  | {
      success: true;
      segments: StaRangeSegmentInput[] | SingleLocationSegmentInput[];
    }
  | { success: false; errors: SegmentFieldErrors; message: string } {
  if (!segments.length) {
    return {
      success: false,
      errors: {},
      message: "Add at least one row",
    };
  }

  const errors: SegmentFieldErrors = {};
  const parsed: (StaRangeSegmentInput | SingleLocationSegmentInput)[] = [];

  segments.forEach((seg, i) => {
    const result =
      formType === "STA_RANGE"
        ? staRangeSegmentSchema.safeParse(seg)
        : singleLocationSegmentSchema.safeParse(seg);
    if (!result.success) {
      errors[i] = zodPathErrors(result.error);
    } else {
      parsed.push(result.data);
    }
  });

  if (Object.keys(errors).length) {
    return {
      success: false,
      errors,
      message: "Fix the highlighted fields",
    };
  }

  if (formType === "STA_RANGE") {
    return {
      success: true,
      segments: parsed as StaRangeSegmentInput[],
    };
  }
  return {
    success: true,
    segments: parsed as SingleLocationSegmentInput[],
  };
}

export type StaRangePair = { beginSta: string; endSta: string };

/**
 * Ensure STA segments stay within project limits and do not overlap
 * previously submitted/approved work or other rows on this report.
 */
export function validateStaSegmentsCoverage(
  segments: StaRangePair[],
  completed: StaRangePair[],
  projectBounds?: StaRangePair | null,
):
  | { success: true }
  | { success: false; errors: SegmentFieldErrors; message: string } {
  if (!segments.length) {
    return { success: true };
  }

  const errors: SegmentFieldErrors = {};
  let normalizedBounds: { beginSta: string; endSta: string } | null = null;

  if (projectBounds?.beginSta?.trim() && projectBounds?.endSta?.trim()) {
    try {
      normalizedBounds = {
        beginSta: normalizeSta(projectBounds.beginSta),
        endSta: normalizeSta(projectBounds.endSta),
      };
    } catch {
      normalizedBounds = null;
    }
  }

  const normalizedSegments: StaRangePair[] = [];
  const normalizedCompleted: StaRangePair[] = [];

  for (const done of completed) {
    try {
      normalizedCompleted.push({
        beginSta: normalizeSta(done.beginSta),
        endSta: normalizeSta(done.endSta),
      });
    } catch {
      /* skip invalid historical rows */
    }
  }

  segments.forEach((seg, i) => {
    try {
      normalizedSegments.push({
        beginSta: normalizeSta(seg.beginSta),
        endSta: normalizeSta(seg.endSta),
      });
    } catch (err) {
      errors[i] = {
        beginSta:
          err instanceof Error ? err.message : "Invalid station",
      };
    }
  });

  if (Object.keys(errors).length) {
    return {
      success: false,
      errors,
      message: "Fix the highlighted station fields",
    };
  }

  normalizedSegments.forEach((seg, i) => {
    const begin = parseStaToDecimal(seg.beginSta);
    const end = parseStaToDecimal(seg.endSta);

    if (normalizedBounds) {
      const pb = parseStaToDecimal(normalizedBounds.beginSta);
      const pe = parseStaToDecimal(normalizedBounds.endSta);
      if (begin < pb) {
        errors[i] = {
          ...errors[i],
          beginSta: `Begin STA cannot be before allowed start (${normalizedBounds.beginSta})`,
        };
      }
      if (begin >= pe) {
        errors[i] = {
          ...errors[i],
          beginSta: `Begin STA must be before allowed end (${normalizedBounds.endSta})`,
        };
      }
      if (end > pe) {
        errors[i] = {
          ...errors[i],
          endSta: `End STA cannot exceed allowed end (${normalizedBounds.endSta})`,
        };
      }
    }

    if (errors[i]) {
      return;
    }

    for (const done of normalizedCompleted) {
      if (
        staRangesOverlap(seg.beginSta, seg.endSta, done.beginSta, done.endSta)
      ) {
        errors[i] = {
          ...errors[i],
          beginSta: `This range is already completed (${done.beginSta} → ${done.endSta})`,
        };
        return;
      }
    }

    for (let j = 0; j < i; j++) {
      const other = normalizedSegments[j];
      if (
        staRangesOverlap(seg.beginSta, seg.endSta, other.beginSta, other.endSta)
      ) {
        errors[i] = {
          ...errors[i],
          beginSta: "Segments on this report cannot overlap",
        };
        return;
      }
    }
  });

  if (Object.keys(errors).length) {
    const msgs = Object.values(errors).flatMap((row) => Object.values(row));
    const message = msgs.some((m) => m.includes("already completed"))
      ? "Station range overlaps work that is already completed"
      : msgs.some((m) => m.includes("allowed") || m.includes("limits"))
        ? "Station must stay within task work limits (start/end STA)"
        : "Fix the highlighted station fields";
    return {
      success: false,
      errors,
      message,
    };
  }

  return { success: true };
}

/** Resolve quantity fields for persistence */
export function resolveStaSegment(segment: StaRangeSegmentInput): {
  beginSta: string;
  endSta: string;
  conversionFactor: number;
  calculatedLf: number | null;
  manualLf: number | null;
  finalQuantity: number;
  quantitySource: "STATION_CALCULATED" | "MANUAL";
  entryType: "STA_RANGE" | "MANUAL_FOOTAGE";
} {
  const beginSta = normalizeSta(segment.beginSta);
  const endSta = normalizeSta(segment.endSta);
  if (segment.useManualLf && segment.manualLf != null) {
    return {
      beginSta,
      endSta,
      conversionFactor: segment.conversionFactor,
      calculatedLf: null,
      manualLf: segment.manualLf,
      finalQuantity: segment.manualLf,
      quantitySource: "MANUAL",
      entryType: "MANUAL_FOOTAGE",
    };
  }
  const calculatedLf = reportedLfFromSta(
    beginSta,
    endSta,
    segment.conversionFactor,
  );
  return {
    beginSta,
    endSta,
    conversionFactor: segment.conversionFactor,
    calculatedLf,
    manualLf: null,
    finalQuantity: calculatedLf,
    quantitySource: "STATION_CALCULATED",
    entryType: "STA_RANGE",
  };
}

export { optionalSta };

/** Hours since submit (or created if submittedAt missing) */
export function reportAgeHours(
  submittedAt: Date | string | null | undefined,
  now = new Date(),
): number {
  if (!submittedAt) return 0;
  const start =
    typeof submittedAt === "string" ? new Date(submittedAt) : submittedAt;
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, (now.getTime() - start.getTime()) / (1000 * 60 * 60));
}

/** Short label for UI age chip */
export function formatReportAge(ageHours: number): string {
  if (ageHours < 1) {
    const mins = Math.max(1, Math.round(ageHours * 60));
    return `${mins}m`;
  }
  if (ageHours < 48) {
    return `${Math.floor(ageHours)}h`;
  }
  const days = Math.floor(ageHours / 24);
  return `${days}d`;
}

