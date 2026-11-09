import { SiteHeader } from "../../components/site-header";
import { REPO } from "../../lib/version";

export const metadata = { title: "Privacy · Sonorous Envelope" };

export default function PrivacyPage() {
  const issues = `${REPO}/issues`;
  return (
    <>
      <SiteHeader />
      <main className="doc-page">
        <div className="doc-head">
          <h1 className="doc-title">Privacy</h1>
          <p>
            Sonorous Envelope is an open-source project. This page says what it keeps about you and why. It is short
            because there is little to say.
          </p>
        </div>

        <ul className="doc-rows">
          <li className="doc-row">
            <h2 className="se-heading">What we keep</h2>
            <ul className="doc-list">
              <li>Your account: the email address you signed up with and, with Google sign-in, the name Google shares. Nothing else is read from your Google account.</li>
              <li>Your sessions: the title, the sounds and colours the model set, what the sound read as, and the settings of the session.</li>
              <li>Who is listening: a device id and whether the sound is playing, muted or not started, while a player page is open. People who open a shared link without an account are not identified.</li>
            </ul>
          </li>
          <li className="doc-row">
            <h2 className="se-heading">What we do not do</h2>
            <ul className="doc-list">
              <li>We do not sell or share your data, and we show no ads.</li>
              <li>We do not record your voice or anything you type to the model. The connector only receives what the model sends to it.</li>
              <li>Analytics and tracking cookies are not used. The only cookies keep you signed in.</li>
            </ul>
          </li>
          <li className="doc-row">
            <h2 className="se-heading">Where it lives</h2>
            <p style={{ margin: 0 }}>
              The site runs on Vercel and the data is stored with Supabase. Signing in with Google goes through
              Google, which tells you what it shares.
            </p>
          </li>
          <li className="doc-row">
            <h2 className="se-heading">Your data</h2>
            <p style={{ margin: 0 }}>
              You can end any of your sessions from the sessions page. To see or delete your data or your account,
              open an issue on <a href={issues} rel="noopener">GitHub</a> and we will do it.
            </p>
          </li>
        </ul>
      </main>
    </>
  );
}
