import "./globals.css";

export const metadata = { title: "Sonorous Envelope", icons: { icon: "/icon.svg" } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
