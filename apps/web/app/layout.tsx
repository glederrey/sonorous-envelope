import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Roboto } from "next/font/google";
import { SiteFooter } from "../components/site-footer";
import "./globals.css";

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Sonorous Envelope",
  description: "Let the model hum while it thinks. A synthesizer and a colour field for an AI model.",
  icons: { icon: "/icon.svg" },
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
            __html: `try{var t=localStorage.getItem("se-theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}try{var m=document.createElement("div");m.style.cssText="position:absolute;top:-99px;width:99px;height:99px;overflow:scroll";document.documentElement.appendChild(m);document.documentElement.style.setProperty("--se-sbw",(m.offsetWidth-m.clientWidth)+"px");m.remove()}catch(e){}`,
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
