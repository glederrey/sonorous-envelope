// The release tag (e.g. "v0.0.10") is set by the deploy workflow as APP_VERSION. Local builds and CI show "dev".
const REPO = "https://github.com/glederrey/sonorous-envelope";

export function appVersion(): string {
  return process.env.NEXT_PUBLIC_APP_VERSION || "dev";
}

/** AGPL section 13: point to the source of the version that is running. */
export function sourceLinks(version = appVersion()) {
  const ref = version === "dev" ? "main" : version;
  return {
    source: version === "dev" ? REPO : `${REPO}/tree/${ref}`,
    license: `${REPO}/blob/${ref}/LICENSE`,
    release: version === "dev" ? null : `${REPO}/releases/tag/${version}`,
  };
}
