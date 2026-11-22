import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Roboto } from "next/font/google";
import { SiteFooter } from "../components/site-footer";
import { OG_IMAGE, SITE_URL } from "../lib/site";
import { FACES, MODE_LABEL } from "../lib/mcp/modes";
import "./globals.css";

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains" });

export const TITLE = "Sonorous Envelope: non-verbal communication for your AI";
const [SELF, ATTUNED, JUKEBOX] = FACES.map((f) => MODE_LABEL[f]);
// What search results and link previews show: the idea first (non-verbal communication), then what it is. About 155 characters.
export const DESCRIPTION = "Non-verbal communication for your AI: a free MCP server that lets it express itself in sound and colour beside the chat, with a synth or live Strudel music.";
const KEYWORDS = ["non-verbal communication", "AI", "MCP server", "Claude connector", "AI music", "synthesizer", "Strudel", "sound", "colour", "affective computing", SELF, ATTUNED, JUKEBOX];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Sonorous Envelope", template: "%s · Sonorous Envelope" },
  description: DESCRIPTION,
  keywords: KEYWORDS,
  applicationName: "Sonorous Envelope",
  // Google picks the favicon from these: an SVG plus PNGs that are a multiple of 48 px
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
  openGraph: {
    type: "website", siteName: "Sonorous Envelope", title: TITLE, description: DESCRIPTION, url: "/",
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [OG_IMAGE.url] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0e12" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${roboto.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("se-theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}try{var m=document.createElement("div");m.style.cssText="position:absolute;top:-99px;width:99px;height:99px;overflow:scroll";document.documentElement.appendChild(m);document.documentElement.style.setProperty("--se-sbw",(m.offsetWidth-m.clientWidth)+"px");m.remove()}catch(e){}try{var d=document.documentElement,u=function(){if(d.scrollHeight<=d.clientHeight)d.setAttribute("data-noscroll","");else d.removeAttribute("data-noscroll")};addEventListener("DOMContentLoaded",function(){u();new ResizeObserver(u).observe(document.body)});addEventListener("resize",u);addEventListener("load",u)}catch(e){}`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <div className="se-shell">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
