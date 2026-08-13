import type { ZodError } from "zod";

/** First human-readable message from a Zod validation error. */
export function firstZodIssueMessage(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Validation failed";
  if (issue.code === "invalid_enum_value") {
    return "Choose a valid option for the highlighted field";
  }
  return issue.message;
}
