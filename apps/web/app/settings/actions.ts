"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

/** Revoke one app: every connection it holds. Claude registers a new client each time the connector is added again, so one app can hold
 *  many grants under the same name; the page shows them as one row and sends all their client ids. */
export async function revokeGrant(formData: FormData) {
  const ids = formData.getAll("client_id").map(String).filter((id) => id && id.length <= 200).slice(0, 100);
  if (ids.length === 0) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  for (const clientId of ids) await supabase.auth.oauth.revokeGrant({ clientId });
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
  redirect("/");
}
