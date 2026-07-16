import { z } from "zod";

export const unitMasterSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(80),
  description: z.string().max(200).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

export const updateUnitMasterSchema = unitMasterSchema.partial();

export type UnitMasterInput = z.infer<typeof unitMasterSchema>;

/** Default units for bids and field reporting */
export const seedUnitMasters = [
  { code: "LF", name: "Linear Feet", sortOrder: 10 },
  { code: "EA", name: "Each", sortOrder: 20 },
  { code: "LS", name: "Lump Sum", sortOrder: 30 },
  { code: "SQFT", name: "Square Feet", sortOrder: 40 },
  { code: "SY", name: "Square Yard", sortOrder: 50 },
] as const;
