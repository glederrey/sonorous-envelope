// The product's own shape: an ADSR envelope drawn as one stroke, warm to cool.
export function Envelope({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 600 200" fill="none" role="img" aria-label="An attack, decay, sustain and release envelope">
      <defs>
        <linearGradient id="env-stroke" x1="0" y1="0" x2="600" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f4a940" />
          <stop offset="1" stopColor="#45c7b6" />
        </linearGradient>
      </defs>
      <path
        className="lp-env-line"
        pathLength={1}
        d="M12 180 C 70 180, 110 24, 150 24 C 190 24, 210 92, 260 96 L 430 96 C 490 96, 520 180, 588 180"
        stroke="url(#env-stroke)"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}
