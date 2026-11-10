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
            Once the connector is added (see <a href="/#add">Add it to your AI app</a>), the model calls these tools itself.
            You do not type commands: you ask in plain words, and you can name a tool if you want to be exact.
          </p>
          <p className="se-sm se-muted">
            Five tools are live, with two faces, reactions and tension. The spectrogram image and Strudel come later and
            will be marked live here as they ship.
          </p>
        </div>

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
          <li className="doc-row">
            <h2 className="se-heading" id="faces">The two faces</h2>
            <div className="se-stack">
              <p style={{ margin: 0 }}>
                The name comes from Didier Anzieu&apos;s sonorous envelope, and the sound has two faces. The{" "}
                <strong>internal face</strong> is the default: the sound is how the model is, like a posture or a tone of voice. It does not
                talk about it, and nobody steers it. The <strong>external face</strong> is sound it makes for you when you ask (music, a
                scene, an emotion to hear): it may say what it plays, and it takes your requests and reactions.
              </p>
              <p style={{ margin: 0 }}>
                A session is on <strong>auto</strong>. It starts internal. The model can offer to switch in words, and it switches to external
                only after you say yes or clearly asked for sound, never on its own reading of your mood. There is no timer on its switches: the
                safeguards are that rule, your lock and a log of every change. You can lock a face at any time from
                the player, and a lock is final.
              </p>
              <p className="se-sm" style={{ margin: 0 }}><a href="/faces">Where the idea comes from, with reading</a></p>
            </div>
          </li>
          <li className="doc-row">
            <h2 className="se-heading">Good to know</h2>
            <ul className="doc-list">
              <li>Turn the connector on at the start of a conversation. Each conversation gets its own session.</li>
              <li>The sound plays in the player page, not in the chat app. Keep that page open; closing it stops the sound.</li>
              <li>On a phone the sound keeps playing when you switch to the chat. If the phone stops it, open the player and tap resume.</li>
              <li>The model is not there between messages. After 15 minutes without an update the sound fades to silence by itself, unless the model turned that off.</li>
              <li>A session with no sound for 30 minutes shows as inactive. It can wake up: if you come back to the same conversation, the model&apos;s next sound plays in the same player. After a week without a sound it ends. You can also end a session yourself from the sessions page.</li>
              <li>Everyone listening sees which face is playing (Internal or External). Reaction buttons (calmer, stormier, softer, harsher, darker, brighter, slower, faster, more or less of this) exist only on the external face, and only for the owner: the model reads them on its next message, not at once, because it is not there between messages.</li>
              <li>The owner can lock the face (Auto, Internal, External) and on the internal face set the &ldquo;Fade to silence after&rdquo; time, all from the player. The owner also has a &ldquo;What the model set&rdquo; panel: the mood it sent, what played, and its note.</li>
              <li>Anyone with the player link can listen, with no account. You can share it. Several devices playing the same session, on a phone and a laptop for example, play the same notes at the same moments.</li>
              <li>You control the volume. The model decides the rest. See <a href="/safety">Safety and control</a>.</li>
            </ul>
          </li>
        </ul>
      </main>
    </>
  );
}
