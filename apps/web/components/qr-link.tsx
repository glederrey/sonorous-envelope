"use client";

import { useEffect, useRef, useState } from "react";
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

  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button type="button" className="se-btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Smartphone size={16} aria-hidden />
        QR code
      </button>
      {/* a centred popup: it keeps the page still and the code can be large; Esc, a click outside or Close shuts it */}
      <dialog ref={dialog} className="pl-qr-dialog" aria-label="QR code to listen on a phone" onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        <div className="pl-qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src && <img src={src} width={288} height={288} alt={`QR code for ${url}`} />}
          <p className="se-sm">Scan it with your phone&apos;s camera to listen there.</p>
          {local && (
            <p className="se-sm">
              This address (localhost) only works on this computer. To scan it, open this site by your computer&apos;s network address.
            </p>
          )}
          <button type="button" className="se-btn" onClick={() => setOpen(false)}>Close</button>
        </div>
      </dialog>
    </>
  );
}
