"use client";

import { useId, useState, type ReactNode } from "react";

interface App {
  id: string;
  name: string;
  tested: boolean;
  intro: string;
  steps: ReactNode[];
  note?: string;
  code?: string;
}

// One panel per app, all in the same form: what it is, a badge for whether we tried it, numbered steps, and a note.
export function AppTabs({ url }: { url: string }) {
  const base = useId();
  const apps: App[] = [
    {
      id: "claude", name: "Claude", tested: true,
      intro: "On claude.ai, in the web, desktop and mobile apps of the same account.",
      steps: [
        <>Open <strong>Settings → Customize → Connectors</strong>, then choose <strong>Add</strong> and <strong>Add custom connector</strong>.</>,
        <>Name it <strong>Sonorous Envelope</strong>, paste the connector URL into <strong>MCP server URL</strong>, and choose <strong>Continue</strong>.</>,
        <>Choose <strong>Connect</strong>: you sign in here and approve access.</>,
        <>In a new conversation, switch the connector on from the <strong>+</strong> menu in the message box.</>,
        <>The model gives you a player link. Open it and tap <strong>Start listening</strong>.</>,
      ],
    },
    {
      id: "chatgpt", name: "ChatGPT", tested: true,
      intro: "Custom connectors in ChatGPT.",
      steps: [
        <>Open <strong>Settings → Connectors</strong> (or <strong>Apps</strong>) and turn on <strong>Developer mode</strong> under Advanced, if your plan asks for it.</>,
        <>Choose <strong>Create</strong>, name it <strong>Sonorous Envelope</strong>, and paste the connector URL.</>,
        <>Choose <strong>OAuth</strong> for the sign-in, then save and approve access.</>,
        <>In a new chat, switch the connector on from the message box and ask for a session.</>,
        <>Open the player link the model gives you and tap <strong>Start listening</strong>.</>,
      ],
      note: "Custom connectors depend on your plan. Menu names change often.",
    },
    {
      id: "cursor", name: "Cursor", tested: false,
      intro: "Cursor reads remote MCP servers from its MCP settings.",
      steps: [
        <>Open <strong>Cursor Settings → Tools &amp; MCP</strong> and choose <strong>Add new MCP server</strong>. It opens <code>mcp.json</code>.</>,
        <>Add the server with the connector URL (below), and save.</>,
        <>Choose <strong>Connect</strong> next to it when Cursor asks you to sign in, and approve access.</>,
        <>In the chat, ask for a session. The model gives you a player link: open it and tap <strong>Start listening</strong>.</>,
      ],
      code: `{\n  "mcpServers": {\n    "sonorous-envelope": {\n      "url": "${url}"\n    }\n  }\n}`,
      note: "We have not tried this one yet.",
    },
    {
      id: "copilot", name: "GitHub Copilot", tested: false,
      intro: "Copilot Chat in VS Code, in Agent mode.",
      steps: [
        <>Open the Command Palette (<strong>Ctrl+Shift+P</strong>) and run <strong>MCP: Add Server</strong>.</>,
        <>Choose <strong>HTTP</strong>, paste the connector URL, and name it <strong>Sonorous Envelope</strong>.</>,
        <>Sign in when asked, then start the server from the MCP list.</>,
        <>In Copilot Chat, switch to <strong>Agent</strong> mode and ask for a session.</>,
      ],
      note: "We have not tried this one yet. Copilot on github.com and in the GitHub mobile apps does not support remote MCP servers.",
    },
    {
      id: "other", name: "Anything else", tested: false,
      intro: "Any app that connects to a remote MCP server by URL and signs in with OAuth should work.",
      steps: [
        <>Look for <strong>MCP</strong>, <strong>custom connector</strong> or <strong>tools</strong> in the app&apos;s settings.</>,
        <>Add a remote server with an <strong>HTTP</strong> URL and paste the connector URL.</>,
        <>Sign in and approve access, then ask for a session.</>,
      ],
      note: "Apps that only run local command-line MCP servers cannot use it.",
    },
  ];
  const [active, setActive] = useState(apps[0].id);
  const app = apps.find((a) => a.id === active) ?? apps[0];
  return (
    <div className="add-tabs">
      <div role="tablist" aria-label="Your AI app" className="add-tablist">
        {apps.map((a) => (
          <button key={a.id} role="tab" type="button" id={`${base}-${a.id}`} aria-selected={a.id === active} aria-controls={`${base}-panel`}
            tabIndex={a.id === active ? 0 : -1} className="add-tab" onClick={() => setActive(a.id)}
            onKeyDown={(e) => {
              const i = apps.findIndex((x) => x.id === active), d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (d) { e.preventDefault(); const n = apps[(i + d + apps.length) % apps.length].id; setActive(n); document.getElementById(`${base}-${n}`)?.focus(); }
            }}>
            {a.name}
          </button>
        ))}
      </div>
      <section role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-${app.id}`} className="add-panel">
        <header className="add-panel-head">
          <h2 className="se-title">{app.name}</h2>
          <span className={app.tested ? "add-badge add-badge-ok" : "add-badge"}>{app.tested ? "Tested" : "Not tested yet"}</span>
        </header>
        <p className="se-muted add-intro">{app.intro}</p>
        <ol className="add-steps">
          {app.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
        {app.code && <pre className="add-code"><code>{app.code}</code></pre>}
        {app.note && <p className="se-sm se-muted add-note">{app.note}</p>}
      </section>
    </div>
  );
}
