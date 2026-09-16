export function CelestialLogo({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M24.5 6.2a12 12 0 1 0 1.3 18.2" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <path d="m19 6 2.4 7.6L29 16l-7.6 2.4L19 26l-2.4-7.6L9 16l7.6-2.4L19 6Z" fill="currentColor" />
  </svg>;
}
