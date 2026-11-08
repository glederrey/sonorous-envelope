import Link from "next/link";

const GITHUB = "https://github.com/glederrey/sonorous-envelope";

export function SiteFooter() {
  return (
    <footer className="se-footer">
      <nav className="se-sm">
        <Link href="/guide">Using the connector</Link>
        <Link href="/safety">Safety</Link>
        <a href={GITHUB}>GitHub</a>
      </nav>
    </footer>
  );
}
