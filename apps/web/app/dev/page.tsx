import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";

export const metadata: Metadata = { title: "Dev tools", robots: { index: false, follow: false } };

// Every lab under /dev. Local only: app/dev/layout.tsx answers 404 in any production build.
const LABS = [
  { href: "/dev/player", name: "Player lab", text: "The real player on scripted states, no session needed: a synth scene, Strudel on, the hand-overs back to the synth, the closing sequence." },
  { href: "/dev/controls", name: "Controls lab", text: "The controls panel with made-up state: owner, listener or guest, each mode, Strudel or synth, and a scene or code behind it to judge the opacity and blur." },
  { href: "/dev/moment", name: "Moment lab", text: "The saved-moment page (/m/<id>) on a made-up synth state and a made-up Strudel state, no database: Start, Mute, Volume, Share, the QR code." },
  { href: "/dev/visuals", name: "Visuals lab", text: "The colour field and the scenes for each emotion and sample, with the silence fade, and a grey mode to tell them apart without hue." },
  { href: "/dev/account", name: "Account lab", text: "The signed-in header with its Account menu (and the burger on phones) and the Settings delete section, without signing in." },
  { href: "/dev/saved", name: "Saved lab", text: "The /saved list on made-up moments: the name search, the month filter, a long name, the empty state. Rename and delete do nothing here." },
  { href: "/dev/strudel", name: "Strudel lab", text: "Strudel code in the sandboxed frame with the drawings (piano roll, scope, spiral) and what the player reports back." },
];

export default function DevIndex() {
  return (
    <>
      <SiteHeader />
      <main className="doc-page">
        <div className="doc-head">
          <h1 className="doc-title">Dev tools</h1>
          <p className="se-muted">Labs for the local dev server. A production build answers 404 on every page here.</p>
        </div>
        <ul className="gd-say">
          {LABS.map((l) => (
            <li key={l.href} className="gd-card">
              <p className="se-sm se-mono gd-live"><a href={l.href}>{l.href}</a></p>
              <h2 className="se-heading">{l.name}</h2>
              <p className="se-muted">{l.text}</p>
            </li>
          ))}
        </ul>
        <p className="se-sm se-muted" style={{ marginTop: 24 }}>
          The player and Strudel labs need the bundles built once: <code>pnpm --filter web build:worklet</code> and <code>pnpm --filter web build:strudel</code>.
        </p>
      </main>
    </>
  );
}
