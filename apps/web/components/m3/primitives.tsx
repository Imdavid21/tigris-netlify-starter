"use client";

import { createElement, type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion } from "motion/react";
import { useMaterialWebReady } from "@/components/material-web-provider";
import { motionSpring } from "@/lib/motion-system";
import styles from "./M3.module.css";

type ButtonVariant = "filled" | "tonal" | "outlined" | "text" | "elevated";

type NativeButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
};

type M3ButtonProps = NativeButtonProps & {
  variant?: ButtonVariant;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

const buttonTags: Record<ButtonVariant, string> = {
  filled: "md-filled-button",
  tonal: "md-filled-tonal-button",
  outlined: "md-outlined-button",
  text: "md-text-button",
  elevated: "md-elevated-button"
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
  const ready = useMaterialWebReady();

  return (
    <motion.span
      className={styles.motionHost}
      whileHover={disabled ? undefined : { y: -1, scale: 1.006 }}
      whileTap={disabled ? undefined : { y: 0, scale: 0.975 }}
      transition={motionSpring.spatialFast}
    >
      {ready
        ? createElement(
            buttonTags[variant],
            {
              ...props,
              disabled,
              className: `${styles.materialButton} ${className}`.trim()
            },
            leadingIcon,
            children,
            trailingIcon
          )
        : (
          <button
            className={`${styles.button} ${styles[variant]} ${className}`.trim()}
            disabled={disabled}
            {...props}
          >
            {leadingIcon}
            {children}
            {trailingIcon}
          </button>
        )}
    </motion.span>
  );
}

export function M3IconButton({
  className = "",
  children,
  disabled,
  ...props
}: NativeButtonProps) {
  const ready = useMaterialWebReady();

  return (
    <motion.span
      className={styles.motionHost}
      whileHover={disabled ? undefined : { scale: 1.07, rotate: 2 }}
      whileTap={disabled ? undefined : { scale: 0.9, rotate: 0 }}
      transition={motionSpring.spatialFast}
    >
      {ready
        ? createElement(
            "md-icon-button",
            {
              ...props,
              disabled,
              className: `${styles.materialIconButton} ${className}`.trim()
            },
            children
          )
        : (
          <button
            className={`${styles.iconButton} ${className}`.trim()}
            disabled={disabled}
            {...props}
          >
            {children}
          </button>
        )}
    </motion.span>
  );
}

type M3ChipProps = NativeButtonProps & {
  selected?: boolean;
};

export function M3Chip({
  selected = false,
  className = "",
  children,
  disabled,
  ...props
}: M3ChipProps) {
  const ready = useMaterialWebReady();

  return (
    <motion.span
      layout
      className={styles.motionHost}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      transition={{ layout: motionSpring.spatialFast, ...motionSpring.spatialFast }}
    >
      {ready
        ? createElement(
            "md-filter-chip",
            {
              ...props,
              selected,
              disabled,
              className: `${styles.materialChip} ${className}`.trim()
            },
            children
          )
        : (
          <button
            className={`${styles.chip} ${selected ? styles.selected : ""} ${className}`.trim()}
            aria-pressed={selected}
            disabled={disabled}
            {...props}
          >
            {selected && <span aria-hidden="true">✓</span>}
            {children}
          </button>
        )}
    </motion.span>
  );
}
