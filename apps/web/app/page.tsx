import { SITE_URL } from "../lib/site";
import { SiteHeader } from "../components/site-header";
import { CopyField } from "../components/copy-field";
import { Envelope } from "../components/envelope";
import { SamplePlayer } from "../components/sample-player";
import { mcpResourceUrl } from "../lib/env";
import { FACES, MODE_LABEL } from "../lib/mcp/modes";
import { getLiveCount, liveSentence } from "../lib/live-count";

export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "/" } };

const [SELF, ATTUNED, JUKEBOX] = FACES.map((f) => MODE_LABEL[f]);

// Structured data: the site name and the logo that search results may show.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", name: "Sonorous Envelope", url: SITE_URL, description: "A remote MCP server that gives an AI model a synthesizer and a colour field." },
    {
      "@type": "SoftwareApplication",
      name: "Sonorous Envelope",
      url: SITE_URL,
      description: `A free MCP server that gives your AI model a voice beyond text: a built-in synth or live Strudel music, with visuals. Three modes: ${SELF}, ${ATTUNED} and ${JUKEBOX}.`,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Any (MCP client)",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
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
            A non-verbal channel for an AI model: sound and colour, to add depth to a conversation that is otherwise only
            text. You hear and see it beside the chat, in one of three modes: {SELF}, {ATTUNED} or {JUKEBOX}.
          </p>
          <p className="lp-lede">
            The idea comes from Didier Anzieu&apos;s sonorous envelope. <a href="/modes#idea">Where it comes from</a>.
          </p>
          <ul className="lp-chips" aria-label="What it has">
            <li>A synthesizer</li>
            <li>A colour field</li>
            <li>30 scenes</li>
            <li>Strudel</li>
            <li>Three modes</li>
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
        <section className="lp-loop" id="modes">
          <h2 className="se-title">Three modes</h2>
          <p className="se-muted">Who decides what plays depends on the mode. A session starts in {SELF}; the model switches only after you say yes, and you can lock a mode from the player.</p>
          <ul className="lp-ways lp-ways-3">
            <li>
              <p className="lp-way-tag">The model, from itself</p>
              <h3 className="se-heading">{SELF}</h3>
              <p className="se-muted">The sound is how the model is. You listen and do not steer it, and the model does not talk about it. Example: you talk about your code, and the sound follows the model.</p>
            </li>
            <li>
              <p className="lp-way-tag">The model, from your need</p>
              <h3 className="se-heading">{ATTUNED}</h3>
              <p className="se-muted">You state a need and press reactions; the model chooses what plays and may say what it is. Example: you say &ldquo;I need to focus&rdquo;, and it picks what helps.</p>
            </li>
            <li>
              <p className="lp-way-tag">You</p>
              <h3 className="se-heading">{JUKEBOX}</h3>
              <p className="se-muted">You ask for anything and the model performs it, and says so if you ask. Example: you say &ldquo;play something funky with drums&rdquo;, and it plays that.</p>
            </li>
          </ul>
          <p className="lp-modes-more"><a href="/modes">More about the modes</a></p>
        </section>

        <section className="lp-loop" id="engines">
          <h2 className="se-title">Two ways to make sound</h2>
          <ul className="lp-ways">
            <li>
              <p className="lp-way-tag">Always available</p>
              <h3 className="se-heading">The built-in synth</h3>
              <p className="se-muted">The model&apos;s own voice, played from a mood. It works in all three modes.</p>
            </li>
            <li>
              <p className="lp-way-tag">When you ask for music</p>
              <h3 className="se-heading">Strudel</h3>
              <p className="se-muted">The model writes it live in <a href="https://strudel.cc" target="_blank" rel="noopener noreferrer">Strudel</a>, with drums and samples. Read the code in the player, copy it, or open it on strudel.cc to change it. It plays in {ATTUNED} and {JUKEBOX}. It runs in a sandbox in your browser, and the owner can switch it off.</p>
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
