export function CelestialLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 44 44"
      role="img"
      aria-label="Celestial"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="celestial-orbit" x1="6" y1="5" x2="37" y2="39" gradientUnits="userSpaceOnUse">
          <stop stopColor="#62E7FF" />
          <stop offset=".48" stopColor="#6C7CFF" />
          <stop offset="1" stopColor="#A66BFF" />
        </linearGradient>
        <radialGradient id="celestial-core" cx="0" cy="0" r="1" gradientTransform="translate(18 18) rotate(48) scale(21)">
          <stop stopColor="#EDF5FF" />
          <stop offset=".45" stopColor="#9BA7FF" />
          <stop offset="1" stopColor="#6C56D9" />
        </radialGradient>
      </defs>

      <path
        d="M31.4 8.4A16.9 16.9 0 1 0 33 33.6 14.4 14.4 0 1 1 31.4 8.4Z"
        fill="url(#celestial-orbit)"
      />
      <circle cx="22" cy="22" r="8.3" fill="url(#celestial-core)" />
      <path
        d="M22 13.4c.55 4.72 1.88 7.3 6.6 8.6-4.72.55-7.3 1.88-8.6 6.6-.55-4.72-1.88-7.3-6.6-8.6 4.72-.55 7.3-1.88 8.6-6.6Z"
        fill="#fff"
        fillOpacity=".9"
      />
      <ellipse
        cx="22"
        cy="22"
        rx="18.5"
        ry="10.2"
        fill="none"
        stroke="url(#celestial-orbit)"
        strokeWidth="1.25"
        transform="rotate(-20 22 22)"
      />
      <circle cx="37" cy="13" r="2.25" fill="#62E7FF" />
      <circle cx="7.2" cy="31.8" r="1.75" fill="#A66BFF" />
    </svg>
  );
}
