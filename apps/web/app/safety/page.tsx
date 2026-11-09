import { SiteHeader } from "../../components/site-header";

export const metadata = { title: "Safety and control · Sonorous Envelope" };

export default function SafetyPage() {
  return (
    <>
      <SiteHeader />
      <main className="doc-page">
        <div className="doc-head">
          <h1 className="doc-title">Safety and control</h1>
          <p>
            Text lets a model soften what it says. Sound and colour reach you before anything can be softened, so a
            sudden harsh or desolate sound can startle someone who did not expect it. For now Claude decides how it
            sounds and looks, and you decide how loud it is. Listener limits are planned and not built yet.
          </p>
        </div>

        <div className="doc-rows">
          <section className="doc-row">
            <h2 className="se-heading">What you control</h2>
            <ul className="doc-list">
              <li>The volume, on every device that plays the sound. Claude cannot change it.</li>
              <li>Mute, one tap away. It stays muted until you turn it back on.</li>
              <li>Closing the page. A session that gets no update fades to silence by itself after a few minutes, unless Claude turns that off.</li>
            </ul>
          </section>

          <section className="doc-row">
            <h2 className="se-heading">Rules that never change</h2>
            <ul className="doc-list">
              <li>The colour never flashes faster than 3 per second.</li>
              <li>The sound never goes above a fixed maximum level, whatever the volume you set.</li>
            </ul>
          </section>

          <section className="doc-row">
            <h2 className="se-heading">What the sound means</h2>
            <p style={{ margin: 0 }}>
              Whether any feeling stands behind the sound is uncertain. Models can also slip into performing the
              emotion they think you expect. This is an expressive channel, not proof of what the model feels.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
