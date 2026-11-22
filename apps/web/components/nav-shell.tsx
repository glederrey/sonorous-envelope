"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

/** The header navigation. Inline on wide screens; behind a burger button on phones (see .se-burger in globals.css). */
export function NavShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const id = useId();
  const burger = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!nav.current?.contains(t) && !burger.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <>
      <button
        ref={burger} type="button" className="se-btn se-btn-icon se-burger" aria-expanded={open} aria-controls={id}
        aria-label={open ? "Close the menu" : "Open the menu"} onClick={() => setOpen((o) => !o)}
      >
        {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
      </button>
      <nav ref={nav} id={id} className="se-nav" data-open={open} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
        {children}
      </nav>
    </>
  );
}
