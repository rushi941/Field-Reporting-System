import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

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
type StorageDriver = "local" | "s3";

function driver(): StorageDriver {
  const d = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();
  return d === "s3" ? "s3" : "local";
}

function uploadRoot() {
  const envDir = process.env.UPLOAD_DIR;
  if (envDir && path.isAbsolute(envDir)) return envDir;
  const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  if (envDir) return path.resolve(apiRoot, envDir);
  return path.join(apiRoot, "uploads");
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

/** Best-effort delete of a locally stored upload. No-op for S3 or unknown URLs. */
export async function deleteStoredFile(storageUrl: string) {
  if (driver() !== "local") return;
  const base = publicBaseUrl();
  if (!storageUrl.startsWith(`${base}/`)) return;
  const key = storageUrl.slice(base.length + 1);
  if (!key || key.includes("..") || path.isAbsolute(key)) return;
  const abs = path.join(uploadRoot(), key);
  await unlink(abs).catch(() => undefined);
}
