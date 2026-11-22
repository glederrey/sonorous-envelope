"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, CircleUser } from "lucide-react";
import { signOut } from "../app/settings/actions";

/**
 * The signed-in account menu. A disclosure panel under the Account button on wide screens; on phones the toggle is hidden and
 * the same list is shown flat inside the burger panel (see .se-account in globals.css).
 */
export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const row = (href: string, label: string) => (
    <li className={`se-account-item se-account-item-${label.toLowerCase()}`}>
      <Link href={href} className="se-account-row" aria-current={pathname === href ? "page" : undefined}>{label}</Link>
    </li>
  );

  return (
    <div className="se-account" ref={root}>
      <button
        ref={toggle} type="button" className="se-btn se-account-toggle" aria-expanded={open} aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <CircleUser size={20} aria-hidden />
        Account
        <ChevronDown size={16} aria-hidden />
      </button>
      <ul id={id} className="se-account-list" data-open={open} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
        <li className="se-account-label">Account</li>
        {row("/sessions", "Sessions")}
        {row("/saved", "Moments")}
        {row("/settings", "Settings")}
        <li className="se-account-sep" aria-hidden />
        <li className="se-account-item se-account-item-signout">
          <form action={signOut}>
            <button type="submit" className="se-account-row">Sign out</button>
          </form>
        </li>
      </ul>
    </div>
  );
}
