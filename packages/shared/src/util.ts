/** Deep copy of plain JSON-like data (EngineState has no functions or dates). */
export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
