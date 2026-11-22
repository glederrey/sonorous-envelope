import { renameMoment } from "../../app/moments/actions";

/** The owner's rename form for a saved moment (on /m and in the /moments list). Only the name can change. */
export function RenameMoment({ id, name }: { id: string; name: string }) {
  return (
    <details>
      <summary className="se-btn" style={{ display: "inline-flex" }}>Rename</summary>
      <form action={renameMoment} className="se-stack" style={{ marginTop: 12 }}>
        <input type="hidden" name="id" value={id} />
        <label className="se-sm se-muted" htmlFor={`rename-${id}`}>Name</label>
        <input id={`rename-${id}`} name="name" type="text" className="se-input" defaultValue={name} maxLength={80} required autoComplete="off" />
        <button type="submit" className="se-btn se-btn-primary">Save</button>
      </form>
    </details>
  );
}
