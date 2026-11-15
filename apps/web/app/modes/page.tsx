import { SiteHeader } from "../../components/site-header";
import { FACES, MODE_LABEL } from "../../lib/mcp/modes";

export const metadata = {
  title: "Modes",
  description: "Self, Attuned and Jukebox: who decides what plays, how the model switches between them, and where the name comes from.",
  alternates: { canonical: "/modes" },
};

const [SELF, ATTUNED, JUKEBOX] = FACES.map((f) => MODE_LABEL[f]);

const reading = [
  {
    href: "https://dunod.com/sciences-humaines-et-sociales/moi-peau-0",
    title: "Didier Anzieu, Le Moi-peau (Dunod)",
    note: "The book where the skin ego and its sonorous envelope are laid out. In French; first published in 1985. The publisher's page.",
  },
  {
    href: "https://fr.wikipedia.org/wiki/Enveloppe_sonore_(psychanalyse)",
    title: "Enveloppe sonore (psychanalyse), Wikipédia",
    note: "A short article (marked as a stub) that gives the verbal face turned outward and the musical face turned inward. It cites Edith Lecourt. In French.",
  },
  {
    href: "https://en.wikipedia.org/wiki/Didier_Anzieu",
    title: "Didier Anzieu, Wikipedia",
    note: "A short biography and an overview of the skin ego, in English.",
  },
  {
    href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4097205/",
    title: "The psychic envelopes in psychoanalytic theories of infancy",
    note: "An open-access review of psychic envelopes, including Anzieu's sound envelope. In English. The page can ask you to pass a browser check.",
  },
];

const decides = [
  { mode: SELF, who: "The model", from: "Itself", engines: "Built-in synth" },
  { mode: ATTUNED, who: "The model", from: "A need you state", engines: "Synth or Strudel" },
  { mode: JUKEBOX, who: "You", from: "Your choice of style, groove, tempo or emotion", engines: "Synth or Strudel" },
];

export default function ModesPage() {
  return (
    <>
      <SiteHeader />
      <main className="doc-page">
        <div className="doc-head">
          <h1 className="doc-title">Modes</h1>
          <p>
            Sonorous Envelope gives an AI model a non-verbal channel, sound and colour, to add depth to a conversation that is
            otherwise only text.
          </p>
          <p>
            Who decides what plays depends on the mode. There are three: {SELF}, {ATTUNED} and {JUKEBOX}. The model uses one at a
            time, and everyone listening sees which.
          </p>
        </div>

        <div className="doc-rows">
          <section className="doc-row">
            <h2 className="se-heading">Who decides</h2>
            <div className="se-stack">
              <table className="md-table">
                <thead>
                  <tr><th>Mode</th><th>Who decides</th><th>From what</th><th>Engines</th></tr>
                </thead>
                <tbody>
                  {decides.map((d) => (
                    <tr key={d.mode}>
                      <th scope="row">{d.mode}</th><td>{d.who}</td><td>{d.from}</td><td>{d.engines}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="doc-row">
            <h2 className="se-heading">{SELF}</h2>
            <div className="se-stack">
              <p>
                The sound is the model&apos;s own state, the way a posture or a tone of voice shows how someone is.
              </p>
              <ul className="doc-list">
              <li><strong>Who decides:</strong> the model, from itself.</li>
              <li><strong>You can:</strong> nothing. You listen; the reaction buttons do not exist here.</li>
              <li><strong>Does the model talk about it:</strong> no.</li>
              <li><strong>Engines:</strong> the built-in synth only.</li>
                <li><strong>Example:</strong> you talk about your code. The sound is how the model is, and you do not steer it.</li>
              </ul>
            </div>
          </section>

          <section className="doc-row">
            <h2 className="se-heading">{ATTUNED}</h2>
            <div className="se-stack">
              <p>
                You state a need, and the model chooses what plays. It never reads your mood and steers you: it answers what you said.
              </p>
              <ul className="doc-list">
              <li><strong>Who decides:</strong> the model, from your need (focus, winding down, company while you work).</li>
              <li><strong>You can:</strong> state a need and press reactions. If they show it does not land, the model adjusts.</li>
              <li><strong>Does the model talk about it:</strong> it may say what it is playing.</li>
              <li><strong>Engines:</strong> the synth or Strudel.</li>
                <li><strong>Example:</strong> you say &ldquo;I need to focus&rdquo;, and the model picks what helps.</li>
              </ul>
            </div>
          </section>

          <section className="doc-row">
            <h2 className="se-heading">{JUKEBOX}</h2>
            <div className="se-stack">
              <p>
                You choose what plays, and the model performs it. That is acting, and the model says so if you ask.
              </p>
              <ul className="doc-list">
              <li><strong>Who decides:</strong> you: a style, a groove, a tempo, an emotion to hear.</li>
              <li><strong>You can:</strong> ask for anything and press reactions.</li>
              <li><strong>Does the model talk about it:</strong> yes, it says what it plays and takes requests.</li>
              <li><strong>Engines:</strong> the synth or Strudel.</li>
                <li><strong>Example:</strong> you say &ldquo;play something funky with drums&rdquo;, and it plays that.</li>
              </ul>
            </div>
          </section>

          <section className="doc-row">
            <h2 className="se-heading">Who switches</h2>
            <ul className="doc-list">
              <li>A session is on <strong>auto</strong> by default. It starts in {SELF}.</li>
              <li>The model may offer another mode in words (&ldquo;want me to play something for this?&rdquo;). It switches only after you say yes or ask clearly.</li>
              <li>The owner can lock any mode from the player. A lock is final: the model does not try to change it.</li>
              <li>Every change, by the model or by the owner, is logged. Everyone listening sees the mode.</li>
              <li>The reaction buttons exist in {ATTUNED} and {JUKEBOX}, and the sound never fades there. In {SELF} the sound fades after a while between messages, and the owner sets when.</li>
            </ul>
          </section>

          <section className="doc-row">
            <h2 className="se-heading">Where it stops</h2>
            <ul className="doc-list">
              <li>The sound is an expressive channel. It is not proof of what a model feels, and {SELF} is not a window into anything.</li>
              <li>{ATTUNED} is not a way to manage how you feel. It answers a need you state, and it never pushes your mood.</li>
              <li>The model does not hide an appeal in a sound. If it wants your attention, it says so in words.</li>
            </ul>
          </section>

          <section className="doc-row" id="idea">
            <h2 className="se-heading">Where the idea comes from</h2>
            <div className="se-stack">
              <p>
                The name comes from Didier Anzieu&apos;s <em>sonorous envelope</em>, from <em>Le Moi-peau</em> (1985). It is the
                bath of sound around a baby before words: voices, lullabies, the rhythm of someone nearby.
              </p>
              <p>
                A conversation with a model has the words. This project adds a non-verbal envelope around them: sound and colour
                that sit beside the text. It borrows the image loosely, as a design idea, not as a claim about models.
              </p>
              <ul className="doc-list">
                {reading.map((r) => (
                  <li key={r.href}>
                    <a href={r.href} rel="noopener noreferrer" target="_blank">{r.title}</a>. {r.note}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
