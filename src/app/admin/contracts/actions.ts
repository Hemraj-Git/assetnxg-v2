"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { CONTRACT_KINDS, needsVendor, type ContractKind } from "@/lib/contracts";
import { daysBetween, parseDisplayDate } from "@/lib/dates";
import { plainDbError } from "@/lib/db-errors";
import { TRY_AGAIN, fail, isId, ok, optionalId, optionalNumber, text, type ActionState } from "@/lib/form-actions";

// Warranty and AMC contracts (Admins only). The database numbers them (CON-),
// checks the assets are this client's, refuses an asset in two overlapping
// contracts of the same group (naming both), keeps renewals linked, and logs
// every change.

export type { ActionState };

const GONE = "This contract was changed or removed meanwhile. Refresh the page.";

/** Add a contract, edit one (id), or renew one (renewsId). */
export async function saveContract(
  id: string | null,
  renewsId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if ((id !== null && !isId(id)) || (renewsId !== null && !isId(renewsId))) return fail(TRY_AGAIN);

  const kind = text(formData, "kind") as ContractKind;
  if (!CONTRACT_KINDS.includes(kind)) return fail("Choose what kind of contract it is.");
  const vendorId = optionalId(formData, "vendor_id");
  if (vendorId === undefined) return fail("Choose a vendor from the list.");
  if (needsVendor(kind) && !vendorId) return fail("Choose the vendor who services the assets under this AMC.");

  const startsOn = parseDisplayDate(text(formData, "starts_on"));
  const endsOn = parseDisplayDate(text(formData, "ends_on"));
  if (!startsOn) return fail("Enter the start date as DD-MM-YYYY.");
  if (!endsOn) return fail("Enter the end date as DD-MM-YYYY.");
  if (daysBetween(startsOn, endsOn) < 0) return fail("The contract ends before it starts.");

  const details = z
    .object({
      contract_no: z.string().max(60, "Keep the contract number under 60 characters."),
      coverage: z.string().max(500, "Keep the coverage note under 500 characters."),
    })
    .safeParse({ contract_no: text(formData, "contract_no"), coverage: text(formData, "coverage") });
  if (!details.success) return fail(details.error.issues[0]?.message ?? "Check the details.");

  const cost = optionalNumber(formData, "cost");
  if (cost === undefined || (cost !== null && cost > 999_999_999_999)) return fail("Enter the cost as a number, without the ₹ sign.");
  const visits = optionalNumber(formData, "visits_per_year");
  if (visits === undefined || (visits !== null && (!Number.isInteger(visits) || visits > 365))) {
    return fail("Enter the visits a year as a whole number.");
  }

  const assetIds = [...new Set(formData.getAll("asset_ids").filter((v): v is string => typeof v === "string"))];
  if (!assetIds.every(isId)) return fail("Choose assets from the list.");
  if (assetIds.length === 0) return fail("Choose at least one asset the contract covers.");
  if (assetIds.length > 2000) return fail("A contract can cover up to 2,000 assets.");

  const values = {
    kind,
    vendor_id: vendorId,
    contract_no: details.data.contract_no || null,
    starts_on: startsOn,
    ends_on: endsOn,
    cost,
    visits_per_year: visits,
    coverage: details.data.coverage || null,
    asset_ids: assetIds,
  };

  if (id === null) {
    const { data, error } = await supabase
      .from("contracts")
      .insert({ ...values, renewed_from_id: renewsId, organization_id: ctx.brand.id })
      .select("code")
      .single();
    if (error) {
      if (error.code === "23505") return fail("That contract has already been renewed. Refresh the page.");
      return fail(plainDbError(error, TRY_AGAIN));
    }
    refresh();
    return ok(
      `${data.code} saved, covering ${assetIds.length} ${assetIds.length === 1 ? "asset" : "assets"}${renewsId ? " (a renewal)" : ""}.`,
    );
  }

  const { data, error } = await supabase
    .from("contracts")
    .update(values)
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("code");
  if (error) return fail(plainDbError(error, TRY_AGAIN));
  if (!data?.length) return fail(GONE);
  refresh();
  return ok(`${data[0].code} saved.`);
}

/** Mark that a contract won't be renewed (or undo it). */
export async function setNotRenewing(id: string, notRenewing: boolean): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (!isId(id)) return fail(TRY_AGAIN);
  const { data, error } = await supabase
    .from("contracts")
    .update({ not_renewing: Boolean(notRenewing) })
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("code");
  if (error) return fail(plainDbError(error, TRY_AGAIN));
  if (!data?.length) return fail(GONE);
  refresh();
  return ok(notRenewing ? `${data[0].code} marked as not renewing.` : `${data[0].code} will show for renewal again.`);
}

export async function deleteContract(id: string): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (!isId(id)) return fail(TRY_AGAIN);
  const { data, error } = await supabase
    .from("contracts")
    .delete()
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("code");
  if (error) return fail(plainDbError(error, TRY_AGAIN));
  if (!data?.length) return fail(GONE);
  refresh();
  return ok(`${data[0].code} deleted.`);
}
