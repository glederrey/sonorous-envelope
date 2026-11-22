"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
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

export async function deleteAccount(formData: FormData) {
  if (formData.get("confirm") !== "delete") redirect("/settings");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=%2Fsettings");
  const { error } = await supabase.rpc("delete_my_account");
  if (error) redirect("/settings?error=delete");
  // The auth user is gone, so the sign-out call may fail; the cookies must go either way.
  try {
    await supabase.auth.signOut();
  } catch {
    // ignored: the cookies are cleared below
  }
  const cookieStore = await cookies();
  for (const { name } of cookieStore.getAll()) if (name.startsWith("sb-")) cookieStore.delete(name);
  revalidatePath("/", "layout");
  redirect("/login?deleted=1");
}
