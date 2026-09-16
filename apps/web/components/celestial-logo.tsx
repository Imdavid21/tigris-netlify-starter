export function CelestialLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Celestial"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="9" fill="#E6F4B7" />
      <path
        d="M16 8.5c.38 4.3 2.7 6.62 7 7-4.3.38-6.62 2.7-7 7-.38-4.3-2.7-6.62-7-7 4.3-.38 6.62-2.7 7-7Z"
        fill="#11120F"
      />
    </svg>
  );
}
