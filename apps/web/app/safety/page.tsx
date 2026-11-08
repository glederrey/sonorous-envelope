import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";

export const metadata = { title: "Safety and control · Sonorous Envelope" };

export default function SafetyPage() {
  return (
    <>
      <SiteHeader />
      <main className="se-page se-stack">
        <h1 className="se-title">Safety and control</h1>
        <p>
          Text lets a model soften what it says. Sound and colour reach you before anything can be softened, so a sudden
          harsh or desolate sound can startle someone who did not expect it. The limits below are enforced on the
          server: the model can never go past them.
        </p>

        <section className="se-stack">
          <h2 className="se-heading">Your limits</h2>
          <ul style={{ paddingLeft: 24 }} className="se-stack">
            <li>Maximum volume.</li>
            <li>Maximum harshness: resonance, roughness and high-frequency energy.</li>
            <li>Maximum change speed: a minimum transition time.</li>
            <li>Maximum colour contrast and brightness.</li>
            <li>Mood range: for example a floor on joy or calm, so the sound never goes below a level you are comfortable with.</li>
            <li>Gestures on or off.</li>
          </ul>
        </section>

        <section className="se-stack">
          <h2 className="se-heading">Consent levels</h2>
          <ul style={{ paddingLeft: 24 }} className="se-stack">
            <li><strong>Ambient only</strong>: gentle, slow, consonant. The default.</li>
            <li><strong>Expressive</strong>: a wider range, still smooth transitions.</li>
            <li><strong>Anything goes</strong>: sudden changes and dissonance allowed.</li>
          </ul>
        </section>

        <section className="se-stack">
          <h2 className="se-heading">Rules that never change</h2>
          <ul style={{ paddingLeft: 24 }} className="se-stack">
            <li>No flashing faster than 3 per second, and limited brightness swings.</li>
            <li>Mute is always one tap away, and stays muted until you turn it back on.</li>
            <li>Big emotional shifts fade in over several seconds unless you allow sudden changes.</li>
            <li>The model is told about every adjustment, so it knows its expression was limited.</li>
          </ul>
        </section>

        <section className="se-stack">
          <h2 className="se-heading">What the sound means</h2>
          <p>
            Whether any feeling stands behind the sound is uncertain. Models can also slip into performing the emotion
            they think you expect. This is an expressive channel, not proof of what the model feels.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
