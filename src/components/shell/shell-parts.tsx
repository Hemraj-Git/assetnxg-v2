import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getBrand, getOrgContext, isAdmin, type Brand } from "@/lib/auth";
import { initials } from "@/lib/initials";
import { roleSummary } from "@/lib/roles";
import { AccountMenu } from "./account-menu";
import { Avatar } from "./avatar";
import { ADMIN_HOME } from "./nav-config";
import { SideNav } from "./side-nav";

// Server parts of the shell. Each reads request data (host, session), so the
// layout renders each one inside its own <Suspense> (Cache Components).

// ───────────── Client logo slot (canvas · Client logo slot) ─────────────

function InitialsTile({ brand }: { brand: Brand }) {
  return (
    <span
      aria-hidden
      className="inline-flex size-8 flex-none items-center justify-center rounded-sm bg-text text-[12.5px] font-semibold tracking-[.02em] text-surface"
    >
      {initials(brand.name)}
    </span>
  );
}

/** Wide logo; without one, an initials tile and the name. */
export async function BrandWide() {
  const brand = await getBrand();
  if (!brand) return <span className="text-sm font-semibold">AssetNXG</span>;

  return (
    <Link
      href={ADMIN_HOME}
      aria-label={`${brand.name}, home`}
      className="flex h-12 w-[200px] min-w-0 items-center gap-2.5 text-text no-underline"
    >
      {brand.logoUrl ? (
        // White plate in dark theme: client logos are usually drawn for white.
        // eslint-disable-next-line @next/next/no-img-element -- client logos are org data on any host
        <img
          src={brand.logoUrl}
          alt=""
          className="max-h-10 max-w-[200px] object-contain dark:rounded-sm dark:bg-white dark:px-2 dark:py-1"
        />
      ) : (
        <>
          <InitialsTile brand={brand} />
          <span className="line-clamp-2 text-sm leading-[18px] font-semibold">{brand.name}</span>
        </>
      )}
    </Link>
  );
}

/** Square mark for the icon rail. */
export async function BrandMark() {
  const brand = await getBrand();
  if (!brand) return null;

  return (
    <Link href={ADMIN_HOME} aria-label={`${brand.name}, home`} title={brand.name} className="flex size-8 items-center justify-center">
      {brand.logoMarkUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- client logos are org data on any host
        <img src={brand.logoMarkUrl} alt="" className="size-8 object-contain dark:rounded-sm dark:bg-white dark:p-0.5" />
      ) : (
        <InitialsTile brand={brand} />
      )}
    </Link>
  );
}

// ───────────── Navigation for this client's modules ─────────────

export async function ModuleNav() {
  const ctx = await getOrgContext();
  if (ctx.status !== "ok") return <div className="flex-1" />;
  return <SideNav modules={ctx.modules} />;
}

// ───────────── Signed-in person ─────────────

/** Sidebar footer: avatar, name, roles. */
export async function SidebarMe() {
  const ctx = await getOrgContext();
  if (ctx.status !== "ok") return null;
  const name = ctx.user.fullName ?? ctx.user.email ?? "You";
  const roles = roleSummary(ctx.roles);

  return (
    <div
      className="flex items-center gap-2.5 rounded-sm px-2 py-1.5 rail:justify-center rail:px-0"
      title={`${name} · ${roles}`}
    >
      <Avatar name={name} />
      <span className="flex min-w-0 flex-col rail:sr-only">
        <span className="truncate text-[13px] leading-[18px] font-medium">{name}</span>
        <span className="truncate text-xs leading-4 text-text-3">{roles}</span>
      </span>
    </div>
  );
}

/** Header right: the account menu. */
export async function HeaderAccount() {
  const ctx = await getOrgContext();
  if (ctx.status !== "ok") return null;

  return (
    <AccountMenu
      account={{
        name: ctx.user.fullName ?? ctx.user.email ?? "You",
        email: ctx.user.email,
        roleLabel: roleSummary(ctx.roles),
        orgName: ctx.brand.name,
      }}
    />
  );
}

// ───────────── Access gate ─────────────

/**
 * The real access check for every admin page (the proxy only redirects
 * optimistically). Admins see the page; everyone else gets a plain reason.
 * Pages and Server Actions still check again for their own data (and RLS
 * checks every row).
 */
export async function AdminGate({ children }: { children: ReactNode }) {
  const ctx = await getOrgContext();

  switch (ctx.status) {
    case "signed-out":
      redirect("/sign-in?next=/admin");
    case "no-organisation":
      return (
        <GateNotice title="This address is not linked to an organisation">
          Open AssetNXG at your organisation&apos;s address, for example{" "}
          <span className="id">soms.assetnxg.app</span>.
        </GateNotice>
      );
    case "unknown-organisation":
      return (
        <GateNotice title="Organisation not found">
          There is no organisation at this address (<span className="id">{ctx.slug}</span>). Check
          the link you were given.
        </GateNotice>
      );
    case "suspended":
      return (
        <GateNotice title="This account is paused">
          {ctx.brand.name} is paused at the moment. Contact AssetNXG support at{" "}
          <a href="mailto:support@assetnxg.app">support@assetnxg.app</a>.
        </GateNotice>
      );
    case "not-a-member":
      return (
        <GateNotice title="No access">
          Your account does not have access to {ctx.brand.name}. Ask its Admin to add you.
        </GateNotice>
      );
    case "ok":
      if (!isAdmin(ctx.roles)) {
        return (
          <GateNotice title="This area is for Admins">
            Your work is in the field app, which arrives in a later phase.
          </GateNotice>
        );
      }
      return <>{children}</>;
  }
}

function GateNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-(--gutter) pt-10">
      <h1 className="text-page">{title}</h1>
      <p className="max-w-prose text-text-2">{children}</p>
    </div>
  );
}
