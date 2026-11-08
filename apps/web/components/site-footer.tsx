import { appVersion, sourceLinks } from "../lib/version";

/** Licence, source and version. The source link is what the AGPL (section 13) asks us to offer. */
export function SiteFooter() {
  const version = appVersion();
  const links = sourceLinks(version);
  return (
    <footer className="se-footer">
      <a href={links.license} rel="noopener">AGPL-3.0</a>
      <a href={links.source} rel="noopener">Source code</a>
      {links.release ? <a href={links.release} rel="noopener">{version}</a> : <span>{version}</span>}
    </footer>
  );
}
