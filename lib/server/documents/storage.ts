import { createReadStream } from "fs";
import { mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { Readable } from "stream";

function sanitizeFileName(fileName: string) {
  const baseName = path.basename(fileName).trim();
  const normalized = baseName.replace(/[^A-Za-z0-9._-]+/g, "_");
  return normalized || "document";
}

export function getDocumentStorageRoot() {
  const configuredRoot = process.env.DOCUMENT_STORAGE_ROOT?.trim();

  if (configuredRoot) {
    return configuredRoot;
  }

  if (process.env.NODE_ENV !== "production") {
    return "/tmp/mfn-hr-documents-dev";
  }

  throw new Error("DOCUMENT_STORAGE_ROOT is not configured.");
}

export function buildEmployeeDocumentStorageKey(input: {
  employeeId: string;
  originalFileName: string;
}) {
  return path.posix.join(
    "employees",
    input.employeeId,
    `${randomUUID()}-${sanitizeFileName(input.originalFileName)}`
  );
}

function resolveStoragePath(storageKey: string) {
  const root = getDocumentStorageRoot();
  const normalizedKey = path.posix.normalize(storageKey);

  if (
    normalizedKey.startsWith("../") ||
    normalizedKey.includes("/../") ||
    normalizedKey === ".."
  ) {
    throw new Error("Storage key is invalid.");
  }

  return path.join(root, normalizedKey);
}

export async function saveDocumentFile(input: {
  storageKey: string;
  fileBuffer: Buffer;
}) {
  const absolutePath = resolveStoragePath(input.storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.fileBuffer);
}

export async function readDocumentFile(storageKey: string) {
  return readFile(resolveStoragePath(storageKey));
}

export async function deleteDocumentFile(storageKey: string) {
  await rm(resolveStoragePath(storageKey), { force: true });
}

export async function getDocumentFileStream(storageKey: string) {
  const absolutePath = resolveStoragePath(storageKey);
  const fileStats = await stat(absolutePath);

  return {
    contentLength: fileStats.size,
    stream: Readable.toWeb(createReadStream(absolutePath)) as ReadableStream,
  };
}
