export type MaterialSpringName =
  | "spatialFast"
  | "spatialDefault"
  | "spatialSlow"
  | "effectsFast"
  | "effectsDefault"
  | "effectsSlow";

type SpringConfig = {
  dampingRatio: number;
  stiffness: number;
  maxDurationMs: number;
};

/**
 * Material 3 Expressive motion uses different spring families for spatial
 * movement and visual effects. Spatial springs can overshoot; effects springs
 * are critically damped so opacity/color/elevation settle without bounce.
 *
 * We model a unit-mass damped oscillator and sample it into Web Animations
 * keyframes. This keeps React components independent from an animation library.
 */
export const MATERIAL_SPRINGS: Record<MaterialSpringName, SpringConfig> = {
  spatialFast: { dampingRatio: 0.6, stiffness: 800, maxDurationMs: 520 },
  spatialDefault: { dampingRatio: 0.8, stiffness: 380, maxDurationMs: 720 },
  spatialSlow: { dampingRatio: 0.8, stiffness: 200, maxDurationMs: 980 },
  effectsFast: { dampingRatio: 1, stiffness: 3800, maxDurationMs: 220 },
  effectsDefault: { dampingRatio: 1, stiffness: 1600, maxDurationMs: 320 },
  effectsSlow: { dampingRatio: 1, stiffness: 800, maxDurationMs: 460 }
};

function springPosition(timeSeconds: number, config: SpringConfig) {
  const zeta = config.dampingRatio;
  const omega0 = Math.sqrt(config.stiffness);

  if (zeta < 1) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    const envelope = Math.exp(-zeta * omega0 * timeSeconds);
    const ratio = zeta / Math.sqrt(1 - zeta * zeta);
    return 1 - envelope * (
      Math.cos(omegaD * timeSeconds) + ratio * Math.sin(omegaD * timeSeconds)
    );
  }

  if (zeta === 1) {
    const envelope = Math.exp(-omega0 * timeSeconds);
    return 1 - envelope * (1 + omega0 * timeSeconds);
  }

  const root = Math.sqrt(zeta * zeta - 1);
  const r1 = -omega0 * (zeta - root);
  const r2 = -omega0 * (zeta + root);
  const c2 = r1 / (r1 - r2);
  const c1 = 1 - c2;
  return 1 - c1 * Math.exp(r1 * timeSeconds) - c2 * Math.exp(r2 * timeSeconds);
}

function settled(position: number, previous: number) {
  return Math.abs(1 - position) < 0.0015 && Math.abs(position - previous) < 0.001;
}

export function sampleMaterialSpring(
  name: MaterialSpringName,
  samples = 48
): { progress: number[]; duration: number } {
  const config = MATERIAL_SPRINGS[name];
  const maxSeconds = config.maxDurationMs / 1000;
  let durationSeconds = maxSeconds;
  let previous = 0;

  for (let t = 1 / 120; t <= maxSeconds; t += 1 / 120) {
    const position = springPosition(t, config);
    if (t > 0.08 && settled(position, previous)) {
      durationSeconds = t;
      break;
    }
    previous = position;
  }

  const progress = Array.from({ length: samples }, (_, index) => {
    const normalized = samples === 1 ? 1 : index / (samples - 1);
    return springPosition(normalized * durationSeconds, config);
  });

  progress[0] = 0;
  progress[progress.length - 1] = 1;

  return {
    progress,
    duration: Math.round(durationSeconds * 1000)
  };
}

export function animateMaterialSpring(
  element: Element,
  name: MaterialSpringName,
  frame: (progress: number) => Keyframe,
  options: Omit<KeyframeAnimationOptions, "duration" | "easing"> = {}
) {
  if (typeof window === "undefined") return undefined;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

  const { progress, duration } = sampleMaterialSpring(name);
  return element.animate(progress.map(frame), {
    duration,
    easing: "linear",
    fill: "both",
    ...options
  });
}
