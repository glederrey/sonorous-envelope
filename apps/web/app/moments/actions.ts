"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../lib/supabase/server";

const ID = /^[A-Za-z0-9_-]{22}$/;

/** The owner renames a saved moment. Only the name can change: RLS and the column grant (migration 0027) refuse anything else. */
export async function renameMoment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!ID.test(id) || name.length < 1 || name.length > 80) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("saved_moments").update({ name }).eq("id", id).eq("owner_id", data.user.id);
  revalidatePath("/moments");
  revalidatePath(`/m/${id}`);
}

/** The owner deletes a saved moment; its link stops working. */
export async function deleteMoment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!ID.test(id)) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("saved_moments").delete().eq("id", id).eq("owner_id", data.user.id);
  revalidatePath("/moments");
  revalidatePath(`/m/${id}`);
}
