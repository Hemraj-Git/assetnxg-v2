import type { Database } from "@/lib/supabase/database.types";

// Documents library (02 "Documents"): types, the files storage accepts, and
// the checks the upload form runs before sending a file. The database and
// the storage bucket check the same again.

export type DocumentType = Database["public"]["Enums"]["document_type"];

export const DOC_TYPES = ["invoice", "warranty", "user_guide", "amc_contract", "other"] as const satisfies readonly DocumentType[];

export const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  invoice: "Invoice",
  warranty: "Warranty card",
  user_guide: "User guide",
  amc_contract: "AMC contract",
  other: "Other",
};

/** File types the "documents" bucket accepts, with the extension to store. */
export const ACCEPTED_FILES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

/** For the file picker's accept attribute. */
export const ACCEPT_ATTRIBUTE = [...Object.keys(ACCEPTED_FILES), ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".docx"].join(",");

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILE_NAME = 200;
export const MAX_TITLE = 120;

const BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** The file's type: what the browser says, or from its extension when the
 *  browser doesn't know (some do this for .docx). "" when not accepted. */
export function fileTypeOf(file: { name: string; type: string }): string {
  if (file.type && file.type in ACCEPTED_FILES) return file.type;
  if (file.type && file.type !== "application/octet-stream") return "";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[ext] ?? "";
}

/** A plain reason the file can't be uploaded, or null when it's fine. */
export function checkFile(file: { name: string; type: string; size: number }): string | null {
  if (!fileTypeOf(file)) return "Choose a PDF, a photo (JPEG, PNG or WebP) or a Word file (.docx).";
  if (file.size <= 0) return "That file is empty.";
  if (file.size > MAX_FILE_BYTES) return `That file is ${formatFileSize(file.size)}. Files can be up to 25 MB.`;
  if (file.name.trim().length === 0 || file.name.length > MAX_FILE_NAME) return "Rename the file to something shorter, then choose it again.";
  return null;
}

/** "AMC_agreement-2026.pdf" → "AMC agreement 2026": a starting title. */
export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return base.slice(0, MAX_TITLE);
}

/** 482133 → "471 KB"; 3 MB and up with one decimal. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "PDF", "Image", "Word": a short word for the file's kind. */
export function fileKind(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("image/")) return "Image";
  if (mime.includes("wordprocessingml")) return "Word";
  return "File";
}

/** A stored file's path: <organization id>/<uuid>.<ext>. */
export function isDocumentPath(path: string, orgId: string): boolean {
  const m = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\.(pdf|jpg|png|webp|docx)$/i.exec(path);
  return m !== null && m[1].toLowerCase() === orgId.toLowerCase();
}

/** The app's link that opens a document's file (or saves it). */
export function documentFileHref(id: string, download = false): string {
  return `/admin/documents/${id}/file${download ? "?download=1" : ""}`;
}
