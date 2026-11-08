import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { CopyField } from "../components/copy-field";
import { Envelope } from "../components/envelope";
import { mcpResourceUrl } from "../lib/env";

export const dynamic = "force-dynamic";

const loop = [
  ["Claude sets a mood", "Warmth, calm, joy, closeness. Exact sounds, gestures and colour are optional."],
  ["Your browser plays it", "Sound and colour glide from one state to the next, live."],
  ["Claude hears back", "What actually played after your limits, and how you reacted."],
] as const;

export default function Home() {
  return (
    <>
      <div className="lp-hero">
        <div className="lp-field" aria-hidden />
        <SiteHeader overlay />
        <div className="lp-hero-body">
          <h1 className="lp-headline">Let the model hum while it thinks.</h1>
          <p className="lp-lede">
            A small synthesizer and a colour field for Claude. It sets the mood while it works, you hear and see it
            beside the chat, and it hears back what really played.
          </p>
          <div className="lp-connect">
            <CopyField label="Connector URL" value={mcpResourceUrl()} />
            <p className="se-sm lp-connect-note">
              Paste this into Claude: Settings → Connectors → Add custom connector.
              <br />
              <a href="#add">Step by step</a>
            </p>
          </div>
          <Envelope className="lp-envelope" />
        </div>
      </div>

      <main className="se-page lp-main">
        <section className="lp-loop" id="how">
          <h2 className="se-title">A conversation with a second channel</h2>
          <ol className="lp-loop-list">
            {loop.map(([title, text]) => (
              <li key={title}>
                <h3 className="se-heading">{title}</h3>
                <p className="se-muted">{text}</p>
              </li>
            ))}
          </ol>
          <p className="lp-wide">
            You stay in control throughout: volume, one-tap mute, limits and a consent level. The model can never go
            past them. <a href="/safety">How safety works</a>
          </p>
        </section>

        <section className="lp-split" id="add">
          <div>
            <h2 className="se-title">Add it to Claude</h2>
            <p className="se-muted">Takes a minute. It works in the web, desktop and mobile apps on the same account.</p>
          </div>
          <ol className="lp-steps">
            <li>Open <strong>Settings → Connectors</strong> and choose <strong>Add custom connector</strong>.</li>
            <li>Paste the connector URL above and save. Choose <strong>Connect</strong>: you sign in here and approve access.</li>
            <li>In a new conversation, switch the connector on from the <strong>+</strong> menu in the message box.</li>
            <li>Claude gives you a player link. Open it and tap <strong>Start listening</strong>.</li>
          </ol>
        </section>

        <section className="lp-split" id="player">
          <div>
            <h2 className="se-title">Keep the player open</h2>
          </div>
          <div className="se-stack">
            <p>
              <strong>The sound plays in the player page, not in Claude.</strong> Closing the page stops the sound, and
              Claude stops getting your reactions.
            </p>
            <p className="se-muted">
              Best setup: the player in one window or device, the chat in another. On a phone, keep the player in the
              foreground with the screen on, because phones pause web audio when you switch apps.
            </p>
          </div>
        </section>

        <section className="lp-split" id="name">
          <div>
            <h2 className="se-title">The name</h2>
          </div>
          <p className="se-muted">
            In synthesis, the envelope is the shape a sound takes over time. In psychoanalysis, Didier Anzieu&apos;s
            sonorous envelope is the bath of sound that holds a person before words. The sound is an expressive channel,
            not proof of what the model feels.
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
