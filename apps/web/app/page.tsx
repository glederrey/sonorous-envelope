import { SITE_URL } from "../lib/site";
import { SiteHeader } from "../components/site-header";
import { CopyField } from "../components/copy-field";
import { Envelope } from "../components/envelope";
import { SamplePlayer } from "../components/sample-player";
import { mcpResourceUrl } from "../lib/env";
import { getLiveCount, liveSentence } from "../lib/live-count";

export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "/" } };

// Structured data: the site name and the logo that search results may show.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", name: "Sonorous Envelope", url: SITE_URL, description: "A remote MCP server that gives an AI model a synthesizer and a colour field." },
    { "@type": "Organization", name: "Sonorous Envelope", url: SITE_URL, logo: `${SITE_URL}/brand/logo-512.png` },
  ],
};

// Splits a phrase into letters so each can be animated with its own delay.
function Letters({ text, className }: { text: string; className: string }) {
  let n = 0;
  return (
    <span className={className}>
      {text.split(" ").map((word, w) => (
        <span key={w} className="lp-word">
          {word.split("").map((ch) => (
            <span key={n} style={{ "--i": n++ } as React.CSSProperties}>
              {ch}
            </span>
          ))}
          {w < text.split(" ").length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

export default async function Home() {
  const live = await getLiveCount();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="lp-hero">
        <div className="lp-field" aria-hidden />
        <SiteHeader overlay />
        <div className="lp-hero-body">
          <div className="lp-hero-text">
          <h1 className="lp-headline" aria-label="Let the model hum while it thinks.">
              <span aria-hidden="true">
                Let the model <Letters text="hum" className="lp-hum" /> while{" "}
                <Letters text="it thinks" className="lp-think" />.
              </span>
            </h1>
          <p className="lp-lede">
            A small synthesizer and a colour field for an AI model. It sets the mood while it works, you hear and see it
            beside the chat, and it hears back what really played. When you ask for music, it can also write it live in Strudel.
          </p>
          <ul className="lp-chips" aria-label="What it has">
            <li>A synthesizer</li>
            <li>A colour field</li>
            <li>30 scenes</li>
            <li>Strudel</li>
          </ul>
          <div className="lp-connect">
            <CopyField label="Connector URL" value={mcpResourceUrl()} />
            <p className="se-sm lp-connect-note">
              Settings → Customize → Connectors → Add.
            </p>
          </div>
          {live && (
            <div className="lp-live-box" role="status">
              <span className="lp-live-dot" aria-hidden />
              <span>{liveSentence(live)}</span>
            </div>
          )}
          </div>
          <Envelope className="lp-envelope" />
        </div>
      </div>

      <main className="se-page lp-main">
        <section className="lp-loop" id="engines">
          <h2 className="se-title">Two ways to make sound</h2>
          <ul className="lp-ways">
            <li>
              <p className="lp-way-tag">Always available</p>
              <h3 className="se-heading">The built-in synth</h3>
              <p className="se-muted">The model&apos;s own voice, played from a mood. On the internal face it is how the model feels; on the external face it is sound made for you.</p>
            </li>
            <li>
              <p className="lp-way-tag">When you ask for music</p>
              <h3 className="se-heading">Strudel</h3>
              <p className="se-muted">The model writes it live in <a href="https://strudel.cc" target="_blank" rel="noopener noreferrer">Strudel</a>, with drums and samples. Read the code in the player, copy it, or open it on strudel.cc to change it. It runs in a sandbox in your browser, and the owner can switch it off.</p>
            </li>
          </ul>
        </section>

        <section className="lp-split" id="hear">
          <div>
            <h2 className="se-title">Hear what to expect</h2>
            <p className="se-muted">Five states, played by the same synthesizer as a real session. We wrote them ourselves; a model chooses its own. Quiet by default, and each one stops by itself after about twenty seconds.</p>
          </div>
          <SamplePlayer />
        </section>

        <section className="lp-split" id="player">
          <div>
            <h2 className="se-title">Keep the player open</h2>
          </div>
          <div className="se-stack">
            <p>
              <strong>The sound plays in the player page, not in the chat app.</strong> Closing the page stops the sound, and
              the model stops knowing you are listening.
            </p>
            <p className="se-muted">
              Best setup: the player in one window or device, the chat in another. On a phone you can switch to the chat
              and keep going: the sound keeps playing in the background and follows the model. If the phone stops it, open
              the player again and tap resume.
              Open the link on several devices and they play the same notes at the same time.
            </p>
          </div>
        </section>
      </main>

    </>
  );
}
