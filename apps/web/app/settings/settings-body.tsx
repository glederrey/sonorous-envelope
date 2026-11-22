import { revokeGrant } from "./actions";
import { DeleteAccountForm } from "./delete-account-form";

export interface ConnectedApp { name: string; ids: string[]; first: string; last: string }

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB");

/** The Settings rows (connected apps, delete account). Shared by /settings and the account lab, so the lab shows the real layout. */
export function SettingsBody({ grants, error }: { grants: ConnectedApp[]; error?: string }) {
  return (
    <div className="doc-rows">
      <section className="doc-row">
        <h2 className="se-heading">Connected apps</h2>
        <div className="se-stack">
          {grants.length === 0 ? (
            <p className="se-muted" style={{ margin: 0 }}>No apps are connected.</p>
          ) : (
            grants.map((app) => (
              <form key={app.name} action={revokeGrant} className="se-grant">
                <div>
                  <strong>{app.name}</strong>
                  <div className="se-sm se-muted">
                    {app.ids.length === 1 ? `Since ${day(app.first)}` : `Since ${day(app.first)} · last connected ${day(app.last)}`}
                  </div>
                </div>
                {app.ids.map((id) => <input key={id} type="hidden" name="client_id" value={id} />)}
                <button type="submit" className="se-btn">Revoke</button>
              </form>
            ))
          )}
        </div>
      </section>
      <section className="doc-row">
        <h2 className="se-heading">Delete account</h2>
        <div className="se-stack">
          <DeleteAccountForm>
            <p className="se-muted" style={{ margin: 0 }}>
              This deletes your account and everything in it: every session, every saved moment, and the apps connected to it.
              Shared links stop working. It cannot be undone.
            </p>
          </DeleteAccountForm>
          {error === "delete" ? <p className="se-error se-sm" role="alert" style={{ margin: 0 }}>The account could not be deleted. Try again.</p> : null}
        </div>
      </section>
    </div>
  );
}
