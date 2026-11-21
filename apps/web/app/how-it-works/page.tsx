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
  { title: "It plays until you stop it.", text: "The last sound keeps playing between messages, in every mode, until you close the player or the session ends. Mute is always one tap away." },
  { title: "Share the link.", text: "Anyone with the player link can listen, with no account. Only you, the owner, can lock a mode, press reactions, tell the AI what you heard, switch Live tuning, allow Strudel, decide whether the AI may see the picture, or end the session." },
  { title: "The AI can see a picture.", text: "Your player takes a picture 8 to 14 s after each new sound, then every 30 s, while the page is open, playing and visible. It shows the screen and, below it, a spectrogram of the last 10 s of the player's sound output, with a few measured numbers. It does not use your microphone or camera. It is on by default; you can turn it off in the player (\"Let the AI see the picture\", under \"Feedback to the AI\"). \"What the AI can see\" shows you the exact image it was given and when." },
  { title: "Live tuning.", text: `In ${ATTUNED} and ${JUKEBOX}, the owner can switch on Live tuning under \"Feedback to the AI\". The AI then waits for your button presses at the end of its message and answers each at once. Press stop in the chat to end the wait; no press is lost.` },
];

const tools = [
  { name: "start_session", text: "Opens a session and gives you the player link." },
  { name: "set_sound", text: "Sets the sound and the colour from a mood, while the AI writes and at the end of each message. It can add a motif, a short phrase of its own, and quote it again later." },
  { name: "strudel_mode", text: `Switches between the synth and Strudel, in ${ATTUNED} and ${JUKEBOX}.` },
  { name: "listen", text: `With Live tuning on, in ${ATTUNED} and ${JUKEBOX}: waits about 20 s at the end of a message for your button presses, so the AI can answer them at once.` },
  { name: "get_feedback", text: "Reads what plays and who listens, without changing anything." },
  { name: "moment", text: "Keeps the sound and picture playing now under a name, and brings them back later, the way a theme returns." },
  { name: "silence", text: "Fades to silence. With end, it closes the session." },
  { name: "inspect", text: "A closer look: the last few states, or a snapshot of what your player shows and plays." },
  { name: "tell_developers", text: "Sends an anonymous note to the people who build this, when something is worth fixing or keeping. At most 3 a day." },
];

export default function HowItWorksPage() {
  return (
    <>
      <SiteHeader />
      <main className="doc-page">
        <div className="doc-head hw-head">
          <h1 className="doc-title">How it works</h1>
          <p>Once the connector is <a href="/add">added</a>, the AI uses it by itself. You just talk in plain words.</p>
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
              <p>The AI&apos;s own voice, played from a mood, with a colour field and 30 scenes. It works in every mode.</p>
            </article>
            <article className="gd-card" id="strudel">
              <h3 className="se-heading">Strudel</h3>
              <p>
                Live-coded music, as on <a href="https://strudel.cc" target="_blank" rel="noopener noreferrer">strudel.cc</a>, in{" "}
                {ATTUNED} and {JUKEBOX}. The AI writes the code, your browser plays it in a sandbox, and you can copy it. The
                model cannot hear it, but if the owner allows it, it can see a picture of the output, Strudel included.
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
