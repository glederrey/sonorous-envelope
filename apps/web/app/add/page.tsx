import { SiteHeader } from "../../components/site-header";
import { CopyField } from "../../components/copy-field";
import { mcpResourceUrl } from "../../lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add to your AI · Sonorous Envelope", alternates: { canonical: "/add" } };

export default function AddPage() {
  return (
    <>
      <SiteHeader />
      <main className="doc-page">
        <div className="doc-head">
          <h1 className="doc-title">Add to your AI</h1>
          <p>
            Sonorous Envelope is a remote MCP server: one URL that an AI app can connect to. Adding it takes a minute, and the sound and
            colour then play in a page you open next to the chat.
          </p>
          <div style={{ maxWidth: 560 }}>
            <CopyField label="Connector URL" value={mcpResourceUrl()} />
          </div>
        </div>

        <section className="gd-section" aria-labelledby="add-claude">
          <h2 className="se-title" id="add-claude">Claude</h2>
          <p className="se-muted">The steps below are for claude.ai, on the web, desktop and mobile apps of the same account. This is the app we test with.</p>
          <ol className="lp-steps add-steps">
            <li>Open <strong>Settings → Customize → Connectors</strong>, then choose <strong>Add</strong> and <strong>Add custom connector</strong>.</li>
            <li>Name it <strong>Sonorous Envelope</strong>, paste the connector URL above into <strong>MCP server URL</strong>, and choose <strong>Continue</strong>.</li>
            <li>Choose <strong>Connect</strong>: you sign in here and approve access.</li>
            <li>In a new conversation, switch the connector on from the <strong>+</strong> menu in the message box.</li>
            <li>The model gives you a player link. Open it and tap <strong>Start listening</strong>.</li>
          </ol>
        </section>

        <section className="gd-section" aria-labelledby="add-others">
          <h2 className="se-title" id="add-others">Other apps</h2>
          <p className="se-muted">
            Any app that can connect to a remote MCP server by URL and sign in with OAuth should work. We have only tested Claude, and menu
            names change often, so check the app&apos;s own help if a step does not match.
          </p>
          <div className="gd-cards">
            <article className="gd-card">
              <h3 className="se-heading">ChatGPT</h3>
              <ol className="add-list">
                <li>Open <strong>Settings → Connectors</strong> (or <strong>Apps</strong>) and turn on <strong>Developer mode</strong> under Advanced, if your plan asks for it.</li>
                <li>Choose <strong>Create</strong>, name it Sonorous Envelope, and paste the connector URL.</li>
                <li>Choose OAuth for the sign-in, then save and approve access.</li>
                <li>In a new chat, switch the connector on from the message box and ask for a session.</li>
              </ol>
              <p className="se-sm se-muted">Custom connectors depend on your plan.</p>
            </article>
            <article className="gd-card">
              <h3 className="se-heading">GitHub Copilot in VS Code</h3>
              <ol className="add-list">
                <li>Open the Command Palette (<strong>Ctrl+Shift+P</strong>) and run <strong>MCP: Add Server</strong>.</li>
                <li>Choose <strong>HTTP</strong>, paste the connector URL, and name it Sonorous Envelope.</li>
                <li>Sign in when asked, then start the server from the MCP list.</li>
                <li>In Copilot Chat, switch to <strong>Agent</strong> mode and ask for a session.</li>
              </ol>
              <p className="se-sm se-muted">Copilot on github.com and in the GitHub mobile apps does not support remote MCP servers yet.</p>
            </article>
            <article className="gd-card">
              <h3 className="se-heading">Microsoft Copilot Studio</h3>
              <ol className="add-list">
                <li>In your agent, open <strong>Tools</strong> and add a new tool of type <strong>Model Context Protocol</strong>.</li>
                <li>Paste the connector URL and choose OAuth 2.0 for the sign-in.</li>
                <li>Create the connection, approve access, and add the tools to the agent.</li>
              </ol>
              <p className="se-sm se-muted">The agent&apos;s author sets this up for everyone who uses the agent.</p>
            </article>
            <article className="gd-card">
              <h3 className="se-heading">Anything else</h3>
              <p>Look for <strong>MCP</strong>, <strong>custom connector</strong> or <strong>tools</strong> in the app&apos;s settings, choose a remote server with an HTTP URL, and paste the connector URL. Local-only MCP apps (command line servers) cannot use it.</p>
            </article>
          </div>
        </section>

        <section className="gd-section" aria-labelledby="add-next">
          <h2 className="se-title" id="add-next">Then</h2>
          <p>
            Turn the connector on at the start of a conversation and the model calls its tools itself: <a href="/guide">what each tool does</a>,
            and <a href="/faces">the two faces</a> of the sound.
          </p>
        </section>
      </main>
    </>
  );
}
