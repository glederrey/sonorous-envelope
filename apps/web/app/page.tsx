export default function Home() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        padding: "0 16px",
      }}
    >
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" width={64} height={64} alt="" />
        <h1 style={{ fontWeight: 600 }}>Sonorous Envelope</h1>
        <p style={{ opacity: 0.7 }}>Coming soon.</p>
      </div>
    </main>
  );
}
