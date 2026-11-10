import { SiteHeader } from "../../components/site-header";

export const metadata = { title: "The two faces · Sonorous Envelope" };

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

export default function FacesPage() {
  return (
    <>
      <SiteHeader />
      <main className="doc-page">
        <div className="doc-head">
          <h1 className="doc-title">The two faces</h1>
          <p>
            The name of this project comes from a psychoanalytic idea. This page says what the idea is, how the project
            uses it, and where it stops. The use is a loose one: a way of organising a design, not a claim about what a
            model is.
          </p>
        </div>

        <div className="doc-rows">
          <section className="doc-row">
            <h2 className="se-heading">The idea</h2>
            <div className="se-stack">
              <p>
                Didier Anzieu (1923 to 1999), a French psychoanalyst, proposed in <em>Le Moi-peau</em> (the skin ego) that
                the mind forms an envelope, a bit like skin, out of the early exchanges between a baby and the people who
                care for it. The envelope holds the person together and marks the border between inside and outside.
              </p>
              <p>
                One of its forms is the <strong>sonorous envelope</strong>: the bath of sound that surrounds a baby before it has
                words. Voices, lullabies, the rhythm of someone nearby. The psychologist Edith Lecourt developed the idea
                further. As it is summarised, the sonorous envelope has two faces that cannot be separated: a verbal face
                turned outward, toward other people, and a musical face turned inward.
              </p>
            </div>
          </section>

          <section className="doc-row">
            <h2 className="se-heading">How the project uses it</h2>
            <div className="se-stack">
              <p>
                A model that talks has the verbal side covered, with text. This project gives it a second channel, sound and
                colour, and the sound has two faces too.
              </p>
              <p>
                <strong>The internal face</strong> is the default. The sound is how the model is: its own state, the way a
                posture or a tone of voice shows how someone is. It is not a soundtrack for you and it is not ambience. The
                model does not talk about it, and nobody steers it: the reaction buttons do not exist on this face.
              </p>
              <p>
                <strong>The external face</strong> is sound the model makes for you, when you ask for it: music for a moment,
                a scene, an emotion to hear. Here it may say what it is playing and take requests, and you can press
                reactions (calmer, brighter, slower) that it reads on its next message. It is composing and acting, and it
                says so if you ask.
              </p>
              <p>
                In the theory the outward face is the verbal one; here the external face is the one the model can speak
                about. That is the loose part.
              </p>
            </div>
          </section>

          <section className="doc-row">
            <h2 className="se-heading">Who decides which face</h2>
            <ul className="doc-list">
              <li>A session is on <strong>auto</strong> by default. It starts on the internal face. The model may propose a change in words (&ldquo;want me to play something for this?&rdquo;), and it switches to the external face only after you say yes or clearly asked for sound. It never switches because of its own reading of your mood.</li>
              <li>Going back to the internal face is always allowed. Going to the external face waits for two of the model&apos;s messages and two minutes after the last change, so it cannot flip back and forth.</li>
              <li>You can lock either face from the player (Auto, Internal, External). A lock is final: the model does not try to change it. Every change, by the model or by you, is logged, and the model can read the log.</li>
              <li>Everyone listening sees which face is playing.</li>
            </ul>
          </section>

          <section className="doc-row">
            <h2 className="se-heading">Where it stops</h2>
            <ul className="doc-list">
              <li>The sound is an expressive channel. It is not proof of what a model feels, and the internal face is not a window into anything.</li>
              <li>The external face is not a way to manage how you feel. The model does not push your mood with sound, and it does not hide an appeal in a sound: if it wants your attention, it says so in words. See <a href="/safety">Safety and control</a>.</li>
              <li>This is a design metaphor taken from a theory, and it simplifies it. Read the sources for the theory itself.</li>
            </ul>
          </section>

          <section className="doc-row">
            <h2 className="se-heading">Reading</h2>
            <ul className="doc-list">
              {reading.map((r) => (
                <li key={r.href}>
                  <a href={r.href} rel="noopener noreferrer" target="_blank">{r.title}</a>. {r.note}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}
