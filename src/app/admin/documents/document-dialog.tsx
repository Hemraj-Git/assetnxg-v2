"use client";

import { useActionState, useMemo, useRef, useState, type DragEvent } from "react";
import { CheckCircle2, FileUp, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField, inputClass } from "@/components/ui/field";
import {
  ACCEPT_ATTRIBUTE,
  DOC_TYPES,
  DOC_TYPE_LABEL,
  MAX_TITLE,
  checkFile,
  fileKind,
  fileTypeOf,
  formatFileSize,
  titleFromFileName,
  type DocumentType,
} from "@/lib/documents";
import { initialActionState, type ActionState } from "@/lib/form-actions";
import { formatCount } from "@/lib/table-params";
import { cn } from "cn";
import { AssetPicker, type AssetPickerRefs } from "../contracts/asset-picker";
import { saveDocument } from "./actions";
import type { DocumentRow, LinkRef } from "./data";
import { uploadFile } from "./upload-file";

export type DocumentLinkRefs = AssetPickerRefs & { contracts: LinkRef[] };

export type DocumentDialogMode =
  | {
      mode: "new";
      /** Upload from an asset or contract: linked to it, no pickers. */
      attachTo?: { assetIds?: string[]; contractIds?: string[]; spareIds?: string[]; label: string };
      docType?: DocumentType;
    }
  | { mode: "edit"; doc: DocumentRow };

type Upload =
  | { state: "none" }
  | { state: "uploading"; file: File; percent: number }
  | { state: "done"; file: File; path: string }
  | { state: "failed"; file: File | null; error: string };

/** Upload a document (file, title, type, links), or edit one's title, type
 *  and links. The file goes to storage as soon as it's chosen. */
