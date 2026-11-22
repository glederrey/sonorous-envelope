"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

/** Copies an absolute URL for a site path, so a session can be shared. `inline` draws it as a text link (no icon), for a line of text. */
export function CopyLink({ path, label = "Copy link", inline = false }: { path: string; label?: string; inline?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  }
  return (
    <button type="button" className={inline ? "se-link" : "se-btn"} onClick={copy}>
      {inline ? null : copied ? <Check size={16} aria-hidden /> : <Link2 size={16} aria-hidden />}
      <span role="status">{copied ? "Link copied" : label}</span>
    </button>
  );
}
