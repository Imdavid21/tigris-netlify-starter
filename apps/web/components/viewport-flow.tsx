"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { motionSpring } from "@/lib/motion-system";

type Props = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 18, scale: 0.992 },
  whileInView: { opacity: 1, y: 0, scale: 1 },
  viewport: { once: true, amount: 0.12 as const },
  transition: { ...motionSpring.spatialDefault, delay }
});

export function FlowSection({ children, className, delay = 0 }: Props) {
  return <motion.section className={className} {...reveal(delay)} layout>{children}</motion.section>;
}

export function FlowDiv({ children, className, delay = 0 }: Props) {
  return <motion.div className={className} {...reveal(delay)} layout>{children}</motion.div>;
}
