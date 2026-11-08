import { SiteHeader } from "../../components/site-header";

export const metadata = { title: "Using the connector · Sonorous Envelope" };

const tools = [
  {
    name: "start_session",
    live: false,
    text: "Starts a sound session for the conversation. Returns a session_id to pass to every other call and a player link to give you. Each conversation gets its own session.",
    example: "Start a sound session for this chat.",
  },
  {
    name: "set_sound",
    live: false,
    text: "Updates the sound and colour. Claude describes a mood (warmth, closeness, joy, calm, spontaneity) and can override synth settings, add one short gesture, or set its own colour. It calls it during its turn and once more with final=true at the end of every message. Returns what was really played and your latest reactions.",
    example: "Hum something calm while you work, and end every message with a final update.",
  },
  {
    name: "get_feedback",
    live: false,
    text: "Reads what is playing and your latest reactions without changing the sound.",
    example: "What does the sound say right now, and did I react?",
  },
  {
    name: "silence",
    live: false,
    text: "Fades the sound to silence, as a normal state that is logged and can be followed by set_sound.",
    example: "Fade to silence over ten seconds.",
  },
  {
    name: "inspect",
    live: false,
    text: "Heavier feedback: the recent history, or a spectrogram image of the last seconds when you have turned image feedback on.",
    example: "Show me the last few states.",
  },
  {
    name: "ping",
    live: true,
    text: "Connectivity check. Returns ok. Temporary: it exists only so the connector can be tested before the real tools arrive.",
    example: "Call ping on the Sonorous Envelope connector.",
  },
];

export default function GuidePage() {
  return (
    <>
      <SiteHeader />
      <main className="se-page se-stack">
        <h1 className="se-title">Using the connector</h1>
        <p>
          Once the connector is added (see <a href="/#add">Add it to Claude</a>), Claude calls these tools itself. You
          do not type commands: you ask in plain words, and you can name a tool if you want to be exact.
        </p>
        <p className="se-sm se-muted">
          Only <code className="se-mono">ping</code> is live today. The others are the plan for the next release and
          will be marked live here as they ship.
        </p>

        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 16 }}>
          {tools.map((tool) => (
            <li key={tool.name} className="se-card se-stack">
              <div style={{ display: "flex", gap: 12, alignItems: "baseline", justifyContent: "space-between" }}>
                <h2 className="se-heading se-mono">{tool.name}</h2>
                <span className="se-sm se-mono" style={{ color: tool.live ? "var(--tide)" : "var(--ink-muted)" }}>
                  {tool.live ? "live" : "coming"}
                </span>
              </div>
              <p style={{ margin: 0 }}>{tool.text}</p>
              <p className="se-sm se-muted" style={{ margin: 0 }}>
                You could say: <em>&ldquo;{tool.example}&rdquo;</em>
              </p>
            </li>
          ))}
        </ul>

        <section className="se-stack">
          <h2 className="se-heading">Good to know</h2>
          <ul style={{ paddingLeft: 24 }} className="se-stack">
            <li>Turn the connector on at the start of a conversation. Each conversation gets its own session.</li>
            <li>The sound plays in the player page, not in Claude. Keep that page open.</li>
            <li>Anyone with the player link can listen, with no account. You can share it.</li>
            <li>Your limits are enforced on the server. See <a href="/safety">Safety and control</a>.</li>
          </ul>
        </section>
      </main>
    </>
  );
}
