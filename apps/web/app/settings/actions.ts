"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

export async function revokeGrant(formData: FormData) {
  const clientId = String(formData.get("client_id") ?? "");
  if (!clientId || clientId.length > 200) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.auth.oauth.revokeGrant({ clientId });
  revalidatePath("/settings");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
