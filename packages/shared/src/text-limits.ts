import { z } from "zod";

/** Max length for notes, comments, and approval text */
export const TEXT_NOTE_MAX_LENGTH = 150;

/** Max length for person names and project names */
export const TEXT_NAME_MAX_LENGTH = 150;

export const optionalNoteTextSchema = z
  .string()
  .trim()
  .max(
    TEXT_NOTE_MAX_LENGTH,
    `Must be ${TEXT_NOTE_MAX_LENGTH} characters or less`,
  )
  .optional()
  .nullable();

export const requiredNoteTextSchema = z
  .string()
  .trim()
  .min(1, "This field is required")
  .max(
    TEXT_NOTE_MAX_LENGTH,
    `Must be ${TEXT_NOTE_MAX_LENGTH} characters or less`,
  );

export const personNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(
    TEXT_NAME_MAX_LENGTH,
    `Must be ${TEXT_NAME_MAX_LENGTH} characters or less`,
  );

export const projectNameSchema = z
  .string()
  .trim()
  .min(1, "Project name is required")
  .max(
    TEXT_NAME_MAX_LENGTH,
    `Must be ${TEXT_NAME_MAX_LENGTH} characters or less`,
  );
