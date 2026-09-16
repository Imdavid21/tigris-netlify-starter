"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { motionSpring } from "@/lib/motion-system";
import styles from "./M3.module.css";

type ButtonVariant = "filled" | "tonal" | "outlined" | "text" | "elevated";

type MotionButtonProps = ComponentPropsWithoutRef<typeof motion.button>;

type M3ButtonProps = MotionButtonProps & {
  variant?: ButtonVariant;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

export function M3Button({
  variant = "filled",
  leadingIcon,
  trailingIcon,
  className = "",
  children,
  disabled,
  ...props
}: M3ButtonProps) {
  return (
    <motion.button
      className={`${styles.button} ${styles[variant]} ${className}`.trim()}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -1, scale: 1.006 }}
      whileTap={disabled ? undefined : { y: 0, scale: 0.975 }}
      transition={motionSpring.spatialFast}
      {...props}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </motion.button>
  );
}

export function M3IconButton({
  className = "",
  children,
  disabled,
  ...props
}: MotionButtonProps) {
  return (
    <motion.button
      className={`${styles.iconButton} ${className}`.trim()}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.07, rotate: 2 }}
      whileTap={disabled ? undefined : { scale: 0.9, rotate: 0 }}
      transition={motionSpring.spatialFast}
      {...props}
    >
      {children}
    </motion.button>
  );
}

type M3ChipProps = MotionButtonProps & {
  selected?: boolean;
};

export function M3Chip({
  selected = false,
  className = "",
  children,
  disabled,
  ...props
}: M3ChipProps) {
  return (
    <motion.button
      layout
      className={`${styles.chip} ${selected ? styles.selected : ""} ${className}`.trim()}
      aria-pressed={selected}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      transition={{ layout: motionSpring.spatialFast, ...motionSpring.spatialFast }}
      {...props}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {selected && (
          <motion.span
            key="check"
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.4, width: 0 }}
            animate={{ opacity: 1, scale: 1, width: "auto" }}
            exit={{ opacity: 0, scale: 0.4, width: 0 }}
            transition={motionSpring.spatialFast}
          >✓</motion.span>
        )}
      </AnimatePresence>
      <motion.span layout="position">{children}</motion.span>
    </motion.button>
  );
}
