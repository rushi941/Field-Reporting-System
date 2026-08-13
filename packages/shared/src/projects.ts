import { z } from "zod";
import { TEXT_NAME_MAX_LENGTH, TEXT_NOTE_MAX_LENGTH } from "./text-limits.js";
import { bidItemFormTypeEnum, isStaFormType } from "./form-types.js";
import { buildPavementMarkingBidCatalog } from "./line-codes.js";
import { normalizeSta, physicalLfFromSta } from "./sta.js";

export const divisionEnum = z.enum([
  "PAVEMENT_MARKING",
  "TRAFFIC_CONTROL",
  "PERMANENT_SIGNS",
  "MISCELLANEOUS",
]);

export const projectStatusEnum = z.enum(["ACTIVE", "INACTIVE", "COMPLETED"]);

export const formTypeEnum = bidItemFormTypeEnum;

export const projectTypeSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  division: divisionEnum.optional().nullable(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

export const updateProjectTypeSchema = projectTypeSchema.partial();

export const taskMasterSchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
  unit: z.string().min(1).max(20),
  formType: formTypeEnum.optional().default("STA_WITH_CF"),
  projectTypeId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  division: divisionEnum.optional().nullable(),
  color: z.string().max(40).optional().nullable(),
  widthInches: z.number().int().positive().optional().nullable(),
  conversionFactor: z.number().nonnegative().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

export const updateTaskMasterSchema = taskMasterSchema.partial();

const optionalDate = z
  .union([z.string().min(1), z.null()])
  .optional()
  .nullable();

export const projectRouteSchema = z.object({
  label: z.string().max(200).optional().nullable(),
  startLat: z.number().min(-90).max(90),
  startLng: z.number().min(-180).max(180),
  startLabel: z.string().max(200).optional().nullable(),
  endLat: z.number().min(-90).max(90),
  endLng: z.number().min(-180).max(180),
  endLabel: z.string().max(200).optional().nullable(),
  beginSta: z.string().trim().max(32).optional().nullable(),
  endSta: z.string().trim().max(32).optional().nullable(),
  polyline: z.array(z.tuple([z.number(), z.number()])).optional().nullable(),
  distanceMeters: z.number().nonnegative().optional().nullable(),
});

const projectBaseSchema = z.object({
  jobNumber: z
    .string()
    .trim()
    .min(1, "Job number is required")
    .max(40)
    .transform((v) => v.toUpperCase()),
  name: z
    .string()
    .min(1)
    .max(TEXT_NAME_MAX_LENGTH, `Project name must be ${TEXT_NAME_MAX_LENGTH} characters or less`),
  division: divisionEnum,
  /// Extra divisions on this job (tasks can span multiple)
  divisions: z.array(divisionEnum).optional().default([]),
  projectTypeId: z.string().optional().nullable(),
  projectAdminId: z.string().min(1, "Project admin is required"),
  /** Primary division manager (legacy); first entry of divisionManagerIds when omitted */
  projectManagerId: z.string().optional().nullable(),
  divisionManagerIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one division manager"),
  fieldLeadIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one field person"),
  clientName: z.string().max(200).optional().nullable(),
  generalContractor: z.string().max(200).optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  contractAmount: z.number().nonnegative().optional().nullable(),
  startDate: optionalDate,
  endDate: optionalDate,
  notes: z
    .string()
    .max(TEXT_NOTE_MAX_LENGTH, `Notes must be ${TEXT_NOTE_MAX_LENGTH} characters or less`)
    .optional()
    .nullable(),
  status: projectStatusEnum.optional().default("ACTIVE"),
  /// Selected master + sub-task IDs
  taskIds: z.array(z.string()).optional().default([]),
  route: projectRouteSchema.optional().nullable(),
});

export const projectSchema = projectBaseSchema;

export const updateProjectSchema = projectBaseSchema.partial();

/** Create a work task on a project — link existing sub-bid or create ad-hoc line */
export const projectCreateTaskSchema = z
  .object({
    taskMasterId: z.string().min(1).optional(),
    name: z.string().min(1).max(200).optional(),
    code: z.string().min(1).max(40).optional(),
    unit: z.string().min(1).max(20).optional().default("LF"),
    formType: formTypeEnum.optional().default("STA_WITH_CF"),
    division: divisionEnum.optional(),
    color: z.string().max(40).optional().nullable(),
    widthInches: z.number().int().positive().optional().nullable(),
    conversionFactor: z.number().nonnegative().optional(),
    description: z.string().max(500).optional().nullable(),
    assignedToId: z.string().min(1).optional().nullable(),
    beginSta: z.string().trim().max(32).optional().nullable(),
    endSta: z.string().trim().max(32).optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (!val.taskMasterId) {
      if (!val.name?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Task name is required",
          path: ["name"],
        });
      }
      if (val.conversionFactor == null || Number.isNaN(val.conversionFactor)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Conversion factor is required",
          path: ["conversionFactor"],
        });
      }
    }
    if (!isStaFormType(val.formType)) return;
    if (!val.beginSta?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Begin STA is required for STA range tasks",
        path: ["beginSta"],
      });
    }
    if (!val.endSta?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End STA is required for STA range tasks",
        path: ["endSta"],
      });
    }
  });

/** All divisions on a project (primary + extras, deduped). */
export function projectDivisions(
  division: z.infer<typeof divisionEnum>,
  extraDivisions: z.infer<typeof divisionEnum>[] = [],
): z.infer<typeof divisionEnum>[] {
  return [...new Set([division, ...extraDivisions])];
}

