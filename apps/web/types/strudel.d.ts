// Strudel ships no type declarations; the code that uses it (strudel/, lib/strudel/) keeps its own narrow types.
declare module "superdough";
declare module "@strudel/core";
declare module "@strudel/mini";
declare module "@strudel/tonal";
declare module "@strudel/transpiler";
// `__pianoroll` is the one export of @strudel/draw we call (lib/strudel/draw.ts): it draws into the canvas context it is given.
declare module "@strudel/draw" {
  export function __pianoroll(options: Record<string, unknown>): unknown;
  export function pitchwheel(options: Record<string, unknown>): unknown;
  export function getTheme(): Record<string, string>;
  export function setTheme(theme: Record<string, string>): void;
}
