"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, FileText, Library, Search, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormMessage, inputClass } from "@/components/ui/field";
import { DOC_TYPE_LABEL, documentFileHref, fileKind, formatFileSize, type DocumentType } from "@/lib/documents";
import { initialActionState, type ActionState } from "@/lib/form-actions";
import { formatCount } from "@/lib/table-params";
import { cn } from "cn";
import { linkDocuments } from "./actions";
import type { DocumentOption, DocumentRow } from "./data";
import { DocumentDialog } from "./document-dialog";


export type LinkTarget = { kind: "asset" | "contract"; id: string; label: string };

/** The documents attached to one asset or contract: open, download, remove
 *  from here; attach from the library or upload a new one. */
export function LinkedDocuments({
  target,
  documents,
  library,
  uploadType,
}: {
  target: LinkTarget;
  /** Those attached to the target. */
  documents: Pick<DocumentRow, "id" | "code" | "title" | "docType" | "fileType" | "fileSize">[];
  /** Every document of this client, to choose from. */
  library: DocumentOption[];
  /** The type a new upload starts with (e.g. AMC contract on a contract). */
  uploadType?: DocumentType;
}) {
  const [uploading, setUploading] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [notice, setNotice] = useState<ActionState>(initialActionState);
  const [busy, startTransition] = useTransition();

  const linked = new Set(documents.map((d) => d.id));
  const available = library.filter((d) => !linked.has(d.id));

  return (
    <div className="flex flex-col gap-3">
      {(notice.error || notice.success) && (
        <FormMessage tone={notice.error ? "error" : "success"}>{notice.error ?? notice.success}</FormMessage>
      )}
      {documents.length === 0 ? (
        <p className="text-small text-text-3">No documents attached yet: invoice, warranty card, user guide or contract.</p>
      ) : (
        <ul className="flex flex-col">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 border-b border-border py-2 last:border-b-0">
              <FileText aria-hidden className="size-4 flex-none text-text-3" />
              <span className="flex min-w-0 flex-1 flex-col">
                <a href={documentFileHref(d.id)} target="_blank" rel="noopener" className="truncate text-cell font-medium">
                  {d.title}
                </a>
                <span className="truncate text-small text-text-3">
                  <span className="id">{d.code}</span> · {DOC_TYPE_LABEL[d.docType]} · {fileKind(d.fileType)} {formatFileSize(d.fileSize)}
                </span>
              </span>
              <a
                href={documentFileHref(d.id, true)}
                aria-label={`Download ${d.title}`}
                title="Download"
                className="grid size-7 flex-none place-items-center rounded-sm text-text-2 hover:bg-sunken hover:text-text"
              >
                <Download aria-hidden className="size-4" />
              </a>
              <button
                type="button"
                disabled={busy}
                aria-label={`Remove ${d.title} from here`}
                title="Remove from here (it stays in the library)"
                onClick={() =>
                  startTransition(async () => setNotice(await linkDocuments(target.kind, target.id, [d.id], false)))
                }
                className="grid size-7 flex-none place-items-center rounded-sm text-text-2 hover:bg-sunken hover:text-text disabled:opacity-50"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setUploading(true)}>
          <Upload aria-hidden /> Upload
        </Button>
        {available.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setChoosing(true)}>
            <Library aria-hidden /> Choose from library
          </Button>
        )}
      </div>

      {uploading && (
        <DocumentDialog
          dialog={{
            mode: "new",
            docType: uploadType,
            attachTo:
              target.kind === "asset"
                ? { assetIds: [target.id], label: target.label }
                : { contractIds: [target.id], label: target.label },
          }}
          refs={null}
          onClose={() => setUploading(false)}
          onDone={(message) => {
            setUploading(false);
            setNotice({ error: null, success: message });
          }}
        />
      )}
      {choosing && (
        <ChooseDocuments
          target={target}
          available={available}
          onClose={() => setChoosing(false)}
          onDone={(result) => {
            setChoosing(false);
            setNotice(result);
          }}
        />
      )}
    </div>
  );
}

function ChooseDocuments({
  target,
  available,
  onClose,
  onDone,
}: {
  target: LinkTarget;
  available: DocumentOption[];
  onClose: () => void;
  onDone: (result: ActionState) => void;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return available.filter(
      (d) => !needle || `${d.code} ${d.title} ${d.fileName} ${DOC_TYPE_LABEL[d.docType]}`.toLowerCase().includes(needle),
    );
  }, [available, q]);

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="text-card">Choose from library</DialogTitle>
          <DialogDescription>Attach documents already in the library to {target.label}.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <span className="relative">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-3" />
            <input
              aria-label="Search documents"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search number, title or file"
              className={cn(inputClass, "h-8 pl-8 text-[13px]")}
            />
          </span>
          <ul className="max-h-72 overflow-y-auto rounded-sm border border-border">
            {shown.length === 0 ? (
              <li className="px-3 py-4 text-small text-text-3">No documents match.</li>
            ) : (
              shown.slice(0, 300).map((d) => (
                <li key={d.id} className="border-b border-border last:border-b-0">
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-sunken has-checked:bg-primary-weak">
                    <input
                      type="checkbox"
                      checked={selected.has(d.id)}
                      onChange={() =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (next.has(d.id)) next.delete(d.id);
                          else next.add(d.id);
                          return next;
                        })
                      }
                      className="size-4 flex-none accent-(--color-primary)"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-cell font-medium">{d.title}</span>
                      <span className="truncate text-small text-text-3">
                        <span className="id">{d.code}</span> · {DOC_TYPE_LABEL[d.docType]} · {d.fileName}
                      </span>
                    </span>
                  </label>
                </li>
              ))
            )}
          </ul>
          <span className="text-small text-text-3">{formatCount(selected.size)} chosen</span>
          {error && <FormMessage tone="error">{error}</FormMessage>}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={pending}
            disabled={selected.size === 0}
            onClick={() =>
              startTransition(async () => {
                const result = await linkDocuments(target.kind, target.id, [...selected], true);
                if (result.error) setError(result.error);
                else onDone(result);
              })
            }
          >
            Attach {selected.size > 0 ? formatCount(selected.size) : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
