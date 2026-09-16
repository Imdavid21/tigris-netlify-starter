"use client";

import type { CSSProperties } from "react";
import styles from "./CelestialLoaders.module.css";

type LoaderVariant = "coreSpiral" | "pulseLadder" | "arcBeacon" | "railScan" | "checkSpin";
type LoaderTone = "primary" | "success" | "muted";

type LoaderProps = {
  variant: LoaderVariant;
  size?: number;
  dotSize?: number;
  speed?: number;
  ariaLabel?: string;
  tone?: LoaderTone;
  className?: string;
};

type DotStyle = CSSProperties & {
  "--dmx-order"?: number;
};

// Adapted from the open-source Dot Matrix loader patterns by zzzzshawn/matrix.
// The motion signatures are retained, while geometry, timing, and color are
// customized for Celestial's Material 3 system.

const SPIRAL_PATH = [
  0, 1, 2, 3, 4,
  9, 14, 19, 24,
  23, 22, 21, 20,
  15, 10, 5,
  6, 7, 8,
  13, 18, 17, 16,
  11, 12
];

const LADDER_PATH = [
  20, 15, 10, 5, 0,
  2, 7, 12, 17, 22,
  21, 16, 11, 6, 1,
  4, 9, 14, 19, 24,
  23, 18, 13, 8, 3
];

const CHECK_ACTIVE = new Set([2, 4, 6, 7]);

function orderMap(path: number[]) {
  const map = new Map<number, number>();
  path.forEach((index, order) => map.set(index, order));
  return map;
}

const SPIRAL_ORDER = orderMap(SPIRAL_PATH);
const LADDER_ORDER = orderMap(LADDER_PATH);

function beaconSector(index: number) {
  const row = Math.floor(index / 5);
  const col = index % 5;
  const x = col - 2;
  const y = row - 2;
  if (x === 0 && y === 0) return 0;
  const angle = Math.atan2(y, x);
  return Math.round(((angle + Math.PI) / (Math.PI * 2)) * 8) % 8;
}

function delayFor(variant: LoaderVariant, index: number, speed: number) {
  if (variant === "coreSpiral") return -((SPIRAL_ORDER.get(index) ?? index) * 0.048) / speed;
  if (variant === "pulseLadder") return -((LADDER_ORDER.get(index) ?? index) * 0.046) / speed;
  if (variant === "railScan") {
    const row = Math.floor(index / 5);
    const col = index % 5;
    return -((row * 0.17 + Math.abs(col - 2) * 0.022) / speed);
  }
  if (variant === "arcBeacon") {
    const row = Math.floor(index / 5);
    const col = index % 5;
    const radius = Math.hypot(row - 2, col - 2);
    return -((beaconSector(index) * 0.13 + radius * 0.012) / speed);
  }
  return 0;
}

export function CelestialDotLoader({
  variant,
  size = variant === "checkSpin" ? 22 : 36,
  dotSize = variant === "checkSpin" ? 4 : 4.5,
  speed = 1,
  ariaLabel = "Loading",
  tone = variant === "checkSpin" ? "success" : "primary",
  className = ""
}: LoaderProps) {
  const count = variant === "checkSpin" ? 9 : 25;
  const duration = variant === "checkSpin" ? 0.95 : variant === "railScan" ? 1.05 : 1.22;
  const toneClass = tone === "success" ? styles.success : tone === "muted" ? styles.muted : "";
  const matrixClass = variant === "checkSpin" ? styles.matrix3 : styles.matrix5;

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={`${styles.loader} ${styles[variant]} ${toneClass} ${styles.inline} ${className}`.trim()}
      style={{
        "--dmx-size": `${size}px`,
        "--dmx-dot": `${dotSize}px`,
        "--dmx-duration": `${duration / Math.max(speed, 0.2)}s`
      } as CSSProperties}
    >
      <span className={`${matrixClass} ${styles[variant]}`} aria-hidden="true">
        {Array.from({ length: count }, (_, index) => {
          const active = variant === "checkSpin" && CHECK_ACTIVE.has(index);
          const dotStyle: DotStyle = {
            animationDelay: variant === "checkSpin" ? undefined : `${delayFor(variant, index, speed)}s`
          };
          return (
            <span
              key={index}
              className={`${styles.dot} ${active ? styles.active : ""}`.trim()}
              style={dotStyle}
            />
          );
        })}
      </span>
    </span>
  );
}

export function CoreSpiralLoader(props: Omit<LoaderProps, "variant">) {
  return <CelestialDotLoader variant="coreSpiral" {...props} />;
}

export function PulseLadderLoader(props: Omit<LoaderProps, "variant">) {
  return <CelestialDotLoader variant="pulseLadder" {...props} />;
}

export function ArcBeaconLoader(props: Omit<LoaderProps, "variant">) {
  return <CelestialDotLoader variant="arcBeacon" {...props} />;
}

export function RailScanLoader(props: Omit<LoaderProps, "variant">) {
  return <CelestialDotLoader variant="railScan" {...props} />;
}

export function CheckSpinLoader(props: Omit<LoaderProps, "variant">) {
  return <CelestialDotLoader variant="checkSpin" {...props} />;
}
