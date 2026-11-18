"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { plainDbError } from "@/lib/db-errors";
import {
  ACCEPTED_FILES,
  DOC_TYPES,
  MAX_FILE_NAME,
  MAX_TITLE,
  checkFile,
  fileTypeOf,
  isDocumentPath,
  type DocumentType,
} from "@/lib/documents";
import { TRY_AGAIN, fail, isId, ok, text, type ActionState } from "@/lib/form-actions";

// Documents library (Admins only). Files go from the browser straight to the
// private "documents" bucket with a one-time signed upload link, so large
// files never pass through the server. The database then checks the file is
// in this client's folder, records its real size and type, numbers the
// document (DOC-YYYY-) and logs every change.

export type { ActionState };

const GONE = "This document was changed or removed meanwhile. Refresh the page.";

export type UploadTicket = { error: string | null; path: string | null; url: string | null; contentType: string | null };

/** Step 1 of an upload: where to put the file, and a signed link to put it. */
export async function prepareUpload(file: { name: string; type: string; size: number }): Promise<UploadTicket> {
  const { ctx, supabase } = await requireAdmin();
  const info = {
    name: typeof file?.name === "string" ? file.name : "",
    type: typeof file?.type === "string" ? file.type : "",
    size: typeof file?.size === "number" ? file.size : 0,
  };
  const problem = checkFile(info);
  if (problem) return { error: problem, path: null, url: null, contentType: null };

  const contentType = fileTypeOf(info);
  const path = `${ctx.brand.id}/${crypto.randomUUID()}.${ACCEPTED_FILES[contentType]}`;
  const { data, error } = await supabase.storage.from("documents").createSignedUploadUrl(path);
  if (error || !data) return { error: "Couldn't start the upload. Try again in a moment.", path: null, url: null, contentType: null };
  return { error: null, path, url: data.signedUrl, contentType };
}

function readLinks(formData: FormData, name: string): string[] | null {
  const ids = [...new Set(formData.getAll(name).filter((v): v is string => typeof v === "string" && v !== ""))];
  return ids.every(isId) ? ids : null;
}

function readDetails(formData: FormData): { title: string; docType: DocumentType } | string {
  const title = text(formData, "title");
  if (!title) return "Give the document a title.";
  if (title.length > MAX_TITLE) return `Keep the title under ${MAX_TITLE} characters.`;
  const docType = text(formData, "doc_type") as DocumentType;
  if (!DOC_TYPES.includes(docType)) return "Choose what kind of document it is.";
  return { title, docType };
}

/** Step 2: save the document (new: after the file is uploaded), or edit its
 *  title, type and asset / contract links (id). Spare links are set when
 *  uploading from a spare, and changed from the spare's page. */
export async function saveDocument(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (id !== null && !isId(id)) return fail(TRY_AGAIN);

  const details = readDetails(formData);
  if (typeof details === "string") return fail(details);
  const assetIds = readLinks(formData, "asset_ids");
  const contractIds = readLinks(formData, "contract_ids");
  if (!assetIds || !contractIds) return fail("Choose assets and contracts from the lists.");
  if (assetIds.length > 2000) return fail("A document can be linked to up to 2,000 assets.");
  if (contractIds.length > 200) return fail("A document can be linked to up to 200 contracts.");

  const values = { title: details.title, doc_type: details.docType, asset_ids: assetIds, contract_ids: contractIds };

  if (id === null) {
    const path = text(formData, "file_path");
    const fileName = text(formData, "file_name");
    if (!isDocumentPath(path, ctx.brand.id)) return fail("Choose the file to upload.");
    if (!fileName || fileName.length > MAX_FILE_NAME) return fail("Rename the file to something shorter, then choose it again.");
    const spareIds = readLinks(formData, "spare_ids");
    if (!spareIds || spareIds.length > 500) return fail("Choose spares from the list.");

    const { data, error } = await supabase
      .from("documents")
      .insert({ ...values, spare_ids: spareIds, organization_id: ctx.brand.id, file_path: path, file_name: fileName })
      .select("code")
      .single();
    if (error) {
      if (error.code === "23505") return fail("That file is already saved as a document. Refresh the page.");
      return fail(plainDbError(error, TRY_AGAIN));
    }
    refresh();
    return ok(`${data.code} saved.`);
  }

  const { data, error } = await supabase
    .from("documents")
    .update(values)
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("code");
  if (error) return fail(plainDbError(error, TRY_AGAIN));
  if (!data?.length) return fail(GONE);
  refresh();
  return ok(`${data[0].code} saved.`);
}

/** Attach documents to an asset, contract or spare, or remove one from it. */
export async function linkDocuments(
  target: "asset" | "contract" | "spare",
  targetId: string,
  documentIds: string[],
  link: boolean,
): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (!["asset", "contract", "spare"].includes(target) || !isId(targetId)) return fail(TRY_AGAIN);
  if (!Array.isArray(documentIds) || documentIds.length === 0 || documentIds.length > 200 || !documentIds.every(isId)) {
    return fail("Choose documents from the list.");
  }
  const { data, error } = await supabase.rpc("link_documents", {
    p_org: ctx.brand.id,
    p_document_ids: documentIds,
    p_target: target,
    p_target_id: targetId,
    p_link: Boolean(link),
  });
  if (error) return fail(plainDbError(error, TRY_AGAIN));
  if (!data) return fail(GONE);
  refresh();
  const n = documentIds.length;
  return ok(link ? `${n === 1 ? "Document" : `${n} documents`} attached.` : "Document removed from here. It stays in the library.");
}

/** Delete the record and its links. The file stays in storage (no deletes
 *  through the API), so support can recover it if asked. */
export async function deleteDocument(id: string): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (!isId(id)) return fail(TRY_AGAIN);
  const { data, error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("code");
  if (error) return fail(plainDbError(error, TRY_AGAIN));
  if (!data?.length) return fail(GONE);
  refresh();
  return ok(`${data[0].code} deleted.`);
}
