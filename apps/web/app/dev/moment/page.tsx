import type { Metadata } from "next";
import { SiteHeader } from "../../../components/site-header";
import { MomentLab } from "./moment-lab";

export const metadata: Metadata = { title: "Moment lab", robots: { index: false, follow: false } };

// The page of a saved moment (components/moment/moment-player.tsx, the one /m/<id> uses) on a made-up synth state and a made-up Strudel
// state, with no database: to look at it in a browser before the migration is released.
export default function Page() {
  return (
    <>
      <SiteHeader hideAuth />
      <MomentLab />
    </>
  );
}
