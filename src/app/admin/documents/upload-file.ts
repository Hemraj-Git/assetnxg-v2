import { checkFile } from "@/lib/documents";
import { prepareUpload } from "./actions";

// Browser side of an upload: ask the server for a one-time signed link to
// this client's folder, then send the file straight to storage. Storage
// checks the type and the 25 MB limit again. No Supabase client in the
// browser (CLAUDE.md: only for Realtime); this is a plain request.

export type UploadResult = { path: string; error: null } | { path: null; error: string };

export async function uploadFile(file: File, onProgress?: (percent: number) => void): Promise<UploadResult> {
  const problem = checkFile(file);
  if (problem) return { path: null, error: problem };

  let ticket;
  try {
    ticket = await prepareUpload({ name: file.name, type: file.type, size: file.size });
  } catch {
    return { path: null, error: "Couldn't start the upload. Check your connection and try again." };
  }
  if (ticket.error || !ticket.url || !ticket.path || !ticket.contentType) {
    return { path: null, error: ticket.error ?? "Couldn't start the upload. Try again in a moment." };
  }
  const { url, path, contentType } = ticket;

  return new Promise<UploadResult>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", contentType);
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("x-upsert", "false");
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (key) xhr.setRequestHeader("apikey", key);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({ path, error: null });
      else if (xhr.status === 413) resolve({ path: null, error: "That file is too large. Files can be up to 25 MB." });
      else if (xhr.status === 415) resolve({ path: null, error: "That kind of file can't be uploaded. Choose a PDF, a photo or a Word file." });
      else resolve({ path: null, error: "The upload didn't finish. Try again." });
    };
    xhr.onerror = () => resolve({ path: null, error: "The upload stopped. Check your connection and try again." });
    xhr.send(file);
  });
}
