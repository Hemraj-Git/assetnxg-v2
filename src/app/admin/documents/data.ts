import "server-only";

import { KIND_LABEL } from "@/lib/contracts";
import type { DocumentType } from "@/lib/documents";
import { FORMER_MEMBER, loadPeopleNames } from "@/lib/people-names";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type LinkRef = { id: string; code: string; name: string };

export type DocumentRow = {
  id: string;
  code: string;
  title: string;
  docType: DocumentType;
  fileName: string;
  fileType: string;
  fileSize: number;
  assetIds: string[];
  contractIds: string[];
  spareIds: string[];
  /** Linked assets, contracts and spares this page can name, in number order. */
  assets: LinkRef[];
  contracts: LinkRef[];
  spares: LinkRef[];
  uploadedBy: string;
  createdAt: string;
};

/** A document as the "choose from library" list shows it. */
export type DocumentOption = Pick<DocumentRow, "id" | "code" | "title" | "docType" | "fileName" | "assetIds" | "contractIds" | "spareIds">;

const byCode = (a: { code: string }, b: { code: string }) => a.code.localeCompare(b.code, "en", { numeric: true });

/** The contracts a document can be linked to, named "AMC · Cool Air ·
 *  AMC/26/017" (assets come from loadContractRefs). */
export async function loadContractOptions(
  supabase: Supabase,
  orgId: string,
  vendors: { id: string; name: string }[],
): Promise<LinkRef[]> {
  const { data, error } = await supabase
    .from("contracts")
    .select("id, code, kind, vendor_id, contract_no")
    .eq("organization_id", orgId);
  if (error || !data) throw new Error(`Could not load contracts: ${error?.message ?? "no data"}`);
  const vendor = new Map(vendors.map((x) => [x.id, x.name]));
  return data
    .map((x) => ({
      id: x.id,
      code: x.code,
      name: [KIND_LABEL[x.kind], x.vendor_id ? vendor.get(x.vendor_id) : "the maker", x.contract_no].filter(Boolean).join(" · "),
    }))
    .sort(byCode);
}

type Only = { assetId?: string; contractId?: string; spareId?: string };

/** This client's documents, newest first (optionally only those linked to
 *  one asset, contract or spare). RLS limits them to staff of this client. */
export async function loadDocuments(
  supabase: Supabase,
  orgId: string,
  refs: { assets: LinkRef[]; contracts: LinkRef[]; spares?: LinkRef[] },
  only: Only = {},
): Promise<DocumentRow[]> {
  let q = supabase
    .from("documents")
    .select("id, code, title, doc_type, file_name, file_type, file_size, asset_ids, contract_ids, spare_ids, uploaded_by, created_at")
    .eq("organization_id", orgId);
  if (only.assetId) q = q.contains("asset_ids", [only.assetId]);
  if (only.contractId) q = q.contains("contract_ids", [only.contractId]);
  if (only.spareId) q = q.contains("spare_ids", [only.spareId]);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error || !data) throw new Error(`Could not load documents: ${error?.message ?? "no data"}`);

  const people = await loadPeopleNames(supabase, data.map((d) => d.uploaded_by));

  const asset = new Map(refs.assets.map((x) => [x.id, { id: x.id, code: x.code, name: x.name }]));
  const contract = new Map(refs.contracts.map((x) => [x.id, { id: x.id, code: x.code, name: x.name }]));
  const spare = new Map((refs.spares ?? []).map((x) => [x.id, { id: x.id, code: x.code, name: x.name }]));

  return data.map((d) => ({
    id: d.id,
    code: d.code,
    title: d.title,
    docType: d.doc_type,
    fileName: d.file_name,
    fileType: d.file_type,
    fileSize: d.file_size,
    assetIds: d.asset_ids,
    contractIds: d.contract_ids,
    spareIds: d.spare_ids,
    assets: d.asset_ids.map((id) => asset.get(id)).filter((x): x is LinkRef => Boolean(x)).sort(byCode),
    contracts: d.contract_ids.map((id) => contract.get(id)).filter((x): x is LinkRef => Boolean(x)).sort(byCode),
    spares: d.spare_ids.map((id) => spare.get(id)).filter((x): x is LinkRef => Boolean(x)).sort(byCode),
    uploadedBy: (d.uploaded_by && people.get(d.uploaded_by)) || FORMER_MEMBER,
    createdAt: d.created_at,
  }));
}

/** Every document, small, for "choose from library". */
export async function loadDocumentOptions(supabase: Supabase, orgId: string): Promise<DocumentOption[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, code, title, doc_type, file_name, asset_ids, contract_ids, spare_ids")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error || !data) throw new Error(`Could not load documents: ${error?.message ?? "no data"}`);
  return data.map((d) => ({
    id: d.id,
    code: d.code,
    title: d.title,
    docType: d.doc_type,
    fileName: d.file_name,
    assetIds: d.asset_ids,
    contractIds: d.contract_ids,
    spareIds: d.spare_ids,
  }));
}

/** Spares a document can name (empty when the Spares module is off: RLS
 *  hides them). */
export async function loadSpareOptions(supabase: Supabase, orgId: string): Promise<LinkRef[]> {
  const { data } = await supabase.from("spares").select("id, code, name").eq("organization_id", orgId);
  return (data ?? []).map((x) => ({ id: x.id, code: x.code, name: x.name })).sort(byCode);
}
