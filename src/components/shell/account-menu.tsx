"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Copy, KeyRound, LifeBuoy, LogOut, Monitor, Moon, Sun, Volume2 } from "lucide-react";
import { signOut } from "@/app/(auth)/sign-in/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { NewPasswordFields } from "@/components/ui/new-password-fields";
import { PasswordInput } from "@/components/ui/password-input";
import { changePassword, type PasswordState } from "@/lib/account-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ThemePreference } from "@/lib/theme";
import { Avatar } from "./avatar";
import { useSoundPreference } from "./use-sound";
import { useTheme } from "./use-theme";

const SUPPORT_EMAIL = "support@assetnxg.app";

export type AccountSummary = {
  name: string;
  email: string | null;
  roleLabel: string;
  orgName: string;
};

// Canvas · Header menus › Avatar menu. Help and About moved here from v1's
// sidebar card ("A product of HMS Digital Solutions / Contact for Support").
export function AccountMenu({ account }: { account: AccountSummary }) {
  const { preference, setTheme } = useTheme();
  const [soundOn, setSoundOn] = useSoundPreference();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [signingOut, startSignOut] = useTransition();

  return (
    <>
      {/* Not modal, so opening Help and About from it doesn't fight over focus. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="w-9"
            aria-label={`Account menu for ${account.name}`}
          >
            <Avatar name={account.name} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="w-72">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={account.name} size="lg" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[13.5px] font-semibold">{account.name}</span>
              {account.email && (
                <span className="truncate text-caption font-normal text-text-3">{account.email}</span>
              )}
              <span className="truncate text-caption font-normal text-text-3">
                {account.roleLabel} · {account.orgName}
              </span>
            </div>
          </div>
          <DropdownMenuSeparator />

          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={preference}
            onValueChange={(v) => setTheme(v as ThemePreference)}
          >
            <DropdownMenuRadioItem value="light">
              <Sun aria-hidden /> Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon aria-hidden /> Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <Monitor aria-hidden /> Same as this device
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />

          <DropdownMenuCheckboxItem
            checked={soundOn}
            onCheckedChange={(on) => setSoundOn(on === true)}
            onSelect={(e) => e.preventDefault()}
            className="min-h-8 gap-2.5 rounded-xs py-1.5 pr-8 pl-2 text-[13.5px]"
          >
            <Volume2 aria-hidden className="text-text-3" /> Sound for new alerts
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
            <KeyRound aria-hidden /> Change password
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAboutOpen(true)}>
            <LifeBuoy aria-hidden /> Help and About
          </DropdownMenuItem>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            disabled={signingOut}
            onSelect={(e) => {
              e.preventDefault();
              startSignOut(() => signOut());
            }}
          >
            <LogOut aria-hidden /> {signingOut ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <HelpAboutDialog open={aboutOpen} onOpenChange={setAboutOpen} orgName={account.orgName} />
      {/* Mounted only while open, so it starts empty every time. */}
      {passwordOpen && <ChangePasswordDialog account={account} onClose={() => setPasswordOpen(false)} />}
    </>
  );
}

const passwordInitial: PasswordState = { error: null, success: null };

function ChangePasswordDialog({ account, onClose }: { account: AccountSummary; onClose: () => void }) {
  const [state, action, pending] = useActionState(changePassword, passwordInitial);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-card">Change password</DialogTitle>
          <DialogDescription>For {account.email ?? account.name}.</DialogDescription>
        </DialogHeader>

        {state.success ? (
          <>
            <Alert tone="success" title={state.success} />
            <DialogFooter>
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form action={action} className="flex flex-col gap-5" noValidate>
            {state.error && <Alert tone="danger" title={state.error} />}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="current-password" className="text-[13px] leading-[18px] font-medium">
                Current password
              </label>
              <PasswordInput id="current-password" name="current" autoComplete="current-password" required />
            </div>
            <NewPasswordFields email={account.email} name={account.name} idPrefix="change" />
            <DialogFooter>
              {/* Cancel left, action right (canvas rule). */}
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Change password
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HelpAboutDialog({
  open,
  onOpenChange,
  orgName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the address is on screen to copy by hand.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-card">Help and About</DialogTitle>
          <DialogDescription>
            AssetNXG for {orgName}. For help, write to the support team.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 rounded-sm border border-border bg-sunken px-3 py-2">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="truncate">
            {SUPPORT_EMAIL}
          </a>
          <Button variant="ghost" size="sm" onClick={copy}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <p className="text-small text-text-2">A product of HMS Digital Solutions.</p>
        <span role="status" className="sr-only">
          {copied ? "Support email copied" : ""}
        </span>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
