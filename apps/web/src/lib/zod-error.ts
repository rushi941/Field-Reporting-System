import type { ZodError } from "zod";

/** First human-readable message from a Zod validation error. */
export function firstZodIssueMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Validation failed";
}
