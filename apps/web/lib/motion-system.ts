import type { Transition, Variants } from "motion/react";

function damping(stiffness: number, ratio: number, mass = 1) {
  return 2 * ratio * Math.sqrt(stiffness * mass);
}

export const motionSpring = {
  spatialFast: {
    type: "spring",
    stiffness: 800,
    damping: damping(800, 0.6),
    mass: 1
  },
  spatialDefault: {
    type: "spring",
    stiffness: 380,
    damping: damping(380, 0.8),
    mass: 1
  },
  spatialSlow: {
    type: "spring",
    stiffness: 200,
    damping: damping(200, 0.8),
    mass: 1
  },
  effectsFast: {
    type: "spring",
    stiffness: 3800,
    damping: damping(3800, 1),
    mass: 1
  },
  effectsDefault: {
    type: "spring",
    stiffness: 1600,
    damping: damping(1600, 1),
    mass: 1
  },
  effectsSlow: {
    type: "spring",
    stiffness: 800,
    damping: damping(800, 1),
    mass: 1
  }
} satisfies Record<string, Transition>;

export const routeVariants: Variants = {
  initial: {
    opacity: 0,
    y: 10,
    scale: 0.996,
    filter: "blur(4px)"
  },
  enter: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      ...motionSpring.spatialDefault,
      opacity: motionSpring.effectsFast,
      filter: motionSpring.effectsFast
    }
  },
  exit: {
    opacity: 0,
    y: -5,
    scale: 0.998,
    filter: "blur(2px)",
    transition: {
      ...motionSpring.spatialFast,
      opacity: motionSpring.effectsFast,
      filter: motionSpring.effectsFast
    }
  }
};

export const flowContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.02
    }
  }
};

export const flowItem: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      ...motionSpring.spatialDefault,
      opacity: motionSpring.effectsFast
    }
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.99,
    transition: motionSpring.spatialFast
  }
};

export const pressMotion = {
  whileHover: { y: -2, scale: 1.006 },
  whileTap: { y: 0, scale: 0.985 },
  transition: motionSpring.spatialFast
};
