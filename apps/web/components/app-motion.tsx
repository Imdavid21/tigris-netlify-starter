"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { routeVariants } from "@/lib/motion-system";

export function AppMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <MotionConfig reducedMotion="user">
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
