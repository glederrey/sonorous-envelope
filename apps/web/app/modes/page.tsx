import { SiteHeader } from "../../components/site-header";
import { MODE_LABEL, type Face } from "../../lib/mcp/modes";

export const metadata = {
  title: "Modes",
  description: "Self, Attuned and Jukebox: who decides what plays, how the AI switches between them, and where the idea comes from.",
  alternates: { canonical: "/modes" },
};

const SELF = MODE_LABEL.internal, ATTUNED = MODE_LABEL.external, JUKEBOX = MODE_LABEL.sandbox;

// One card per mode, the same four facts in the same order, so they compare at a glance.
const modes: Array<{ face: Face; who: string; line: string; facts: Array<[string, string]> }> = [
  {
    face: "internal",
    who: "The AI decides, from itself",
    line: "The sound is the AI's own state, the way a posture or a tone of voice shows how someone is.",
    facts: [
      ["You can", "Listen and tell what you heard. You have no say in the sound."],
      ["The AI talks about it", "No."],
      ["Engines", "Built-in synth"],
      ["Between messages", "Fades after 15 minutes"],
    ],
  },
  {
    face: "external",
    who: "The AI decides, for you",
    line: "The AI plays for what you need, from what you say and from how you are. It sets its own reaction aside.",
    facts: [
      ["You can", "Say what you need, press reactions, tell what you heard, tune live, say it is not helping."],
      ["The AI talks about it", "It may say what it plays and why."],
      ["Engines", "Synth or Strudel"],
      ["Between messages", "Keeps playing"],
    ],
  },
  {
    face: "sandbox",
    who: "You decide",
    line: "You choose what plays: a style, a groove, a tempo, an emotion to hear. The AI performs it.",
    facts: [
      ["You can", "Ask for anything, press reactions, tell what you heard, tune live, ask for changes."],
      ["The AI talks about it", "Yes, freely. Playing an emotion here is acting."],
      ["Engines", "Synth or Strudel"],
      ["Between messages", "Keeps playing"],
    ],
  },
];

// One moment, three answers: the clearest way to see the difference.
const scene: Array<{ face: Face; text: string }> = [
  { face: "internal", text: "The sound carries how the story sits with the AI. It stays gentle, because care rules hold in every mode, but it is the AI's own reaction." },
  { face: "external", text: "The AI starts quiet and slow, close to where you are, then moves gradually toward calm. The goal is to help you settle." },
  { face: "sandbox", text: "You ask for rain on a window, or your favourite kind of ambient, and the AI plays that." },
];

const steps = [
  { title: `Starts in ${SELF}`, text: "Every session begins with the AI's own sound. This is auto, the default." },
  { title: "The AI offers, you answer", text: "It may propose another mode in words (“want me to play something gentle?”). It switches only after a yes or a clear request, and says so." },
  { title: "You can lock it", text: "From the player, the owner can lock any mode. A lock is final. Every change is logged, and everyone listening sees the mode." },
];

const reading = [
  {
    href: "https://dunod.com/sciences-humaines-et-sociales/moi-peau-0",
    title: "Didier Anzieu, Le Moi-peau (Dunod)",
    note: "The book where the skin ego and its sonorous envelope are laid out. In French; first published in 1985.",
  },
  {
    href: "https://fr.wikipedia.org/wiki/Enveloppe_sonore_(psychanalyse)",
    title: "Enveloppe sonore (psychanalyse), Wikipédia",
    note: "A short article on the sonorous envelope. It cites Edith Lecourt. In French.",
  },
  {
    href: "https://en.wikipedia.org/wiki/Didier_Anzieu",
    title: "Didier Anzieu, Wikipedia",
    note: "A short biography and an overview of the skin ego, in English.",
  },
  {
    href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4097205/",
    title: "The psychic envelopes in psychoanalytic theories of infancy",
    note: "An open-access review of psychic envelopes, including Anzieu's sound envelope. In English.",
  },
];

export default function ModesPage() {
  return (
    <>
      <SiteHeader />
      <main className="doc-page md-page">
        <div className="doc-head">
          <h1 className="doc-title">Modes</h1>
          <p className="md-lede">
            Sonorous Envelope gives an AI a non-verbal channel, sound and colour, to add depth to a conversation that is
            otherwise only text. The mode says <strong>who decides what plays</strong>.
          </p>
        </div>

        <section aria-labelledby="md-three">
          <h2 className="se-visually-hidden" id="md-three">The three modes</h2>
          <div className="md-axis" aria-hidden="true">
            <span>The AI decides</span>
            <span>You decide</span>
          </div>
          <ol className="md-modes">
            {modes.map((m) => (
              <li key={m.face} className={`md-mode md-${m.face}`}>
                <p className="md-who">{m.who}</p>
                <h3 className="md-name">{MODE_LABEL[m.face]}</h3>
                <p className="md-line">{m.line}</p>
                <dl className="md-facts">
                  {m.facts.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ol>
        </section>

        <section className="md-section" aria-labelledby="md-scene">
          <h2 className="se-title" id="md-scene">One moment, three modes</h2>
          <p className="se-muted md-sub">You wake up from a bad nightmare and tell the AI about it.</p>
          <ul className="md-scene">
            {scene.map((s) => (
              <li key={s.face} className={`md-${s.face}`}>
                <p className="md-scene-name">{MODE_LABEL[s.face]}</p>
                <p>{s.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="md-section" aria-labelledby="md-switch">
          <h2 className="se-title" id="md-switch">How the mode changes</h2>
          <ol className="md-steps">
            {steps.map((s, i) => (
              <li key={s.title}>
                <span className="md-step-n" aria-hidden="true">{i + 1}</span>
                <h3 className="se-heading">{s.title}</h3>
                <p className="se-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="md-section" aria-labelledby="md-limits">
          <h2 className="se-title" id="md-limits">Where it stops</h2>
          <ul className="md-limits">
            <li><strong>Not proof of feeling.</strong> The sound is an expressive channel. {SELF} is not a window into anything.</li>
            <li><strong>{ATTUNED} eases, it does not steer.</strong> It moves only toward what you would welcome (comfort, calm, focus), and never uses sound to persuade you or rush you.</li>
            <li><strong>Nothing hidden.</strong> The AI does not hide an appeal in a sound. If it wants your attention, it says so in words.</li>
          </ul>
        </section>

        <section className="md-section md-idea" id="idea" aria-labelledby="md-idea">
          <div>
            <h2 className="se-title" id="md-idea">Where the idea comes from</h2>
            <p>
              The name comes from Didier Anzieu&apos;s <em>sonorous envelope</em>, in <em>Le Moi-peau</em> (1985): the bath of
              sound around a baby before words. Voices, lullabies, the rhythm of someone nearby.
            </p>
            <p>
              A conversation with a model has the words. This project adds a non-verbal envelope around them: sound and colour
              beside the text. It borrows the image loosely, as a design idea, not as a claim about models.
            </p>
          </div>
          <ul className="md-reading">
            {reading.map((r) => (
              <li key={r.href}>
                <a href={r.href} rel="noopener noreferrer" target="_blank">{r.title}</a>
                <span className="se-sm se-muted">{r.note}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
