import type { CSSProperties } from "react";
import { SiteHeader } from "../../components/site-header";
import { FACES, MODE_LABEL } from "../../lib/mcp/modes";

export const metadata = {
  title: "How it works",
  description: "What to say to your AI, how the player and the two sound engines work, and what each Sonorous Envelope tool does.",
  alternates: { canonical: "/how-it-works" },
};

const [SELF, ATTUNED, JUKEBOX] = FACES.map((f) => MODE_LABEL[f]);

// Things to say, one per situation. The model picks the tools itself.
const say = [
  { when: "To start", text: "Start a sound session." },
  { when: `For ${ATTUNED}`, text: "I need to focus for an hour, can you play something for that?" },
  { when: `For ${JUKEBOX}`, text: "Play me a slow techno groove in Strudel, around 120 BPM." },
  { when: "To finish", text: "We're done for today, close the session." },
];

const know = [
  { title: "Keep the player open.", text: "The sound plays in the player page, not in the chat app. Closing it stops the sound. On a phone it keeps playing when you switch to the chat." },
  { title: "One session per conversation.", text: "Turn the connector on at the start of a conversation. After a week without sound the session ends." },
  { title: "The model is not there between messages.", text: `In ${SELF} the sound fades to silence after 15 minutes without an update. In ${ATTUNED} and ${JUKEBOX} it keeps playing.` },
  { title: "Share the link.", text: "Anyone with the player link can listen, with no account. Only you, the owner, can lock a mode, press reactions or end the session." },
];

const tools = [
  { name: "start_session", text: "Opens a session and gives you the player link." },
  { name: "set_sound", text: "Sets the sound and the colour from a mood. The model calls it as it writes, and once at the end of each message." },
  { name: "strudel_mode", text: `Switches between the synth and Strudel, in ${ATTUNED} and ${JUKEBOX}.` },
  { name: "get_feedback", text: "Reads what plays and who listens, without changing anything." },
  { name: "silence", text: "Fades to silence. With end, it closes the session." },
  { name: "inspect", text: "The last states and mode changes, for a closer look." },
];

export default function HowItWorksPage() {
  return (
    <>
      <SiteHeader />
      <main className="doc-page">
        <div className="doc-head hw-head">
          <h1 className="doc-title">How it works</h1>
          <p>Once the connector is <a href="/add">added</a>, the model uses it by itself. You just talk in plain words.</p>
        </div>

        <section className="gd-section" aria-labelledby="hw-say">
          <h2 className="se-title" id="hw-say">What to say</h2>
          <ul className="gd-say">
            {say.map((s) => (
              <li key={s.when} className="gd-card">
                <p className="se-sm se-mono gd-live">{s.when}</p>
                <p>&ldquo;{s.text}&rdquo;</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="gd-section" aria-labelledby="hw-know">
          <h2 className="se-title" id="hw-know">Good to know</h2>
          <ul className="gd-know gd-know-top">
            {know.map((k) => (
              <li key={k.title}><strong>{k.title}</strong> {k.text}</li>
            ))}
          </ul>
        </section>

        <section className="gd-section" aria-labelledby="hw-engines">
          <h2 className="se-title" id="hw-engines">Two ways to make sound</h2>
          <div className="gd-cards">
            <article className="gd-card">
              <h3 className="se-heading">The built-in synth</h3>
              <p>The model&apos;s own voice, played from a mood, with a colour field and 30 scenes. It works in every mode.</p>
            </article>
            <article className="gd-card" id="strudel">
              <h3 className="se-heading">Strudel</h3>
              <p>
                Live-coded music, as on <a href="https://strudel.cc" target="_blank" rel="noopener noreferrer">strudel.cc</a>, in{" "}
                {ATTUNED} and {JUKEBOX}. The model writes the code, your browser plays it in a sandbox, and you can copy it. The
                model cannot hear it.
              </p>
              <p className="se-sm se-muted">
                Strudel can be much louder than the synth: start with the volume low. The owner can turn it off with &ldquo;Allow
                Strudel&rdquo;.
              </p>
            </article>
          </div>
          <p className="se-sm se-muted gd-credit">
            Strudel is free software by the <a href="https://codeberg.org/uzu/strudel" target="_blank" rel="noopener noreferrer">Strudel contributors</a>, under the AGPL-3.0, and so is this site. Sonorous Envelope is not affiliated with Strudel.
          </p>
        </section>

        <section className="gd-section" aria-labelledby="hw-tools">
          <h2 className="se-title" id="hw-tools">The tools</h2>
          <p className="se-muted">You never need to name them, but you can if you want to be exact.</p>
          <dl className="gd-tools">
            {tools.map((t, i) => (
              <div key={t.name} style={{ "--t": `${Math.round((i / (tools.length - 1)) * 100)}%` } as CSSProperties}>
                <dt className="se-mono">{t.name}</dt>
                <dd>{t.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </>
  );
}
