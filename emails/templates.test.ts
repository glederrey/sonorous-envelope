import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS module
import { templates } from "./build.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
// The variables Supabase fills in for auth emails.
const ALLOWED = new Set([".ConfirmationURL", ".Token", ".Email", ".NewEmail", ".SiteURL"]);

describe("auth email templates", () => {
  for (const [name, t] of Object.entries(templates) as [string, { subject: string; button?: { url: string }; code?: string }][]) {
    const html = readFileSync(join(dir, "dist", `${name}.html`), "utf8");

    it(`${name}: only uses variables Supabase provides`, () => {
      const vars = [...html.matchAll(/\{\{\s*(\.[A-Za-z]+)\s*\}\}/g)].map((m) => m[1]);
      expect(vars.length).toBeGreaterThan(0);
      for (const v of vars) expect(ALLOWED.has(v), v).toBe(true);
    });

    it(`${name}: has a subject, an action and nothing unfinished`, () => {
      expect(t.subject.length).toBeGreaterThan(5);
      expect(html).toContain(`<title>${t.subject}</title>`);
      expect(t.button || t.code).toBeTruthy();
      if (t.button) expect(html).toContain(`href="${t.button.url}"`);
      if (t.code) expect(html).toContain(t.code);
      expect(html).not.toMatch(/undefined|TODO|\[object/);
    });
  }

  it("the committed files are up to date with the builder", async () => {
    // Fails if someone edited build.mjs without running `pnpm emails`.
    const { build } = await import("./build.mjs");
    const before = Object.keys(templates).map((n) => readFileSync(join(dir, "dist", `${n}.html`), "utf8"));
    build();
    const after = Object.keys(templates).map((n) => readFileSync(join(dir, "dist", `${n}.html`), "utf8"));
    expect(after).toEqual(before);
  });
});
