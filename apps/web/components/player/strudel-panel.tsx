"use client";

import { useState } from "react";
import { Code2, Copy, ExternalLink, Square, Play } from "lucide-react";

/** What the listener may do with the model's Strudel code: read it, copy it, open it on strudel.cc (where it can be changed and
 *  played), and stop it on this device. It cannot be edited here. */
export function strudelUrl(code: string): string {
  // strudel.cc puts the code in the URL hash: base64, then URL-encoded. Non-Latin-1 text goes through UTF-8 first.
  let b64: string;
  try { b64 = btoa(code); } catch { b64 = btoa(unescape(encodeURIComponent(code))); }
  return `https://strudel.cc/#${encodeURIComponent(b64)}`;
}

/** The code as it plays here: with the tempo, so it sounds the same on strudel.cc. */
export function copyableCode(code: string, bpm: number): string {
  return /\bsetcpm?\s*\(/.test(code) ? code : `setcps(${Math.round(bpm * 10) / 10}/60/4)\n${code}`;
}

export function StrudelPanel({ code, bpm, stopped, onToggle }: { code: string; bpm: number; stopped: boolean; onToggle: () => void }) {
  const [copied, setCopied] = useState(false);
  const full = copyableCode(code, bpm);
  const copy = async () => {
    try { await navigator.clipboard.writeText(full); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* the code is selectable below */ }
  };
  return (
    <details className="pl-set se-sm pl-code">
      <summary><Code2 size={14} aria-hidden /> Strudel code · {Math.round(bpm)} BPM</summary>
      <pre className="pl-code-pre" tabIndex={0} aria-label="The model's Strudel code, read only">{code}</pre>
      <div className="pl-actions">
        <button type="button" className="se-btn" onClick={() => void copy()}><Copy size={16} aria-hidden /> {copied ? "Copied" : "Copy code"}</button>
        <a className="se-btn" href={strudelUrl(full)} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} aria-hidden /> Open in Strudel</a>
        <button type="button" className="se-btn" aria-pressed={stopped} onClick={onToggle}>{stopped ? <><Play size={16} aria-hidden /> Play pattern</> : <><Square size={16} aria-hidden /> Stop pattern</>}</button>
      </div>
    </details>
  );
}
