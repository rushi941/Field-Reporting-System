import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { attachmentUploadMeta } from "@frs/shared";
import { AppError } from "../lib/app-error.js";

function payloadTooLarge(err: unknown) {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    (err as { status?: number }).status === 413
  );
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: null },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        details: err.flatten(),
      },
    });
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: {
          code: "FILE_TOO_LARGE",
          message: `File must be ${attachmentUploadMeta.maxLabel} or smaller`,
          details: null,
        },
      });
    }
    return res.status(400).json({
      error: {
        code: "UPLOAD_ERROR",
        message: err.message || "Upload failed",
        details: null,
      },
    });
  }

  if (payloadTooLarge(err)) {
    return res.status(413).json({
      error: {
        code: "FILE_TOO_LARGE",
        message: `File must be ${attachmentUploadMeta.maxLabel} or smaller`,
        details: null,
      },
    });
  }

  console.error(err);
  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
      details: null,
    },
  });
}
