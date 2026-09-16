"use client";

import { AnimatePresence, MotionConfig, motion, useScroll, useSpring } from "motion/react";
import { usePathname } from "next/navigation";
import { routeVariants } from "@/lib/motion-system";

export function AppMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 380,
    damping: 42,
    mass: 0.7,
    restDelta: 0.001
  });

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          zIndex: 120,
          transformOrigin: "0% 50%",
          scaleX: smoothProgress,
          background: "var(--md-sys-color-primary)",
          pointerEvents: "none"
        }}
      />

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={pathname}
          variants={routeVariants}
          initial="initial"
          animate="enter"
          exit="exit"
          style={{ minHeight: "100vh", willChange: "transform, opacity, filter" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}
