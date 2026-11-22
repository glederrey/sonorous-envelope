import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { EngineState } from "@sonorous/engine";
import { SiteHeader } from "../../../components/site-header";
import { MomentPlayer } from "../../../components/moment/moment-player";
import { hasSupabaseEnv } from "../../../lib/env";
import { createClient } from "../../../lib/supabase/server";

const ID = /^[A-Za-z0-9_-]{22}$/;

interface Saved { name: string; saved_by: "human" | "ai"; created_at: string; effective: EngineState; seed: number; voice_seed: number }

/** The one public read of a saved moment (get_saved_moment): it never carries the owner or the session. */
const load = cache(async (id: string) => {
  if (!ID.test(id) || !hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_saved_moment", { p_id: id });
  return data ? { supabase, saved: data as Saved } : null;
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const found = await load((await params).id);
  return { title: found?.saved.name ?? "Saved moment", robots: { index: false } };
}

export default async function MomentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await load(id);
  if (!found) notFound();
  const { supabase, saved } = found;
  // The owner is the one whose own (row-level secured) read finds the row: it is never in what everyone gets
  const { data: own } = await supabase.from("saved_moments").select("id").eq("id", id).maybeSingle();
  const mine = Boolean(own);
  return (
    <>
      <SiteHeader hideAuth />
      <MomentPlayer
        mine={mine}
        moment={{ id, name: saved.name, savedBy: saved.saved_by, createdAt: saved.created_at, effective: saved.effective, seed: Number(saved.seed), voiceSeed: Number(saved.voice_seed) }}
      />
    </>
  );
}
