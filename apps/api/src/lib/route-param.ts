import { AppError } from "./app-error.js";

/** Express 5 typings allow `string | string[]`; normalize to a single path id. */
export function routeParam(
  value: string | string[] | undefined,
  label = "id",
): string {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id) throw new AppError("VALIDATION_ERROR", `Missing ${label}`, 400);
  return id;
}
