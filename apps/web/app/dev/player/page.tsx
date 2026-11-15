import type { Metadata } from "next";
import { PlayerLab } from "./player-lab";

export const metadata: Metadata = { title: "Player lab", robots: { index: false, follow: false } };

// The real player (components/player/player.tsx) fed by a stand-in client that serves scripted states, the way the server writes them:
// a synth scene, Strudel, strudel_mode off, set_sound after a pause, the closing sequence. To see the hand-overs without a session.
export default function Page() {
  return <PlayerLab />;
}
