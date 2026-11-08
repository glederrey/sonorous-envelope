"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the value stays selectable in the field.
    }
  }
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input readOnly aria-label={label} value={value} className="se-input se-mono" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="se-btn" onClick={copy} aria-label={copied ? "Copied" : `Copy ${label}`}>
        {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}
