"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/guide", label: "Connector" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="se-navlink" aria-current={pathname === l.href ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </>
  );
}
