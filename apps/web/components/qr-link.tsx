"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Smartphone } from "lucide-react";

/** Shows the player link as a QR code, to move from a computer to a phone. Drawn in the browser. */
export function QrLink({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState("");
  const [url, setUrl] = useState("");
  const [local, setLocal] = useState(false);

  useEffect(() => {
    if (!open) return;
    const u = `${window.location.origin}${path}`;
    setUrl(u);
    setLocal(["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname));
    // always dark on white: scanners need the contrast, whatever the theme
    void QRCode.toDataURL(u, { margin: 2, width: 288, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })
      .then(setSrc).catch(() => setSrc(""));
  }, [open, path]);

  return (
    <>
      <button type="button" className="se-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Smartphone size={16} aria-hidden />
        {open ? "Hide the code" : "Open on your phone"}
      </button>
      {open && (
        <div className="pl-qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src && <img src={src} width={288} height={288} alt={`QR code for ${url}`} />}
          <p className="se-sm">Scan it with your phone&apos;s camera to listen there.</p>
          {local && (
            <p className="se-sm">
              This address (localhost) only works on this computer. To scan it, open this site by your computer&apos;s network address.
            </p>
          )}
        </div>
      )}
    </>
  );
}
