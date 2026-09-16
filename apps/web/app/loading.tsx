import { MaterialCircularProgress, MaterialLinearProgress } from "@/components/m3/material-feedback";

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
          gap: 18,
          justifyItems: "center"
        }}
      >
        <MaterialCircularProgress ariaLabel="Loading Celestial" />
        <strong style={{ font: "var(--md-sys-typescale-title-medium)" }}>Loading Celestial</strong>
        <MaterialLinearProgress indeterminate ariaLabel="Loading page" className="route-loading-progress" />
      </div>
    </main>
  );
}
