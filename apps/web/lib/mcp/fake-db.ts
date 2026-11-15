// A small in-memory stand-in for the Supabase client, for unit tests of the tool service (the real Postgres run is service.integration.test.ts).
// Supports only the chains service.ts uses: select / insert / update with eq, is, not, gte, lt, order, limit, single, maybeSingle, head count.
type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

class Query implements PromiseLike<{ data: unknown; error: null; count?: number }> {
  private filters: Filter[] = [];
  private mode: "select" | "insert" | "update" = "select";
  private payload: Row = {};
  private head = false; private wantCount = false; private one: "single" | "maybe" | null = null;
  private orderBy: { col: string; asc: boolean } | null = null; private max = Infinity;
  constructor(private rows: Row[]) {}

  select(_cols?: string, opt?: { count?: string; head?: boolean }) { this.wantCount = Boolean(opt?.count); this.head = Boolean(opt?.head); return this; }
  insert(p: Row) { this.mode = "insert"; this.payload = p; return this; }
  update(p: Row) { this.mode = "update"; this.payload = p; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  is(c: string, v: unknown) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  not(c: string, _op: string, v: unknown) { this.filters.push((r) => (r[c] ?? null) !== v); return this; }
  gte(c: string, v: unknown) { this.filters.push((r) => String(r[c]) >= String(v)); return this; }
  lt(c: string, v: unknown) { this.filters.push((r) => String(r[c]) < String(v)); return this; }
  order(col: string, o?: { ascending?: boolean }) { this.orderBy = { col, asc: o?.ascending ?? true }; return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.one = "single"; return this; }
  maybeSingle() { this.one = "maybe"; return this; }

  private run() {
    if (this.mode === "insert") { const r = { ...this.payload }; this.rows.push(r); return { data: this.one ? r : [r], error: null }; }
    let hit = this.rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.mode === "update") { for (const r of hit) Object.assign(r, this.payload); return { data: null, error: null }; }
    if (this.orderBy) { const { col, asc } = this.orderBy; hit = [...hit].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1)); }
    hit = hit.slice(0, this.max);
    if (this.head) return { data: null, error: null, count: hit.length };
    if (this.one) return { data: hit[0] ?? null, error: null };
    return { data: hit, error: null, ...(this.wantCount ? { count: hit.length } : {}) };
  }
  then<A, B>(ok?: ((v: { data: unknown; error: null; count?: number }) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.run()).then(ok, bad);
  }
}

let nextId = 1;
/** An in-memory Db. Rows of `states` get an id when inserted without one, as the database would. */
export function fakeDb() {
  const tables: Record<string, Row[]> = {};
  const rows = (t: string) => (tables[t] ??= []);
  const db = {
    from: (t: string) => {
      const q = new Query(rows(t));
      const insert = q.insert.bind(q);
      q.insert = (p: Row) => insert(t === "states" && p.id === undefined ? { ...p, id: `st${nextId++}` } : p);
      return q;
    },
    rpc: async () => ({ data: [], error: null }),
  };
  return { db: db as never, tables };
}