/** Split selected divisions into primary + extras for persistence. */
export function splitProjectDivisions(
  selected: z.infer<typeof divisionEnum>[],
): { division: z.infer<typeof divisionEnum>; divisions: z.infer<typeof divisionEnum>[] } {
  const unique = [...new Set(selected)];
  if (unique.length === 0) {
    throw new Error("At least one division is required");
  }
  return { division: unique[0], divisions: unique.slice(1) };
}

export type ProjectCreateTaskInput = z.infer<typeof projectCreateTaskSchema>;

/** Update an existing project task (master bid, division, work limits). */
export const projectUpdateTaskSchema = z
  .object({
    taskMasterId: z.string().min(1),
    division: divisionEnum.optional(),
    formType: formTypeEnum.optional(),
    beginSta: z.string().trim().max(32).optional().nullable(),
    endSta: z.string().trim().max(32).optional().nullable(),
    description: z.string().max(500).optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (!val.formType || !isStaFormType(val.formType)) return;
    if (!val.beginSta?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Begin STA is required for STA range tasks",
        path: ["beginSta"],
      });
    }
    if (!val.endSta?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End STA is required for STA range tasks",
        path: ["endSta"],
      });
    }
  });

export type ProjectUpdateTaskInput = z.infer<typeof projectUpdateTaskSchema>;

export const projectUpdateTaskLimitsSchema = z
  .object({
    beginSta: z.string().trim().min(1),
    endSta: z.string().trim().min(1),
  })
  .superRefine((val, ctx) => {
    try {
      const begin = normalizeSta(val.beginSta);
      const end = normalizeSta(val.endSta);
      physicalLfFromSta(begin, end);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : "Invalid STA range",
        path: ["endSta"],
      });
    }
  });

export type ProjectUpdateTaskLimitsInput = z.infer<
  typeof projectUpdateTaskLimitsSchema
>;

export const taskImportRowSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1),
  formType: formTypeEnum.optional().default("STA_WITH_CF"),
  projectTypeCode: z.string().optional().nullable(),
  parentCode: z.string().optional().nullable(),
  division: divisionEnum.optional().nullable(),
  description: z.string().optional().nullable(),
});

export type ProjectTypeInput = z.infer<typeof projectTypeSchema>;
export type TaskMasterInput = z.infer<typeof taskMasterSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type ProjectRouteInput = z.infer<typeof projectRouteSchema>;

/** Seed catalog — USA specialty roadway contractors */
export const seedProjectTypes = [
  {
    code: "PM",
    name: "Pavement Marking",
    description: "Paint, thermoplastic, and epoxy pavement markings",
    division: "PAVEMENT_MARKING" as const,
    sortOrder: 10,
  },
  {
    code: "TC",
    name: "Traffic Control",
    description: "Temporary traffic control, flagging, and work-zone devices",
    division: "TRAFFIC_CONTROL" as const,
    sortOrder: 20,
  },
  {
    code: "PS",
    name: "Permanent Signs",
    description: "Ground-mount and overhead permanent signing",
    division: "PERMANENT_SIGNS" as const,
    sortOrder: 30,
  },
  {
    code: "COMBINED",
    name: "Multi-Discipline Specialty",
    description: "Combined marking, TCP, and signing scopes",
    division: null,
    sortOrder: 40,
  },
  {
    code: "MAINT",
    name: "Maintenance / On-Call",
    description: "On-call striping and signing maintenance agreements",
    division: "PAVEMENT_MARKING" as const,
    sortOrder: 50,
  },
  {
    code: "TEMP",
    name: "Temporary Marking & TCP",
    description: "Temporary markings tied to construction phasing",
    division: "TRAFFIC_CONTROL" as const,
    sortOrder: 60,
  },
];

export type SeedTaskMaster = {
  code: string;
  name: string;
  unit: string;
  formType: z.infer<typeof formTypeEnum>;
  projectTypeCode: string;
  division: "PAVEMENT_MARKING" | "TRAFFIC_CONTROL" | "PERMANENT_SIGNS";
  description: string;
  sortOrder: number;
  /** Parent master code — omit for top-level masters */
  parentCode?: string;
  color?: string | null;
  widthInches?: number | null;
  conversionFactor?: number | null;
};

/** Build bid master seed from pavement marking line-code catalog */
export function buildSeedTaskMasters(): SeedTaskMaster[] {
  const { masters, subs } = buildPavementMarkingBidCatalog();
  return [
    ...masters.map((m) => ({
      code: m.code,
      name: m.name,
      unit: m.unit,
      formType: m.formType,
      projectTypeCode: m.projectTypeCode,
      division: m.division,
      description: m.description,
      sortOrder: m.sortOrder,
      color: null,
      widthInches: null,
      conversionFactor: null,
    })),
    ...subs.map((s) => ({
      code: s.code,
      name: s.name,
      unit: s.unit,
      formType: s.formType,
      projectTypeCode: s.projectTypeCode,
      division: s.division,
      description: s.description,
      sortOrder: s.sortOrder,
      parentCode: s.parentCode,
      color: s.color,
      widthInches: s.widthInches,
      conversionFactor: s.conversionFactor,
    })),
  ];
}

/** @deprecated use buildSeedTaskMasters() — kept for callers expecting an array */
export const seedTaskMasters: SeedTaskMaster[] = buildSeedTaskMasters();
