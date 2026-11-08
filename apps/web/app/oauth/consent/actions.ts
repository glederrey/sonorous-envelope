"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { getSignedInUser } from "../../../lib/supabase/user";

export async function decide(formData: FormData) {
  const id = String(formData.get("authorization_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!id || id.length > 200 || (decision !== "approve" && decision !== "deny")) {
    redirect("/oauth/consent?error=1");
  }

  const supabase = await createClient();
  if (!(await getSignedInUser(supabase))) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${id}`)}`);

  const { data, error } =
    decision === "approve"
      ? await supabase.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true });
  if (error || !data?.redirect_url) redirect("/oauth/consent?error=1");
  redirect(data.redirect_url);
}
