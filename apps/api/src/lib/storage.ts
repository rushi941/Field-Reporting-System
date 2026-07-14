import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type StoredFile = {
  /** Public URL path or absolute S3 URL */
  storageUrl: string;
  /** Relative key / path inside the bucket or uploads root */
  storageKey: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
};

export type UploadInput = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  /** Optional folder prefix e.g. reports/{reportId} */
  folder?: string;
};

/**
 * Storage driver:
 * - local (default) — writes under UPLOAD_DIR, served at /uploads
 * - s3 — production; requires AWS_S3_BUCKET + credentials (not fully wired yet)
 */
export type StorageDriver = "local" | "s3";

function driver(): StorageDriver {
  const d = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();
  return d === "s3" ? "s3" : "local";
}

function uploadRoot() {
  return (
    process.env.UPLOAD_DIR ??
    path.resolve(process.cwd(), "uploads")
  );
}

function publicBaseUrl() {
  // API origin; web proxies /uploads → API in dev
  return (process.env.UPLOAD_PUBLIC_BASE_URL ?? "/uploads").replace(/\/$/, "");
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

async function storeLocal(input: UploadInput): Promise<StoredFile> {
  const folder = input.folder ?? "misc";
  const root = uploadRoot();
  const dir = path.join(root, folder);
  await mkdir(dir, { recursive: true });

  const fileName = safeName(input.originalName || "file");
  const key = path.join(folder, `${randomUUID()}-${fileName}`).replace(/\\/g, "/");
  const abs = path.join(root, key);
  await writeFile(abs, input.buffer);

  return {
    storageKey: key,
    storageUrl: `${publicBaseUrl()}/${key}`,
    fileName,
    fileType: input.mimeType || "application/octet-stream",
    fileSizeBytes: input.buffer.byteLength,
  };
}

/**
 * S3 placeholder — set STORAGE_DRIVER=s3 and wire AWS SDK when going to production.
 * Throws until implemented so misconfig is obvious.
 */
async function storeS3(_input: UploadInput): Promise<StoredFile> {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new Error(
      "STORAGE_DRIVER=s3 but AWS_S3_BUCKET is not set. Use STORAGE_DRIVER=local for now.",
    );
  }
  // Production: putObject to s3://bucket/{key} and return public/CDN URL
  throw new Error(
    "S3 upload is not enabled yet. Use STORAGE_DRIVER=local in this environment.",
  );
}

export async function storeUpload(input: UploadInput): Promise<StoredFile> {
  if (driver() === "s3") return storeS3(input);
  return storeLocal(input);
}

export function getUploadRoot() {
  return uploadRoot();
}

export function getStorageDriver() {
  return driver();
}
