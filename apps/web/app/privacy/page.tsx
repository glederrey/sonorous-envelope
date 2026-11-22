import { pageMeta } from "../../lib/site";
import { SiteHeader } from "../../components/site-header";
import { REPO } from "../../lib/version";

export const metadata = pageMeta("Privacy", "What Sonorous Envelope stores, what it does not, and how to delete your sessions and account.", "/privacy");

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
              <li>Your sessions: the title, the sounds and colours the AI set, what the sound read as, the settings of the session, and the moments and motifs the AI keeps.</li>
              <li>Your saved moments: the sound and picture the AI saved, with a link anyone who has it can open, until you delete it from the Moments page.</li>
              <li>Your presses in the player: reactions (“Guide the sound”) and what you heard (“Tell the AI what you heard”).</li>
              <li>One snapshot per session: the picture the player shows and a spectrogram of its sound output (not your microphone or camera). It is replaced as it updates, and we also keep the copy the AI last looked at. You can turn it off in the player, under “Feedback to the AI”.</li>
              <li>Who is listening: a device id and whether the sound is playing, muted or not started, while a player page is open. People who open a shared link without an account are not identified.</li>
              <li>Anonymous notes to the developers: the text, its kind, and the app version and mode it was sent from. No account, session or conversation is attached. A count of notes per account is kept for the day only, to enforce the daily limit.</li>
            </ul>
          </li>
          <li className="doc-row">
            <h2 className="se-heading">What we do not do</h2>
            <ul className="doc-list">
              <li>We do not sell or share your data, and we show no ads.</li>
              <li>We do not record your voice or anything you type to the AI. The connector receives what the AI sends, your presses in the player, and, unless you turn it off, the player's snapshot.</li>
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
              You can end any of your sessions from the sessions page. Ending a session keeps its data. Deleting it removes the session with its snapshot, the moments kept in it and its motifs; saved moments stay on your Moments page. A note to the developers cannot be found or removed per person, because it carries no account. You can delete your account, with all its data, from Settings at any time. For a copy of your data,
              open an issue on <a href={issues} rel="noopener">GitHub</a>.
            </p>
          </li>
        </ul>
      </main>
    </>
  );
}
