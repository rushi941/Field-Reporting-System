import { z } from "zod";
import { divisionEnum } from "./projects.js";
import { TEXT_NOTE_MAX_LENGTH } from "./text-limits.js";
import {
  isQuantityOnlyFormType,
  isSinglePointFormType,
  isStaFormType,
  isStaNoCf,
  isStaWithCf,
  lineSideEnum,
  normalizeFormType,
  type BidItemFormType,
} from "./form-types.js";
import {
  normalizeSta,
  physicalLfFromSta,
  quantityFromStaRange,
  reportedLfFromSta,
} from "./sta.js";

export {
  bidItemFormTypeEnum,
  normalizeFormType,
  isStaFormType,
  isStaWithCf,
  isStaNoCf,
  isSinglePointFormType,
  isQuantityOnlyFormType,
  formTypeLabel,
  inferFormType,
  lineSideEnum,
  type BidItemFormType,
  type LineSide,
} from "./form-types.js";

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
  notes: z
    .string()
    .trim()
    .max(TEXT_NOTE_MAX_LENGTH, `Notes must be ${TEXT_NOTE_MAX_LENGTH} characters or less`)
    .optional()
    .nullable(),
});

export const approveWithNotesSchema = z.object({
  notes: z
    .string()
    .trim()
    .min(1, "Approval notes are required")
    .max(TEXT_NOTE_MAX_LENGTH, `Notes must be ${TEXT_NOTE_MAX_LENGTH} characters or less`),
});

/** BR-004 — return comment is mandatory */
export const returnReportSchema = z.object({
  comment: z
    .string()
    .trim()
    .min(1, "Return comment is required")
    .max(TEXT_NOTE_MAX_LENGTH, `Comment must be ${TEXT_NOTE_MAX_LENGTH} characters or less`),
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
    conversionFactor: z.number().positive("Conversion factor must be greater than 0"),
    useManualLf: z.boolean().optional().default(false),
    manualLf: z.number().positive("Manual LF must be greater than 0").optional().nullable(),
    lineTypeCode: z.string().max(40).optional().nullable(),
    side: lineSideEnum.optional().nullable(),
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
      if (val.manualLf == null) {
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

export const quantityOnlySegmentSchema = z.object({
  quantity: z.number().positive(),
  notes: z
    .string()
    .max(TEXT_NOTE_MAX_LENGTH, `Notes must be ${TEXT_NOTE_MAX_LENGTH} characters or less`)
    .optional()
    .nullable(),
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
  notes: z
    .string()
    .max(TEXT_NOTE_MAX_LENGTH, `Notes must be ${TEXT_NOTE_MAX_LENGTH} characters or less`)
    .optional()
    .nullable(),
  /** Division manager for approval routing; must be assigned to the project */
  divisionManagerId: z.string().min(1).optional().nullable(),
});

export const updateDraftReportSchema = z.object({
  reportDate: z.string().min(1).optional(),
  crewSize: z.number().int().positive().optional().nullable(),
  notes: z
    .string()
    .max(TEXT_NOTE_MAX_LENGTH, `Notes must be ${TEXT_NOTE_MAX_LENGTH} characters or less`)
    .optional()
    .nullable(),
  divisionManagerId: z.string().min(1).optional().nullable(),
});

export const submitReportSchema = z.object({
  divisionManagerId: z.string().min(1).optional().nullable(),
});

export type StaRangeSegmentInput = z.infer<typeof staRangeSegmentSchema>;
export type SingleLocationSegmentInput = z.infer<
  typeof singleLocationSegmentSchema
>;
export type QuantityOnlySegmentInput = z.infer<typeof quantityOnlySegmentSchema>;
export type UpsertDraftReportInput = z.infer<typeof upsertDraftReportSchema>;

/** Per-row field errors keyed by segment index → field name → message */
export type SegmentFieldErrors = Record<number, Record<string, string>>;

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
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
  maxLabel: "5 MB",
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
  formType: string,
  segments: unknown[],
):
  | {
      success: true;
      segments:
        | StaRangeSegmentInput[]
        | SingleLocationSegmentInput[]
        | QuantityOnlySegmentInput[];
    }
  | { success: false; errors: SegmentFieldErrors; message: string } {
  if (!segments.length) {
    return {
      success: false,
      errors: {},
      message: "Add at least one row",
    };
  }

  const normalized = normalizeFormType(formType);
  const errors: SegmentFieldErrors = {};
  const parsed: (
    | StaRangeSegmentInput
    | SingleLocationSegmentInput
    | QuantityOnlySegmentInput
  )[] = [];

  segments.forEach((seg, i) => {
    const result = isStaFormType(normalized)
      ? staRangeSegmentSchema.safeParse(seg)
      : isQuantityOnlyFormType(normalized)
        ? quantityOnlySegmentSchema.safeParse(seg)
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

  if (isStaFormType(normalized)) {
    return { success: true, segments: parsed as StaRangeSegmentInput[] };
  }
  if (isQuantityOnlyFormType(normalized)) {
    return { success: true, segments: parsed as QuantityOnlySegmentInput[] };
  }
  return { success: true, segments: parsed as SingleLocationSegmentInput[] };
}

export type StaRangePair = { beginSta: string; endSta: string };

/** Validate STA segments: format only (field leads are not blocked by task limits). */
export function validateStaSegmentsCoverage(
  segments: StaRangePair[],
):
  | { success: true }
  | { success: false; errors: SegmentFieldErrors; message: string } {
  if (!segments.length) {
    return { success: true };
  }

  const errors: SegmentFieldErrors = {};

  segments.forEach((seg, i) => {
    try {
      normalizeSta(seg.beginSta);
      normalizeSta(seg.endSta);
      physicalLfFromSta(seg.beginSta, seg.endSta);
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

  return { success: true };
}

/** Resolve quantity fields for persistence */
export function resolveStaSegment(
  segment: StaRangeSegmentInput,
  unit: string,
): {
  beginSta: string;
  endSta: string;
  conversionFactor: number;
  calculatedLf: number | null;
  manualLf: number | null;
  finalQuantity: number;
  quantitySource: "STATION_CALCULATED" | "MANUAL";
  entryType: "STA_RANGE" | "MANUAL_FOOTAGE";
  lineTypeCode: string | null;
  side: string | null;
} {
  const beginSta = normalizeSta(segment.beginSta);
  const endSta = normalizeSta(segment.endSta);
  const lineTypeCode = segment.lineTypeCode?.trim() || null;
  const side = segment.side ?? null;
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
      lineTypeCode,
      side,
    };
  }
  const cf = segment.conversionFactor;
  const finalQuantity = quantityFromStaRange(unit, beginSta, endSta, cf);
  if (finalQuantity <= 0) {
    throw new Error("Calculated quantity must be greater than 0");
  }
  const calculatedLf =
    unit.trim().toUpperCase() === "LF"
      ? finalQuantity
      : physicalLfFromSta(beginSta, endSta);
  return {
    beginSta,
    endSta,
    conversionFactor: cf,
    calculatedLf,
    manualLf: null,
    finalQuantity,
    quantitySource: "STATION_CALCULATED",
    entryType: "STA_RANGE",
    lineTypeCode,
    side,
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

