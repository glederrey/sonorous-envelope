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
    { "@type": "WebSite", name: "Sonorous Envelope", url: SITE_URL, description: "A synthesizer and a colour field for an AI model." },
    { "@type": "Organization", name: "Sonorous Envelope", url: SITE_URL, logo: `${SITE_URL}/brand/logo-512.png` },
  ],
};

const loop = [
  ["The model sets a mood", "Warmth, calm, joy, closeness. Exact sounds and colour are optional."],
  ["Your browser plays it", "Sound and colour glide from one state to the next, live."],
  ["The model hears back", "What actually played, and the volume you chose."],
] as const;

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
            beside the chat, and it hears back what really played.
          </p>
          <div className="lp-connect">
            <CopyField label="Connector URL" value={mcpResourceUrl()} />
            <p className="se-sm lp-connect-note">
              Settings → Customize → Connectors → Add. <a href="#add">Step by step</a>
            </p>
            {live && <p className="se-sm lp-live" role="status">{liveSentence(live)}</p>}
          </div>
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
            You stay in control of the volume, with a one-tap mute. The model decides the rest of how it sounds and looks.
            <a href="/safety"> How safety works</a>
          </p>
        </section>

        <section className="lp-split" id="hear">
          <div>
            <h2 className="se-title">Hear what to expect</h2>
            <p className="se-muted">Five states, played by the same synthesizer as a real session. We wrote them ourselves; a model chooses its own. Quiet by default, and each one stops by itself after about twenty seconds.</p>
          </div>
          <SamplePlayer />
        </section>

        <section className="lp-split" id="add">
          <div>
            <h2 className="se-title">Add it to your AI app</h2>
            <p className="se-muted">Takes a minute. It works in the web, desktop and mobile apps on the same account. The steps below are for claude.ai; other apps with custom MCP connectors (ChatGPT, for example) have a similar menu.</p>
          </div>
          <ol className="lp-steps">
            <li>Open <strong>Settings → Customize → Connectors</strong>, then choose <strong>Add</strong> and <strong>Add custom connector</strong>.</li>
            <li>Name it <strong>Sonorous Envelope</strong>, paste the connector URL above into <strong>MCP server URL</strong>, and choose <strong>Continue</strong>.</li>
            <li>Choose <strong>Connect</strong>: you sign in here and approve access.</li>
            <li>In a new conversation, switch the connector on from the <strong>+</strong> menu in the message box.</li>
            <li>The model gives you a player link. Open it and tap <strong>Start listening</strong>.</li>
          </ol>
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

    </>
  );
}
