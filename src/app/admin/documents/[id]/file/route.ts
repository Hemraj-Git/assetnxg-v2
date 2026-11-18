import type { NextRequest } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { isId } from "@/lib/form-actions";
import { createClient } from "@/lib/supabase/server";

// Opens a document's file (?download=1 saves it instead). The bucket is
// private: this hands out a signed link that works for one minute. RLS on
// the document row and on storage decide who may have it (staff of this
// client), so the same link serves the field app later.

const LINK_SECONDS = 60;

export async function GET(request: NextRequest, ctx: RouteContext<"/admin/documents/[id]/file">) {
  const { id } = await ctx.params;
  const org = await getOrgContext();
  if (org.status === "signed-out") {
    return Response.redirect(new URL("/sign-in", request.url), 307);
  }
  if (org.status !== "ok" || !isId(id)) return new Response("Not found", { status: 404 });

  const supabase = await createClient({ orgId: org.brand.id });
  const { data: doc } = await supabase
    .from("documents")
    .select("file_path, file_name")
    .eq("id", id)
    .eq("organization_id", org.brand.id)
    .maybeSingle();
  if (!doc) return new Response("Not found", { status: 404 });

  const download = request.nextUrl.searchParams.get("download") === "1";
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.file_path, LINK_SECONDS, download ? { download: doc.file_name } : undefined);
  if (error || !data) return new Response("The file couldn't be opened. Try again in a moment.", { status: 502 });

  return new Response(null, {
    status: 307,
    headers: { Location: data.signedUrl, "Cache-Control": "private, no-store" },
  });
}
