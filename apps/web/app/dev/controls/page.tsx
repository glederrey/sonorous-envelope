import type { Metadata } from "next";
import { ControlsLab } from "./controls-lab";

export const metadata: Metadata = { title: "Controls lab", robots: { index: false, follow: false } };

// The listening controls of the player with made-up state and no session, to look at the layout and try the buttons: the owner's view, a
// signed-in listener's, and a guest's (components/player/controls-panel.tsx and controls-middle.tsx are the same ones the player uses).
export default function Page() {
  return <ControlsLab />;
}
