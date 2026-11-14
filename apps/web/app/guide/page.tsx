import { SiteHeader } from "../../components/site-header";

export const metadata = { title: "Using the connector · Sonorous Envelope" };

const tools = [
  {
    name: "start_session",
    live: true,
    text: "Starts a sound session for the conversation. Returns a session_id to pass to every other call and a player link to give you. Each conversation gets its own session. It starts on auto: the sound has an internal face (how the model is, no words about it, the default) and an external face (sound made for you, which it can talk about and you can steer). The model may offer to switch, and you can lock either face from the player. See The two faces below.",
    example: "Start a sound session, and play me something for a rainy afternoon.",
  },
  {
    name: "set_sound",
    live: true,
    text: "Updates the sound and colour. The model describes a mood (warmth, closeness, joy, calm, spontaneity, and optionally tension for dissonance) and can override synth settings or set its own colour: a hue, a shape (wash, glow, sweep) and a motion (still, drift, pulse, breathe). The tempo glides over the transition. It can switch its face when the rules allow. It calls it during its turn and once more with final=true at the end of every message. Returns what was really played, the face, your volume and the reactions you pressed since its last call. The model can also choose a voice of its own, stack notes into chords, add a pad, set the echo and the colour. The volume is yours alone.",
    example: "Hum something calm while you work, and end every message with a final update.",
  },
  {
    name: "strudel_mode",
    live: true,
    text: "Switches the model between its built-in synth and Strudel, live-coded music as on strudel.cc, on the external face only and only after you said yes. With on set to true it sends Strudel code and a tempo and your browser plays it, with drums and samples; sending new code changes the music on the next bar. With on set to false it goes back to the synth. While Strudel is on, set_sound only changes the picture. The model cannot hear the music: it reads what the owner's player reports back, such as an error.",
    example: "Play me a slow techno groove in Strudel, around 120 BPM.",
  },
  {
    name: "get_feedback",
    live: true,
    text: "Reads what is playing and who is listening without changing the sound.",
    example: "What is playing right now, and is anyone listening?",
  },
  {
    name: "silence",
    live: true,
    text: "Fades the sound to silence, as a normal state that is logged and can be followed by set_sound. With end, the model closes the session once the fade is over.",
    example: "Fade to silence over ten seconds.",
  },
  {
    name: "inspect",
    live: true,
    text: "The last eight states as one line each: what the model sent, what it read as, safety clamps and its note, plus the last changes of face and who made them. The set_sound feedback also carries sound (words for brightness, density and movement) and reads_as, a rough estimate of the axes (and tension) measured from the audio alone. A spectrogram image comes later.",
    example: "Show me the last few states.",
  },
];

export default function GuidePage() {
  return (
    <>
      <SiteHeader />
      <main className="doc-page">
        <div className="doc-head">
          <h1 className="doc-title">Using the connector</h1>
          <p>
            Once the connector is added (see <a href="/add">Add to your AI</a>), the model calls these tools itself.
            You do not type commands: you ask in plain words, and you can name a tool if you want to be exact.
          </p>
          <p className="se-sm se-muted">
            Six tools are live, with two faces, reactions, tension and two ways to make sound: the built-in synth and Strudel.
            The spectrogram image comes later and will be marked live here as it ships.
          </p>
        </div>

        <section className="gd-section" aria-labelledby="gd-tools">
        <h2 className="se-title" id="gd-tools">The tools</h2>
        <ul className="doc-rows">
          {tools.map((tool) => (
            <li key={tool.name} className="doc-row">
              <div className="gd-tool-name">
                <h2 className="se-heading se-mono">{tool.name}</h2>
                <span className={tool.live ? "se-sm se-mono gd-live" : "se-sm se-mono se-muted"}>
                  {tool.live ? "live" : "coming"}
                </span>
              </div>
              <div className="se-stack">
                <p style={{ margin: 0 }}>{tool.text}</p>
                <p className="se-sm se-muted" style={{ margin: 0 }}>
                  You could say: <em>&ldquo;{tool.example}&rdquo;</em>
                </p>
              </div>
            </li>
          ))}
        </ul>
        </section>

        <section className="gd-section" aria-labelledby="gd-how">
          <h2 className="se-title" id="gd-how">How it works</h2>

          <div className="gd-cards">
            <article className="gd-card">
            <h3 className="se-heading" id="faces">The two faces</h3>
          <p>
            The sound has two faces. The <strong>internal face</strong> is the default: the sound is how the model is, like a posture or a
            tone of voice, and it does not talk about it. The <strong>external face</strong> is sound it makes for you when you ask for it
            (music, a scene, an emotion to hear): it may say what it plays and it takes your requests and reactions.
          </p>
          <p>
            A session starts internal. The model can offer to switch in words, and switches only after you say yes. You can lock a face at
            any time from the player, and a lock is final. <a href="/faces">Where the idea comes from, with reading</a>.
          </p>
            </article>

            <article className="gd-card">
            <h3 className="se-heading" id="strudel">The synth and Strudel</h3>
          <p>
            The <strong>built-in synth</strong> is the model&apos;s own voice, played from a mood. <strong>Strudel</strong> is live-coded
            music, as on <a href="https://strudel.cc" target="_blank" rel="noopener noreferrer">strudel.cc</a>, and it is for the external
            face only: the model writes the code, your browser plays it in a sandbox, and the player shows the code so you can copy it or
            open it on strudel.cc. The model cannot hear it; it only sees what your player reports, such as an error.
          </p>
          <p>
            Strudel has no volume limit of its own, so a pattern can be much louder than the synth: start with the slider low. The owner can
            switch Strudel off for the session (&ldquo;Let the model play Strudel code&rdquo;).
          </p>
            </article>
          </div>

          <article className="gd-card gd-wide">
          <h3 className="se-heading">Good to know</h3>
          <ul className="gd-know">
            <li><strong>One session per conversation.</strong> Turn the connector on at the start of a conversation.</li>
            <li><strong>Keep the player open.</strong> The sound plays in the player page, not in the chat app. Closing it stops the sound. On a phone it keeps playing when you switch to the chat.</li>
            <li><strong>The model is not there between messages.</strong> After 15 minutes without an update the sound fades to silence, unless the model turned that off. After 30 minutes the session shows as inactive and wakes up when you come back to the same conversation; after a week it ends.</li>
            <li><strong>You and the player link.</strong> Anyone with the link can listen, with no account, on any number of devices. Only the owner can end the session, lock a face or press reactions. You control the volume and mute, and the &ldquo;Gradient&rdquo; and &ldquo;Scenes&rdquo; buttons turn the moving colours and the scene off.</li>
          </ul>
          </article>
        </section>
      </main>
    </>
  );
}