export function DocumentDialog({
  dialog,
  refs,
  onClose,
  onDone,
}: {
  dialog: DocumentDialogMode;
  refs: DocumentLinkRefs | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const editing = dialog.mode === "edit" ? dialog.doc : null;
  const attachTo = dialog.mode === "new" ? dialog.attachTo : undefined;

  const [title, setTitle] = useState(editing?.title ?? "");
  const [assets, setAssets] = useState<Set<string>>(new Set(editing?.assetIds ?? attachTo?.assetIds ?? []));
  const [contracts, setContracts] = useState<Set<string>>(new Set(editing?.contractIds ?? attachTo?.contractIds ?? []));
  const [upload, setUpload] = useState<Upload>({ state: "none" });
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // Ignore a slow upload's result once another file was chosen.
  const latest = useRef<File | null>(null);

  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await saveDocument(editing?.id ?? null, prev, formData);
    if (result.success) onDone(result.success);
    return result;
  }, initialActionState);

  async function choose(file: File | undefined) {
    if (!file) return;
    const problem = checkFile(file);
    if (problem) {
      setUpload({ state: "failed", file: null, error: problem });
      return;
    }
    latest.current = file;
    if (!title.trim()) setTitle(titleFromFileName(file.name));
    setUpload({ state: "uploading", file, percent: 0 });
    const result = await uploadFile(file, (percent) => {
      if (latest.current === file) setUpload({ state: "uploading", file, percent });
    });
    if (latest.current !== file) return;
    setUpload(result.error === null ? { state: "done", file, path: result.path } : { state: "failed", file, error: result.error });
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (upload.state !== "uploading") void choose(e.dataTransfer.files[0]);
  }

  const busy = pending || upload.state === "uploading";
  const ready = editing !== null || upload.state === "done";

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent size={refs && !attachTo ? "lg" : "md"}>
        <form action={action} noValidate className="contents">
          <DialogHeader>
            <DialogTitle className="text-card">{editing ? `Edit ${editing.code}` : "Upload document"}</DialogTitle>
            <DialogDescription>
              {editing
                ? `The file (${editing.fileName}) stays as it is. To change it, upload the new one as a document.`
                : attachTo
                  ? `It's added to the library and attached to ${attachTo.label}.`
                  : "PDF, photo or Word file, up to 25 MB. The number (DOC-…) is given when you save."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            {!editing && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] leading-[18px] font-medium">File</span>
                <input
                  ref={fileInput}
                  type="file"
                  accept={ACCEPT_ATTRIBUTE}
                  className="sr-only"
                  aria-label="Choose a file"
                  onChange={(e) => {
                    void choose(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                {upload.state === "done" && <input type="hidden" name="file_path" value={upload.path} />}
                {upload.state === "done" && <input type="hidden" name="file_name" value={upload.file.name} />}

                {upload.state === "none" || (upload.state === "failed" && !upload.file) ? (
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-sm border border-dashed border-border-strong px-4 py-6 text-center hover:bg-sunken",
                      dragging && "border-primary bg-primary-weak",
                    )}
                  >
                    <FileUp aria-hidden className="size-5 text-text-2" />
                    <span className="text-cell font-medium">Drop a file here, or choose one</span>
                    <span className="text-small text-text-3">PDF, JPEG, PNG, WebP or Word (.docx) · up to 25 MB</span>
                  </button>
                ) : (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDrop}
                    className="flex items-center gap-3 rounded-sm border border-border px-3 py-2.5"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-cell font-medium">{upload.file?.name}</span>
                      <span className="text-small text-text-3">
                        {upload.file && `${fileKind(fileTypeOf(upload.file))} · ${formatFileSize(upload.file.size)}`}
                        {upload.state === "uploading" && ` · uploading ${upload.percent}%`}
                        {upload.state === "done" && " · uploaded"}
                      </span>
                      {upload.state === "uploading" && (
                        <span
                          role="progressbar"
                          aria-label="Upload progress"
                          aria-valuenow={upload.percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          className="h-1 overflow-hidden rounded-full bg-sunken"
                        >
                          <span className="block h-full bg-primary transition-[width]" style={{ width: `${upload.percent}%` }} />
                        </span>
                      )}
                    </span>
                    {upload.state === "done" && <CheckCircle2 aria-label="Uploaded" className="size-4 flex-none text-success" />}
                    {upload.state === "failed" && upload.file && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => void choose(upload.file ?? undefined)}>
                        <RotateCcw aria-hidden /> Retry
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={upload.state === "uploading"}
                      onClick={() => fileInput.current?.click()}
                    >
                      Change file
                    </Button>
                  </div>
                )}
                {upload.state === "failed" && <FormMessage tone="error">{upload.error}</FormMessage>}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
              <TextField
                label="Title"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={MAX_TITLE}
                placeholder="e.g. Invoice 4471 · 12 split ACs"
              />
              <SelectField
                label="Type"
                name="doc_type"
                defaultValue={editing?.docType ?? (dialog.mode === "new" ? (dialog.docType ?? "other") : "other")}
                options={DOC_TYPES.map((t) => ({ value: t, label: DOC_TYPE_LABEL[t] }))}
              />
            </div>

            {attachTo || !refs ? (
              <>
                {[...assets].map((id) => (
                  <input key={id} type="hidden" name="asset_ids" value={id} />
                ))}
                {[...contracts].map((id) => (
                  <input key={id} type="hidden" name="contract_ids" value={id} />
                ))}
                {(attachTo?.spareIds ?? []).map((id) => (
                  <input key={id} type="hidden" name="spare_ids" value={id} />
                ))}
              </>
            ) : (
              <>
                <AssetPicker refs={refs} selected={assets} onChange={setAssets} legend="Linked assets" />
                <ContractPicker contracts={refs.contracts} selected={contracts} onChange={setContracts} />
              </>
            )}

            {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!ready || busy}>
              {editing ? "Save" : "Save document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ContractPicker({
  contracts,
  selected,
  onChange,
}: {
  contracts: LinkRef[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return contracts.filter((c) => !needle || `${c.code} ${c.name}`.toLowerCase().includes(needle));
  }, [contracts, q]);

  if (contracts.length === 0) return null;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-[13px] leading-[18px] font-medium">
        Linked warranties and AMCs <span className="font-normal text-text-3">· {formatCount(selected.size)} chosen</span>
      </legend>
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="contract_ids" value={id} />
      ))}
      {contracts.length > 8 && (
        <span className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-3" />
          <input
            aria-label="Search contracts"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search number, kind or vendor"
            className={cn(inputClass, "h-8 pl-8 text-[13px]")}
          />
        </span>
      )}
      <ul className="max-h-48 overflow-y-auto rounded-sm border border-border">
        {shown.length === 0 ? (
          <li className="px-3 py-4 text-small text-text-3">No contracts match.</li>
        ) : (
          shown.map((c) => (
            <li key={c.id} className="border-b border-border last:border-b-0">
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-sunken has-checked:bg-primary-weak">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => {
                    const next = new Set(selected);
                    if (next.has(c.id)) next.delete(c.id);
                    else next.add(c.id);
                    onChange(next);
                  }}
                  className="size-4 flex-none accent-(--color-primary)"
                />
                <span className="id w-20 flex-none text-text-2">{c.code}</span>
                <span className="truncate text-cell">{c.name}</span>
              </label>
            </li>
          ))
        )}
      </ul>
    </fieldset>
  );
}
