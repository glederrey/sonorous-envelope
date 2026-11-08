import { SiteHeader } from "../components/site-header";
import { CopyField } from "../components/copy-field";
import { mcpResourceUrl } from "../lib/env";

export const dynamic = "force-dynamic";

const GITHUB = "https://github.com/glederrey/sonorous-envelope";

const steps = [
  {
    title: "Claude sets a mood",
    text: "While it works, and at the end of every message, it calls the connector with a mood and, if it wants, exact sounds, short gestures and colour.",
  },
  {
    title: "Your browser plays it",
    text: "The player page renders the sound and the colour field live, and glides from one state to the next.",
  },
  {
    title: "Claude hears back",
    text: "It gets what was really played: the settings after your limits, how the sound reads on the same mood axes, and your reactions.",
  },
  {
    title: "You stay in control",
    text: "Volume, one-tap mute, limits, a consent level, and buttons like calmer or softer. The model can never go past your limits.",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section
          className="se-page se-stack"
          style={{ paddingTop: 64, paddingBottom: 64, paddingLeft: 0, paddingRight: 0, background: "linear-gradient(135deg, var(--field-a), var(--field-b))", maxWidth: "none" }}
        >
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }} className="se-stack">
            <h1 className="se-display" style={{ color: "var(--on-scrim)" }}>Let the model hum while it thinks.</h1>
            <p style={{ color: "var(--on-scrim-muted)", fontSize: 18 }}>
              Sonorous Envelope gives Claude a second voice: a small synthesizer and a colour field you hear and see
              while it works.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a className="se-btn se-btn-primary" href="#add">Add to Claude</a>
              <a className="se-btn" href="#how">How it works</a>
            </div>
          </div>
        </section>

        <div className="se-page" style={{ paddingTop: 64 }}>
          <section className="se-stack" id="idea">
            <h2 className="se-title">The idea</h2>
            <p>
              Text is the only channel a language model normally has. This adds a second one, ambient and non-verbal.
            </p>
            <p>
              During each turn the model describes a mood: warmth, closeness, joy, calm, spontaneity. Your browser turns
              it into a slow, living loop of sound and colour, and glides from one state to the next.
            </p>
            <p>
              The name has two meanings. In synthesis, the envelope is the shape a sound takes over time. In
              psychoanalysis, Anzieu&apos;s &ldquo;sonorous envelope&rdquo; is the bath of sound that holds a person
              before words. One caveat: the sound is an expressive channel, not proof of what the model feels.
            </p>
          </section>

          <section className="se-stack" id="how" style={{ marginTop: 64 }}>
            <h2 className="se-title">How it works</h2>
            <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 16 }}>
              {steps.map((step, i) => (
                <li key={step.title} className="se-card">
                  <span className="se-mono se-sm se-muted">0{i + 1}</span>
                  <h3 className="se-heading">{step.title}</h3>
                  <p className="se-muted" style={{ margin: "4px 0 0" }}>{step.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="se-stack" id="add" style={{ marginTop: 64 }}>
            <h2 className="se-title">Add it to Claude</h2>
            <CopyField label="Connector URL" value={mcpResourceUrl()} />
            <ol className="se-stack" style={{ paddingLeft: 24 }}>
              <li>In claude.ai, open <strong>Settings → Connectors</strong> and choose <strong>Add custom connector</strong>.</li>
              <li>Name it &ldquo;Sonorous Envelope&rdquo; and paste the URL above. Save, then <strong>Connect</strong>: you are sent here to sign in and approve access. Then you are back in Claude.</li>
              <li>In a new conversation, turn the connector on from the tools menu in the message box. Claude starts a session and gives you a link to your player page.</li>
              <li>Open the link and tap <strong>Start listening</strong>.</li>
            </ol>
            <ul className="se-sm se-muted" style={{ paddingLeft: 24 }}>
              <li>See <a href="/guide">Using the connector</a> for what Claude can do with it.</li>
              <li>The connector works in the Claude desktop and mobile apps on the same account.</li>
              <li>Each conversation gets its own session. Turn the connector on at the start of the conversation.</li>
              <li>Custom connectors may depend on your Claude plan, and menu names can change.</li>
            </ul>
          </section>

          <section
            className="se-stack"
            id="player"
            style={{ marginTop: 64, padding: 24, borderRadius: "var(--radius)", background: "linear-gradient(135deg, var(--field-a), var(--field-b))", color: "var(--on-scrim)" }}
          >
            <h2 className="se-title">Keep the player page open</h2>
            <p>
              <strong>The sound plays in the player page, not in Claude.</strong> Keep that page open for the whole
              conversation. Closing it stops the sound, and Claude stops getting your reactions.
            </p>
            <p>Best setup: the player on one device or window, the chat on another.</p>
            <p>
              On a phone, keep the player page in the foreground with the screen on. Phones pause web audio when you
              switch apps or lock the screen.
            </p>
            <p>If the page was closed, reopen the link from the conversation or from Your sessions. It picks up the current state.</p>
          </section>

          <section className="se-stack" id="safety" style={{ marginTop: 64 }}>
            <h2 className="se-title">Safety and control</h2>
            <ul className="se-stack" style={{ paddingLeft: 24 }}>
              <li>Listener limits and consent levels, ambient by default.</li>
              <li>Mute is always one tap away.</li>
              <li>No flashing faster than 3 per second.</li>
              <li>Every adjustment made to Claude&apos;s request is reported back to it.</li>
            </ul>
            <p><a href="/safety">Read more about safety and control</a></p>
          </section>
        </div>
      </main>

      <footer className="se-page se-sm se-muted" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <a href="/guide">Using the connector</a>
        <a href="/safety">Safety</a>
        <a href={GITHUB}>GitHub</a>
        <a href="/sessions">Your sessions</a>
        <a href="/settings">Settings</a>
      </footer>
    </>
  );
}
