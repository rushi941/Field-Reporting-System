import { z } from "zod";

/** How this job is set up for billing / contract relationships */
export const billingRelationshipEnum = z.enum([
  /** Work directly for the client — no general contractor */
  "DIRECT_CLIENT",
  /** Subcontractor on a job — client (owner) and GC both apply */
  "CLIENT_AND_GC",
  /** Work directly for a GC / 3rd party — end client optional */
  "GC_DIRECT",
]);

export type BillingRelationship = z.infer<typeof billingRelationshipEnum>;

export const billingRelationshipLabels: Record<BillingRelationship, string> = {
  DIRECT_CLIENT: "Direct to client",
  CLIENT_AND_GC: "Client + general contractor",
  GC_DIRECT: "Direct to GC / 3rd party",
};

export const billingRelationshipDescriptions: Record<BillingRelationship, string> =
  {
    DIRECT_CLIENT:
      "You work directly for the client or owner. General contractor is not used.",
    CLIENT_AND_GC:
      "You are a subcontractor. The owner/client and general contractor are both on the job.",
    GC_DIRECT:
      "You work directly for a general contractor or 3rd party. End client is optional.",
  };

export function trimPartyName(
  name: string | null | undefined,
): string | null {
  if (name == null) return null;
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateProjectBillingParties(input: {
  billingRelationship: BillingRelationship;
  clientName?: string | null;
  generalContractor?: string | null;
}): string | null {
  const client = trimPartyName(input.clientName);
  const gc = trimPartyName(input.generalContractor);

  switch (input.billingRelationship) {
    case "DIRECT_CLIENT":
      if (!client) return "Client / owner is required for direct jobs";
      return null;
    case "CLIENT_AND_GC":
      if (!client) return "Client / owner is required";
      if (!gc) return "General contractor is required";
      return null;
    case "GC_DIRECT":
      if (!gc) return "General contractor is required";
      return null;
    default:
      return null;
  }
}

export type BillingPartySummary = {
  billTo: string | null;
  billToLabel: string;
  secondary: string | null;
  secondaryLabel: string | null;
};

/** Primary party for billing lists and exports */
export function billingPartySummary(project: {
  billingRelationship: BillingRelationship;
  clientName?: string | null;
  generalContractor?: string | null;
}): BillingPartySummary {
  const client = trimPartyName(project.clientName);
  const gc = trimPartyName(project.generalContractor);
  const rel = project.billingRelationship;

  if (rel === "DIRECT_CLIENT") {
    return {
      billTo: client,
      billToLabel: "Bill to (client)",
      secondary: null,
      secondaryLabel: null,
    };
  }

  if (rel === "CLIENT_AND_GC") {
    return {
      billTo: gc,
      billToLabel: "Bill to (GC)",
      secondary: client,
      secondaryLabel: "Client / owner",
    };
  }

  // GC_DIRECT
  return {
    billTo: gc,
    billToLabel: "Bill to (GC)",
    secondary: client,
    secondaryLabel: client ? "End client (optional)" : null,
  };
}

export function formatBillingPartyLine(project: {
  billingRelationship: BillingRelationship;
  clientName?: string | null;
  generalContractor?: string | null;
  location?: string | null;
}): string {
  const summary = billingPartySummary(project);
  const parts: string[] = [];
  if (summary.billTo) {
    parts.push(summary.billTo);
  }
  if (summary.secondary) {
    parts.push(`${summary.secondaryLabel ?? "Client"}: ${summary.secondary}`);
  }
  if (project.location?.trim()) {
    parts.push(project.location.trim());
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function inferBillingRelationship(input: {
  clientName?: string | null;
  generalContractor?: string | null;
}): BillingRelationship {
  const client = trimPartyName(input.clientName);
  const gc = trimPartyName(input.generalContractor);
  if (client && gc) return "CLIENT_AND_GC";
  if (gc && !client) return "GC_DIRECT";
  return "DIRECT_CLIENT";
}
