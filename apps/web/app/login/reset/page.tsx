import { redirect } from "next/navigation";
import { SiteHeader } from "../../../components/site-header";
import { createClient } from "../../../lib/supabase/server";
import { getSignedInUser } from "../../../lib/supabase/user";
import { ResetForm } from "./reset-form";

export const metadata = { title: "New password · Sonorous Envelope" };

export default async function ResetPage() {
  const supabase = await createClient();
  if (!(await getSignedInUser(supabase))) redirect("/login");
  return (
    <>
      <SiteHeader hideAuth />
      <main className="se-narrow se-stack">
        <h1 className="se-title">Choose a new password</h1>
        <ResetForm />
      </main>
    </>
  );
}
