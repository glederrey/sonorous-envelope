import { SiteHeader } from "../../components/site-header";

export const metadata = { title: "Using the connector · Sonorous Envelope" };

const tools = [
  {
    name: "start_session",
    live: true,
    text: "Starts a sound session for the conversation. Returns a session_id to pass to every other call and a player link to give you. Each conversation gets its own session. It has a mode: inner (the default), where the sound is the model\u2019s own state and it does not talk about it, or outer, where you asked for sound (music, a scene, an emotion to guess) and the model may talk about it and take requests. Outer sessions do not fade between messages.",
    example: "Start an outer sound session and play me an emotion to guess.",
  },
  {
    name: "set_sound",
    live: true,
    text: "Updates the sound and colour. The model describes a mood (warmth, closeness, joy, calm, spontaneity, and optionally tension for dissonance) and can override synth settings or set its own colour: a hue, a shape (wash, glow, sweep) and a motion (still, drift, pulse, breathe). The tempo glides over the transition. It can add one short gesture (purr, chirp, sigh and so on) to a state. It calls it during its turn and once more with final=true at the end of every message. Returns what was really played, your volume and the reactions you pressed since its last call. The model can also choose a voice of its own, stack notes into chords, add a pad, set the echo and the colour. The volume is yours alone.",
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
    text: "The last eight states as one line each: what the model sent, what it read as, safety clamps and its note. The set_sound feedback also carries sound (words for brightness, density and movement) and reads_as, a rough estimate of the axes (and tension) measured from the audio alone. A spectrogram image comes later.",
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
            Five tools are live, with modes, gestures, reactions and tension. The spectrogram image and Strudel come later and
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
            <h2 className="se-heading">Good to know</h2>
            <ul className="doc-list">
              <li>Turn the connector on at the start of a conversation. Each conversation gets its own session.</li>
              <li>The sound plays in the player page, not in the chat app. Keep that page open; closing it stops the sound.</li>
              <li>On a phone the sound keeps playing when you switch to the chat. If the phone stops it, open the player and tap resume.</li>
              <li>The model is not there between messages. After 15 minutes without an update the sound fades to silence by itself, unless the model turned that off.</li>
              <li>A session with no sound for 30 minutes shows as inactive. It can wake up: if you come back to the same conversation, the model&apos;s next sound plays in the same player. After a week without a sound it ends. You can also end a session yourself from the sessions page.</li>
              <li>Signed in as the owner, the player has reaction buttons (calmer, softer, darker, brighter, slower, faster, more or less of this) that the model hears about on its next call, a &ldquo;Fade to silence after&rdquo; setting, and a &ldquo;What the model set&rdquo; panel: the mood it sent, what played, and its note. The panel can be hidden, for a guessing game.</li>
              <li>The model sometimes adds a short gesture (a purr, a chirp, a sigh). You can switch gestures off on your device in the player.</li>
              <li>Anyone with the player link can listen, with no account. You can share it. Several devices playing the same session, on a phone and a laptop for example, play the same notes at the same moments.</li>
              <li>You control the volume. The model decides the rest. See <a href="/safety">Safety and control</a>.</li>
            </ul>
          </li>
        </ul>
      </main>
    </>
  );
}
