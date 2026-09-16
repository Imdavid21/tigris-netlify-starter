"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { motionSpring } from "@/lib/motion-system";

type Item = { href: string; label: string };

export function MotionNav({
  items,
  className,
  ariaLabel,
  id = "primary"
}: {
  items: Item[];
  className?: string;
  ariaLabel: string;
  id?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className={className} aria-label={ariaLabel}>
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== "/explore" && pathname.startsWith(item.href + "/"));
        return (
          <motion.a
            href={item.href}
            key={item.href}
            whileTap={{ scale: .95 }}
            transition={motionSpring.spatialFast}
            animate={{ color: active ? "var(--md-sys-color-on-surface)" : "var(--md-sys-color-on-surface-variant)" }}
            style={{ position: "relative", isolation: "isolate", overflow: "hidden" }}
          >
            {active && (
              <motion.span
                layoutId={`${id}-active-destination`}
                aria-hidden="true"
                transition={motionSpring.spatialDefault}
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: -1,
                  borderRadius: "var(--md-sys-shape-corner-full)",
                  background: "var(--md-sys-color-secondary-container)"
                }}
              />
            )}
            <span>{item.label}</span>
          </motion.a>
        );
      })}
    </nav>
  );
}
