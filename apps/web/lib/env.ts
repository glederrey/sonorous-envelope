// Read lazily: CI builds with only two placeholder variables, and previews have none.
// NEXT_PUBLIC_* must be referenced literally so Next can inline them.

function need(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export function supabaseUrl() {
  return need("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey() {
  return need("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function authIssuer() {
  return need("SUPABASE_AUTH_ISSUER", process.env.SUPABASE_AUTH_ISSUER);
}

export function jwksUrl() {
  return need("SUPABASE_JWKS_URL", process.env.SUPABASE_JWKS_URL);
}

export function publicBaseUrl() {
  return need("PUBLIC_BASE_URL", process.env.PUBLIC_BASE_URL).replace(/\/+$/, "");
}

export function mcpResourceUrl() {
  return need("MCP_RESOURCE_URL", process.env.MCP_RESOURCE_URL);
}

export function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
