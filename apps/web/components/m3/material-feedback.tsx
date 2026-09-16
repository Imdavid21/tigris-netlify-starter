"use client";

import { createElement, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMaterialWebReady } from "@/components/material-web-provider";
import { motionSpring } from "@/lib/motion-system";

type ProgressProps = {
  value?: number;
  indeterminate?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function MaterialLinearProgress({ value, indeterminate = false, ariaLabel = "Loading", className = "" }: ProgressProps) {
  const ready = useMaterialWebReady();
  const safe = value === undefined ? undefined : Math.max(0, Math.min(1, value));

  if (ready) {
    return createElement("md-linear-progress", {
      className,
      value: safe,
      indeterminate,
      "aria-label": ariaLabel
    });
  }

  return (
    <div
      className={className}
      role="progressbar"
      aria-label={ariaLabel}
      style={{
        position: "relative",
        height: 4,
        overflow: "hidden",
        borderRadius: 999,
        background: "var(--md-sys-color-surface-container-highest)"
      }}
    >
      <motion.div
        initial={false}
        animate={indeterminate ? { x: ["-80%", "280%"], width: "35%" } : { width: `${(safe ?? 0) * 100}%`, x: 0 }}
        transition={indeterminate ? { duration: 1.05, repeat: Infinity, ease: "easeInOut" } : motionSpring.spatialDefault}
        style={{ height: "100%", background: "var(--md-sys-color-primary)" }}
      />
    </div>
  );
}

export function MaterialCircularProgress({ indeterminate = true, value, ariaLabel = "Loading", className = "" }: ProgressProps) {
  const ready = useMaterialWebReady();
  const safe = value === undefined ? undefined : Math.max(0, Math.min(1, value));

  if (ready) {
    return createElement("md-circular-progress", {
      className,
      value: safe,
      indeterminate,
      "aria-label": ariaLabel
    });
  }

  return (
    <motion.span
      className={className}
      role="progressbar"
      aria-label={ariaLabel}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.85, repeat: Infinity, ease: "linear" }}
      style={{
        width: 28,
        height: 28,
        display: "inline-block",
        border: "3px solid var(--md-sys-color-surface-container-highest)",
        borderTopColor: "var(--md-sys-color-primary)",
        borderRadius: "50%"
      }}
    />
  );
}

export function MaterialDivider({ className = "" }: { className?: string }) {
  const ready = useMaterialWebReady();
  return ready
    ? createElement("md-divider", { className })
    : <hr className={className} style={{ border: 0, borderTop: "1px solid var(--md-sys-color-outline-variant)" }} />;
}

export function MaterialBusy({ busy, label = "Working", children }: { busy: boolean; label?: string; children?: ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <AnimatePresence mode="popLayout" initial={false}>
        {busy && (
          <motion.span
            key="busy"
            initial={{ opacity: 0, scale: 0.55, width: 0 }}
            animate={{ opacity: 1, scale: 1, width: 20 }}
            exit={{ opacity: 0, scale: 0.55, width: 0 }}
            transition={motionSpring.spatialFast}
            style={{ display: "inline-flex", overflow: "hidden" } as CSSProperties}
          >
            <MaterialCircularProgress ariaLabel={label} />
          </motion.span>
        )}
      </AnimatePresence>
      <motion.span layout="position">{children ?? label}</motion.span>
    </span>
  );
}
