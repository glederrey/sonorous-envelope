import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { publicBaseUrl } from "../../../lib/env";
import { safeNext } from "../../../lib/safe-next";

export async function GET(request: NextRequest) {
  const base = publicBaseUrl();
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${base}${next}`);
  }
  return NextResponse.redirect(`${base}/login?error=1&next=${encodeURIComponent(next)}`);
}
