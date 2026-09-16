import { CoreSpiralLoader } from "@/components/dotmatrix/celestial-loaders";

export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--md-sys-color-background)",
        color: "var(--md-sys-color-on-background)"
      }}
    >
      <div
        style={{
          width: "min(420px, calc(100vw - 40px))",
          display: "grid",
          gap: 16,
          justifyItems: "center"
        }}
      >
        <CoreSpiralLoader size={58} dotSize={6} speed={1.05} ariaLabel="Loading Celestial" />
        <strong className="md-typescale-title-medium">Loading Celestial</strong>
        <span className="md-typescale-body-small" style={{ color: "var(--md-sys-color-on-surface-variant)" }}>
          Resolving markets and interface state
        </span>
      </div>
    </main>
  );
}
