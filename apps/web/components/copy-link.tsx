"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

/** Copies an absolute URL for a site path, so a session can be shared. */
export function CopyLink({ path, label = "Copy link" }: { path: string; label?: string }) {
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
    <button type="button" className="se-btn" onClick={copy}>
      {copied ? <Check size={16} aria-hidden /> : <Link2 size={16} aria-hidden />}
      <span role="status">{copied ? "Link copied" : label}</span>
    </button>
  );
}
