import { SiteHeader } from "../../components/site-header";
import { CopyField } from "../../components/copy-field";
import { AppTabs } from "../../components/app-tabs";
import { mcpResourceUrl } from "../../lib/env";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Add to your AI",
  description: "Paste one URL into Claude, ChatGPT or any MCP client to give your AI a synth, Strudel music and visuals. Free.",
  alternates: { canonical: "/add" },
};

export default function AddPage() {
  return (
    <>
      <SiteHeader />
      <main className="doc-page">
        <div className="doc-head">
          <h1 className="doc-title">Add to your AI</h1>
          <p className="se-muted add-lede">Paste one URL into your AI app. It takes about a minute.</p>
          <div style={{ maxWidth: 560 }}>
            <CopyField label="Connector URL" value={mcpResourceUrl()} />
          </div>
        </div>

        <AppTabs url={mcpResourceUrl()} />

        <section className="gd-section" aria-labelledby="add-next">
          <h2 className="se-title" id="add-next">Then</h2>
          <p>
            Turn the connector on at the start of a conversation and the AI calls its tools itself: <a href="/how-it-works">what each tool does</a>,
            and <a href="/modes">the three modes</a> of the sound.
          </p>
        </section>
      </main>
    </>
  );
}
