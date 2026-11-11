import type { Metadata } from "next";
import { VisualsLab } from "./visuals-lab";

export const metadata: Metadata = { title: "Visuals lab", robots: { index: false, follow: false } };

// A calibration page for the moving picture (docs/visuals.md): the five landing emotions side by side, at a tempo you choose, with the
// hue taken away if you like. It runs the same canvas and the same frame model as the player. No session, no data.
export default function Page() {
  return <VisualsLab />;
}
