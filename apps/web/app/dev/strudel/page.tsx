import type { Metadata } from "next";
import { StrudelLab } from "./strudel-lab";

export const metadata: Metadata = { title: "Strudel lab", robots: { index: false, follow: false } };

// A calibration page for the Strudel picture (docs/implementation/strudel.md, "The picture"): type or pick some code, press Play, and see
// the same view, worker and drawings as the player, with no session and no database.
export default function Page() {
  return <StrudelLab />;
}
