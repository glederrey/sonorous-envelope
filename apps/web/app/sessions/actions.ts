"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../lib/supabase/server";

/** The owner ends one of their sessions from the sessions page. RLS only lets the owner update the row. */
export async function endSession(formData: FormData) {
  const id = String(formData.get("session_id") ?? "");
  if (!id || id.length > 64) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("sessions").update({ ended_at: new Date().toISOString() }).eq("id", id).eq("owner_id", data.user.id).is("ended_at", null);
  revalidatePath("/sessions");
}
